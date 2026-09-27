// ============================================================
// background.js — DB9 Team Translator
// Service Worker: xử lý dịch văn bản, OCR ảnh, và glossary
// ============================================================

// ============================================================
// TỪ ĐIỂN CHUYÊN NGÀNH (Glossary Post-Processing)
// Dùng để chuyển các từ máy dịch sai sang từ đúng domain
// ============================================================

// Glossary EN→VI: Dùng khi dịch tiếng Anh ra tiếng Việt
// (áp dụng cho incoming messages hoặc khi dịch về Vietnamese)
const GLOSSARY_EN_TO_VI = {
    // --- Architecture / Architectural Visualization ---
    "visualization": "diễn họa",
    "visualisation": "diễn họa",
    "architectural visualization": "diễn họa kiến trúc",
    "architectural visualisation": "diễn họa kiến trúc",
    "facade": "mặt đứng",
    "façade": "mặt đứng",
    "elevation": "mặt đứng",
    "floor plan": "mặt bằng",
    "floorplan": "mặt bằng",
    "section": "mặt cắt",
    "cross section": "mặt cắt",
    "perspective": "phối cảnh",
    "3d model": "mô hình 3D",
    "3d modeling": "mô hình hóa 3D",
    "lighting": "ánh sáng",
    "material": "vật liệu",
    "materials": "vật liệu",
    "texture": "bề mặt",
    "textures": "bề mặt",
    "post-processing": "hậu kỳ",
    "post processing": "hậu kỳ",
    "postprocessing": "hậu kỳ",
    "environment": "môi trường",
    "ambient occlusion": "AO",
    "depth of field": "độ sâu trường ảnh",
    "rendering": "rendering",
    "renderer": "renderer",
    "render": "render",
    "rendered": "render",
    "renders": "render",
    "hdr": "HDR",
    // --- PC Hardware ---
    "graphics card": "GPU (card màn hình)",
    "graphics processing unit": "GPU",
    "central processing unit": "CPU",
    "random access memory": "RAM",
    "video ram": "VRAM",
    "motherboard": "bo mạch chủ",
    "main board": "bo mạch chủ",
    "power supply": "nguồn điện",
    "power supply unit": "nguồn điện",
    "psu": "nguồn điện",
    "heatsink": "tản nhiệt",
    "heat sink": "tản nhiệt",
    "thermal paste": "keo tản nhiệt",
    "thermal compound": "keo tản nhiệt",
    "benchmark": "điểm chuẩn",
    "benchmarks": "điểm chuẩn",
    "benchmarking": "đánh giá hiệu năng",
    "overclocking": "ép xung",
    "overclock": "ép xung",
    "bottleneck": "điểm nghẽn"
};

// Glossary VI→EN (reverse): Giữ nguyên thuật ngữ kỹ thuật khi dịch sang EN/JA
// Đảm bảo máy dịch không dịch sai các từ quan trọng
const GLOSSARY_VI_TO_PRESERVE = {
    "diễn họa kiến trúc": "architectural visualization",
    "diễn họa": "visualization",
    "mặt đứng": "facade",
    "mặt bằng": "floor plan",
    "mặt cắt": "section",
    "phối cảnh": "perspective",
    "mô hình 3D": "3D model",
    "hậu kỳ": "post-processing",
    "ép xung": "overclocking",
    "điểm nghẽn": "bottleneck",
    "bo mạch chủ": "motherboard",
    "nguồn điện": "power supply",
    "tản nhiệt": "heatsink",
    "keo tản nhiệt": "thermal paste",
    "điểm chuẩn": "benchmark",
    "card màn hình": "GPU",
    "vi xử lý": "CPU"
};

/**
 * Post-process bản dịch VI: thay thế các từ máy dịch sai bằng từ đúng domain.
 * @param {string} text - Raw text từ Google Translate (tiếng Việt)
 * @returns {string} - Text đã được chuẩn hóa theo glossary
 */
function glossaryPostProcess(text) {
    if (!text) return text;
    let result = text;

    // Duyệt glossary theo thứ tự dài → ngắn để tránh replace nhầm
    const entries = Object.entries(GLOSSARY_EN_TO_VI)
        .sort((a, b) => b[0].length - a[0].length);

    for (const [enTerm, viTerm] of entries) {
        // Case-insensitive replace, giữ nguyên nếu đã đúng
        const regex = new RegExp(`\\b${escapeRegex(enTerm)}\\b`, 'gi');
        result = result.replace(regex, viTerm);
    }

    return result;
}

/**
 * Escape special regex characters
 */
