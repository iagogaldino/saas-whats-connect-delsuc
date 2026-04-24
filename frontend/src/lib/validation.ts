export function validatePhone(phone: string): string | null {
  const d = phone.replace(/\D/g, '');
  if (d.length < 10 || d.length > 15) {
    return 'Telefone: use 10 a 15 dígitos (DDI + número, sem +).';
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
