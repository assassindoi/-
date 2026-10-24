import {createClient} from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';
import {reminderEvents,isPushSubscription} from './events.js';
// Deploy with JWT verification off; a separate scheduler secret is mandatory.
Deno.serve(async(req:Request)=>{
 const expected=Deno.env.get('TONE_CRON_SECRET');
 if(req.method!=='POST'||!expected||req.headers.get('x-tone-cron-secret')!==expected)return new Response('Unauthorized',{status:401});
 const publicKey=Deno.env.get('VAPID_PUBLIC_KEY'),privateKey=Deno.env.get('VAPID_PRIVATE_KEY'),contact=Deno.env.get('VAPID_CONTACT');
 if(!publicKey||!privateKey||!contact)return new Response('Push server is not configured',{status:503});
 webpush.setVapidDetails(contact,publicKey,privateKey);
 const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
 // Reclaim a pending delivery if an earlier invocation stopped before sending.
 await db.from('tone_push_deliveries').delete().is('delivered_at',null).lt('created_at',new Date(Date.now()-5*60000).toISOString());
 async function readAll(table:string,fields='*'){const rows:any[]=[];for(let offset=0;;offset+=500){const {data,error}=await db.from(table).select(fields).range(offset,offset+499);if(error)throw error;rows.push(...data);if(data.length<500)return {data:rows}}}
 let documents,memberships,subscriptions;try{[documents,memberships,subscriptions]=await Promise.all([readAll('tone_docs','id,room_id,kind,payload,created_at'),readAll('tone_members'),readAll('tone_push_subscriptions')])}catch{return new Response('Unable to load reminder data',{status:500})}
 const events=reminderEvents(documents.data||[],memberships.data);
 let sent=0,failed=0;
 for(const event of events)for(const sub of subscriptions.data.filter(s=>s.user_id===event.userId)){
  if(!isPushSubscription(sub.subscription,sub.endpoint)){failed++;continue}
  const key=event.key+':'+sub.id;const claim=await db.from('tone_push_deliveries').insert({event_key:key});if(claim.error){if(claim.error.code!=='23505')failed++;continue}
  try{await webpush.sendNotification(sub.subscription,JSON.stringify({title:event.title,body:event.body,tag:event.key}),{TTL:900});await db.from('tone_push_deliveries').update({delivered_at:new Date().toISOString()}).eq('event_key',key);sent++}catch(error){failed++;if((error as {statusCode?:number}).statusCode===404||(error as {statusCode?:number}).statusCode===410)await db.from('tone_push_subscriptions').delete().eq('id',sub.id);await db.from('tone_push_deliveries').delete().eq('event_key',key)}
 }
 return Response.json({sent,failed});
});
