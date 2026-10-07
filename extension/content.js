// ============================================================
// content.js — DB9 Team Translator
// - Dịch tin đến (EN/JA/... -> VI) ngay dưới tin nhắn trong khung chat
// - Preview bản dịch tin đang gõ (VI -> EN/JA), giữ xuống dòng
// - Ctrl+Enter: copy bản dịch vào clipboard (Teams không cho tự gửi an toàn)
// - Sidebar chỉ tạo ở frame có ô chat (tránh chạy trùng trong iframe)
// ============================================================
'use strict';

const TTR_VERSION = chrome.runtime.getManifest().version;
const TTR_DEBUG = false; // bật true khi cần debug (log có thể chứa nội dung chat)
function ttrLog(...args) { if (TTR_DEBUG) console.log('[TTR DEBUG]', ...args); }

let targetLang = 'en';
const translationCache = new Map();
const observedNodes = new WeakSet();
const processed = new WeakSet();
const queued = new WeakSet();
const translateQueue = [];
let isProcessing = false;
let lastPreviewSource = '';
let lastPreviewTranslation = '';
let previewTimer = null;

function cacheKey(text, sl, tl) {
    return `${sl}::${tl}::${text}`;
}

async function translateText(text, sl, tl, ai = false) {
    const clean = (text || '').trim();
    if (!clean) return null;

    const key = cacheKey(clean, sl, tl) + (ai ? '::ai' : '');
    if (translationCache.has(key)) {
        return translationCache.get(key);
    }

    try {
        const response = await chrome.runtime.sendMessage({
            action: 'translate',
            useGemini: ai,
            text: clean,
            sl,
            tl
        });

        if (response?.notice) showToast(response.notice, 7000);
        if (ai && response?.engine) showEngine(response.engine);
        if (response?.success && response.text) {
            translationCache.set(key, response.text);
            if (translationCache.size > 500) {
                const firstKey = translationCache.keys().next().value;
                translationCache.delete(firstKey);
            }
            return response.text;
        }
        return null;
    } catch (e) {
        console.warn('[TTR] translate error:', e.message);
        return null;
    }
}

function showEngine(engine) {
    const el = document.getElementById('ttr-engine');
    if (!el) return;
    el.textContent = engine === 'gemini' ? '· Gemini ✨' : (engine === 'google' ? '· Google' : '· Google (Gemini tạm nghỉ)');
    el.style.color = engine === 'gemini' ? '#0a7d32' : '#b45309';
}

async function copyTextToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
        ttrLog('clipboard:writeTextOk');
        return true;
    } catch (err) {
        ttrLog('clipboard:writeTextError', err.message);
    }

    try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.setAttribute('readonly', '');
        ta.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0;';
        document.body.appendChild(ta);
        ta.select();
        const ok = document.execCommand('copy');
        ta.remove();
        ttrLog('clipboard:execCopy', { ok });
        return ok;
    } catch (err) {
        ttrLog('clipboard:execCopyError', err.message);
        return false;
    }
}

function showToast(msg, dur = 2000) {
    let t = document.getElementById('ttr-toast');
    if (!t) {
        t = document.createElement('div');
        t.id = 'ttr-toast';
        t.style.cssText = 'position:fixed;top:20px;left:50%;transform:translateX(-50%);z-index:9999999;background:#0078d4;color:#fff;padding:8px 22px;border-radius:20px;font-weight:bold;font-size:13px;pointer-events:none;opacity:0;transition:opacity 0.3s;';
        document.body.appendChild(t);
    }
    t.textContent = msg;
    t.style.opacity = '1';
    clearTimeout(t._t);
    t._t = setTimeout(() => { t.style.opacity = '0'; }, dur);
}

function normalizeText(s) {
    return (s || '').replace(/\s+/g, ' ').trim();
}

function isVisible(el) {
    if (!el || !el.isConnected) return false;
    const style = getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden') return false;
    const rect = el.getBoundingClientRect();
    return rect.width > 20 && rect.height > 10;
}

