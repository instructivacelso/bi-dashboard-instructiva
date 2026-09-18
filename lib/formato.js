export const SEM_DADOS = 'sem dados';

export function moeda(v, casas = 2) {
  if (v === null || v === undefined || !isFinite(v)) return SEM_DADOS;
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: casas, maximumFractionDigits: casas }).format(v);
}
export function numero(v, casas = 0) {
  if (v === null || v === undefined || !isFinite(v)) return SEM_DADOS;
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: casas }).format(v);
}
export function pct(v) {
  if (v === null || v === undefined || !isFinite(v)) return SEM_DADOS;
  return `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(v * 100)}%`;
}
export function multiplo(v) {
  if (v === null || v === undefined || !isFinite(v)) return SEM_DADOS;
  return `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(v)}x`;
}

// Converte "1.234,56" ou "1234.56" em número. Vazio -> null.
export function lerNumero(v) {
  if (v === undefined || v === null) return null;
  const s = String(v).trim().replace(/\s|R\$/g, '');
  if (s === '') return null;
  const normal = s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s;
  const n = Number(normal);
  return Number.isFinite(n) ? n : null;
}
