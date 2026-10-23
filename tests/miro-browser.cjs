const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 try {
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{if(!localStorage.getItem('miro-test-seeded')){localStorage.setItem('tone-notes',JSON.stringify([{id:'existing-note',title:'元からあるメモ',body:'残す内容',type:'現在の課題',date:'2026-01-01'}]));localStorage.removeItem('tone-miro-summaries-v1');localStorage.setItem('miro-test-seeded','yes')}});
 await page.goto(process.env.APP_URL||'http://localhost:5173');
 await page.getByRole('button',{name:'ノート',exact:true}).click();
 await page.getByRole('heading',{name:'Miroまとめ｜目標と優先方針'}).waitFor();
 assert.equal(await page.locator('.note-card').count(),5);await page.getByRole('heading',{name:'元からあるメモ',exact:true}).waitFor();
 const summary=page.locator('.note-card').filter({has:page.getByRole('heading',{name:'Miroまとめ｜目標と優先方針',exact:true})});
 await summary.getByRole('button',{name:'編集',exact:true}).click();await page.getByLabel('ノート',{exact:true}).fill('自分で更新した方針');await page.getByRole('button',{name:'ノートを保存'}).click();
 await page.reload();await page.getByRole('button',{name:'ノート',exact:true}).click();assert.equal(await page.locator('.note-card').count(),5);await page.getByText('自分で更新した方針',{exact:true}).waitFor();
 // A removed source note should not reappear after reload.
 page.once('dialog',d=>d.accept());await page.locator('.note-card').filter({has:page.getByRole('heading',{name:'Miroまとめ｜次に確認すること',exact:true})}).getByRole('button',{name:'ノートを削除'}).click();await page.reload();await page.getByRole('button',{name:'ノート',exact:true}).click();assert.equal(await page.locator('.note-card').count(),4);
 await page.getByRole('button',{name:'参考音声',exact:true}).click();
 // Library presence is sufficient for note tests; playback is covered by browser.cjs.
 await page.locator('input[type=file]').setInputFiles({name:'個別練習.wav',mimeType:'audio/wav',buffer:Buffer.alloc(44)});
 await page.getByRole('button',{name:'個別練習.wavの発声メモ'}).click();
 await page.getByLabel('発声時の注意点',{exact:true}).fill('自分で書いた大事なメモ');
 await page.getByLabel('この音声の練習名（Miro）').selectOption('long-five');await page.getByRole('button',{name:'この注意点をメモに追加'}).click();
 const note=page.getByLabel('発声時の注意点',{exact:true});const value=await note.inputValue();assert.ok(value.startsWith('自分で書いた大事なメモ'));assert.match(value,/15秒/);await page.getByRole('button',{name:'この注意点をメモに追加'}).click();assert.equal(await note.inputValue(),value);
 await page.reload();await page.getByRole('button',{name:'参考音声',exact:true}).click();await page.getByRole('button',{name:'個別練習.wavの発声メモ'}).click();assert.equal(await page.getByLabel('この音声の練習名（Miro）').inputValue(),'long-five');assert.equal(await page.getByLabel('発声時の注意点',{exact:true}).inputValue(),value);
 await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:'/tmp/tone-miro-mobile.png',fullPage:true});assert.deepEqual(errors,[]);
 console.log('PASS: Miro summary migration preserves notes and edits, no duplicates or resurrection; exercise memo selection, append, deduplication, persistence, mobile layout');
 } finally {await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