function getMessageTextElement(root) {
    if (!root) return null;
    const selectors = [
        '[data-tid="chat-pane-message"]',
        '[data-tid="message-body"]',
        '[data-tid="threadBodyDisplay"]',
        '[data-track-module-name="messageBody"]',
        '[class*="messageBody"]',
        '[class*="bodyContent"]',
        '[class*="message-body"]'
    ];

    for (const sel of selectors) {
        const found = root.matches?.(sel) ? root : root.querySelector?.(sel);
        if (found && isVisible(found)) return found;
    }

    const paragraphs = Array.from(root.querySelectorAll?.('p, div, span') || [])
        .filter(el => isVisible(el) && normalizeText(el.innerText || '').length >= 5)
        .sort((a, b) => normalizeText(b.innerText || '').length - normalizeText(a.innerText || '').length);

    return paragraphs[0] || null;
}

function getMessageContainer(el) {
    if (!el) return null;
    return el.closest(
        '[data-tid="message-pane-item"], [data-tid="chat-pane-item"], [class*="messageListItem"], .fui-ChatMessage, .fui-ChatMyMessage, .ui-chat__message'
    );
}

function isChatInput(el) {
    if (!el) return false;
    if (el.closest('#ttr-sidebar')) return false;
    const editor = el.closest('[contenteditable="true"]');
    if (!editor) return false;
    const aria = (String(editor.getAttribute('aria-label') || '') + ' ' + String(editor.getAttribute('data-tid') || '') + ' ' + String(editor.className || '')).toLowerCase();
    return /type a message|compose|chat input|ckeditor|editor|new message/.test(aria) || !!editor.closest('[data-tid="ckeditor"], [class*="compose"], [class*="editor"]');
}

function getActiveEditor() {
    const el = document.activeElement;
    if (!el) return null;
    const editor = el.closest('[contenteditable="true"]');
    if (!editor || !isChatInput(editor)) return null;
    return editor;
}

function splitStructuredText(text) {
    const raw = (text || '').replace(/\r\n/g, '\n');
    if (!raw.trim()) return [];

    const lines = raw.split('\n');
    const segments = [];
    let current = [];

    const flush = () => {
        if (current.length) {
            segments.push({ type: 'text', text: current.join('\n') });
            current = [];
        }
    };

    for (const line of lines) {
        if (line.trim() === '') {
            flush();
            segments.push({ type: 'break', text: '' });
        } else {
            current.push(line);
        }
    }
    flush();

    return segments;
}

async function translateStructuredText(text, sl, tl, ai = false) {
    const segments = splitStructuredText(text);
    if (!segments.length) return null;

    const out = [];
    for (const segment of segments) {
        if (segment.type === 'break') {
            out.push('');
            continue;
        }

        let translated = await translateText(segment.text, sl, tl, ai);
        // Google đôi khi gộp dòng: số dòng lệch bản gốc thì dịch lại từng dòng (không áp dụng cho Gemini để khỏi tốn lượt)
        const srcLines = segment.text.split('\n');
        if (!ai && translated && srcLines.length > 1 && translated.split('\n').length !== srcLines.length) {
            const parts = [];
            for (const line of srcLines) parts.push((await translateText(line, sl, tl)) || line);
            translated = parts.join('\n');
        }
        out.push(translated || segment.text);
    }

    return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}


// ============================================================
// SIDEBAR — tạo lazy ở frame có ô chat, DRAGGABLE + RESIZABLE + SAVE POSITION
// ============================================================
let sidebar = null;
let collapsed = false;

