// Test lỗi "mất dịch khi cuộn" (v6.4.5–6.4.6): trang Teams giả có danh sách ẢO HOÁ (cuộn là xoá/dựng lại tin)
// và React-like dựng lại tin đang hiện (xoá badge). Chạy: node tests/test_scroll_virtual_mock.js
// Kết quả đúng: errors [], mỗi lượt kiểm "ok" = "en" (mọi tin tiếng Anh đang hiện có dòng dịch), viBadge 0,
// prefetch > 0 (tin sắp cuộn tới đã được dịch trước), PASS.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const code = fs.readFileSync(path.join(__dirname, '..', 'extension', 'content.js'), 'utf8');
const stub = `window.chrome={runtime:{getManifest:()=>({version:'test'}),sendMessage:(m)=>new Promise(r=>setTimeout(()=>r({success:true,text:'[vi] '+m.text}),60))}};`;

const html = `<!doctype html><html><head><style>
body{margin:0;font-family:sans-serif;display:flex;height:100vh}
#rail{width:200px;overflow:auto}
#main{flex:1;display:flex;flex-direction:column}
#pane{flex:1;overflow:auto}
[data-tid="message-pane-list-runway"]{position:relative}
.fui-ChatMessage{padding:6px 10px;margin:6px;background:#f3f3f3}
</style></head><body>
<div id="rail" role="navigation"></div>
<div id="main" role="main">
 <div id="pane"><div data-tid="message-pane-list-runway" id="runway"></div></div>
 <div data-tid="ckeditor"><div contenteditable="true" aria-label="Type a message" id="ed" style="min-height:40px"></div></div>
</div>
<script>
const EN=['Please share the master model including the placed villas to Bao','it needs a sidewalk and access from the gate to the sidewalk','How much longer do you need?'];
const VI=['Hiện tại team đang đặt nhà sát theo cao độ','mình xài map thôi anh, anh skip cái đó xíu em'];
const N=200,H=70;
const msgs=[...Array(N)].map((_,i)=>({id:i,text:(i%3===2?VI[i%2]:EN[i%3])+' #'+i}));
const runway=document.getElementById('runway'),pane=document.getElementById('pane');
runway.style.height=(N*H)+'px';
const live=new Map();
function build(m){const c=document.createElement('div');c.className='fui-ChatMessage';c.style.cssText='position:absolute;left:0;right:0;top:'+(m.id*H)+'px';
 c.innerHTML='<div data-tid="chat-pane-message"><div><p></p></div></div>';c.querySelector('p').textContent=m.text;return c}
function render(){const f=Math.max(0,Math.floor(pane.scrollTop/H)-5),l=Math.min(N-1,Math.ceil((pane.scrollTop+pane.clientHeight)/H)+5);
 for(const [id,el] of live) if(id<f||id>l){el.remove();live.delete(id)}
 for(let i=f;i<=l;i++) if(!live.has(i)){const el=build(msgs[i]);runway.appendChild(el);live.set(i,el)}}
pane.addEventListener('scroll',render);pane.scrollTop=N*H;render();
for(let i=0;i<40;i++){const d=document.createElement('div');d.innerHTML='<span class="p">●</span> Người '+i;rail.appendChild(d)}
setInterval(()=>{const s=rail.children[Math.random()*40|0].querySelector('.p');s.textContent=s.textContent==='●'?'○':'●'},50);
window.__rerender=()=>{for(const [id,old] of live){const el=build(msgs[id]);old.replaceWith(el);live.set(id,el)}};
</script></body></html>`;

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1200, height: 800 } });
  const errors = [];
  p.on('pageerror', e => errors.push(e.message));
  await p.setContent(html);
  await p.evaluate(stub + code);
  const count = () => p.evaluate(() => {
    const isVi = t => /^(Hiện tại|mình xài)/.test(t);
    const bottom = document.getElementById('pane').getBoundingClientRect().bottom;
    const ms = [...document.querySelectorAll('.fui-ChatMessage')].filter(m => { const r = m.getBoundingClientRect(); return r.bottom > 0 && r.top < bottom; });
    const en = ms.filter(m => !isVi(m.querySelector('p').textContent));
    return { en: en.length, ok: en.filter(m => m.querySelector('.ttr-badge')).length, viBadge: ms.filter(m => isVi(m.querySelector('p').textContent) && m.querySelector('.ttr-badge')).length };
  });
  const scrollTo = i => p.evaluate(i => { document.getElementById('pane').scrollTop = i * 70; }, i);
  const out = {};
  await p.waitForTimeout(2500);
  out.start = await count();
  await scrollTo(100); await p.waitForTimeout(2500);
  out.afterJump = await count();
  await p.evaluate(() => window.__rerender()); await p.waitForTimeout(1000);
  out.afterRerender = await count();          // badge bị xoá phải được chèn lại (từ bộ nhớ, không gọi API)
  await scrollTo(92); await p.waitForTimeout(200);
  out.prefetch = await count();               // vùng sát trên đã được dịch trước khi cuộn tới?
  await scrollTo(195); await p.waitForTimeout(2500);
  out.backToBottom = await count();           // quay lại tin đã dịch: phải có badge
  out.errors = errors;
  console.log(JSON.stringify(out, null, 1));
  const full = c => c.en > 0 && c.ok === c.en && c.viBadge === 0;
  const pass = errors.length === 0 && full(out.start) && full(out.afterJump) && full(out.afterRerender) && full(out.backToBottom) && out.prefetch.ok > 0;
  console.log(pass ? 'PASS' : 'FAIL');
  await b.close();
  process.exit(pass ? 0 : 1);
})();
