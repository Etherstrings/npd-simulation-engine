export function getWechatSessionName(session) {
  if (!session || typeof session !== 'object') return '';

  const candidate = session.name || session.chat || session.nickname || session.chat_name;
  if (typeof candidate === 'string' && candidate.trim()) {
    return candidate.trim();
  }

  try {
    return JSON.stringify(session);
  } catch {
    return '';
  }
}