function ensureSidebar() {
    if (sidebar || document.getElementById('ttr-sidebar')) return;
    sidebar = document.createElement('div');
    sidebar.id = 'ttr-sidebar';

    let savedPos = {};
    try { savedPos = JSON.parse(localStorage.getItem('ttr-sidebar-pos') || '{}') || {}; } catch (_) { savedPos = {}; }

    sidebar.style.cssText = `position:fixed;top:${savedPos.top || '60px'};left:${savedPos.left || 'auto'};right:${savedPos.right || '0px'};width:${savedPos.width || '320px'};height:${savedPos.height || '420px'};min-width:220px;min-height:180px;max-width:min(70vw, 900px);max-height:80vh;background:#fff;border:3px solid #0078d4;border-radius:8px;box-shadow:0 4px 20px rgba(0,0,0,0.2);z-index:9999998;font-family:"Segoe UI",sans-serif;display:flex;flex-direction:column;overflow:hidden;resize:both;cursor:default;`;

    sidebar.innerHTML = `
    <div id="ttr-hdr" style="background:#0078d4;color:#fff;padding:7px 12px;cursor:move;display:flex;justify-content:space-between;align-items:center;user-select:none;flex-shrink:0;">
      <span style="font-weight:bold;font-size:13px;">🌐 DB9 TTR v${TTR_VERSION}</span>
      <div style="display:flex;gap:6px;align-items:center;">
        <button id="ttr-lang" style="background:rgba(255,255,255,0.25);color:#fff;border:none;padding:2px 8px;border-radius:10px;cursor:pointer;font-size:11px;font-weight:bold;">🇺🇸 EN</button>
        <span id="ttr-arr" style="cursor:pointer;">◀</span>
      </div>
    </div>
    <div id="ttr-bdy" style="padding:10px;overflow-y:auto;flex:1;font-size:12px;flex-direction:column;display:flex;gap:6px;">
      <div style="background:#e8f4ff;border-radius:5px;padding:7px;color:#0078d4;line-height:1.6;">
        ⌨️ <b>Ctrl+Enter</b> = dịch &amp; gửi (giữ trích dẫn)<br>
        🔵 Chỉ dịch trong khung chat<br>
        ↔️ Có thể kéo góc panel để resize
      </div>
      <div style="font-size:11px;color:#888;">Preview (Google) — Ctrl+Enter gửi bản Gemini <span id="ttr-engine"></span></div>
      <div id="ttr-prev" style="color:#0078d4;min-height:28px;padding:5px;background:#f5f5f5;border-radius:4px;line-height:1.4;word-break:break-word;white-space:pre-wrap;">—</div>
    </div>`;
    document.body.appendChild(sidebar);

    function saveSidebarState() {
        try {
            localStorage.setItem('ttr-sidebar-pos', JSON.stringify({
                top: sidebar.style.top || '60px',
                left: sidebar.style.left || 'auto',
                right: sidebar.style.right || '0px',
                width: sidebar.style.width || `${sidebar.offsetWidth}px`,
                height: sidebar.style.height || `${sidebar.offsetHeight}px`
            }));
        } catch (_) {}
    }

    let isDragging = false, offsetX = 0, offsetY = 0;

    document.getElementById('ttr-hdr').addEventListener('mousedown', (e) => {
        if (e.target.id === 'ttr-lang' || e.target.id === 'ttr-arr') return;
        isDragging = true;
        const rect = sidebar.getBoundingClientRect();
        offsetX = e.clientX - rect.left;
        offsetY = e.clientY - rect.top;
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        const x = Math.max(0, e.clientX - offsetX);
        const y = Math.max(0, e.clientY - offsetY);
        sidebar.style.left = x + 'px';
        sidebar.style.top = y + 'px';
        sidebar.style.right = 'auto';
    });

    document.addEventListener('mouseup', () => {
        if (isDragging) {
            isDragging = false;
            saveSidebarState();
        }
    });

    let resizeSaveTimer = null;
    new ResizeObserver(() => {
        clearTimeout(resizeSaveTimer);
        resizeSaveTimer = setTimeout(saveSidebarState, 150);
    }).observe(sidebar);

    document.getElementById('ttr-arr').addEventListener('click', (e) => {
        e.stopPropagation();
        collapsed = !collapsed;
        const bdy = document.getElementById('ttr-bdy');
        bdy.style.display = collapsed ? 'none' : 'flex';
        document.getElementById('ttr-arr').textContent = collapsed ? '▶' : '◀';
        if (collapsed) {
            sidebar.dataset.prevWidth = sidebar.style.width || `${sidebar.offsetWidth}px`;
            sidebar.dataset.prevHeight = sidebar.style.height || `${sidebar.offsetHeight}px`;
            sidebar.style.width = '120px';
            sidebar.style.height = '42px';
            sidebar.style.resize = 'none';
        } else {
            sidebar.style.width = sidebar.dataset.prevWidth || '320px';
            sidebar.style.height = sidebar.dataset.prevHeight || '420px';
            sidebar.style.resize = 'both';
        }
        saveSidebarState();
    });

    document.getElementById('ttr-lang').addEventListener('click', (e) => {
        e.stopPropagation();
        targetLang = targetLang === 'en' ? 'ja' : 'en';
        document.getElementById('ttr-lang').textContent = targetLang === 'ja' ? '🇯🇵 JA' : '🇺🇸 EN';
    });

    startPreviewLoop();
}

