/**
 * Utilities for exporting filtered WhatsApp conversations to TXT, JSON, and CSV.
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
