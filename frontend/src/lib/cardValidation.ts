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

export function isValidCpf(cpf: string): boolean {
  const d = digits(cpf);
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  let s = 0;
  for (let i = 0; i < 9; i++) s += parseInt(d[i]!, 10) * (10 - i);
  let r = (s * 10) % 11;
  if (r === 10 || r === 11) r = 0;
  if (r !== parseInt(d[9]!, 10)) return false;
  s = 0;
  for (let i = 0; i < 10; i++) s += parseInt(d[i]!, 10) * (11 - i);
  r = (s * 10) % 11;
  if (r === 10 || r === 11) r = 0;
  return r === parseInt(d[10]!, 10);
}

export function formatCpf(value: string): string {
  const d = digits(value).slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}
