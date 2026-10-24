export function reminderEvents(docs,memberships,now=Date.now()){
 const events=[],since=now-15*60000;
 for(const doc of docs){
  const p=doc.payload;
  if(doc.kind==='assignment'&&p.acceptedAt&&p.reminderConsent&&Date.parse(p.dueAt)<=now&&Date.parse(p.dueAt)>=since&&!docs.some(s=>s.kind==='submission'&&s.payload.assignmentId===doc.id)){
   for(const member of memberships.filter(m=>m.room_id===doc.room_id&&m.role==='student'))events.push({key:'practice:'+doc.id+':'+p.dueAt,userId:member.user_id,title:'しまさん、練習の時間です',body:p.title+'：合意した内容を練習室で確認しましょう。'});
  }
  if(doc.kind==='submission'&&Date.parse(doc.created_at)>=since&&Date.parse(doc.created_at)<=now&&!docs.some(r=>r.kind==='review'&&r.payload.submissionId===doc.id)){
   for(const member of memberships.filter(m=>m.room_id===doc.room_id&&m.role==='teacher'))events.push({key:'submission:'+doc.id,userId:member.user_id,title:'しまから録音が届きました',body:'練習室で録音を確認して、フィードバックを返してください。'});
  }
 }
 return events;
}
export function isPushSubscription(subscription,endpoint){
 try{const url=new URL(endpoint);const host=url.hostname;return url.protocol==='https:'&&!url.username&&!url.password&&!url.port&&subscription?.endpoint===endpoint&&typeof subscription.keys?.p256dh==='string'&&typeof subscription.keys?.auth==='string'&&(host==='fcm.googleapis.com'||host==='android.googleapis.com'||host==='web.push.apple.com'||host==='push.services.mozilla.com'||host.endsWith('.push.services.mozilla.com')||host==='notify.windows.com'||host.endsWith('.notify.windows.com'));}catch{return false}
}
