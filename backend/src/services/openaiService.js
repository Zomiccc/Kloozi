const axios = require('axios');
const config = require('../config');
const logger = require('../utils/logger');

async function extractLeadInfoFromMessage(messageText, extractFields, systemPrompt) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      logger.warn('OpenAI API key not configured');
      return null;
    }

    const fields = extractFields || ['name', 'budget', 'interest', 'product'];
    
    const prompt = systemPrompt || `You are a lead extraction assistant for a CRM system. Extract the following information from the WhatsApp message: ${fields.join(', ')}. Return ONLY a JSON object with these fields. If a field is not found, set it to null. Do not include any other text.`;

    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: prompt },
          { role: 'user', content: messageText }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const content = response.data.choices[0]?.message?.content;
    if (!content) return null;

    const extracted = JSON.parse(content);
    
    // Normalize the extracted data
    const result = {};
    for (const field of fields) {
      result[field] = extracted[field] || null;
    }

    return result;
  } catch (err) {
    logger.error('OpenAI extraction error:', err.message);
    return null;
  }
}

async function generateAIReply(messageText, extractedInfo, systemPrompt) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      logger.warn('OpenAI API key not configured');
      return null;
    }

    const prompt = systemPrompt || `You are a helpful sales assistant for a real estate CRM. Generate a friendly, professional WhatsApp reply to the customer's message. Keep it under 160 characters. If the customer hasn't provided their name or budget, ask for it politely. Otherwise, acknowledge their message and offer to help.`;

    const context = extractedInfo ? `Extracted info: ${JSON.stringify(extractedInfo)}` : '';

    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: prompt },
          { role: 'user', content: `${context}\n\nCustomer message: ${messageText}` }
        ],
        max_tokens: 100,
        temperature: 0.7
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    return response.data.choices[0]?.message?.content || null;
  } catch (err) {
    logger.error('OpenAI reply generation error:', err.message);
    return null;
  }
}

module.exports = {
  extractLeadInfoFromMessage,
  generateAIReply
};
