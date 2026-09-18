import { q, q1 } from './db.js';
import { consolidarPosvenda } from './posvenda.js';

export const fechamentoPvDoDia = (userId, dia) => q1('SELECT * FROM posvenda_daily_closings WHERE user_id=$1 AND data_ref=$2', [userId, dia]);

export async function numerosPosvenda(desde, ate) {
  const cfg = await q(`SELECT chave, valor FROM configuracoes WHERE chave LIKE 'posvenda_%'`);
  const m = Object.fromEntries(cfg.map((c) => [c.chave, c.valor]));
  const [diarios, cancelamentos, riscos] = await Promise.all([
    q('SELECT * FROM posvenda_daily_closings WHERE data_ref BETWEEN $1 AND $2', [desde, ate]),
    q(`SELECT cancel_motivo motivo, SUM(cancelamentos)::int n FROM posvenda_daily_closings WHERE data_ref BETWEEN $1 AND $2 AND cancel_motivo IS NOT NULL AND cancelamentos > 0 GROUP BY 1 ORDER BY n DESC LIMIT 8`, [desde, ate]),
    q(`SELECT data_ref, risco, plano, prazo FROM posvenda_daily_closings WHERE data_ref BETWEEN $1 AND $2 AND risco IS NOT NULL ORDER BY data_ref DESC LIMIT 10`, [desde, ate]),
  ]);
  const cons = consolidarPosvenda(diarios);
  return {
    ...cons, diasComEnvio: diarios.length,
    metaRenovacao: Number(m.posvenda_meta_renovacao ?? 85) / 100, metaNps: Number(m.posvenda_meta_nps ?? 50) / 100,
    motivosCancelamento: cancelamentos, riscos,
  };
}