// Chỉ frame nào có ô chat được focus mới tạo sidebar + chạy preview
document.addEventListener('focusin', (e) => {
    if (isChatInput(e.target)) ensureSidebar();
}, true);

// ============================================================
// LIVE PREVIEW — chỉ dịch khi text đã ngừng thay đổi, giữ xuống dòng
// ============================================================
// Khối trích dẫn (quote/reply) trong ô soạn và trong tin nhắn: không dịch
const QUOTE_SEL = 'blockquote, [data-tid*="quote" i], [class*="quote" i], [itemtype*="Reply" i], [data-tid*="reply" i]';
// Phần cảm xúc (reaction) — không đưa vào text dịch
const REACTION_SEL = '[data-tid*="reaction" i], [class*="reaction" i], [aria-label*="reaction" i], [aria-label*="tương tác" i]';

function isQuoteBlock(node) {
    return node.nodeType === 1 && (node.matches(QUOTE_SEL) || !!node.querySelector(QUOTE_SEL));
}

// Các khối do người dùng tự gõ (con trực tiếp của editor, trừ khối trích dẫn)
function getOwnBlocks(editor) {
    return Array.from(editor.childNodes).filter(n =>
        !(n.nodeType === 1 && isQuoteBlock(n)) &&
        !(n.nodeType === 3 && !n.textContent.trim())
    );
}

function getEditorRawText(editor) {
    const hasQuote = !!editor.querySelector(QUOTE_SEL);
    const own = hasQuote
        ? getOwnBlocks(editor).map(n => (n.nodeType === 1 ? n.innerText : n.textContent) || '').join('\n')
        : (editor.innerText || editor.textContent || '');
    return own
        .replace(/\r\n/g, '\n')
        .replace(/\u00a0/g, ' ')
        .replace(/[ \t]+\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

const PREVIEW_STABLE_MS = 700;
let previewSeenText = '';
let previewSeenAt = 0;

async function updatePreview() {
    const prev = document.getElementById('ttr-prev');
    if (!prev || collapsed) return;

    const editor = getActiveEditor();
    if (!editor) return;

    const raw = getEditorRawText(editor);
    if (raw.length < 2) {
        lastPreviewSource = '';
        previewSeenText = '';
        prev.textContent = '—';
        return;
    }
    if (raw === lastPreviewSource) return;

    // Chờ người dùng ngừng gõ rồi mới gọi API
    const now = Date.now();
    if (raw !== previewSeenText) {
        previewSeenText = raw;
        previewSeenAt = now;
        return;
    }
    if (now - previewSeenAt < PREVIEW_STABLE_MS) return;

    lastPreviewSource = raw;
    prev.textContent = '⏳...';

    const translated = await translateStructuredText(raw, 'vi', targetLang);
    if (!translated) {
        if (lastPreviewSource === raw) prev.textContent = '❌ Dịch lỗi';
        return;
    }
    if (lastPreviewSource === raw) {
        lastPreviewTranslation = translated;
        prev.textContent = translated;
    }
}

let previewInterval = null;
function startPreviewLoop() {
    if (previewInterval) return;
    previewInterval = setInterval(updatePreview, 250);
}

// ============================================================
// CTRL+ENTER → CHỈ DỊCH & THAY THẾ (KHÔNG AUTO-SEND)
// ============================================================
const handleBlockEvent = (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && getActiveEditor()) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
    }
};
document.addEventListener('keypress', handleBlockEvent, true);
document.addEventListener('keyup', handleBlockEvent, true);