function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ============================================================
// GEMINI API — dịch bằng AI (hiểu ngữ cảnh, giữ giọng văn, dùng từ điển)
// Key lưu ở chrome.storage.local (nhập ở trang Cài đặt), KHÔNG nằm trong code.
// Key dạng "AQ." dùng header x-goog-api-key trên endpoint gốc generativelanguage.
// ============================================================
const DEFAULT_GEMINI_MODEL = "gemini-3.5-flash-lite";
const LANG_NAME = { vi: "Vietnamese", en: "English", ja: "Japanese", auto: "the original language (auto-detect)" };
let geminiCooldownUntil = 0;
let lastStatusKind = null;

async function getSettings() {
    const s = await chrome.storage.local.get(["geminiKey", "geminiModel"]);
    return { key: (s.geminiKey || "").trim(), model: (s.geminiModel || DEFAULT_GEMINI_MODEL).trim() };
}

function glossaryForPrompt() {
    const a = Object.entries(GLOSSARY_EN_TO_VI).map(([en, vi]) => `${en} = ${vi}`);
    const b = Object.entries(GLOSSARY_VI_TO_PRESERVE).map(([vi, en]) => `${vi} = ${en}`);
    return [...new Set([...a, ...b])].join("; ");
}

const GEMINI_SYSTEM = [
    "You are the chat translator for DB9, an architectural visualization (archviz) studio.",
    "Translate the user's chat message naturally, like a colleague would write it: keep the tone (casual, jokes, slang, 'hahaha'), emojis, names, numbers, URLs and line breaks.",
    "Use correct archviz / 3D / rendering / post-production terminology. Preferred term pairs: " + glossaryForPrompt() + ".",
    "Do not translate software names (3ds Max, V-Ray, Corona, Photoshop, D5, Lumion, Unreal).",
    "Output ONLY the translation. No quotes, no notes, no explanations."
].join(" ");

async function translateGemini(text, sl, tl, key, model) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 15000);
    try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
        const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-goog-api-key": key },
            body: JSON.stringify({
                systemInstruction: { parts: [{ text: GEMINI_SYSTEM }] },
                contents: [{ role: "user", parts: [{ text: `Translate from ${LANG_NAME[sl] || sl} to ${LANG_NAME[tl] || tl}:\n\n${text}` }] }],
                generationConfig: { temperature: 0.2 }
            }),
            signal: ctrl.signal
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            const err = new Error((data.error && data.error.message) || ("HTTP " + res.status));
            err.status = res.status;
            err.apiStatus = data.error && data.error.status;
            throw err;
        }
        const cand = data.candidates && data.candidates[0];
        const out = cand && cand.content && (cand.content.parts || []).map(p => p.text || "").join("").trim();
        if (!out) {
            const err = new Error("Gemini không trả kết quả (" + ((cand && cand.finishReason) || (data.promptFeedback && data.promptFeedback.blockReason) || "?") + ")");
            err.status = 0;
            throw err;
        }
        return out;
    } finally {
        clearTimeout(timer);
    }
}

function classifyGeminiError(err) {
    const st = err.status;
    const msg = String(err.message || "");
    if (st === 429 || err.apiStatus === "RESOURCE_EXHAUSTED")
        return { ok: false, kind: "quota", cooldownMs: 60000, message: "Gemini hết lượt / vượt giới hạn (429). Tạm dùng Google, 1 phút sau thử lại." };
    if (st === 401 || st === 403 || /API[_ ]KEY|api key/i.test(msg))
        return { ok: false, kind: "key", cooldownMs: 600000, message: "API key sai, bị khoá hoặc bị thu hồi (" + (st || "") + "). Đang dùng Google." };
    if (st === 404)
        return { ok: false, kind: "model", cooldownMs: 600000, message: "Tên model không tồn tại (404). Sửa model trong Cài đặt. Đang dùng Google." };
    if (err.name === "AbortError")
        return { ok: false, kind: "timeout", cooldownMs: 30000, message: "Gemini phản hồi quá 15 giây. Tạm dùng Google." };
    return { ok: false, kind: "error", cooldownMs: 30000, message: "Gemini lỗi: " + msg.slice(0, 160) + ". Tạm dùng Google." };
}

// Ghi trạng thái + badge trên icon: "!" cam = hết lượt, "!" đỏ = key/model lỗi
async function setGeminiStatus(info) {
    const kind = info.ok ? "ok" : info.kind;
    const today = new Date().toLocaleDateString("sv"); // YYYY-MM-DD giờ máy
    const s = await chrome.storage.local.get(["geminiUsage"]);
    const usage = s.geminiUsage && s.geminiUsage.date === today ? s.geminiUsage : { date: today, ok: 0, fail: 0 };
    if (info.ok) usage.ok++; else usage.fail++;
    const patch = { geminiUsage: usage };
    if (kind !== lastStatusKind || !info.ok) patch.geminiStatus = { kind, message: info.message || "Gemini hoạt động bình thường", at: Date.now() };
    await chrome.storage.local.set(patch);
    if (kind !== lastStatusKind) {
        chrome.action.setBadgeText({ text: info.ok ? "" : "!" });
        chrome.action.setBadgeBackgroundColor({ color: kind === "quota" || kind === "timeout" ? "#d97706" : "#dc2626" });
        chrome.action.setTitle({ title: "DB9 Team Translator — " + (info.message || "Gemini OK") });
    }
    const changed = kind !== lastStatusKind;
    lastStatusKind = kind;
    return changed;
}

