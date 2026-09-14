/**
 * Texting style analysis and Gemini 3.8 Flash response generator.
 */

// Regex patterns for emoji extraction
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

    // Word count
    const words = text.split(/\s+/).filter(Boolean);
    totalWords += words.length;

    // Capitalization check: starts with lowercase?
    const firstChar = text.charAt(0);
    if (firstChar === firstChar.toLowerCase() && firstChar !== firstChar.toUpperCase()) {
      lowerCaseStarts++;
    }

    // Terminal punctuation
    if (!text.endsWith('.') && !text.endsWith('!') && !text.endsWith('?')) {
      noTerminalPeriodCount++;
    }

    if (text.includes('!')) exclamationCount++;
    if (text.includes('?')) questionCount++;

    // Emojis
    const emojis = text.match(EMOJI_REGEX);
    if (emojis) {
      emojis.forEach(e => {
        emojiCounts[e] = (emojiCounts[e] || 0) + 1;
      });
    }

    // Keywords
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

  // Top emojis
  const topEmojis = Object.entries(emojiCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(entry => entry[0]);

  // Top slang/phrases
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
 * @param {string} [params.customInstruction] Specific guidance (e.g. "say yes but ask for 7pm")
 * @returns {Promise<Object>} { casual: string, detailed: string, witty: string }
 */
export async function generateGeminiReplies({
  apiKey,
  model = 'gemini-3.8-flash',
  chatName = 'Contact',
  recentMessages = [],
  styleProfile,
  customInstruction = ''
}) {
  if (!apiKey || !apiKey.trim()) {
    throw new Error('Gemini API Key is required. Please add your key in the Settings modal.');
  }

  // Format conversation context (last 12 messages)
  const contextSlice = recentMessages.slice(-12).map(m => {
    const sender = m.fromMe ? 'You' : chatName;
    return `${sender}: "${m.text}"`;
  }).join('\n');

  const profileDesc = styleProfile ? `
- User Capitalization Style: ${styleProfile.casingTendency}
- Average Message Length: ~${styleProfile.avgWordsPerMsg} words (keep messages crisp and authentic)
- Terminal Punctuation: ${styleProfile.omitsTerminalPeriodPct}% of the time the user does NOT end messages with a period. Match this natural cadence.
- Top Preferred Emojis: ${styleProfile.topEmojis.join(' ')} (use subtly when fitting)
- Common Vocabulary & Fillers: ${styleProfile.commonPhrases.join(', ')}
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
Do NOT sound like an AI, corporate email, or formal customer assistant. Mimic the user's authentic capitalization, slang, brevity, and punctuation quirks.

Output MUST be a valid JSON object with exactly these 3 keys:
{
  "casual": "Quick, punchy everyday reply (1 sentence or phrase)",
  "detailed": "A more complete or thoughtful response that still sounds like a natural WhatsApp text",
  "witty": "A playful, humorous, or witty response matching the vibe"
}
`;

  // Use Gemini API REST endpoint
  // Supports gemini-3.8-flash, gemini-2.5-flash, gemini-1.5-flash
  const effectiveModel = model.trim() || 'gemini-3.8-flash';
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${effectiveModel}:generateContent?key=${encodeURIComponent(apiKey.trim())}`;

  const requestBody = {
    contents: [
      {
        parts: [
          { text: promptText }
        ]
      }
    ],
    generationConfig: {
      temperature: 0.85,
      topP: 0.95,
      responseMimeType: "application/json"
    }
  };

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    let errorDetail = `Status ${response.status}: ${response.statusText}`;
    try {
      const errJson = await response.json();
      if (errJson.error && errJson.error.message) {
        errorDetail = errJson.error.message;
      }
    } catch {
      // Use status text
    }
    throw new Error(`Gemini API error: ${errorDetail}`);
  }

  const data = await response.json();
  const rawResponseText = data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!rawResponseText) {
    throw new Error('Received an empty response from Gemini.');
  }

  // Parse JSON from output
  try {
    const cleanedJson = rawResponseText.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleanedJson);
    return {
      casual: parsed.casual || 'Sounds good!',
      detailed: parsed.detailed || 'Yeah that works for me, let me know when you get there.',
      witty: parsed.witty || 'Haha deal, only if you get the first round! 🚀'
    };
  } catch (parseErr) {
    console.warn('Could not parse Gemini JSON response directly, falling back to raw extract:', rawResponseText);
    return {
      casual: rawResponseText.slice(0, 80).trim(),
      detailed: rawResponseText.trim(),
      witty: 'Haha totally down!'
    };
  }
}

/**
 * Generates instant offline mock replies based on the user's style profile
 * for zero-friction demonstration when no API key is yet configured.
 * 
 * @param {Object} styleProfile 
 * @param {string} chatName 
 * @param {string} lastMsgText 
 * @returns {Object}
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
