/**
 * LLM API Integration
 * Supports OpenAI, Gemini, Claude, and custom OpenAI-compatible endpoints
 */

const API_CONFIGS = {
  openai: {
    url: 'https://api.openai.com/v1/chat/completions',
    model: 'gpt-4o',
    buildHeaders: (key) => ({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`,
    }),
    buildBody: (messages, model) => ({
      model: model || 'gpt-4o',
      messages,
      temperature: 0.9,
      max_tokens: 1000,
    }),
    extractContent: (data) => data.choices?.[0]?.message?.content || '',
  },
  gemini: {
    url: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent',
    buildHeaders: () => ({
      'Content-Type': 'application/json',
    }),
    buildBody: (messages) => ({
      contents: messages.map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      })),
      generationConfig: {
        temperature: 0.9,
        maxOutputTokens: 1000,
      },
    }),
    extractContent: (data) => data.candidates?.[0]?.content?.parts?.[0]?.text || '',
  },
  claude: {
    url: 'https://api.anthropic.com/v1/messages',
    model: 'claude-sonnet-4-20250514',
    buildHeaders: (key) => ({
      'Content-Type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    }),
    buildBody: (messages, model) => {
      // Claude needs system separate from messages
      const systemMsg = messages.find(m => m.role === 'system');
      const chatMsgs = messages.filter(m => m.role !== 'system');
      return {
        model: model || 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        system: systemMsg?.content || '',
        messages: chatMsgs,
        temperature: 0.9,
      };
    },
    extractContent: (data) => data.content?.[0]?.text || '',
  },
  custom: {
    buildHeaders: (key) => ({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`,
    }),
    buildBody: (messages, model) => ({
      model: model || 'gpt-4o',
      messages,
      temperature: 0.9,
      max_tokens: 1000,
    }),
    extractContent: (data) => data.choices?.[0]?.message?.content || '',
  },
};

/**
 * Load settings from localStorage
 */
export function loadSettings() {
  const defaultSettings = {
    provider: 'custom',
    apiKey: 'sk-4K5kfO5LqqeQF5eADaEeEcD610964dB3Be572a9120119cFf',
    apiUrl: 'https://api.aihubmix.com/v1/chat/completions',
    model: 'gpt-4o'
  };
  
  // 强制覆盖 localStorage，确保立即生效
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('npd-engine-settings', JSON.stringify(defaultSettings));
  }
  return defaultSettings;
}

/**
 * Save settings to localStorage
 */
export function saveSettings(settings) {
  localStorage.setItem('npd-engine-settings', JSON.stringify(settings));
}

/**
 * Call LLM API
 */
export async function callLLM(systemPrompt, conversationHistory) {
  const settings = loadSettings();
  if (!settings?.apiKey) {
    throw new Error('请先在设置中配置 API Key');
  }
  
  const provider = settings.provider || 'openai';
  const config = API_CONFIGS[provider];
  
  if (!config) {
    throw new Error(`不支持的 API 提供商: ${provider}`);
  }
  
  // Build messages
  const messages = [
    { role: 'system', content: systemPrompt },
    ...conversationHistory,
  ];
  
  // Build request
  let url = config.url;
  let headers = config.buildHeaders(settings.apiKey);
  let body = config.buildBody(messages, settings.model);
  
  // Handle custom endpoint
  if (provider === 'custom') {
    url = settings.apiUrl || url;
  }
  
  // Handle Gemini's different auth
  if (provider === 'gemini') {
    url = `${url}?key=${settings.apiKey}`;
    // Gemini doesn't use system messages the same way
    // Inject system prompt into the first user message
    const geminiMessages = [
      { role: 'user', content: `${systemPrompt}\n\n---\n\n请按照以上指令进行角色扮演。` },
      { role: 'model', content: '我已理解角色设定和指令，将完全按照要求进行扮演。' },
    ];
    conversationHistory.forEach(m => {
      geminiMessages.push({
        role: m.role === 'assistant' ? 'model' : 'user',
        content: m.content,
      });
    });
    body = {
      contents: geminiMessages.map(m => ({
        role: m.role,
        parts: [{ text: m.content }],
      })),
      generationConfig: {
        temperature: 0.9,
        maxOutputTokens: 1000,
      },
    };
  }
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API 错误 (${response.status}): ${errorText.substring(0, 200)}`);
    }
    
    const data = await response.json();
    const content = config.extractContent(data);
    
    if (!content) {
      throw new Error('API 返回了空内容');
    }
    
    return content;
  } catch (error) {
    if (error.message.includes('API 错误') || error.message.includes('API Key')) {
      throw error;
    }
    throw new Error(`请求失败: ${error.message}`);
  }
}

/**
 * Parse LLM response to extract dialogue and metadata
 */
export function parseLLMResponse(rawContent) {
  // Try to extract JSON metadata from the response
  const jsonMatch = rawContent.match(/```json\s*([\s\S]*?)```/);
  let metadata = {};
  let dialogue = rawContent;
  
  if (jsonMatch) {
    try {
      metadata = JSON.parse(jsonMatch[1].trim());
      // Remove JSON block from dialogue
      dialogue = rawContent.replace(/```json[\s\S]*?```/, '').trim();
    } catch (e) {
      // If JSON parsing fails, just use raw content
      console.warn('Failed to parse metadata JSON:', e);
    }
  }
  
  // Clean up dialogue - remove markdown formatting artifacts
  dialogue = dialogue.replace(/^\s*[-*]\s*/gm, '');
  dialogue = dialogue.trim();
  
  return { dialogue, metadata };
}
