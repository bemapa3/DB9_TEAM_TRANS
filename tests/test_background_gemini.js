// Test background.js (Gemini + fallback Google) bằng chrome/fetch giả. Chạy: node tests/test_background_gemini.js
const fs = require('fs'), path = require('path'), vm = require('vm');
const code = fs.readFileSync(path.join(__dirname, '..', 'extension', 'background.js'), 'utf8');
const store = { geminiKey: 'AQ.test', geminiModel: 'gemini-3.5-flash-lite' };
const badge = {};
let listener, mode = 'ok', lastHeaders = null;
const chrome = {
  storage: { local: { get: async k => Object.fromEntries(k.map(x => [x, store[x]])), set: async o => Object.assign(store, o) } },
  action: { setBadgeText: o => badge.text = o.text, setBadgeBackgroundColor: o => badge.color = o.color, setTitle: () => {}, onClicked: { addListener: () => {} } },
  runtime: { onMessage: { addListener: f => listener = f }, openOptionsPage: () => {} }
};
const googleCalls = [];
const fetch = async (url, opt) => {
  if (url.includes('generativelanguage')) {
    lastHeaders = opt.headers;
    if (mode === 'ok') return { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: 'Send me the floor plan hahaha' }] } }] }) };
    const st = mode === 'quota' ? 429 : 403;
    return { ok: false, status: st, json: async () => ({ error: { message: 'x', status: st === 429 ? 'RESOURCE_EXHAUSTED' : 'PERMISSION_DENIED' } }) };
  }
  // Google giả. ok/status bắt buộc từ v6.4.3 (background kiểm res.ok).
  // Mô phỏng lỗi v6.4.5: sl=auto nhận câu EN mở đầu bằng tên Việt là 'vi' → trả nguyên văn.
  googleCalls.push(url);
  const q = decodeURIComponent(url.split('q=')[1]);
  if (url.includes('sl=auto') && q.startsWith('Cường Phạm')) return { ok: true, status: 200, json: async () => [[[q]], null, 'vi'] };
  return { ok: true, status: 200, json: async () => [[['GOOGLE:' + q]], null, 'en'] };
};
vm.runInNewContext(code, { chrome, fetch, console, AbortController, setTimeout, clearTimeout, FormData: class {}, URL });
const ask = req => new Promise(r => listener(req, {}, r));
(async () => {
  const out = {};
  out.incoming = await ask({ action: 'translate', text: 'Hello', sl: 'auto', tl: 'vi' });
  googleCalls.length = 0;
  out.misdetect = await ask({ action: 'translate', text: 'Cường Phạm - Please share the model', sl: 'auto', tl: 'vi' });
  out.misdetectRetriedEn = googleCalls.some(u => u.includes('sl=en'));
  out.viNoAccent = await ask({ action: 'translate', text: 'Cường Phạm gui nha anh', sl: 'auto', tl: 'vi' });
  out.ok = await ask({ action: 'translate', text: 'Anh gửi bản vẽ nhé', sl: 'vi', tl: 'en', useGemini: true });
  out.header = lastHeaders['x-goog-api-key'];
  mode = 'quota';
  out.quota = await ask({ action: 'translate', text: 'câu 2', sl: 'vi', tl: 'en', useGemini: true });
  out.badgeQuota = { ...badge };
  out.cooldown = await ask({ action: 'translate', text: 'câu 3', sl: 'vi', tl: 'en', useGemini: true });
  out.status = store.geminiStatus.kind;
  out.usage = store.geminiUsage;
  console.log(JSON.stringify(out, null, 1));
  const pass = out.misdetectRetriedEn && out.misdetect.text.startsWith('GOOGLE:') && out.viNoAccent.text === 'Cường Phạm gui nha anh' && out.incoming.engine === 'google' && out.ok.engine === 'gemini' && out.header === 'AQ.test' && out.quota.engine === 'google' && out.quota.notice.includes('429')
    && out.badgeQuota.text === '!' && out.cooldown.engine === 'google-cooldown' && out.status === 'quota';
  console.log(pass ? 'PASS' : 'FAIL'); process.exit(pass ? 0 : 1);
})();
