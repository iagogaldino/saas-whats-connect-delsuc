const VALID_CHAT_JID_SUFFIXES = ['@s.whatsapp.net', '@lid', '@g.us'] as const;

export function validatePhone(phone: string): string | null {
  const d = phone.replace(/\D/g, '');
  if (d.length < 10 || d.length > 15) {
    return 'Telefone: use 10 a 15 dígitos (DDI + número, sem +).';
  }
  return null;
}

export function validateChatJid(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) {
    return 'Chat JID: informe o destino completo (ex.: 123...@lid).';
  }
  if (!trimmed.includes('@')) {
    return 'Chat JID: use o sufixo completo (@lid, @g.us ou @s.whatsapp.net).';
  }
  const lower = trimmed.toLowerCase();
  const ok = VALID_CHAT_JID_SUFFIXES.some((suffix) => lower.endsWith(suffix));
  if (!ok) {
    return 'Chat JID: sufixo inválido. Use @s.whatsapp.net, @lid ou @g.us.';
  }
  return null;
}

export function validateReplyTo(input: {
  messageId: string;
  chatJid: string;
}): string | null {
  const messageId = input.messageId.trim();
  if (!messageId) {
    return 'replyTo: informe o messageId da mensagem a citar.';
  }
  const errJid = validateChatJid(input.chatJid);
  if (errJid) {
    return errJid.replace('Chat JID', 'replyTo.chatJid');
  }
  return null;
}

export function validateCode(code: string): string | null {
  const t = code.trim();
  if (t.length < 1) {
    return 'Mensagem: informe pelo menos 1 caractere.';
  }
  if (t.length > 200) {
    return 'Mensagem: no máximo 200 caracteres.';
  }
  return null;
}
