import {useEffect,useMemo,useState,useCallback,useRef} from 'react';
import {createClient} from '@supabase/supabase-js';
import {localMedia} from './media';
const LOCAL='tone-studio-docs-v1';
async function readDocuments(client,roomId){const rows=[];for(let offset=0;;offset+=500){const result=await client.from('tone_docs').select('*').eq('room_id',roomId).order('created_at').order('id').range(offset,offset+499);if(result.error)throw result.error;rows.push(...result.data);if(result.data.length<500)return rows}}
export function useStudio(){
 const [config,setConfig]=useState(()=>{try{return JSON.parse(localStorage.getItem('tone-studio-cloud'))}catch{return null}});
 const client=useMemo(()=>config?createClient(config.url,config.key):null,[config]);
 const [session,setSession]=useState(null),[room,setRoom]=useState(null),[role,setRole]=useState('teacher'),[docs,setDocs]=useState([]),[error,setError]=useState(''),[loading,setLoading]=useState(false);
 const sessionRef=useRef(session),clientRef=useRef(client);sessionRef.current=session;clientRef.current=client;
 const cloud=!!client,uid=cloud?session?.user.id:'local-'+role;
 const refresh=useCallback(async()=>{try{if(!client){setDocs(JSON.parse(localStorage.getItem(LOCAL)||'[]'));return}if(!session)return;const memberships=await client.from('tone_members').select('room_id,role').eq('user_id',session.user.id);if(memberships.error)throw memberships.error;const member=memberships.data[0];if(!member){if(sessionRef.current?.user.id===session.user.id&&clientRef.current===client){setRoom(null);setDocs([])}return}const r=await client.from('tone_rooms').select('*').eq('id',member.room_id).single();if(r.error)throw r.error;const data=await readDocuments(client,member.room_id);if(sessionRef.current?.user.id!==session.user.id||clientRef.current!==client)return;setRoom(r.data);setRole(member.role);setDocs(data);setError('')}catch(e){setError('共有先との接続に失敗しました：'+e.message)}},[client,session]);
 useEffect(()=>{if(!client){setRoom(null);setSession(null);refresh();return}client.auth.getSession().then(({data,error})=>{if(error)setError(error.message);setSession(data.session)});const {data}=client.auth.onAuthStateChange((_event,s)=>{setSession(s)});return()=>data.subscription.unsubscribe()},[client]);
 useEffect(()=>{refresh();if(!client)return;const timer=setInterval(refresh,15000);return()=>clearInterval(timer)},[refresh,client]);
 useEffect(()=>{if(!client||!room)return;const channel=client.channel('tone-'+room.id).on('postgres_changes',{event:'*',schema:'public',table:'tone_docs',filter:'room_id=eq.'+room.id},()=>refresh()).subscribe();return()=>{client.removeChannel(channel)}},[client,room?.id,refresh]);
 async function save(kind,payload,id){
  const existing=docs.find(d=>d.id===id);const row={id:id||crypto.randomUUID(),kind,payload,room_id:room?.id||'local',author_id:existing?.author_id||uid};
  if(cloud){if(!session||!room)throw new Error('ログインして共有ルームを作成・参加してください。');let query;if(existing)query=client.from('tone_docs').update({payload}).eq('id',id).eq('version',existing.version).select().single();else query=client.from('tone_docs').insert(row).select().single();const {data,error}=await query;if(error)throw new Error(error.code==='PGRST116'?'別の端末で更新されました。更新ボタンを押してからやり直してください。':error.message);setDocs(current=>[...current.filter(d=>d.id!==data.id),data]);return data;}
  const current=JSON.parse(localStorage.getItem(LOCAL)||'[]');const stored=current.find(d=>d.id===id);if(existing&&stored&&existing.version!==stored.version)throw new Error('別の画面で更新されました。更新してからやり直してください。');
  const data={...row,version:(stored?.version||0)+1,created_at:stored?.created_at||new Date().toISOString(),updated_at:new Date().toISOString()};const next=[...current.filter(d=>d.id!==data.id),data];localStorage.setItem(LOCAL,JSON.stringify(next));setDocs(next);return data;
 }
 async function upload(file,usage='recording'){
  if(file.size>100*1024*1024)throw new Error('ファイルは100MB以下にしてください。');
  if(!/^(audio|video|image)\//.test(file.type))throw new Error('音声・動画・画像のファイルを選択してください。');
  const id=crypto.randomUUID(),path=cloud?`${room?.id}/${uid}/${id}`:id;
  if(cloud){if(!room)throw new Error('先に共有ルームに参加してください。');const r=await client.storage.from('tone-room-assets').upload(path,file,{contentType:file.type});if(r.error)throw r.error}else await localMedia('put',id,file);
  try{return await save('asset',{name:file.name,type:file.type,size:file.size,path,usage},id)}catch(e){if(cloud)await client.storage.from('tone-room-assets').remove([path]);else await localMedia('delete',id);throw e}
 }
 async function blobFor(asset){if(!cloud)return localMedia('get',asset.id);const {data,error}=await client.storage.from('tone-room-assets').download(asset.payload.path);if(error)throw error;return data}
 async function login(email){if(!client)throw new Error('共有先を先に設定してください。');const {error}=await client.auth.signInWithOtp({email,options:{emailRedirectTo:location.origin+location.pathname}});if(error)throw error;}
 async function createRoom(){const {error}=await client.rpc('tone_create_room',{room_name:'先生としまのボイトレ'});if(error)throw error;await refresh()}
 async function joinRoom(code){const {error}=await client.rpc('tone_join_room',{code:code.trim()});if(error)throw error;await refresh()}
 async function enablePush(){
  if(!client||!session)throw new Error('共有先にログインしてから有効にしてください。');
  if(!config.vapidPublicKey)throw new Error('共有先設定に通知用のVAPID公開キーを追加してください。');
  if(!('serviceWorker'in navigator)||!('PushManager'in window))throw new Error('このブラウザはバックグラウンド通知に対応していません。カレンダーをご利用ください。');
  if(await Notification.requestPermission()!=='granted')throw new Error('通知の許可が必要です。');
  const registration=await navigator.serviceWorker.register(import.meta.env.BASE_URL+'tone-sw.js');await navigator.serviceWorker.ready;
  const base64=config.vapidPublicKey.replace(/-/g,'+').replace(/_/g,'/');const bytes=Uint8Array.from(atob(base64+'='.repeat((4-base64.length%4)%4)),c=>c.charCodeAt(0));
  const subscription=await registration.pushManager.getSubscription()||await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:bytes});
  const {error}=await client.from('tone_push_subscriptions').upsert({user_id:session.user.id,endpoint:subscription.endpoint,subscription:subscription.toJSON()},{onConflict:'endpoint'});if(error)throw error;
 }
 async function disablePush(){if(!client||!session)return;const {error}=await client.from('tone_push_subscriptions').delete().eq('user_id',session.user.id);if(error)throw error;const registration=await navigator.serviceWorker.getRegistration(import.meta.env.BASE_URL);const sub=await registration?.pushManager.getSubscription();if(sub)await sub.unsubscribe();}
 function configure(next){localStorage.setItem('tone-studio-cloud',JSON.stringify(next));setDocs([]);setSession(null);setRoom(null);setConfig(next)}
 return {enablePush,disablePush,docs,save,upload,blobFor,cloud,role,setRole,uid,session,room,error,loading,refresh,config,configure,login,createRoom,joinRoom,signOut:async()=>{await client.auth.signOut();setRoom(null);setDocs([])},disconnect:async()=>{if(client)await client.auth.signOut();localStorage.removeItem('tone-studio-cloud');setConfig(null);setDocs([]);setSession(null);setRoom(null)}};
}
