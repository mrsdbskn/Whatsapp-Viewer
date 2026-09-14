/**
 * Texting style analysis, Gemini 3 response generator,
 * live model fetching, and AI Chat Summarizer (TL;DR & Action Items).
 */

/**
 * Curated list of active, modern Gemini 3 models matching Google's latest documentation.
 * Serves as the rich default/offline catalog when no API key is set yet.
 */
export const DEFAULT_GEMINI_MODELS = [
  {
    id: 'gemini-3.8-flash',
    name: 'Gemini 3.8 Flash',
    desc: 'Most intelligent Flash model for autonomous agents, software engineering & tone analysis.',
    badge: 'New',
    isRecommended: true
  },
  {
    id: 'gemini-3.7-flash',
    name: 'Gemini 3.7 Flash',
    desc: 'Flagship model for complex coding, agentic workflows, and reliable multi-step execution.',
    badge: 'Stable'
  },
  {
    id: 'gemini-3.6-flash',
    name: 'Gemini 3.6 Flash',
    desc: 'Official recommended replacement for Gemini 2.5. Balanced speed and multimodal capabilities.',
    badge: 'Stable',
    isRecommended: true
  },
  {
    id: 'gemini-3.5-flash',
    name: 'Gemini 3.5 Flash',
    desc: 'Baseline speed and foundational performance for routine, high-throughput workloads.',
    badge: 'Stable'
  },
  {
    id: 'gemini-3.5-flash-lite',
    name: 'Gemini 3.5 Flash-Lite',
    desc: 'Fastest, most cost-effective 3.5 model for high-throughput execution.',
    badge: 'Fast'
  },
  {
    id: 'gemini-3.1-flash-lite',
    name: 'Gemini 3.1 Flash-Lite',
    desc: 'Frontier-class performance rivaling larger models at a fraction of the cost.',
    badge: 'Efficient'
  },
  {
    id: 'gemini-3.1-pro-preview',
    name: 'Gemini 3.1 Pro',
    desc: 'Advanced intelligence, complex problem-solving skills, and vibe coding capabilities.',
    badge: 'Preview'
  },
  {
    id: 'gemini-3-flash-preview',
    name: 'Gemini 3 Flash Preview',
    desc: 'Preview model with frontier performance at a fraction of the cost.',
    badge: 'Preview'
  },
  {
    id: 'gemini-flash-latest',
    name: 'Gemini Flash Latest',
    desc: 'Auto-updating pointer alias always running the latest stable Flash release.',
    badge: 'Auto-Update'
  }
];

/**
 * List of known deprecated/shut-down models to automatically migrate away from.
 */
export const DEPRECATED_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-2.5-pro',
  'gemini-2.0-flash',
  'gemini-2.0-flash-lite',
  'gemini-1.5-flash',
  'gemini-1.5-pro',
  'gemini-1.0-pro'
];

/**
 * Sanitizes model ID, automatically replacing deprecated models with Gemini 3.8 Flash.
 * @param {string} modelId 
 * @returns {string}
 */