document.addEventListener('keydown', async (e) => {
    // Chỉ dịch khi nhấn Ctrl+Enter
    if (!e.ctrlKey || e.key !== 'Enter') return;

    const ed = getActiveEditor();
    if (!ed) {
        return;
    }
    ttrLog('keydown:ctrlEnter');

    const txt = getEditorRawText(ed);
    if (!txt || txt.length < 2) {
        return;
    }

    // Chặn sự kiện gốc để Teams không gửi dòng mới hay xoá chat
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    const applyTranslation = async (translationText) => {
        const result = await replaceAndSend(ed, translationText);
        if (result === 'sent') {
            showToast('✅ Đã gửi bản dịch', 2000);
            return;
        }
        if (result === 'replaced') {
            showToast('📝 Đã thay bằng bản dịch — bấm Gửi (Teams chưa nhận lệnh gửi tự động)', 5000);
            return;
        }
        // Không thay được an toàn → quay về cách copy
        const copied = await copyTextToClipboard(translationText);
        showToast(copied
            ? '📋 Không tự thay được. Đã COPY bản dịch: bôi đen phần bạn gõ → Ctrl+V → Gửi.'
            : '❌ Trình duyệt chặn copy. Hãy copy từ khung Preview.', 7000);
    };

    showToast('⏳ Đang dịch...', 4000);

    try {
        const translated = await translateStructuredText(txt, 'vi', targetLang, true);
        if (!translated) {
            showToast('❌ Dịch thất bại - kiểm tra mạng');
            return;
        }

        lastPreviewSource = txt;
        lastPreviewTranslation = translated;
        previewSeenText = txt;
        const prev = document.getElementById('ttr-prev');
        if (prev) prev.textContent = translated;

        await applyTranslation(translated);
    } catch (err) {
        showToast('Lỗi: ' + err.message);
    }
}, true);

// ============================================================
// CTRL+ENTER: THAY BẰNG BẢN DỊCH (giữ trích dẫn) + GỬI
// Ưu tiên thay qua model CKEditor (main-world.js); không được thì dùng sự kiện paste.
// Chỉ gửi khi đã kiểm tra ô chat đúng bằng bản dịch.
// ============================================================
const AUTO_SEND = true;

function selectOwnContent(editor) {
    editor.focus();
    const sel = window.getSelection();
    const range = document.createRange();
    const own = getOwnBlocks(editor);
    if (editor.querySelector(QUOTE_SEL)) {
        if (!own.length) return false;
        range.setStartBefore(own[0]);
        range.setEndAfter(own[own.length - 1]);
    } else {
        range.selectNodeContents(editor);
    }
    sel.removeAllRanges();
    sel.addRange(range);
    return true;
}

function pasteText(editor, text) {
    try {
        const dt = new DataTransfer();
        dt.setData('text/plain', text);
        const ev = new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true, composed: true });
        editor.dispatchEvent(ev);
        if (ev.defaultPrevented) return true; // editor đã tự xử lý paste
    } catch (err) {
        ttrLog('pasteText:error', err.message);
    }
    try { return document.execCommand('insertText', false, text); } catch (_) { return false; }
}

function findSendButton(editor) {
    let root = editor;
    for (let i = 0; i < 6 && root; i++) {
        root = root.parentElement;
        if (!root) break;
        const exact = root.querySelector('[data-tid="newMessageCommands-send"], button[data-tid*="send" i]:not([data-tid*="later" i]):not([data-tid*="schedule" i])');
        if (exact && isVisible(exact) && exact.getAttribute('aria-disabled') !== 'true' && !exact.disabled) return exact;
        const byLabel = Array.from(root.querySelectorAll('button, [role="button"]')).find(b => {
            const l = ((b.getAttribute('aria-label') || '') + ' ' + (b.getAttribute('title') || '')).trim().toLowerCase();
            return /^(send|gửi)\b/.test(l) && !/later|schedule|lịch|sau/.test(l) && isVisible(b) && !b.disabled && b.getAttribute('aria-disabled') !== 'true';
        });
        if (byLabel) return byLabel;
    }
    return null;
}

async function waitOwnTextCleared(editor, ms) {
    for (let t = 0; t < ms; t += 100) {
        await wait(100);
        if (!editor.isConnected || getEditorRawText(editor).length === 0) return true;
    }
    return false;
}

function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

