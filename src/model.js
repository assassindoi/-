export const dateKey = (d = new Date()) => new Date(d.getTime() - d.getTimezoneOffset()*60000).toISOString().slice(0,10);
export const initialMenus = [
 {id:'breath',title:'呼吸とウォームアップ',description:'リップロールで、声の準備を整える',category:'基礎',minutes:5,time:'19:00',days:[0,1,2,3,4,5,6],map:'呼吸のコントロール'},
 {id:'resonance',title:'響きのポジションを探す',description:'ハミング → 母音で、響きを前に集める',category:'共鳴',minutes:10,time:'19:05',days:[0,1,2,3,4,5,6],map:'共鳴のポジション'},
 {id:'imitate',title:'理想の音色をトレース',description:'参考音声を聴いて、声の質感をまねる',category:'音色',minutes:15,time:'19:15',days:[0,1,2,3,4,5,6],map:'理想の音色'},
];
export const initialRoadmap = [{id:'r1',title:'呼吸のコントロール',description:'一定の息を、無理なく長く保つ',status:'達成',level:'STEP 01'},{id:'r2',title:'共鳴のポジション',description:'喉に力を入れず、響きを前に集める',status:'練習中',level:'STEP 02'},{id:'r3',title:'理想の音色',description:'参考音声の質感を、自分の声で再現する',status:'これから',level:'STEP 03'},{id:'r4',title:'歌の中で使いこなす',description:'フレーズの中でも自然に再現できる',status:'これから',level:'STEP 04'}];
export function stats(logs) { const today=dateKey(); return {count:logs.length,minutes:logs.reduce((n,x)=>n+Number(x.minutes),0),today:logs.filter(x=>x.date===today).length}; }
export function weekly(logs,now=new Date()){return Array.from({length:7},(_,i)=>{const d=new Date(now);d.setDate(d.getDate()-6+i);const key=dateKey(d);return {key,day:['日','月','火','水','木','金','土'][d.getDay()],minutes:logs.filter(x=>x.date===key).reduce((n,x)=>n+Number(x.minutes),0)}})}
