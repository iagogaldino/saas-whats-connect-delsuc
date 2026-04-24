/** Apenas dígitos. */
function digits(s: string): string {
  return s.replace(/\D/g, '');
}

export function luhnCheck(cardNumber: string): boolean {
  const d = digits(cardNumber);
  if (d.length < 13 || d.length > 19) return false;
  let sum = 0;
  let alt = false;
  for (let i = d.length - 1; i >= 0; i--) {
    let n = parseInt(d[i]!, 10);
    if (alt) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alt = !alt;
  }
  return sum % 10 === 0;
}

export function isValidCardExpiry(mmyy: string): boolean {
  const m = mmyy.match(/^(\d{2})\/(\d{2})$/);
  if (!m) return false;
  const month = parseInt(m[1]!, 10);
  const yy = parseInt(m[2]!, 10);
  if (month < 1 || month > 12) return false;
  const yFull = 2000 + yy;
  /** Último instante do mês de expiração (mês 1–12: `new Date(ano, m, 0)` = fim do mês m). */
  const endOfExpiryMonth = new Date(yFull, month, 0, 23, 59, 59, 999);
  return endOfExpiryMonth.getTime() >= new Date().getTime();
}

export function formatCardNumber(value: string): string {
  return digits(value)
    .slice(0, 19)
    .replace(/(\d{4})(?=\d)/g, '$1 ')
    .trim();
}

export function formatExpiry(value: string): string {
  const d = digits(value).slice(0, 4);
  if (d.length <= 2) return d;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}`;
}