// Gọi main-world.js: thay chữ qua model CKEditor (cách chắc nhất)
function mainWorldReplace(text) {
    return new Promise(resolve => {
        const id = Math.random().toString(36).slice(2);
        const onDone = (e) => {
            let d;
            try { d = JSON.parse(e.detail); } catch (_) { return; }
            if (d.id !== id) return;
            document.removeEventListener('ttr:replace:done', onDone);
            resolve(d);
        };
        document.addEventListener('ttr:replace:done', onDone);
        setTimeout(() => {
            document.removeEventListener('ttr:replace:done', onDone);
            resolve({ ok: false, reason: 'timeout' });
        }, 500);
        document.dispatchEvent(new CustomEvent('ttr:replace', { detail: JSON.stringify({ id, text, quoteSel: QUOTE_SEL }) }));
    });
}

async function replaceAndSend(editor, translation) {
    const norm = s => (s || '').replace(/\s+/g, ' ').trim();
    const hadQuote = !!editor.querySelector(QUOTE_SEL);
    editor.focus();
    const viaModel = await mainWorldReplace(translation);
    ttrLog('replaceAndSend:mainWorld', viaModel);
    if (!viaModel.ok) {
        // Dự phòng: sự kiện paste
        if (!selectOwnContent(editor)) return 'failed';
        await wait(40); // để editor đồng bộ vùng chọn
        pasteText(editor, translation);
    }
    await wait(150);

    const ok = norm(getEditorRawText(editor)) === norm(translation) && (!hadQuote || !!editor.querySelector(QUOTE_SEL));
    ttrLog('replaceAndSend:verify', { ok, hadQuote });
    if (!ok) return 'failed';
    if (!AUTO_SEND) return 'replaced';

    const btn = findSendButton(editor);
    if (btn) {
        btn.click();
        if (await waitOwnTextCleared(editor, 1200)) return 'sent';
    }
    // Dự phòng: Enter (Teams gửi bằng Enter)
    if (getEditorRawText(editor).length > 0) {
        for (const type of ['keydown', 'keyup']) {
            editor.dispatchEvent(new KeyboardEvent(type, { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true, composed: true }));
        }
        if (await waitOwnTextCleared(editor, 1200)) return 'sent';
    }
    return 'replaced';
}