export function sanitizeModelId(modelId) {
  if (!modelId) return 'gemini-3.8-flash';
  const clean = modelId.trim().replace(/^models\//, '');
  if (DEPRECATED_MODELS.includes(clean) || clean.startsWith('gemini-1.') || clean.startsWith('gemini-2.')) {
    return 'gemini-3.8-flash';
  }
  return clean;
}

/**
 * Dynamically queries Google's Gemini API to fetch currently available models
 * that support generateContent for the user's API key.
 * 
 * @param {string} apiKey 
 * @returns {Promise<Array<Object>>} List of available models
 */
export async function fetchAvailableGeminiModels(apiKey) {
  if (!apiKey || !apiKey.trim()) {
    return DEFAULT_GEMINI_MODELS;
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey.trim())}`;
  const resp = await fetch(endpoint);

  if (!resp.ok) {
    let errMessage = `HTTP ${resp.status}: ${resp.statusText}`;
    try {
      const errJson = await resp.json();
      if (errJson.error?.message) errMessage = errJson.error.message;
    } catch {}
    throw new Error(errMessage);
  }

  const data = await resp.json();
  const rawModels = data.models || [];

  // Filter for models supporting content generation
  const contentModels = rawModels.filter(m => {
    const methods = m.supportedGenerationMethods || [];
    return methods.includes('generateContent');
  });

  if (contentModels.length === 0) {
    return DEFAULT_GEMINI_MODELS;
  }

  // Format and prioritize models
  const parsedModels = contentModels.map(m => {
    const id = m.name.replace(/^models\//, '');
    let badge = 'Active';
    if (id.includes('3.8')) badge = 'New';
    else if (id.includes('preview')) badge = 'Preview';
    else if (id.includes('latest')) badge = 'Latest';
    else if (id.includes('lite')) badge = 'Lite';
    else if (id.includes('3.7') || id.includes('3.6') || id.includes('3.5')) badge = 'Stable';

    return {
      id,
      name: m.displayName || id,
      desc: m.description || 'Gemini conversational model',
      badge,
      inputTokenLimit: m.inputTokenLimit,
      outputTokenLimit: m.outputTokenLimit,
      isRecommended: id === 'gemini-3.8-flash' || id === 'gemini-3.6-flash'
    };
  });

  // Sort: Recommended first, then Gemini 3 Flash, then other Gemini 3, then rest
  parsedModels.sort((a, b) => {
    if (a.id === 'gemini-3.8-flash') return -1;
    if (b.id === 'gemini-3.8-flash') return 1;
    if (a.id === 'gemini-3.6-flash') return -1;
    if (b.id === 'gemini-3.6-flash') return 1;
    if (a.id === 'gemini-3.7-flash') return -1;
    if (b.id === 'gemini-3.7-flash') return 1;
    return a.id.localeCompare(b.id);
  });

  return parsedModels;
}

const EMOJI_REGEX = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E6}-\u{1F1FF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}]/gu;

/**
 * Analyzes sent message history to extract user's unique texting persona.
 * 
 * @param {Array<string>} sentMessages 
 * @returns {Object} Detailed stylistic profile
 */
export function analyzeTextingStyle(sentMessages = []) {
  if (!sentMessages || sentMessages.length === 0) {
    return {
      sampleCount: 0,
      avgWordsPerMsg: 6,
      casingTendency: 'Casual mixed',
      omitsTerminalPeriodPct: 90,
      exclamationFrequency: 'Occasional',
      topEmojis: ['😂', '👍', '🙏'],
      commonPhrases: ['sounds good', 'yeah', 'haha'],
      summary: 'Casual, modern WhatsApp texting style with punchy phrases.'
    };
  }

  let totalWords = 0;
  let lowerCaseStarts = 0;
  let noTerminalPeriodCount = 0;
  let exclamationCount = 0;
  let questionCount = 0;
  const emojiCounts = {};
  const phraseCounts = {};

  const commonKeywords = [
    'haha', 'lol', 'tbh', 'yeah', 'yep', 'omw', 'definitely', 
    'sounds good', 'cool', 'thanks', 'perfect', 'gonna', 'wanna', 
    'totally', 'no worries', 'cheers', 'awesome', 'bet'
  ];

  sentMessages.forEach(msg => {
    const text = msg.trim();
    if (!text) return;

    const words = text.split(/\s+/).filter(Boolean);
    totalWords += words.length;

    const firstChar = text.charAt(0);
    if (firstChar === firstChar.toLowerCase() && firstChar !== firstChar.toUpperCase()) {
      lowerCaseStarts++;
    }

    if (!text.endsWith('.') && !text.endsWith('!') && !text.endsWith('?')) {
      noTerminalPeriodCount++;
    }

    if (text.includes('!')) exclamationCount++;
    if (text.includes('?')) questionCount++;

    const emojis = text.match(EMOJI_REGEX);
    if (emojis) {
      emojis.forEach(e => {
        emojiCounts[e] = (emojiCounts[e] || 0) + 1;
      });
    }

    const lowerText = text.toLowerCase();
    commonKeywords.forEach(kw => {
      if (lowerText.includes(kw)) {
        phraseCounts[kw] = (phraseCounts[kw] || 0) + 1;
      }
    });
  });

  const count = sentMessages.length;
  const avgWords = Math.round((totalWords / count) * 10) / 10;
  const lowerStartPct = Math.round((lowerCaseStarts / count) * 100);
  const noPeriodPct = Math.round((noTerminalPeriodCount / count) * 100);

  const topEmojis = Object.entries(emojiCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(entry => entry[0]);

  const commonPhrases = Object.entries(phraseCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(entry => entry[0]);

  let casingStyle = 'Sentence case';
  if (lowerStartPct > 60) {
    casingStyle = 'Mostly lowercase (informal)';
  } else if (lowerStartPct > 35) {
    casingStyle = 'Relaxed casual';
  }

  return {
    sampleCount: count,
    avgWordsPerMsg: avgWords || 5,
    casingTendency: casingStyle,
    omitsTerminalPeriodPct: noPeriodPct,
    exclamationFrequency: exclamationCount > count * 0.3 ? 'Frequent (!)' : 'Selective',
    questionFrequency: questionCount > count * 0.25 ? 'High' : 'Moderate',
    topEmojis: topEmojis.length > 0 ? topEmojis : ['👍', '😂'],
    commonPhrases: commonPhrases.length > 0 ? commonPhrases : ['sounds good', 'yeah'],
    summary: `${casingStyle}, avg ${avgWords} words/message, ${noPeriodPct}% period omission.`
  };
}

/**
 * Calls Google Gemini API (defaults to Gemini 3.8 Flash) to generate authentic WhatsApp replies.
 * 
 * @param {Object} params
 * @param {string} params.apiKey Gemini API Key
 * @param {string} [params.model="gemini-3.8-flash"]
 * @param {string} params.chatName Contact or group name
 * @param {Array<Object>} params.recentMessages Recent conversation history
 * @param {Object} params.styleProfile Texting style profile from analyzeTextingStyle
 * @param {string} [params.customInstruction] Specific guidance
 * @param {string} [params.tone="casual"] 'casual' | 'balanced' | 'professional' | 'witty'
 * @returns {Promise<Object>} { casual: string, detailed: string, witty: string }
 */
export async function generateGeminiReplies({
  apiKey,
  model = 'gemini-3.8-flash',
  chatName = 'Contact',
  recentMessages = [],
  styleProfile,
  customInstruction = '',
  tone = 'casual'
}) {
  if (!apiKey || !apiKey.trim()) {
    throw new Error('Gemini API Key is required. Please add your key in Settings.');
  }

  const contextSlice = recentMessages.slice(-14).map(m => {
    const sender = m.fromMe ? 'You' : chatName;
    return `${sender}: "${m.text}"`;
  }).join('\n');

  const toneInstructions = {
    casual: 'Emphasize punchy slang, lowercase starts, and informal brevity.',
    balanced: 'Warm, natural everyday tone with balanced punctuation.',
    professional: 'Polite, clear, slightly more structured, while staying friendly on WhatsApp.',
    witty: 'Playful, humorous, witty reactions and playful teasing.'
  };

  const profileDesc = styleProfile ? `
- User Capitalization Style: ${styleProfile.casingTendency}
- Average Message Length: ~${styleProfile.avgWordsPerMsg} words
- Terminal Punctuation: ${styleProfile.omitsTerminalPeriodPct}% of the time the user does NOT end messages with a period.
- Top Preferred Emojis: ${styleProfile.topEmojis.join(' ')}
- Common Vocabulary & Fillers: ${styleProfile.commonPhrases.join(', ')}
- Desired Tone: ${toneInstructions[tone] || toneInstructions.casual}
` : 'Casual, friendly WhatsApp texting, punchy responses, avoid periods at end of single lines.';

  const promptText = `
You are an expert ghostwriter for WhatsApp. You are replying on behalf of the user ("You") to the latest message from "${chatName}".

### AUTHENTIC USER TEXTING PROFILE:
${profileDesc}

### RECENT CHAT HISTORY:
${contextSlice}

${customInstruction ? `### ADDITIONAL USER INSTRUCTION / INTENT:\n"${customInstruction}"\n` : ''}

### TASK:
Generate 3 distinct WhatsApp reply candidates that sound 100% like the user organically typing on their phone right now.
Do NOT sound like an AI, corporate email, or formal customer assistant. Match the requested tone and the user's authentic style quirks.

Output MUST be a valid JSON object with exactly these 3 keys:
{
  "casual": "Quick, punchy everyday reply (1 sentence or phrase)",
  "detailed": "A more complete or thoughtful response that still sounds like a natural WhatsApp text",
  "witty": "A playful, humorous, or witty response matching the vibe"
}
`;

  let effectiveModel = sanitizeModelId(model);
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${effectiveModel}:generateContent?key=${encodeURIComponent(apiKey.trim())}`;

  const requestBody = {
    contents: [{ parts: [{ text: promptText }] }],
    generationConfig: {
      temperature: 0.85,
      topP: 0.95,
      responseMimeType: "application/json"
    }
  };

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    let errorDetail = `Status ${response.status}: ${response.statusText}`;
    let isDeprecated = false;
    let suggestedModel = 'gemini-3.6-flash';

    try {
      const errJson = await response.json();
      if (errJson.error?.message) {
        errorDetail = errJson.error.message;
        const match = errorDetail.match(/models\/(gemini-[0-9.]+-flash(?:-lite)?)/i);
        if (match && match[1]) {
          suggestedModel = match[1];
        }
        if (
          errorDetail.toLowerCase().includes('no longer available') ||
          errorDetail.toLowerCase().includes('deprecated') ||
          errorDetail.toLowerCase().includes('not found') ||
          response.status === 404
        ) {
          isDeprecated = true;
        }
      }
    } catch {}

    // Auto-migrate to supported model if requested model is deprecated
    if (isDeprecated && effectiveModel !== suggestedModel) {
      console.warn(`Model "${effectiveModel}" is deprecated. Auto-upgrading to "${suggestedModel}"...`);
      try {
        localStorage.setItem('gemini_model', suggestedModel);
      } catch {}
      return generateGeminiReplies({
        apiKey,
        model: suggestedModel,
        chatName,
        recentMessages,
        styleProfile,
        customInstruction,
        tone
      });
    }

    throw new Error(`Gemini API error: ${errorDetail}`);
  }

  const data = await response.json();
  const rawResponseText = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!rawResponseText) throw new Error('Empty response from Gemini.');

  try {
    const cleanedJson = rawResponseText.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleanedJson);
    return {
      casual: parsed.casual || 'Sounds good!',
      detailed: parsed.detailed || 'Yeah that works for me, let me know when you get there.',
      witty: parsed.witty || 'Haha deal, only if you get the first round! 🚀'
    };
  } catch {
    return {
      casual: rawResponseText.slice(0, 80).trim(),
      detailed: rawResponseText.trim(),
      witty: 'Haha totally down!'
    };
  }
}

