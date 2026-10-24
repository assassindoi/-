-- Run once in a new Supabase project's SQL editor. No secret values belong here.
create table if not exists public.tone_rooms (
 id uuid primary key default gen_random_uuid(), name text not null,
 teacher_id uuid not null references auth.users(id), invite_code text not null unique default replace(gen_random_uuid()::text,'-',''),
 created_at timestamptz not null default now()
);
create table if not exists public.tone_members (
 room_id uuid not null references public.tone_rooms(id) on delete cascade,
 user_id uuid not null references auth.users(id), role text not null check (role in ('teacher','student')),
 display_name text not null, primary key(room_id,user_id)
);
create table if not exists public.tone_docs (
 id text primary key, room_id uuid not null references public.tone_rooms(id) on delete cascade,
 author_id uuid not null default auth.uid() references auth.users(id),
 kind text not null check(kind in ('assignment','submission','review','issue','roadmap','assessment','audioMeta','practice','asset','weekly')),
 payload jsonb not null default '{}', version integer not null default 1,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create or replace function public.tone_role(room uuid) returns text language sql stable security definer set search_path=public as $$
 select role from public.tone_members where room_id=room and user_id=auth.uid()
$$;
revoke all on function public.tone_role(uuid) from public;
grant execute on function public.tone_role(uuid) to authenticated;
alter table public.tone_rooms enable row level security;
alter table public.tone_members enable row level security;
alter table public.tone_docs enable row level security;
drop policy if exists tone_room_read on public.tone_rooms;
create policy tone_room_read on public.tone_rooms for select to authenticated using (public.tone_role(id) is not null);
drop policy if exists tone_member_read on public.tone_members;
create policy tone_member_read on public.tone_members for select to authenticated using (public.tone_role(room_id) is not null);
drop policy if exists tone_doc_read on public.tone_docs;
create policy tone_doc_read on public.tone_docs for select to authenticated using (public.tone_role(room_id) is not null);
drop policy if exists tone_doc_insert on public.tone_docs;
create policy tone_doc_insert on public.tone_docs for insert to authenticated with check (
 author_id=auth.uid() and (public.tone_role(room_id)='teacher' or
 (public.tone_role(room_id)='student' and kind in ('submission','practice','assessment','asset')))
);
drop policy if exists tone_doc_update on public.tone_docs;
create policy tone_doc_update on public.tone_docs for update to authenticated using (
 public.tone_role(room_id)='teacher' or (public.tone_role(room_id)='student' and (kind='assignment' or (author_id=auth.uid() and kind in ('assessment','asset'))))
) with check (public.tone_role(room_id) is not null);
drop policy if exists tone_doc_delete on public.tone_docs;
create policy tone_doc_delete on public.tone_docs for delete to authenticated using (public.tone_role(room_id)='teacher' or (author_id=auth.uid() and kind in ('assessment','asset')));
create or replace function public.tone_validate_doc() returns trigger language plpgsql set search_path=public as $$
declare role_name text; assignment_row public.tone_docs;
begin
 role_name:=public.tone_role(new.room_id);
 if tg_op='UPDATE' then
  if new.id<>old.id or new.room_id<>old.room_id or new.kind<>old.kind or new.author_id<>old.author_id then raise exception 'Document identity cannot be changed'; end if;
  if role_name='student' and new.kind='assignment' then
   if (new.payload - array['acceptedAt','reminderConsent']) <> (old.payload - array['acceptedAt','reminderConsent']) then raise exception 'Only the teacher can change the practice requirements'; end if;
  end if;
  new.version:=old.version+1;
  new.created_at:=old.created_at;
 else
  new.version:=1;
  new.created_at:=now();
 end if;
 if new.kind='assignment' then
  if role_name='teacher' and coalesce(new.payload->>'acceptedAt','')<>'' and (tg_op='INSERT' or new.payload->'acceptedAt' is distinct from old.payload->'acceptedAt') then raise exception 'Only the student can agree to a practice'; end if;
  if tg_op='UPDATE' and role_name='teacher' and (new.payload - array['acceptedAt','reminderConsent']) <> (old.payload - array['acceptedAt','reminderConsent']) then
   new.payload:=new.payload || '{"acceptedAt":null,"reminderConsent":false}'::jsonb;
  end if;
  if role_name='student' and coalesce(new.payload->>'acceptedAt','')<>'' and new.payload->'acceptedAt' is distinct from old.payload->'acceptedAt' then new.payload:=jsonb_set(new.payload,'{acceptedAt}',to_jsonb(now())); end if;
 end if;
 if new.kind='assessment' then new.payload:=jsonb_set(new.payload,'{measuredBy}',to_jsonb(case when role_name='teacher' then '先生'::text else 'しま'::text end)); end if;
 if new.kind='asset' then
  if split_part(new.payload->>'path','/',1)<>new.room_id::text or split_part(new.payload->>'path','/',2)<>new.author_id::text then raise exception 'File must belong to this room and author'; end if;
  if not exists(select 1 from storage.objects where bucket_id='tone-room-assets' and name=new.payload->>'path') then raise exception 'Uploaded file not found'; end if;
 end if;
 if new.kind='submission' then
  select * into assignment_row from public.tone_docs where id=new.payload->>'assignmentId' and room_id=new.room_id and kind='assignment';
  if assignment_row.id is null or coalesce(assignment_row.payload->>'acceptedAt','')='' then raise exception 'Agree to the practice before submitting'; end if;
  if coalesce(new.payload->>'assetId','')='' then raise exception 'A recording is required'; end if;
  if not exists (select 1 from public.tone_docs where id=new.payload->>'assetId' and room_id=new.room_id and kind='asset' and payload->>'type' like 'audio/%' and (role_name='teacher' or author_id=auth.uid())) then raise exception 'Recording asset not found'; end if;
 end if;
 if new.kind='review' and not exists (select 1 from public.tone_docs where id=new.payload->>'submissionId' and room_id=new.room_id and kind='submission') then raise exception 'Submission not found'; end if;
 new.updated_at:=now();
 return new;
end $$;
drop trigger if exists tone_validate_doc_trigger on public.tone_docs;
create trigger tone_validate_doc_trigger before insert or update on public.tone_docs for each row execute function public.tone_validate_doc();
create or replace function public.tone_create_room(room_name text) returns uuid language plpgsql security definer set search_path=public as $$
declare room uuid;
begin
 if auth.uid() is null then raise exception 'Sign in first'; end if;
 if length(trim(room_name))<1 or length(room_name)>100 then raise exception 'Invalid room name'; end if;
 insert into public.tone_rooms(name,teacher_id) values(room_name,auth.uid()) returning id into room;
 insert into public.tone_members values(room,auth.uid(),'teacher','先生');
 return room;
end $$;
create or replace function public.tone_join_room(code text) returns uuid language plpgsql security definer set search_path=public as $$
declare room uuid;
begin
 if auth.uid() is null then raise exception 'Sign in first'; end if;
 select id into room from public.tone_rooms where invite_code=code;
 if room is null then raise exception 'Invite code not found'; end if;
 if exists(select 1 from public.tone_members where room_id=room and role='student' and user_id<>auth.uid()) then raise exception 'This room already has a student'; end if;
 insert into public.tone_members values(room,auth.uid(),'student','しま') on conflict do nothing;
 return room;
end $$;
revoke all on function public.tone_create_room(text) from public;
revoke all on function public.tone_join_room(text) from public;
grant execute on function public.tone_create_room(text),public.tone_join_room(text) to authenticated;
grant select on public.tone_rooms,public.tone_members to authenticated;
grant select,insert,update,delete on public.tone_docs to authenticated;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('tone-room-assets','tone-room-assets',false,104857600,array['audio/*','video/*','image/*']) on conflict(id) do nothing;
drop policy if exists tone_asset_read on storage.objects;
create policy tone_asset_read on storage.objects for select to authenticated using(bucket_id='tone-room-assets' and public.tone_role(((storage.foldername(name))[1])::uuid) is not null);
drop policy if exists tone_asset_insert on storage.objects;
create policy tone_asset_insert on storage.objects for insert to authenticated with check(bucket_id='tone-room-assets' and public.tone_role(((storage.foldername(name))[1])::uuid) is not null and (storage.foldername(name))[2]=auth.uid()::text);
drop policy if exists tone_asset_delete on storage.objects;
create policy tone_asset_delete on storage.objects for delete to authenticated using(bucket_id='tone-room-assets' and (public.tone_role(((storage.foldername(name))[1])::uuid)='teacher' or (public.tone_role(((storage.foldername(name))[1])::uuid)='student' and (storage.foldername(name))[2]=auth.uid()::text and not exists(select 1 from public.tone_docs a join public.tone_docs r on r.payload->>'assetId'=a.id where a.kind='asset' and a.payload->>'path'=storage.objects.name and r.kind in ('submission','practice')))));
-- Optional background notifications. Endpoint/subscription data is private per user.
create table if not exists public.tone_push_subscriptions (
 id uuid primary key default gen_random_uuid(),user_id uuid not null default auth.uid() references auth.users(id),
 endpoint text not null unique, subscription jsonb not null,created_at timestamptz not null default now()
);
alter table public.tone_push_subscriptions enable row level security;
drop policy if exists tone_push_self on public.tone_push_subscriptions;
create policy tone_push_self on public.tone_push_subscriptions for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
grant select,insert,update,delete on public.tone_push_subscriptions to authenticated;
create table if not exists public.tone_push_deliveries(event_key text primary key,created_at timestamptz not null default now(),delivered_at timestamptz);
alter table public.tone_push_deliveries enable row level security;
-- No client policies: only the server service role can read/write delivery deduplication.

alter table public.tone_push_deliveries add column if not exists delivered_at timestamptz;

create unique index if not exists tone_one_audio_meta on public.tone_docs(room_id,(payload->>'targetId')) where kind='audioMeta';
create unique index if not exists tone_one_roadmap on public.tone_docs(room_id,(payload->>'targetId')) where kind='roadmap';
create unique index if not exists tone_one_review on public.tone_docs(room_id,(payload->>'submissionId')) where kind='review';
