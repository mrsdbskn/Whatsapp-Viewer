import initSqlJs from 'sql.js';

let sqlEngineInstance = null;

/**
 * Initializes sql.js in memory using local sql-wasm.wasm or CDN fallback.
 * @returns {Promise<any>}
 */
export async function getSqlEngine() {
  if (sqlEngineInstance) return sqlEngineInstance;

  // Support Node.js testing environment
  if (typeof process !== 'undefined' && process.versions && process.versions?.node && typeof window === 'undefined') {
    try {
      const dynamicImport = new Function('m', 'return import(m)');
      const fs = await dynamicImport('fs');
      const path = await dynamicImport('path');
      const wasmPath = path.resolve('node_modules/sql.js/dist/sql-wasm.wasm');
      if (fs.existsSync(wasmPath)) {
        const wasmBinary = fs.readFileSync(wasmPath);
        sqlEngineInstance = await initSqlJs({ wasmBinary });
        return sqlEngineInstance;
      }
    } catch (nodeErr) {
      console.warn('Node wasm loading fallback:', nodeErr);
    }
  }

  try {
    sqlEngineInstance = await initSqlJs({
      locateFile: file => `./${file}`
    });
    return sqlEngineInstance;
  } catch (err) {
    console.warn('Local WASM init failed, loading from CDN fallback...', err);
    try {
      sqlEngineInstance = await initSqlJs({
        locateFile: file => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.12.0/${file}`
      });
      return sqlEngineInstance;
    } catch (cdnErr) {
      console.error('Fatal: Failed to load sql.js from both local and CDN sources.', cdnErr);
      throw cdnErr;
    }
  }
}

/**
 * Loads raw SQLite Uint8Array buffer into sql.js Database.
 * @param {Uint8Array} sqliteBytes 
 * @returns {Promise<any>} Database instance
 */
export async function openDatabase(sqliteBytes) {
  const SQL = await getSqlEngine();
  return new SQL.Database(sqliteBytes);
}

/**
 * Formats raw WhatsApp JID into clean readable display.
 * @param {string} jid 
 * @returns {string}
 */
export function formatJid(jid) {
  if (!jid) return 'Unknown Contact';
  if (jid.endsWith('@s.whatsapp.net')) {
    const num = jid.replace('@s.whatsapp.net', '');
    if (num.length >= 10) {
      return `+${num.slice(0, num.length - 10)} ${num.slice(-10, -7)} ${num.slice(-7, -4)} ${num.slice(-4)}`;
    }
    return `+${num}`;
  }
  if (jid.endsWith('@g.us')) {
    return `Group (${jid.split('-')[0].slice(-4)}...)`;
  }
  return jid;
}

/**
 * Fetches all chat threads from the database matching the prompt specification:
 * 
 * SELECT 
 *   c._id AS chat_id, 
 *   COALESCE(c.subject, j.raw_string) AS display_name,
 *   j.raw_string AS jid,
 *   COUNT(m._id) AS msg_count
 * FROM chat c
 * JOIN jid j ON c.jid_row_id = j._id
 * LEFT JOIN message m ON m.chat_row_id = c._id
 * GROUP BY c._id
 * HAVING msg_count > 0
 * ORDER BY msg_count DESC;
 * 
 * @param {any} db sql.js Database instance
 * @returns {Array<Object>} List of conversation threads
 */
export function fetchChatThreads(db) {
  const tableCheck = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('chat', 'jid', 'message', 'messages');");
  const tables = tableCheck.length && tableCheck[0].values ? tableCheck[0].values.map(r => r[0]) : [];

  if (tables.includes('chat') && tables.includes('jid')) {
    try {
      const query = `
        SELECT 
          c._id AS chat_id, 
          COALESCE(c.subject, j.raw_string) AS display_name,
          j.raw_string AS jid,
          COUNT(m._id) AS msg_count
        FROM chat c
        JOIN jid j ON c.jid_row_id = j._id
        LEFT JOIN message m ON m.chat_row_id = c._id
        GROUP BY c._id
        HAVING msg_count > 0
        ORDER BY msg_count DESC;
      `;
      const res = db.exec(query);
      if (res.length > 0 && res[0].values) {
        return res[0].values.map(row => {
          const chatId = row[0];
          const rawDisplayName = row[1];
          const jid = row[2];
          const msgCount = row[3];
          const isGroup = jid ? jid.endsWith('@g.us') : false;

          let lastMsg = '';
          let lastTimestamp = 0;
          try {
            const lastMsgRes = db.exec(`
              SELECT text_data, timestamp, from_me, message_type
              FROM message 
              WHERE chat_row_id = ${chatId} AND (text_data IS NOT NULL OR message_type > 0)
              ORDER BY timestamp DESC LIMIT 1;
            `);
            if (lastMsgRes.length > 0 && lastMsgRes[0].values.length > 0) {
              const r = lastMsgRes[0].values[0];
              const text = r[0];
              const type = r[3];
              if (text) {
                lastMsg = text;
              } else if (type === 1) {
                lastMsg = '📷 Photo';
              } else if (type === 2) {
                lastMsg = '🎤 Voice message';
              } else if (type === 3) {
                lastMsg = '📹 Video';
              } else if (type === 9) {
                lastMsg = '📄 Document';
              } else {
                lastMsg = 'Media message';
              }
              lastTimestamp = r[1] || 0;
            }
          } catch {}

          let formattedName = rawDisplayName;
          if (rawDisplayName === jid) {
            formattedName = formatJid(jid);
          }

          return {
            chatId,
            displayName: formattedName || 'WhatsApp Contact',
            rawDisplayName,
            jid,
            msgCount,
            isGroup,
            lastMsg,
            lastTimestamp: normalizeTimestamp(lastTimestamp)
          };
        });
      }
    } catch (err) {
      console.warn('Standard query failed, checking fallback schemas...', err);
    }
  }

  // Fallback for older WhatsApp databases (messages table)
  if (tables.includes('messages')) {
    try {
      const fallbackQuery = `
        SELECT 
          key_remote_jid, 
          COUNT(*) as msg_count,
          MAX(timestamp) as last_time
        FROM messages
        WHERE key_remote_jid IS NOT NULL
        GROUP BY key_remote_jid
        ORDER BY msg_count DESC;
      `;
      const res = db.exec(fallbackQuery);
      if (res.length > 0 && res[0].values) {
        return res[0].values.map((row, idx) => {
          const jid = row[0];
          const msgCount = row[1];
          const lastTime = row[2];
          return {
            chatId: idx + 1,
            displayName: formatJid(jid),
            rawDisplayName: jid,
            jid,
            msgCount,
            isGroup: jid.endsWith('@g.us'),
            lastMsg: 'Legacy WhatsApp message',
            lastTimestamp: normalizeTimestamp(lastTime)
          };
        });
      }
    } catch (legacyErr) {
      console.error('Legacy query failed:', legacyErr);
    }
  }

  return [];
}

/**
 * Normalizes timestamps to valid JS millisecond epoch.
 * @param {number} ts 
 * @returns {number}
 */
export function normalizeTimestamp(ts) {
  if (!ts) return Date.now();
  if (ts < 10000000000) {
    return ts * 1000;
  }
  return ts;
}

/**
 * Fetches messages for a specific chat thread.
 * 
 * @param {any} db sql.js Database instance
 * @param {number|string} chatId 
 * @param {Object} [filters] 
 * @returns {Array<Object>} Messages sorted chronologically
 */
export function fetchMessagesForChat(db, chatId, filters = {}) {
  const { searchQuery = '', sender = 'all', startDate = null, endDate = null } = filters;

  try {
    const query = `
      SELECT 
        _id, 
        chat_row_id, 
        from_me, 
        timestamp, 
        COALESCE(text_data, '') as text_data, 
        COALESCE(message_type, 0) as message_type, 
        COALESCE(status, 0) as status
      FROM message 
      WHERE chat_row_id = ?
      ORDER BY timestamp ASC;
    `;

    const stmt = db.prepare(query);
    stmt.bind([chatId]);

    const messages = [];
    while (stmt.step()) {
      const row = stmt.getAsObject();
      const rawTimestamp = normalizeTimestamp(row.timestamp);

      if (sender === 'sent' && !row.from_me) continue;
      if (sender === 'received' && row.from_me) continue;

      if (startDate && rawTimestamp < startDate) continue;
      if (endDate && rawTimestamp > endDate) continue;

      const text = row.text_data || '';
      if (searchQuery && !text.toLowerCase().includes(searchQuery.toLowerCase())) {
        continue;
      }

      messages.push({
        id: row._id,
        chatId: row.chat_row_id,
        fromMe: Boolean(row.from_me),
        timestamp: rawTimestamp,
        text: text,
        type: row.message_type,
        status: row.status,
      });
    }
    stmt.free();
    return messages;
  } catch (err) {
    console.warn('fetchMessagesForChat failed on modern schema, trying legacy...', err);
    try {
      const res = db.exec(`
        SELECT _id, key_remote_jid, key_from_me, timestamp, data
        FROM messages
        ORDER BY timestamp ASC;
      `);
      if (res.length > 0 && res[0].values) {
        return res[0].values.map(row => ({
          id: row[0],
          chatId,
          fromMe: Boolean(row[2]),
          timestamp: normalizeTimestamp(row[3]),
          text: row[4] || '',
          type: 0,
          status: 13
        }));
      }
    } catch {}
    return [];
  }
}

/**
 * Searches across all messages in all conversation threads simultaneously.
 * 
 * @param {any} db sql.js Database instance
 * @param {string} query Search text
 * @returns {Array<Object>} List of matching results with chat metadata
 */
export function searchAllMessages(db, query = '') {
  if (!query || !query.trim()) return [];
  const cleanQuery = `%${query.trim().toLowerCase()}%`;

  try {
    const sql = `
      SELECT 
        m._id, 
        m.chat_row_id, 
        m.from_me, 
        m.timestamp, 
        m.text_data,
        COALESCE(c.subject, j.raw_string) as chat_name
      FROM message m
      JOIN chat c ON m.chat_row_id = c._id
      JOIN jid j ON c.jid_row_id = j._id
      WHERE lower(m.text_data) LIKE ?
      ORDER BY m.timestamp DESC
      LIMIT 100;
    `;

    const stmt = db.prepare(sql);
    stmt.bind([cleanQuery]);

    const results = [];
    while (stmt.step()) {
      const row = stmt.getAsObject();
      results.push({
        id: row._id,
        chatId: row.chat_row_id,
        chatName: row.chat_name || 'Contact',
        fromMe: Boolean(row.from_me),
        timestamp: normalizeTimestamp(row.timestamp),
        text: row.text_data
      });
    }
    stmt.free();
    return results;
  } catch (err) {
    console.warn('searchAllMessages failed:', err);
    return [];
  }
}

/**
 * Merges a secondary SQLite backup into the active primary in-memory database,
 * deduplicating records by key_id or (chat_row_id, timestamp, text_data).
 * 
 * @param {any} primaryDb 
 * @param {Uint8Array} secondaryBytes 
 * @returns {Promise<Object>} { importedCount: number, duplicateCount: number }
 */
export async function mergeSqliteDatabases(primaryDb, secondaryBytes) {
  const SQL = await getSqlEngine();
  const secondaryDb = new SQL.Database(secondaryBytes);

  let importedCount = 0;
  let duplicateCount = 0;

  try {
    // Read all messages from secondary database
    const secMsgRes = secondaryDb.exec(`
      SELECT chat_row_id, from_me, key_id, timestamp, text_data, message_type, status
      FROM message;
    `);

    if (secMsgRes.length > 0 && secMsgRes[0].values) {
      const insertStmt = primaryDb.prepare(`
        INSERT INTO message (chat_row_id, from_me, key_id, timestamp, text_data, message_type, status)
        VALUES (?, ?, ?, ?, ?, ?, ?);
      `);

      const rows = secMsgRes[0].values;
      for (const r of rows) {
        const [chatId, fromMe, keyId, ts, text, type, status] = r;

        // Check for duplicates
        let isDup = false;
        if (keyId) {
          const checkStmt = primaryDb.prepare(`SELECT _id FROM message WHERE key_id = ? LIMIT 1;`);
          checkStmt.bind([keyId]);
          if (checkStmt.step()) isDup = true;
          checkStmt.free();
        }

        if (!isDup && ts && text) {
          const checkStmt2 = primaryDb.prepare(`
            SELECT _id FROM message 
            WHERE chat_row_id = ? AND timestamp = ? AND text_data = ?
            LIMIT 1;
          `);
          checkStmt2.bind([chatId, ts, text]);
          if (checkStmt2.step()) isDup = true;
          checkStmt2.free();
        }

        if (isDup) {
          duplicateCount++;
        } else {
          insertStmt.run([chatId, fromMe, keyId, ts, text, type || 0, status || 13]);
          importedCount++;
        }
      }
      insertStmt.free();
    }
  } finally {
    secondaryDb.close();
  }

  return { importedCount, duplicateCount };
}

/**
 * Fetches user's sent message history across all conversations.
 * 
 * @param {any} db sql.js Database instance
 * @param {number} [limit=150]
 * @returns {Array<string>} Array of sent message strings
 */
export function fetchUserSentHistory(db, limit = 150) {
  try {
    const res = db.exec(`
      SELECT text_data 
      FROM message 
      WHERE from_me = 1 AND text_data IS NOT NULL AND length(trim(text_data)) > 0
      ORDER BY timestamp DESC 
      LIMIT ${limit};
    `);
    if (res.length > 0 && res[0].values) {
      return res[0].values.map(r => r[0]);
    }
  } catch {}
  return [];
}

/**
 * Generates an authentic, pre-populated SQLite database in memory.
 * 
 * @returns {Promise<Uint8Array>} Raw SQLite database bytes
 */
export async function generateMockWhatsAppDb() {
  const SQL = await getSqlEngine();
  const db = new SQL.Database();

  db.run(`
    CREATE TABLE jid (
      _id INTEGER PRIMARY KEY AUTOINCREMENT,
      raw_string TEXT NOT NULL UNIQUE,
      user TEXT,
      server TEXT
    );

    CREATE TABLE chat (
      _id INTEGER PRIMARY KEY AUTOINCREMENT,
      jid_row_id INTEGER NOT NULL,
      subject TEXT,
      created_timestamp INTEGER,
      sort_timestamp INTEGER
    );

    CREATE TABLE message (
      _id INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_row_id INTEGER NOT NULL,
      from_me INTEGER NOT NULL,
      key_id TEXT,
      timestamp INTEGER NOT NULL,
      text_data TEXT,
      message_type INTEGER DEFAULT 0,
      status INTEGER DEFAULT 13
    );
  `);

  db.run(`
    INSERT INTO jid (_id, raw_string, user, server) VALUES 
    (1, '14155552671@s.whatsapp.net', '14155552671', 's.whatsapp.net'),
    (2, '120363029482910294@g.us', '120363029482910294', 'g.us'),
    (3, '14155558932@s.whatsapp.net', '14155558932', 's.whatsapp.net'),
    (4, '14155554109@s.whatsapp.net', '14155554109', 's.whatsapp.net'),
    (5, '120363098765432101@g.us', '120363098765432101', 'g.us');
  `);

  const now = Date.now();
  const oneHour = 3600 * 1000;
  const oneDay = 24 * oneHour;

  db.run(`
    INSERT INTO chat (_id, jid_row_id, subject, created_timestamp, sort_timestamp) VALUES
    (1, 1, 'Sarah Jenkins', ${now - 7 * oneDay}, ${now - 12 * 60 * 1000}),
    (2, 2, 'Design Systems & Frontend 🚀', ${now - 30 * oneDay}, ${now - 45 * 60 * 1000}),
    (3, 3, 'Alex Rivera', ${now - 14 * oneDay}, ${now - 3 * oneHour}),
    (4, 4, 'Mom ❤️', ${now - 60 * oneDay}, ${now - 1 * oneDay}),
    (5, 5, 'Weekend Tennis Club 🎾', ${now - 40 * oneDay}, ${now - 2 * oneDay});
  `);

  const conversationData = [
    // Sarah Jenkins (Chat 1)
    { chatId: 1, fromMe: 0, time: now - 3 * oneHour, text: "Hey! Are we still on for lunch today? That new Thai place down 4th street just opened 🍜" },
    { chatId: 1, fromMe: 1, time: now - 2 * oneHour - 45 * 60 * 1000, text: "hey! yeah definitely, dying to try their pad see ew tbh" },
    { chatId: 1, fromMe: 1, time: now - 2 * oneHour - 44 * 60 * 1000, text: "is 12:30 good for you? check their menu at https://thaibasilmenu.example.com" },
    { chatId: 1, fromMe: 0, time: now - 2 * oneHour - 10 * 60 * 1000, text: "12:30 is perfect! Let's grab a table outside if the sun stays out ☀️" },
    { chatId: 1, fromMe: 0, time: now - 40 * 60 * 1000, text: "I'm heading out now! Let me know if you want me to order an iced matcha for you while I wait?" },
    { chatId: 1, fromMe: 1, time: now - 18 * 60 * 1000, text: "omg please, oat milk if they have it haha 🙏" },
    { chatId: 1, fromMe: 0, time: now - 12 * 60 * 1000, text: "Got it! Table by the patio. How far away are you?" },

    // Design Systems & Frontend (Chat 2)
    { chatId: 2, fromMe: 0, time: now - 5 * oneHour, text: "Quick update: The Figma tokens for the OLED dark mode are finalized in branch feature/tokens-v3: https://github.com/example/tokens" },
    { chatId: 2, fromMe: 0, time: now - 4 * oneHour, text: "Does everyone agree on using #0B141A for the base canvas rather than pure #000000?" },
    { chatId: 2, fromMe: 1, time: now - 3 * oneHour - 30 * 60 * 1000, text: "100% yes, pure black causes noticeable smearing when scrolling on OLED screens" },
    { chatId: 2, fromMe: 1, time: now - 3 * oneHour - 29 * 60 * 1000, text: "slate 900 looks way cleaner and elevates the cards nicely" },
    { chatId: 2, fromMe: 0, time: now - 2 * oneHour, text: "Agreed. I ran a build test on GitHub Pages with relative assets base: './' and it works without a hitch." },
    { chatId: 2, fromMe: 0, time: now - 45 * 60 * 1000, text: "Should we cut the v1.2 release tag this afternoon or wait until Monday morning?" },

    // Alex Rivera (Chat 3)
    { chatId: 3, fromMe: 0, time: now - 8 * oneHour, text: "Hey man, did you see the query optimizer metrics for sql.js? https://sql.js.org/docs" },
    { chatId: 3, fromMe: 1, time: now - 7 * oneHour, text: "yeah checked it earlier! in-memory execution is under 15ms for 10k messages, crazy fast" },
    { chatId: 3, fromMe: 0, time: now - 5 * oneHour, text: "Awesome. Also wanted to ask if you've had a chance to test Gemini 3.8 Flash for style extraction?" },
    { chatId: 3, fromMe: 1, time: now - 4 * oneHour, text: "playing with the prompt engineering right now, testing persona mimicry on sent history" },
    { chatId: 3, fromMe: 0, time: now - 3 * oneHour, text: "Let me know when the PR is ready to review, would love to take it for a spin! 🚀" },

    // Mom (Chat 4)
    { chatId: 4, fromMe: 0, time: now - 2 * oneDay, text: "Hi honey! Hope work isn't too busy this week. Grandma sent some old family pictures." },
    { chatId: 4, fromMe: 1, time: now - 2 * oneDay + 2 * oneHour, text: "hey mom! all good here, super focused on a project launch. send the pics when you can!" },
    { chatId: 4, fromMe: 0, time: now - 1 * oneDay - 4 * oneHour, text: "Are you coming over for dinner this Sunday? We're making homemade lasagna!" },
    { chatId: 4, fromMe: 1, time: now - 1 * oneDay - 2 * oneHour, text: "would love to!! wouldn't miss homemade lasagna for anything haha ❤️" },
    { chatId: 4, fromMe: 0, time: now - 1 * oneDay, text: "Wonderful! We'll start around 6pm. Love you! 💕" },

    // Weekend Tennis Club (Chat 5)
    { chatId: 5, fromMe: 0, time: now - 3 * oneDay, text: "Courts 3 and 4 booked for Saturday 9am. Who is playing doubles? Location: https://maps.example.com/tennis" },
    { chatId: 5, fromMe: 1, time: now - 3 * oneDay + 30 * 60 * 1000, text: "count me in! bringing a fresh can of balls" },
    { chatId: 5, fromMe: 0, time: now - 2 * oneDay, text: "Awesome, that makes four of us. See you all Saturday morning!" }
  ];

  const stmt = db.prepare(`
    INSERT INTO message (chat_row_id, from_me, key_id, timestamp, text_data, message_type, status)
    VALUES (?, ?, ?, ?, ?, 0, 13);
  `);

  conversationData.forEach((msg, i) => {
    stmt.run([msg.chatId, msg.fromMe, `MOCK_KEY_${i}`, msg.time, msg.text]);
  });
  stmt.free();

  // Add a sample voice note (message_type = 2) to Sarah's chat
  db.run(`
    INSERT INTO message (chat_row_id, from_me, key_id, timestamp, text_data, message_type, status)
    VALUES (1, 0, 'VOICE_SAMPLE_1', ${now - 25 * 60 * 1000}, 'Voice Message (0:24)', 2, 13);
  `);

  const binary = db.export();
  db.close();
  return binary;
}
