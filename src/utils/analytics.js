/**
 * Conversation Analytics & "WhatsApp Wrapped" Insights Engine
 */

const EMOJI_REGEX = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E6}-\u{1F1FF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}]/gu;

const STOPWORDS = new Set([
  'the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'i', 'it', 'for', 'not', 'on', 'with', 
  'he', 'as', 'you', 'do', 'at', 'this', 'but', 'his', 'by', 'from', 'they', 'we', 'say', 'her', 
  'she', 'or', 'an', 'will', 'my', 'one', 'all', 'would', 'there', 'their', 'what', 'so', 'up', 
  'out', 'if', 'about', 'who', 'get', 'which', 'go', 'me', 'when', 'make', 'can', 'like', 'time', 
  'no', 'just', 'him', 'know', 'take', 'people', 'into', 'year', 'your', 'good', 'some', 'could', 
  'them', 'see', 'other', 'than', 'then', 'now', 'look', 'only', 'come', 'its', 'over', 'think', 
  'also', 'back', 'after', 'use', 'two', 'how', 'our', 'work', 'first', 'well', 'way', 'even', 
  'new', 'want', 'because', 'any', 'these', 'give', 'day', 'most', 'us', 'is', 'am', 'are', 'was', 'were'
]);

/**
 * Computes rich chat analytics from an array of messages.
 * 
 * @param {Array<Object>} messages 
 * @param {string} chatName 
 * @returns {Object} Comprehensive analytics report
 */
export function computeChatAnalytics(messages = [], chatName = 'Contact') {
  if (!messages || messages.length === 0) {
    return null;
  }

  let sentCount = 0;
  let receivedCount = 0;
  let sentWordCount = 0;
  let receivedWordCount = 0;

  const hourlyCounts = new Array(24).fill(0);
  const dayOfWeekCounts = new Array(7).fill(0); // 0 = Sun, 1 = Mon, ...
  const userEmojis = {};
  const contactEmojis = {};
  const wordFrequency = {};

  // For response time calculation (replies within 12 hours)
  const userResponseDeltas = []; // in minutes
  const contactResponseDeltas = [];

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    const isSent = Boolean(msg.fromMe);
    const d = new Date(msg.timestamp);

    // Activity distribution
    const hour = d.getHours();
    hourlyCounts[hour]++;

    const day = d.getDay();
    dayOfWeekCounts[day]++;

    // Message counts
    if (isSent) {
      sentCount++;
    } else {
      receivedCount++;
    }

    const text = msg.text || '';
    if (text) {
      const words = text.toLowerCase().split(/[\s,.;:!?()"'`~-]+/).filter(w => w.length > 2 && !STOPWORDS.has(w) && !/^\d+$/.test(w));
      
      if (isSent) {
        sentWordCount += words.length;
      } else {
        receivedWordCount += words.length;
      }

      words.forEach(w => {
        wordFrequency[w] = (wordFrequency[w] || 0) + 1;
      });

      // Emojis
      const emojis = text.match(EMOJI_REGEX);
      if (emojis) {
        emojis.forEach(e => {
          if (isSent) {
            userEmojis[e] = (userEmojis[e] || 0) + 1;
          } else {
            contactEmojis[e] = (contactEmojis[e] || 0) + 1;
          }
        });
      }
    }

    // Response time delta: check if previous message was from the opposite person
    if (i > 0) {
      const prevMsg = messages[i - 1];
      if (prevMsg.fromMe !== msg.fromMe) {
        const deltaMs = msg.timestamp - prevMsg.timestamp;
        const deltaMin = deltaMs / (1000 * 60);
        // Only consider replies between 10 seconds and 12 hours
        if (deltaMin >= 0.15 && deltaMin <= 720) {
          if (isSent) {
            userResponseDeltas.push(deltaMin);
          } else {
            contactResponseDeltas.push(deltaMin);
          }
        }
      }
    }
  }

  // Response times
  const avgUserReplyMin = userResponseDeltas.length > 0 
    ? Math.round(userResponseDeltas.reduce((a, b) => a + b, 0) / userResponseDeltas.length)
    : 4;

  const avgContactReplyMin = contactResponseDeltas.length > 0 
    ? Math.round(contactResponseDeltas.reduce((a, b) => a + b, 0) / contactResponseDeltas.length)
    : 8;

  // Peak Hour calculation
  let peakHour = 0;
  let maxHourCount = -1;
  hourlyCounts.forEach((c, h) => {
    if (c > maxHourCount) {
      maxHourCount = c;
      peakHour = h;
    }
  });

  const peakHourFormatted = `${peakHour.toString().padStart(2, '0')}:00 - ${(peakHour + 1).toString().padStart(2, '0')}:00`;

  // Top Emojis
  const topUserEmojis = Object.entries(userEmojis)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([emoji, count]) => ({ emoji, count }));

  const topContactEmojis = Object.entries(contactEmojis)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([emoji, count]) => ({ emoji, count }));

  // Top Topics / Words
  const topWords = Object.entries(wordFrequency)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([word, count]) => ({ word, count }));

  // Sentiment / Vibe assessment
  let vibe = 'Warm & Friendly';
  const totalEmojisCount = Object.values(userEmojis).reduce((a, b) => a + b, 0) + Object.values(contactEmojis).reduce((a, b) => a + b, 0);
  const emojiRatio = totalEmojisCount / messages.length;

  if (emojiRatio > 0.4) {
    vibe = 'Super Expressive & Playful 🔥';
  } else if (emojiRatio > 0.15) {
    vibe = 'Warm & Upbeat ✨';
  } else if (sentCount > receivedCount * 2) {
    vibe = 'You Lead the Chat 🚀';
  } else if (receivedCount > sentCount * 2) {
    vibe = 'Deep Listener 🎧';
  } else {
    vibe = 'Balanced & Direct 💬';
  }

  // Days of week names
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const dayDistribution = dayNames.map((name, idx) => ({
    day: name,
    count: dayOfWeekCounts[idx]
  }));

  const maxDayCount = Math.max(...dayOfWeekCounts, 1);

  return {
    totalMessages: messages.length,
    chatName,
    sentCount,
    receivedCount,
    sentPct: Math.round((sentCount / messages.length) * 100) || 50,
    receivedPct: Math.round((receivedCount / messages.length) * 100) || 50,
    avgUserReplyMin,
    avgContactReplyMin,
    peakHourFormatted,
    vibe,
    hourlyCounts,
    maxHourCount: Math.max(...hourlyCounts, 1),
    dayDistribution,
    maxDayCount,
    topUserEmojis,
    topContactEmojis,
    topWords
  };
}
