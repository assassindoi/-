import FFT from 'fft.js';
const openDb=()=>new Promise((resolve,reject)=>{const r=indexedDB.open('tone-studio-media',1);r.onupgradeneeded=()=>r.result.createObjectStore('assets');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});
export async function localMedia(action,id,blob){const db=await openDb();return new Promise((resolve,reject)=>{const tx=db.transaction('assets',action==='get'?'readonly':'readwrite');const r=action==='get'?tx.objectStore('assets').get(id):action==='put'?tx.objectStore('assets').put(blob,id):tx.objectStore('assets').delete(id);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);tx.oncomplete=()=>db.close()})}
export async function analyseAudio(blob){
 const context=new AudioContext();
 try{
 const buffer=await context.decodeAudioData(await blob.arrayBuffer());const samples=buffer.getChannelData(0),rate=buffer.sampleRate,size=2048,fft=new FFT(size),out=fft.createComplexArray(),input=new Float64Array(size),power=new Float64Array(size/2);
 const frames=Math.min(48,Math.floor(samples.length/size));if(frames<1)throw new Error('音声が短すぎます。1秒以上の音声を使ってください。');
 let rms=0;for(let j=0;j<frames;j++){const start=Math.floor(j*(samples.length-size)/Math.max(1,frames-1));for(let i=0;i<size;i++){input[i]=samples[start+i]*(.5-.5*Math.cos(2*Math.PI*i/(size-1)));rms+=samples[start+i]**2}fft.realTransform(out,input);for(let k=1;k<size/2;k++)power[k]+=out[2*k]**2+out[2*k+1]**2;}
 const lo=Math.ceil(80*size/rate),hi=Math.min(power.length-1,Math.floor(8000*size/rate));let total=0,weighted=0,logs=0,high=0;for(let k=lo;k<=hi;k++){const v=power[k]/frames+1e-15;total+=v;weighted+=v*k*rate/size;logs+=Math.log(v);if(k*rate/size>=3000)high+=v;}
 const level=Math.sqrt(rms/(frames*size));if(level<.001)throw new Error('音量が小さすぎます。声が入っている録音を選んでください。');
 const flatness=Math.exp(logs/(hi-lo+1))/(total/(hi-lo+1));const centroid=weighted/total,highRatio=high/total;
 let label=flatness>.3?'ノイズ成分が多め（推定）':flatness>.08?'若干ノイズがある傾向（推定）':highRatio>.18?'高域の倍音成分が多め（推定）':'周期性が高い・クリーン寄り（推定）';
 const bins=Array.from({length:128},(_,i)=>{const start=Math.floor(i*hi/128),end=Math.max(start+1,Math.floor((i+1)*hi/128));let sum=0;for(let k=start;k<end;k++)sum+=power[k]||0;return sum/(end-start)});const max=Math.max(...bins,1e-15);const spectrum=bins.map(x=>Math.max(0,1+10*Math.log10(Math.max(x/max,1e-8))/70));
 return {duration:buffer.duration,centroid:Math.round(centroid),flatness:Number(flatness.toFixed(3)),highRatio:Number(highRatio.toFixed(3)),levelDb:Math.round(20*Math.log10(level)),label,spectrum,maxHz:Math.round(hi*rate/size),analysedAt:new Date().toISOString()};
 } finally {await context.close()}
}
export function downloadText(text,name,type='text/plain'){const url=URL.createObjectURL(new Blob([text],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
