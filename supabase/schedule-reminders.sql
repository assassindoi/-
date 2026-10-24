-- Optional; run after enabling pg_cron / pg_net and configuring the Edge Function.
-- In Supabase Vault, create two values through its secure UI:
-- tone_supabase_url : https://YOUR-PROJECT.supabase.co
-- tone_cron_secret  : the same private value as the function's TONE_CRON_SECRET
-- Do not paste secret values into this file or into chat.
select cron.schedule(
 'tone-practice-reminders',
 '* * * * *',
 $$
 select net.http_post(
  url:=(select decrypted_secret from vault.decrypted_secrets where name='tone_supabase_url')||'/functions/v1/tone-reminders',
  headers:=jsonb_build_object('Content-Type','application/json','x-tone-cron-secret',(select decrypted_secret from vault.decrypted_secrets where name='tone_cron_secret')),
  body:='{}'::jsonb
 );
 $$
);