async function translateGoogle(text, sl, tl) {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sl}&tl=${tl}&dt=t&q=${encodeURIComponent(text)}`;
    const res = await fetch(url);
    const data = await res.json();
    let translated = data[0].map(item => item[0]).join("");
    if (tl === "vi") translated = glossaryPostProcess(translated);
    return translated;
}

async function translateSmart(text, sl, tl, useGemini) {
    const { key, model } = await getSettings();
    // Gemini chỉ cho tin gửi đi (tiết kiệm lượt); tin đến + preview dùng Google
    if (useGemini && key && Date.now() >= geminiCooldownUntil) {
        try {
            const out = await translateGemini(text, sl, tl, key, model);
            const changed = await setGeminiStatus({ ok: true });
            return { text: out, engine: "gemini", notice: changed && lastStatusKind === "ok" ? "✅ Gemini hoạt động lại" : "" };
        } catch (err) {
            const info = classifyGeminiError(err);
            geminiCooldownUntil = Date.now() + info.cooldownMs;
            const changed = await setGeminiStatus(info);
            const out = await translateGoogle(text, sl, tl);
            return { text: out, engine: "google", notice: changed ? "⚠️ " + info.message : "" };
        }
    }
    return { text: await translateGoogle(text, sl, tl), engine: useGemini && key ? "google-cooldown" : "google" };
}

// Bấm icon extension → mở trang Cài đặt
chrome.action.onClicked.addListener(() => chrome.runtime.openOptionsPage());

// ============================================================
// MESSAGE HANDLER
// ============================================================
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {

    // 1. DỊCH VĂN BẢN — Gemini (nếu có key), lỗi thì tự dùng Google
    if (request.action === "translate") {
        translateSmart(request.text, request.sl, request.tl, !!request.useGemini)
            .then(r => sendResponse({ success: true, ...r }))
            .catch(error => sendResponse({ success: false, error: String(error && error.message || error) }));
        return true;
    }

    // 1b. KIỂM TRA KEY (trang Cài đặt)
    if (request.action === "test_gemini") {
        getSettings().then(({ key, model }) => {
            if (!key) return sendResponse({ success: false, error: "Chưa nhập API key" });
            translateGemini("Anh gửi em bản vẽ mặt bằng nhé 😄", "vi", "en", key, model)
                .then(text => { setGeminiStatus({ ok: true }); sendResponse({ success: true, text, model }); })
                .catch(err => { const info = classifyGeminiError(err); setGeminiStatus(info); sendResponse({ success: false, error: info.message }); });
        });
        return true;
    }

    // 2. OCR ẢNH & DỊCH
    if (request.action === "ocr_and_translate") {
        const formData = new FormData();
        formData.append("base64Image", request.base64);
        formData.append("language", "eng");

        fetch("https://api.ocr.space/parse/image", {
            method: "POST",
            headers: { "apikey": "helloworld" },
            body: formData
        })
        .then(res => res.json())
        .then(ocrData => {
            if (ocrData.IsErroredOnProcessing || !ocrData.ParsedResults || ocrData.ParsedResults.length === 0) {
                throw new Error("Không tìm thấy chữ trong ảnh hoặc ảnh quá mờ.");
            }

            const extractedText = ocrData.ParsedResults[0].ParsedText.trim();
            if (!extractedText) throw new Error("Ảnh không có văn bản.");

            const transUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=vi&dt=t&q=${encodeURIComponent(extractedText)}`;
            return fetch(transUrl)
                .then(res => res.json())
                .then(transData => {
                    let translatedText = transData[0].map(item => item[0]).join('');
                    // Áp dụng glossary cho bản dịch OCR
                    translatedText = glossaryPostProcess(translatedText);
                    sendResponse({ success: true, original: extractedText, translated: translatedText });
                });
        })
        .catch(error => sendResponse({ success: false, error: error.toString() }));
        return true;
    }

    // 3. LẤY GLOSSARY (để hiển thị trong panel Từ điển)
    if (request.action === "get_glossary") {
        sendResponse({
            success: true,
            en_to_vi: GLOSSARY_EN_TO_VI,
            vi_to_preserve: GLOSSARY_VI_TO_PRESERVE
        });
        return true;
    }
});