// ============================================================
// CORE: DỊCH TIN NHẮN — CHỈ TRONG KHUNG CHAT
// ============================================================
function likelyNameLine(text) {
    const clean = normalizeText(text);
    if (!clean || clean.length > 80) return false;
    if (/^(you|me|today|yesterday|now|edited)$/i.test(clean)) return true;
    if (/^\d{1,2}:\d{2}(\s?[ap]m)?$/i.test(clean)) return true;
    // Tiếng Nhật/Trung/Hàn không có dấu cách: chỉ coi là tên khi rất ngắn
    if (/[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]/.test(clean)) return clean.length <= 6;
    const words = clean.split(' ');
    return words.length <= 5 && /^[\p{L}\p{M}.'’ -]+$/u.test(clean);
}

function shouldSkipElement(el, text) {
    if (!el || !text) return true;
    
    // Đảm bảo phần tử nằm trong vùng chat chính (main / chat pane)
    const root = getConversationRoot();
    if (root && !root.contains(el)) return true;

    if (el.closest('#ttr-sidebar')) return true;
    if (el.closest('[contenteditable="true"]')) return true;
    if (el.closest('[role="navigation"], [role="complementary"], nav, header, aside, [data-tid*="left-rail"], [data-tid*="chat-list"], [data-tid*="app-bar"], [data-tid*="title"], [class*="title"], [class*="header"]')) return true;
    if (el.querySelector('.ttr-badge') || el.classList.contains('ttr-badge')) return true;
    if (likelyNameLine(text)) return true;
    return false;
}

function getConversationRoot() {
    const selectors = [
        '[data-tid="message-pane-list-runway"]',
        '[data-tid="chat-pane-list"]',
        '[role="main"]',
        '[data-tid="channel-pane"]'
    ];
    for (const sel of selectors) {
        const root = document.querySelector(sel);
        if (root) return root;
    }
    return null;
}

// ============================================================
// CHỐNG ĐÈ CHỮ: nếu có phần tử của Teams (reaction, nút...) nằm đè lên dòng dịch
// thì đẩy dòng dịch xuống; nếu phần tử đó đi theo dòng dịch thì chừa lề ngang.
// ============================================================
function foreignOnTop(badge) {
    const r = badge.getBoundingClientRect();
    if (!r.width || !r.height || r.bottom < 0 || r.top > innerHeight) return null;
    for (const fy of [0.2, 0.5, 0.8]) {
        const y = r.top + r.height * fy;
        if (y < 0 || y > innerHeight) continue;
        for (const fx of [0.02, 0.25, 0.5, 0.75, 0.98]) {
            const x = r.left + r.width * fx;
            if (x < 0 || x > innerWidth) continue;
            const top = document.elementFromPoint(x, y);
            if (!top || badge.contains(top) || top.contains(badge) || top.closest('#ttr-sidebar')) continue;
            // Chỉ coi là "đè" khi là phần tử nhỏ (reaction/nút). Lớp phủ/khung lớn của Teams → bỏ qua,
            // nếu không sẽ chừa lề gần bằng cả bề ngang → chữ dồn 1 cột, bong bóng chat kéo dài.
            const tr = top.getBoundingClientRect();
            if (tr.width > Math.min(160, r.width * 0.5) || tr.height > 48) continue;
            return top;
        }
    }
    return null;
}

function fixBadgeOverlap(badge) {
    if (!badge.isConnected) return;
    const other = foreignOnTop(badge);
    if (!other) {
        if (badge.getBoundingClientRect().height) badge.dataset.ttrFixed = '1';
        return;
    }
    const or = other.getBoundingClientRect();
    const br = badge.getBoundingClientRect();
    // Cách 1: đẩy xuống dưới phần tử đè
    const oldMb = badge.style.marginBottom;
    badge.style.marginBottom = Math.min(60, Math.ceil(or.height + 6)) + 'px';
    if (!foreignOnTop(badge)) { badge.dataset.ttrFixed = '1'; return; }
    badge.style.marginBottom = oldMb;
    // Không chừa lề ngang nữa: lề ngang làm chữ dồn 1 cột → bong bóng kéo dài.
    badge.dataset.ttrFixed = '1';
    ttrLog('fixBadgeOverlap', { with: other.tagName + '.' + String(other.className).slice(0, 60) });
}

// Lấy chữ của tin, GIỮ xuống dòng như chat gốc: mỗi khối (p/div/li...) = 1 dòng, <br> = xuống dòng,
// đoạn trống = dòng trống. Bỏ quote, reaction, dòng dịch cũ.
function getIncomingText(el) {
    const skipSel = QUOTE_SEL + ', ' + REACTION_SEL + ', .ttr-badge';
    let out = '';
    const walk = (node) => {
        for (const n of node.childNodes) {
            if (n.nodeType === 3) {
                const t = n.nodeValue.replace(/[ \t\r\n]+/g, ' ');
                if (t === ' ' && (!out || out.endsWith('\n'))) continue;
                out += t;
                continue;
            }
            if (n.nodeType !== 1 || n.matches(skipSel)) continue;
            if (n.tagName === 'BR') { out += '\n'; continue; }
            const block = /^(block|list-item|flex|grid|table|table-row)/.test(getComputedStyle(n).display);
            if (block && out && !out.endsWith('\n')) out += '\n';
            walk(n);
            if (block && !out.endsWith('\n')) out += '\n';
        }
    };
    walk(el);
    return out.split('\n').map(l => l.replace(/ /g, ' ').trim()).join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

function enqueueForTranslation(el) {
    if (!el || processed.has(el) || queued.has(el)) return;
    queued.add(el);
    translateQueue.push(el);
}

async function processQueue() {
    if (isProcessing) return;
    isProcessing = true;

    while (translateQueue.length > 0) {
        const el = translateQueue.shift();
        queued.delete(el);

        if (!el || processed.has(el) || !document.contains(el)) continue;
        if (el.querySelector('.ttr-badge')) {
            processed.add(el);
            continue;
        }

        const text = getIncomingText(el);
        if (!text || text.length < 5 || text.length > 2000 || shouldSkipElement(el, text)) {
            processed.add(el);
            continue;
        }

        const viChars = (text.match(/[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/gi) || []).length;
        const latinChars = (text.match(/[a-zA-Z]/g) || []).length;
        const cjkChars = (text.match(/[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]/g) || []).length;
        if (viChars / Math.max(text.length, 1) > 0.1 || (latinChars < 2 && cjkChars < 2)) {
            processed.add(el);
            continue;
        }

        processed.add(el);

        const translated = await translateStructuredText(text, 'auto', 'vi');
        if (!translated) continue;

        const norm = s => s.toLowerCase().replace(/\s+/g, '').slice(0, 50);
        if (norm(translated) === norm(text)) continue;

        const badge = document.createElement('div');
        badge.className = 'ttr-badge';
        badge.style.cssText = 'color:#005a9e;font-size:12px;font-weight:500;margin-top:3px;padding:3px 8px;background:#e8f4ff;border-left:3px solid #0078d4;border-radius:3px;line-height:1.5;font-style:italic;white-space:pre-wrap;';
        badge.textContent = '🇻🇳 ' + translated;
        // Teams để khối reaction (cao 0px, nội dung tràn) là con cuối của bong bóng →
        // chèn dòng dịch TRƯỚC nó, nếu append sau thì reaction đè lên dòng dịch.
        const rx = Array.from(el.children).find(c => c.matches(REACTION_SEL));
        if (rx) el.insertBefore(badge, rx); else el.appendChild(badge);
        setTimeout(() => fixBadgeOverlap(badge), 300);
        getMessageContainer(el)?.setAttribute('data-ttr-host', '1');

        await new Promise(r => setTimeout(r, 80));
    }

    isProcessing = false;
}

(function injectTtrStyle() {
    if (document.getElementById('ttr-style')) return;
    const st = document.createElement('style');
    st.id = 'ttr-style';
    st.textContent = '.ttr-badge{display:block;clear:both;margin-bottom:4px}';
    (document.head || document.documentElement).appendChild(st);
})();

const intObs = new IntersectionObserver((entries) => {
    for (const entry of entries) {
        if (entry.isIntersecting && !processed.has(entry.target)) {
            enqueueForTranslation(entry.target);
            intObs.unobserve(entry.target);
        }
    }
    processQueue();
}, { threshold: 0.05, rootMargin: '150px 0px' });

function registerMessageNode(node) {
    if (!node || observedNodes.has(node) || processed.has(node)) return;
    observedNodes.add(node);
    intObs.observe(node);
}

function scanMessageDOM(root = getConversationRoot()) {
    if (!root) return;

    const containers = root.querySelectorAll(
        '[data-tid="message-pane-item"], [data-tid="chat-pane-item"], [class*="messageListItem"], .fui-ChatMessage, .fui-ChatMyMessage, .ui-chat__message'
    );

    let count = 0;
    for (const container of containers) {
        const textEl = getMessageTextElement(container);
        if (!textEl) continue;
        const text = normalizeText(textEl.innerText || '');
        if (!text || shouldSkipElement(textEl, text)) continue;
        registerMessageNode(textEl);
        count++;
    }

    if (count > 0) console.log('[TTR] Registered message nodes:', count);
}

const mutObs = new MutationObserver((mutations) => {
    clearTimeout(mutObs._t);
    mutObs._t = setTimeout(() => {
        for (const mutation of mutations) {
            for (const node of mutation.addedNodes) {
                if (!(node instanceof Element)) continue;
                const container = getMessageContainer(node) || node.querySelector?.(
                    '[data-tid="message-pane-item"], [data-tid="chat-pane-item"], [class*="messageListItem"], .fui-ChatMessage, .fui-ChatMyMessage, .ui-chat__message'
                );
                if (!container) continue;
                const textEl = getMessageTextElement(container);
                if (textEl) registerMessageNode(textEl);
            }
        }
        scanMessageDOM();
        document.querySelectorAll('.ttr-badge:not([data-ttr-fixed])').forEach(fixBadgeOverlap);
    }, 250);
});
mutObs.observe(document.body, { childList: true, subtree: true });

setTimeout(() => scanMessageDOM(), 1200);
setTimeout(() => scanMessageDOM(), 3500);

console.log('[DB9 Team Translator v' + TTR_VERSION + '] ready' + (window.top === window ? '' : ' (iframe)'));
