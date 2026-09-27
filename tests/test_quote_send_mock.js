const { chromium } = require('playwright');
const code = require('fs').readFileSync(require('path').join(__dirname,'..','extension','content.js'), 'utf8');
const stub = `window.chrome={runtime:{getManifest:()=>({version:'6.1.0'}),sendMessage:async(m)=>({success:true,text:'['+m.tl+'] '+m.text})}};`;
const html = `<html><body>
<div data-tid="message-pane-list-runway">
 <div data-tid="chat-pane-item" style="position:relative;width:420px;padding-bottom:30px"><div data-tid="chat-pane-message">
   <blockquote>Old quoted text from John about the render</blockquote>
   <p>I have been editing some model photos recently and cannot see the difference</p>
   <div class="fui-reactions"><span aria-label="1 Laugh reaction">😆 1</span></div>
 </div><div id="pill" style="position:absolute;left:20px;bottom:50px;width:300px;height:24px;background:#333;border-radius:12px">😆</div></div>
</div>
<div data-tid="compose"><div contenteditable="true" aria-label="Type a message" id="ed" style="min-height:40px;width:400px"><blockquote><p>Quoted: please check the facade</p></blockquote><p>x</p></div>
<button data-tid="newMessageCommands-send" aria-label="Send" id="send">Send</button></div>
<div id="sent"></div>
<script>
 const ed=document.getElementById('ed');
 ed.addEventListener('paste',e=>{e.preventDefault();const t=e.clipboardData.getData('text/plain');const r=getSelection().getRangeAt(0);r.deleteContents();const f=document.createDocumentFragment();t.split('\\n').forEach(l=>{const p=document.createElement('p');p.textContent=l;f.appendChild(p)});r.insertNode(f);});
 document.getElementById('send').onclick=()=>{document.getElementById('sent').textContent=ed.innerText;ed.innerHTML='';};
</script></body></html>`;
(async () => {
  const b = await chromium.launch(); const p = await b.newPage(); const errors = [];
  p.on('pageerror', e => errors.push(e.message));
  await p.setContent(html); await p.evaluate(stub + code);
  await p.waitForTimeout(2000);
  const badge = await p.evaluate(() => { const b = document.querySelector('.ttr-badge'); if (!b) return null; const rg = document.createRange(); rg.selectNodeContents(b); const rects = [...rg.getClientRects()]; const pr = document.getElementById('pill').getBoundingClientRect();
    const hit = rects.some(r => r.right > pr.left && r.left < pr.right && r.bottom > pr.top && r.top < pr.bottom);
    return { text: b.textContent, textUnderPill: hit, fixed: b.dataset.ttrFixed || null, pr: b.style.paddingRight, mb: b.style.marginBottom }; });
  // user types own text after quote
  await p.evaluate(() => { const ed = document.getElementById('ed'); ed.lastChild.textContent = 'Chào anh'; const p2 = document.createElement('p'); p2.textContent = 'Em gửi file nhé'; ed.appendChild(p2); });
  await p.click('#ed p:last-child');
  await p.waitForTimeout(1500);
  const prev = await p.evaluate(() => document.getElementById('ttr-prev')?.textContent);
  await p.keyboard.press('Control+Enter');
  await p.waitForTimeout(1500);
  const sent = await p.evaluate(() => document.getElementById('sent').innerText);
  const toast = await p.evaluate(() => document.getElementById('ttr-toast')?.textContent);
  console.log(JSON.stringify({ errors, badge, prev, sent, toast }, null, 1));
  await b.close();
})();
