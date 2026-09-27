const { chromium } = require('playwright');
const fs = require('fs');
const code = fs.readFileSync(require('path').join(__dirname,'..','extension','content.js'), 'utf8');
const stub = `window.chrome={runtime:{getManifest:()=>({version:'6.0.0'}),sendMessage:async(m)=>{window.__calls=(window.__calls||0)+1;return {success:true,text:'['+m.tl+'] '+m.text};}}};`;
const html = `<html><body>
<div data-tid="message-pane-list-runway">
 <div data-tid="chat-pane-item"><div data-tid="chat-pane-message">Please send the updated floor plan tomorrow morning</div></div>
 <div data-tid="chat-pane-item"><div data-tid="chat-pane-message">明日までに図面を送ってください</div></div>
 <div data-tid="chat-pane-item"><div data-tid="chat-pane-message">Anh gửi em bản vẽ mặt bằng nhé</div></div>
</div>
<div data-tid="ckeditor"><div contenteditable="true" aria-label="Type a message" id="ed" style="min-height:40px;width:400px"></div></div>
<iframe id="fr" srcdoc="<html><body><p>other frame content here</p></body></html>" style="width:300px;height:100px"></iframe>
</body></html>`;
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  const errors = [];
  p.on('pageerror', e => errors.push(e.message));
  await p.setContent(html);
  await p.waitForTimeout(300);
  await p.evaluate(stub + code);
  const fr = p.frames()[1];
  await fr.evaluate(stub + code);
  await p.waitForTimeout(2000);
  const before = await p.evaluate(() => !!document.getElementById('ttr-sidebar'));
  const badges = await p.evaluate(() => [...document.querySelectorAll('.ttr-badge')].map(b => b.textContent));
  await p.click('#ed');
  await p.keyboard.type('Chào anh');
  await p.keyboard.press('Enter');
  await p.keyboard.type('Em gửi file nhé');
  await p.waitForTimeout(1500);
  const prev = await p.evaluate(() => document.getElementById('ttr-prev')?.textContent);
  const counts = { top: await p.evaluate(() => document.querySelectorAll('#ttr-sidebar').length), iframe: await fr.evaluate(() => document.querySelectorAll('#ttr-sidebar').length) };
  const calls = await p.evaluate(() => window.__calls);
  console.log(JSON.stringify({ errors, sidebarBeforeFocus: before, badges, prev, counts, calls }, null, 1));
  await b.close();
})();
