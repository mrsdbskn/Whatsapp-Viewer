/**
 * Utilities for exporting filtered WhatsApp conversations to TXT, JSON, and Styled HTML.
 */

/**
 * Formats a timestamp into WhatsApp's export format [DD/MM/YYYY, HH:MM:SS].
 * @param {number|Date} timestamp 
 * @returns {string}
 */
export function formatExportDate(timestamp) {
  const d = new Date(timestamp);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const seconds = String(d.getSeconds()).padStart(2, '0');

  return `[${day}/${month}/${year}, ${hours}:${minutes}:${seconds}]`;
}

/**
 * Generates WhatsApp formatted text content from an array of message objects.
 * 
 * @param {Object} options
 * @param {string} options.chatName Contact or group display name
 * @param {Array<Object>} options.messages List of messages
 * @param {string} [options.filterDescription] Optional description of active filters
 * @returns {string} Plaintext WhatsApp format
 */
export function generateWhatsAppTxt({ chatName, messages = [], filterDescription = '' }) {
  const header = [
    '================================================================',
    `WhatsApp Chat Export: ${chatName}`,
    `Exported on: ${new Date().toLocaleString()}`,
    `Total Messages: ${messages.length}`,
    filterDescription ? `Active Filters: ${filterDescription}` : null,
    '================================================================',
    ''
  ].filter(Boolean).join('\n');

  const body = messages.map(msg => {
    const timeStr = formatExportDate(msg.timestamp);
    const sender = msg.fromMe ? 'You' : chatName;
    const content = msg.text || (msg.type > 0 ? '<Media omitted>' : '');
    return `${timeStr} ${sender}: ${content}`;
  }).join('\n');

  return `${header}\n${body}`;
}

/**
 * Generates structured JSON export.
 * @param {string} chatName 
 * @param {Array<Object>} messages 
 * @returns {string}
 */
export function generateWhatsAppJson({ chatName, messages = [] }) {
  return JSON.stringify({
    chatName,
    exportedAt: new Date().toISOString(),
    totalMessages: messages.length,
    messages: messages.map(m => ({
      id: m.id,
      timestamp: m.timestamp,
      date: new Date(m.timestamp).toISOString(),
      sender: m.fromMe ? 'You' : chatName,
      fromMe: m.fromMe,
      text: m.text,
      type: m.type
    }))
  }, null, 2);
}

/**
 * Generates a self-contained, beautifully styled HTML document with OLED WhatsApp bubbles,
 * authentic styling, and print/PDF support.
 * 
 * @param {Object} options
 * @param {string} options.chatName 
 * @param {Array<Object>} options.messages 
 * @param {string} [options.filterDescription]
 * @returns {string} Standalone HTML document string
 */
export function generateStyledHtmlExport({ chatName, messages = [], filterDescription = '' }) {
  const escapeHtml = str => (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  const messageRows = messages.map(m => {
    const isSent = Boolean(m.fromMe);
    const time = new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const date = new Date(m.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
    const content = escapeHtml(m.text || (m.type > 0 ? '[Media Attachment]' : ''));

    return `
      <div class="message-row ${isSent ? 'sent' : 'received'}">
        <div class="bubble">
          <div class="sender-name">${isSent ? 'You' : escapeHtml(chatName)}</div>
          <div class="text">${content}</div>
          <div class="meta">
            <span class="date">${date}</span>
            <span class="time">${time}</span>
            ${isSent ? '<span class="tick">&#10003;&#10003;</span>' : ''}
          </div>
        </div>
      </div>
    `;
  }).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>WhatsApp Chat - ${escapeHtml(chatName)}</title>
  <style>
    :root {
      color-scheme: dark;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    }
    body {
      background-color: #0B141A;
      color: #E9EDEF;
      padding: 24px 16px;
      line-height: 1.5;
    }
    .container {
      max-width: 760px;
      margin: 0 auto;
      background: #111B21;
      border: 1px solid #222E35;
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
    }
    .header {
      background: #182229;
      padding: 18px 24px;
      border-bottom: 1px solid #222E35;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .header-title {
      font-size: 18px;
      font-weight: 700;
      color: #E9EDEF;
    }
    .header-subtitle {
      font-size: 12px;
      color: #8696A0;
      margin-top: 2px;
    }
    .badge {
      background: rgba(0, 168, 132, 0.15);
      color: #00A884;
      padding: 4px 10px;
      border-radius: 9999px;
      font-size: 11px;
      font-weight: 600;
      border: 1px solid rgba(0, 168, 132, 0.3);
    }
    .chat-stream {
      padding: 24px 20px;
      display: flex;
      flex-direction: column;
      gap: 10px;
      background-color: #0B141A;
      background-image: radial-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 0);
      background-size: 20px 20px;
      min-height: 400px;
    }
    .message-row {
      display: flex;
      width: 100%;
    }
    .message-row.sent {
      justify-content: flex-end;
    }
    .message-row.received {
      justify-content: flex-start;
    }
    .bubble {
      max-width: 75%;
      padding: 8px 12px;
      border-radius: 10px;
      font-size: 13.5px;
      position: relative;
      word-wrap: break-word;
      white-space: pre-wrap;
      box-shadow: 0 1px 1px rgba(0, 0, 0, 0.2);
    }
    .message-row.sent .bubble {
      background: #005C4B;
      color: #E9EDEF;
      border-top-right-radius: 0;
    }
    .message-row.received .bubble {
      background: #202C33;
      color: #E9EDEF;
      border-top-left-radius: 0;
      border: 1px solid rgba(255, 255, 255, 0.05);
    }
    .sender-name {
      font-size: 11px;
      font-weight: 600;
      color: #00A884;
      margin-bottom: 2px;
    }
    .message-row.sent .sender-name {
      display: none;
    }
    .meta {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 5px;
      font-size: 10px;
      color: #8696A0;
      margin-top: 4px;
      float: right;
      margin-left: 12px;
    }
    .tick {
      color: #00A884;
      font-weight: bold;
    }
    .footer {
      background: #182229;
      padding: 12px 20px;
      font-size: 11px;
      color: #8696A0;
      text-align: center;
      border-top: 1px solid #222E35;
    }
    @media print {
      body {
        background: white !important;
        color: black !important;
        padding: 0;
      }
      .container {
        border: none;
        box-shadow: none;
        max-width: 100%;
      }
      .message-row.sent .bubble {
        background: #DCF8C6 !important;
        color: black !important;
      }
      .message-row.received .bubble {
        background: #EFEFEF !important;
        color: black !important;
      }
      .header, .footer {
        background: #F4F4F4 !important;
        color: black !important;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div>
        <div class="header-title">${escapeHtml(chatName)}</div>
        <div class="header-subtitle">Exported on ${new Date().toLocaleString()} &bull; ${messages.length} messages</div>
      </div>
      <div class="badge">WhatsApp Backup Archive</div>
    </div>
    <div class="chat-stream">
      ${messageRows}
    </div>
    <div class="footer">
      Generated client-side by WhatsApp Crypt15 Backup Viewer &bull; 100% Private Web Crypto Archive
    </div>
  </div>
</body>
</html>`;
}

/**
 * Triggers a file download in the browser.
 * 
 * @param {string} content 
 * @param {string} filename 
 * @param {string} mimeType 
 */
export function triggerDownload(content, filename, mimeType = 'text/plain;charset=utf-8') {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
