export function assignmentState(assignment,docs,now=Date.now()){
 const submissions=docs.filter(d=>d.kind==='submission'&&d.payload.assignmentId===assignment.id);
 const latest=submissions.sort((a,b)=>b.created_at.localeCompare(a.created_at))[0];
 const review=latest&&docs.find(d=>d.kind==='review'&&d.payload.submissionId===latest.id);
 if(review)return review.payload.result==='retry'?'再練習':'確認済み';
 if(latest)return '提出済み';
 if(assignment.payload.rescheduleTo)return '振替の相談中';
 if(!assignment.payload.acceptedAt)return '合意待ち';
 return new Date(assignment.payload.dueAt).getTime()<now?'未実施・振替待ち':'合意済み';
}
export function latestIssueMemo(docs,targetId){return docs.filter(d=>d.kind==='practice'&&d.payload.targetId===targetId).sort((a,b)=>b.created_at.localeCompare(a.created_at))[0]?.payload.nextMemo||'';}
export function appendCalendarEvent({title,start,minutes=15,note=''}){
 const stamp=d=>new Date(d).toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');
 const escape=t=>String(t).replace(/\\/g,'\\\\').replace(/\n/g,'\\n').replace(/,/g,'\\,').replace(/;/g,'\\;');
 return ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//tone//practice//JA','BEGIN:VEVENT',`UID:${crypto.randomUUID()}@tone`, `DTSTAMP:${stamp(Date.now())}`,`DTSTART:${stamp(start)}`,`DTEND:${stamp(new Date(start).getTime()+minutes*60000)}`,`SUMMARY:${escape(title)}`,`DESCRIPTION:${escape(note)}`,'BEGIN:VALARM','TRIGGER:-PT5M','ACTION:DISPLAY','DESCRIPTION:練習の時間です','END:VALARM','END:VEVENT','END:VCALENDAR'].join('\r\n');
}
export function validatePublicConfig(url,key){
 let parsed;try{parsed=new URL(url)}catch{return 'Supabase のプロジェクト URL を確認してください。'}
 if(parsed.protocol!=='https:'&&parsed.hostname!=='localhost'&&parsed.hostname!=='127.0.0.1')return 'HTTPS のプロジェクト URL を入力してください。';
 if(key.startsWith('sb_secret_'))return 'secret キーは入力できません。publishable または anon キーを使ってください。';
 if(key.startsWith('sb_publishable_'))return '';
 try{const part=key.split('.')[1].replace(/-/g,'+').replace(/_/g,'/');const payload=JSON.parse(atob(part));if(payload.role==='anon')return '';}catch{}
 return '公開用の publishable / anon キーを入力してください。service_role キーは使用できません。';
}
export const noteNames=['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
export function pitchName(midi){return noteNames[((midi%12)+12)%12]+(Math.floor(midi/12)-1);}
export function measurementSummary(items){return items.map(d=>({id:d.id,...d.payload})).sort((a,b)=>new Date(a.date)-new Date(b.date));}
