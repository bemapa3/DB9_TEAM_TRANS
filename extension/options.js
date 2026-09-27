// options.js — DB9 Team Translator
const $ = id => document.getElementById(id);

function showMsg(text, cls) {
  $('msg').textContent = text;
  $('msg').className = cls || '';
}

async function renderStatus() {
  const s = await chrome.storage.local.get(['geminiStatus', 'geminiUsage', 'geminiKey']);
  const st = s.geminiStatus;
  if (!s.geminiKey) {
    $('status').textContent = 'Chưa có key → đang dùng Google Translate.';
    $('status').className = 'warn';
  } else if (!st) {
    $('status').textContent = 'Chưa dịch lần nào bằng Gemini.';
    $('status').className = '';
  } else {
    $('status').textContent = (st.kind === 'ok' ? '✅ ' : '⚠️ ') + st.message + ' — ' + new Date(st.at).toLocaleString('vi-VN');
    $('status').className = st.kind === 'ok' ? 'ok' : (st.kind === 'quota' || st.kind === 'timeout' ? 'warn' : 'err');
  }
  const u = s.geminiUsage;
  $('usage').textContent = u ? `Hôm nay (${u.date}): ${u.ok} lần dịch Gemini thành công, ${u.fail} lần lỗi.` : '';
}

(async () => {
  const s = await chrome.storage.local.get(['geminiKey', 'geminiModel']);
  $('key').value = s.geminiKey || '';
  $('model').value = s.geminiModel || 'gemini-3.5-flash-lite';
  renderStatus();
})();

$('save').addEventListener('click', async () => {
  await chrome.storage.local.set({ geminiKey: $('key').value.trim(), geminiModel: $('model').value.trim() || 'gemini-3.5-flash-lite' });
  showMsg('Đã lưu. Bấm "Kiểm tra key" để thử.', 'ok');
});

$('test').addEventListener('click', async () => {
  await chrome.storage.local.set({ geminiKey: $('key').value.trim(), geminiModel: $('model').value.trim() || 'gemini-3.5-flash-lite' });
  showMsg('⏳ Đang gọi Gemini...', '');
  const r = await chrome.runtime.sendMessage({ action: 'test_gemini' });
  showMsg(r && r.success ? `✅ Key dùng được (${r.model}).\nThử dịch: ${r.text}` : '❌ ' + (r && r.error), r && r.success ? 'ok' : 'err');
  renderStatus();
});

chrome.storage.onChanged.addListener(renderStatus);