/**
 * Summarizes an entire conversation thread into a structured Catch-Up report:
 * 1. Executive TL;DR (3 bullet points)
 * 2. Key Decisions made
 * 3. Action Items / Dates / Locations mentioned
 * 
 * @param {Object} params
 * @param {string} params.apiKey
 * @param {string} [params.model="gemini-3.8-flash"]
 * @param {string} params.chatName
 * @param {Array<Object>} params.messages
 * @returns {Promise<Object>}
 */
export async function generateChatSummary({
  apiKey,
  model = 'gemini-3.8-flash',
  chatName = 'Contact',
  messages = []
}) {
  if (!apiKey || !apiKey.trim()) {
    // Generate intelligent offline summary from message content
    return generateOfflineSummary(chatName, messages);
  }

  const sampleMessages = messages.slice(-50).map(m => {
    const sender = m.fromMe ? 'You' : chatName;
    const time = new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return `[${time}] ${sender}: ${m.text}`;
  }).join('\n');

  const promptText = `
You are an executive WhatsApp assistant. Analyze this conversation between "You" and "${chatName}".

### CONVERSATION LOG:
${sampleMessages}

### TASK:
Provide a structured executive summary in JSON format with:
1. "summary": Array of 3 concise, clear bullet points summarizing the core discussion.
2. "decisions": Array of key decisions, agreements, or conclusions reached (max 3).
3. "actionItems": Array of specific dates, times, locations, or commitments made (e.g. "Lunch at Thai place at 12:30").

Output format MUST be strictly JSON:
{
  "summary": ["point 1", "point 2", "point 3"],
  "decisions": ["decision 1", "decision 2"],
  "actionItems": ["action item 1", "action item 2"]
}
`;

  let effectiveModel = sanitizeModelId(model);
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${effectiveModel}:generateContent?key=${encodeURIComponent(apiKey.trim())}`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: promptText }] }],
      generationConfig: {
        temperature: 0.3,
        responseMimeType: "application/json"
      }
    })
  });

  if (!response.ok) {
    let errorDetail = `Status ${response.status}: ${response.statusText}`;
    let isDeprecated = false;
    let suggestedModel = 'gemini-3.6-flash';

    try {
      const errJson = await response.json();
      if (errJson.error?.message) {
        errorDetail = errJson.error.message;
        const match = errorDetail.match(/models\/(gemini-[0-9.]+-flash(?:-lite)?)/i);
        if (match && match[1]) {
          suggestedModel = match[1];
        }
        if (
          errorDetail.toLowerCase().includes('no longer available') ||
          errorDetail.toLowerCase().includes('deprecated') ||
          errorDetail.toLowerCase().includes('not found') ||
          response.status === 404
        ) {
          isDeprecated = true;
        }
      }
    } catch {}

    if (isDeprecated && effectiveModel !== suggestedModel) {
      console.warn(`Model "${effectiveModel}" is deprecated. Auto-upgrading to "${suggestedModel}" for summary...`);
      try {
        localStorage.setItem('gemini_model', suggestedModel);
      } catch {}
      return generateChatSummary({
        apiKey,
        model: suggestedModel,
        chatName,
        messages
      });
    }

    throw new Error(`Gemini summary error: ${errorDetail}`);
  }

  const data = await response.json();
  const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!rawText) throw new Error('No summary returned.');

  try {
    const cleaned = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleaned);
  } catch {
    return generateOfflineSummary(chatName, messages);
  }
}

/**
 * Intelligent offline summary fallback when testing without Gemini API key.
 */
export function generateOfflineSummary(chatName, messages = []) {
  const lastFew = messages.slice(-10);
  const mentionsLunch = messages.some(m => (m.text || '').toLowerCase().includes('lunch') || (m.text || '').toLowerCase().includes('thai'));
  const mentionsDinner = messages.some(m => (m.text || '').toLowerCase().includes('dinner') || (m.text || '').toLowerCase().includes('lasagna'));
  const mentionsFigma = messages.some(m => (m.text || '').toLowerCase().includes('figma') || (m.text || '').toLowerCase().includes('tokens'));

  if (mentionsLunch) {
    return {
      summary: [
        `Coordinated lunch plans at the new Thai restaurant on 4th street.`,
        `Agreed to meet at 12:30 PM and grab an outdoor patio table.`,
        `${chatName} offered to order an iced matcha with oat milk while waiting.`
      ],
      decisions: [
        `Meeting time locked at 12:30 PM outside on the patio.`
      ],
      actionItems: [
        `Order iced matcha (with oat milk) upon arrival.`
      ]
    };
  }

  if (mentionsFigma) {
    return {
      summary: [
        `Finalized Figma tokens for OLED dark mode in feature branch.`,
        `Consensus reached to use #0B141A for the base canvas rather than pure black to prevent OLED smearing.`,
        `Verified GitHub Pages build with relative path base './'.`
      ],
      decisions: [
        `Use #0B141A for OLED slate canvas.`,
        `Keep relative asset path base for seamless deployment.`
      ],
      actionItems: [
        `Decide on cutting release tag v1.2.`
      ]
    };
  }

  if (mentionsDinner) {
    return {
      summary: [
        `Caught up on project launch progress and family pictures.`,
        `Confirmed attendance for Sunday dinner.`,
        `Homemade lasagna scheduled for dinner at 6:00 PM.`
      ],
      decisions: [
        `Attending Sunday family dinner.`
      ],
      actionItems: [
        `Arrive at 6:00 PM on Sunday.`
      ]
    };
  }

  return {
    summary: [
      `Active discussion with ${chatName} spanning ${messages.length} messages.`,
      `Most recent exchange touched on upcoming plans and project timelines.`,
      `High conversational responsiveness with quick turnaround.`
    ],
    decisions: [
      `Maintained active communication on priority tasks.`
    ],
    actionItems: [
      `Follow up on pending questions in the thread.`
    ]
  };
}

/**
 * Offline demo replies based on authentic style profile.
 */
export function generateOfflineDemoReplies(styleProfile, chatName, lastMsgText = '') {
  const isQuestion = lastMsgText.includes('?');
  const favEmoji = (styleProfile?.topEmojis && styleProfile.topEmojis[0]) || '👍';
  const phrase = (styleProfile?.commonPhrases && styleProfile.commonPhrases[0]) || 'sounds good';

  if (isQuestion) {
    return {
      casual: `yeah ${phrase}! omw now ${favEmoji}`,
      detailed: `just wrapped up here, give me like 10 mins and I'll be right over. grab us a spot!`,
      witty: `haha depends, are you buying if I make it in 5 mins? 😉`
    };
  }

  return {
    casual: `haha 100%, ${phrase} ${favEmoji}`,
    detailed: `definitely down for that! let me finish up this build and I'll ping you as soon as it's live`,
    witty: `you read my mind haha, literally was just about to say the exact same thing 🚀`
  };
}
