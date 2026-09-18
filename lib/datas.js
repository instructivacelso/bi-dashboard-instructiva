export const FUSO = 'America/Sao_Paulo';

export function hoje(agora = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: FUSO }).format(agora);
}

export function somarDias(iso, n) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function isoDe(v) {
  if (!v) return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v).slice(0, 10);
}

export function fmtData(v) {
  const s = isoDe(v);
  if (!s) return '—';
  const [a, m, d] = s.split('-');
  return `${d}/${m}/${a}`;
}

export function fmtDataHora(v) {
  if (!v) return '—';
  return new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, dateStyle: 'short', timeStyle: 'short' }).format(new Date(v));
}

export function diasEntre(desde, ate) {
  const lista = [];
  for (let d = desde; d <= ate; d = somarDias(d, 1)) lista.push(d);
  return lista;
}
