const axios = require('axios');
const logger = require('../utils/logger');

// WhatsApp AI agent: pulls lead details out of a message and (optionally) drafts a reply.
// Without OPENAI_API_KEY both helpers return null and the agent simply does nothing.

const MODEL = () => process.env.OPENAI_MODEL || 'gpt-4o-mini';

async function chat(messages, extra = {}) {
  const response = await axios.post(
    'https://api.openai.com/v1/chat/completions',
    { model: MODEL(), messages, ...extra },
    {
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
      timeout: 20000,
    }
  );
  return response.data.choices?.[0]?.message?.content || null;
}

function parseFields(extractFields) {
  let fields = extractFields;
  if (typeof fields === 'string') {
    try { fields = JSON.parse(fields); } catch { fields = fields.split(','); }
  }
  fields = (Array.isArray(fields) ? fields : []).map((f) => String(f).trim().toLowerCase()).filter(Boolean);
  return fields.length ? fields : ['name', 'budget', 'interest', 'city', 'email'];
}

/**
 * Extract lead fields from a message. The workspace's own prompt (persona/business
 * context) is passed as background only, so extraction always returns clean JSON.
 */
async function extractLeadInfoFromMessage(messageText, extractFields, systemPrompt) {
  try {
    if (!process.env.OPENAI_API_KEY || !String(messageText || '').trim()) return null;
    const fields = parseFields(extractFields);
    const content = await chat([
      {
        role: 'system',
        content: `You extract lead details for a CRM from a customer's WhatsApp message. Return ONLY a JSON object with exactly these keys: ${fields.join(', ')}. `
          + 'Use null for anything the customer did not clearly state. "budget" must be a plain number (e.g. 750000) with no currency or words. Never guess.'
          + (systemPrompt ? `\n\nBusiness context (for understanding only): ${systemPrompt}` : ''),
      },
      { role: 'user', content: String(messageText) },
    ], { response_format: { type: 'json_object' }, temperature: 0 });
    if (!content) return null;
    const extracted = JSON.parse(content);
    const result = {};
    for (const field of fields) result[field] = extracted[field] ?? null;
    return result;
  } catch (err) {
    logger.error('OpenAI extraction error:', err.response?.data?.error?.message || err.message);
    return null;
  }
}

/**
 * Draft a short WhatsApp reply. `history` is the recent conversation, oldest first:
 * [{ direction: 'inbound'|'outbound', text }].
 */
async function generateAIReply(messageText, extractedInfo, systemPrompt, history = []) {
  try {
    if (!process.env.OPENAI_API_KEY) return null;
    const persona = systemPrompt
      || 'You are a friendly, professional sales assistant replying on WhatsApp. If the customer has not shared their name or budget, ask politely. Otherwise acknowledge their message and offer to help.';
    const known = extractedInfo && Object.values(extractedInfo).some((v) => v)
      ? `\nKnown about this customer: ${JSON.stringify(extractedInfo)}`
      : '';
    const messages = [
      { role: 'system', content: `${persona}\nKeep replies under 300 characters, plain text, no markdown. Never invent prices, availability or promises.${known}` },
      ...history.slice(-10).map((m) => ({ role: m.direction === 'inbound' ? 'user' : 'assistant', content: String(m.text || '') })).filter((m) => m.content),
    ];
    if (!history.length || history[history.length - 1].text !== messageText) messages.push({ role: 'user', content: String(messageText) });
    const reply = await chat(messages, { max_tokens: 160, temperature: 0.6 });
    return reply ? reply.trim() : null;
  } catch (err) {
    logger.error('OpenAI reply generation error:', err.response?.data?.error?.message || err.message);
    return null;
  }
}

module.exports = { extractLeadInfoFromMessage, generateAIReply };
