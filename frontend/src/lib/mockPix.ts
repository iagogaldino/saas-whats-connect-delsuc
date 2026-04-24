/**
 * Gera um "Pix Copia e Cola" fictício para demonstração de UI (não é um pagamento real).
 * Formato alinhado ao padrão EMV (começo típico 00020126…).
 */
export function generateMockPixCopiaECola(): string {
  const id = globalThis.crypto?.randomUUID?.() ?? `mock-${Date.now()}`;
  const hash = btoa(id).replace(/=+$/, '').replace(/\+/g, '0').replace(/\//g, '0').slice(0, 32);
  // Payload curto o suficiente para QR; só para demo visual.
  return `00020126580014br.gov.bcb.pix2568${hash.padEnd(32, '0').slice(0, 32)}52040000530398654${(20.0 * 100).toFixed(0).padStart(7, '0')}5802BR5921WhatsAppConnect6009SaoPaolo62070503***6304AB12`;
}
