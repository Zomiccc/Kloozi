const axios = require('axios');
const logger = require('../utils/logger');

// ─── Shared OpenAI access ───────────────────────────────────────────────────
// Every AI feature calls through here. Without OPENAI_API_KEY, enabled() is
// false and callers fall back to their rule-based versions.

const enabled = () => !!process.env.OPENAI_API_KEY;
const MODEL = () => process.env.OPENAI_MODEL || 'gpt-4o-mini';
const TRANSCRIBE_MODEL = () => process.env.OPENAI_TRANSCRIBE_MODEL || 'whisper-1';

async function chat(messages, { json = false, maxTokens = 600, temperature = 0.4 } = {}) {
  if (!enabled()) return null;
  try {
    const r = await axios.post('https://api.openai.com/v1/chat/completions', {
      model: MODEL(), messages, max_tokens: maxTokens, temperature,
      ...(json ? { response_format: { type: 'json_object' } } : {}),
    }, { headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` }, timeout: 45000 });
    const content = r.data.choices?.[0]?.message?.content || '';
    if (!json) return content.trim();
    try { return JSON.parse(content); } catch { return null; }
  } catch (err) {
    logger.error(`AI request failed (${err.response?.status || 'network'}): ${err.response?.data?.error?.message || err.message}`);
    return null;
  }
}

/** System + user prompt → parsed JSON object (or null). */
const chatJSON = (system, user, opts = {}) => chat([{ role: 'system', content: system }, { role: 'user', content: user }], { ...opts, json: true });
const chatText = (system, user, opts = {}) => chat([{ role: 'system', content: system }, { role: 'user', content: user }], opts);

/** Audio buffer → transcript text (or null). */
async function transcribe(buffer, filename = 'audio.webm', mimetype = 'audio/webm') {
  if (!enabled() || !buffer?.length) return null;
  try {
    const form = new FormData();
    form.append('file', new Blob([buffer], { type: mimetype }), filename);
    form.append('model', TRANSCRIBE_MODEL());
    const r = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST', headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` }, body: form,
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data?.error?.message || `HTTP ${r.status}`);
    return String(data.text || '').trim() || null;
  } catch (err) {
    logger.error(`Transcription failed: ${err.message}`);
    return null;
  }
}

module.exports = { enabled, chat, chatJSON, chatText, transcribe };
