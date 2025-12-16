const sessions = new Map();

const SESSION_TIMEOUT = 30 * 60 * 1000;

const SYSTEM_PROMPT = `Nhân viên nhà hàng Việt Nam.

Tools: filter_menu (số liệu), search_menu (mô tả) → show_products(ids) → reply ngắn

Context VN: "500" = 500k, "tầm 100" = ~100k, "mấy người" = mấy món, viết tắt OK.`;

function getOrCreateSession(sessionId) {
  if (!sessions.has(sessionId)) {
    sessions.set(sessionId, {
      messages: [{ role: "system", content: SYSTEM_PROMPT }],
      lastActivity: Date.now()
    });
  } else {
    const session = sessions.get(sessionId);
    session.lastActivity = Date.now();
  }
  return sessions.get(sessionId);
}

function addMessage(sessionId, role, content) {
  const session = getOrCreateSession(sessionId);
  session.messages.push({ role, content });

  if (session.messages.length > 9) {
    session.messages = [
      session.messages[0], // system prompt
      ...session.messages.slice(-8) // 8 messages cuối
    ];
  }

  return session.messages;
}

function clearSession(sessionId) {
  sessions.delete(sessionId);
}

function cleanupOldSessions() {
  const now = Date.now();
  for (const [sessionId, session] of sessions.entries()) {
    if (now - session.lastActivity > SESSION_TIMEOUT) {
      sessions.delete(sessionId);
    }
  }
}

setInterval(cleanupOldSessions, 5 * 60 * 1000);

module.exports = {
  getOrCreateSession,
  addMessage,
  clearSession
};
