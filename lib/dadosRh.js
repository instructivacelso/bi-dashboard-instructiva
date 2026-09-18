import { q, q1 } from './db.js';
import { headcountMedio, turnover, taxaDesligamento, custoMedio, consolidarRh } from './rh.js';
import { dividir } from './calc.js';

export const cargos = () => q('SELECT c.*, d.nome setor FROM hr_positions c LEFT JOIN departments d ON d.id=c.department_id ORDER BY c.ativo DESC, c.nome');
export const cargosAtivos = () => q('SELECT id, nome FROM hr_positions WHERE ativo ORDER BY nome');
export const listaColaboradores = (f = {}) => {
  const cond = ['1=1']; const p = [];
  if (f.status) { p.push(f.status); cond.push(`e.status=$${p.length}`); }
  if (f.department_id) { p.push(f.department_id); cond.push(`e.department_id=$${p.length}`); }
  return q(`SELECT e.*, c.nome cargo, d.nome setor, g.nome gestor FROM hr_employees e
             LEFT JOIN hr_positions c ON c.id=e.position_id LEFT JOIN departments d ON d.id=e.department_id LEFT JOIN hr_employees g ON g.id=e.gestor_id
            WHERE ${cond.join(' AND ')} ORDER BY (e.status='desligado'), e.nome`, p);
};
export const colaborador = (id) => q1(`SELECT e.*, c.nome cargo, d.nome setor, g.nome gestor FROM hr_employees e
   LEFT JOIN hr_positions c ON c.id=e.position_id LEFT JOIN departments d ON d.id=e.department_id LEFT JOIN hr_employees g ON g.id=e.gestor_id WHERE e.id=$1`, [id]);
export const movimentacoesDe = (id) => q('SELECT * FROM hr_movements WHERE employee_id=$1 ORDER BY data DESC, id DESC', [id]);

const ativos = (d) => `admissao <= '${d}' AND (desligado_em IS NULL OR desligado_em > '${d}')`;

export async function numerosRh(desde, ate) {
  const cfg = await q(`SELECT chave, valor FROM configuracoes WHERE chave LIKE 'rh_%'`);
  const m = Object.fromEntries(cfg.map((c) => [c.chave, c.valor]));
  const [hc, mov, custo, porSetor, porUnidade, porVinculo, experiencia, docs, diarios, ultimo] = await Promise.all([
    q1(`SELECT
          (SELECT COUNT(*) FROM hr_employees WHERE ${ativos(desde)})::int ini,
          (SELECT COUNT(*) FROM hr_employees WHERE ${ativos(ate)})::int fim,
          (SELECT COUNT(*) FROM hr_employees WHERE status<>'desligado')::int atual`),
    q1(`SELECT
          (SELECT COUNT(*) FROM hr_employees WHERE admissao BETWEEN $1 AND $2)::int admissoes,
          (SELECT COUNT(*) FROM hr_employees WHERE desligado_em BETWEEN $1 AND $2)::int desligamentos,
          (SELECT COUNT(*) FROM hr_employees WHERE desligado_em BETWEEN $1 AND $2 AND desligado_tipo='voluntario')::int deslig_vol,
          (SELECT COUNT(*) FROM hr_employees WHERE desligado_em BETWEEN $1 AND $2 AND desligado_tipo='involuntario')::int deslig_invol`, [desde, ate]),
    q1(`SELECT COALESCE(SUM(salario),0) total, COUNT(*) FILTER (WHERE salario IS NOT NULL)::int com_salario FROM hr_employees WHERE status<>'desligado'`),
    q(`SELECT COALESCE(d.nome,'Sem setor') chave, COUNT(*)::int n, COALESCE(SUM(e.salario),0) custo FROM hr_employees e LEFT JOIN departments d ON d.id=e.department_id WHERE e.status<>'desligado' GROUP BY 1 ORDER BY n DESC`),
    q(`SELECT COALESCE(NULLIF(unidade,''),'Não informada') chave, COUNT(*)::int n FROM hr_employees WHERE status<>'desligado' GROUP BY 1 ORDER BY n DESC`),
    q(`SELECT vinculo chave, COUNT(*)::int n FROM hr_employees WHERE status<>'desligado' GROUP BY 1 ORDER BY n DESC`),
    q1(`SELECT COUNT(*)::int n FROM hr_employees WHERE status<>'desligado' AND experiencia_fim IS NOT NULL AND experiencia_fim >= CURRENT_DATE`),
    q1(`SELECT COUNT(*) FILTER (WHERE contrato_fim IS NOT NULL AND contrato_fim BETWEEN CURRENT_DATE AND CURRENT_DATE + 30)::int contratos,
               COUNT(*) FILTER (WHERE experiencia_fim IS NOT NULL AND experiencia_fim BETWEEN CURRENT_DATE AND CURRENT_DATE + 7)::int experiencias FROM hr_employees WHERE status<>'desligado'`),
    q(`SELECT * FROM hr_daily_closings WHERE data_ref BETWEEN $1 AND $2`, [desde, ate]),
    q1(`SELECT * FROM hr_daily_closings ORDER BY data_ref DESC LIMIT 1`),
  ]);
  const hcMedio = headcountMedio(hc.ini, hc.fim);
  const cons = consolidarRh(diarios);
  return {
    headcountIni: hc.ini, headcountFim: hc.fim, headcountAtual: hc.atual, headcountMedio: hcMedio,
    admissoes: mov.admissoes, desligamentos: mov.desligamentos, desligVol: mov.deslig_vol, desligInvol: mov.deslig_invol,
    turnover: turnover(mov.admissoes, mov.desligamentos, hcMedio), taxaDesligamento: taxaDesligamento(mov.desligamentos, hcMedio),
    turnoverVol: taxaDesligamento(mov.deslig_vol, hcMedio),
    custoTotal: Number(custo.total), custoMedio: custoMedio(Number(custo.total), hcMedio), comSalario: custo.com_salario,
    porSetor: porSetor.map((x) => ({ ...x, custo: Number(x.custo) })), porUnidade, porVinculo,
    emExperiencia: experiencia.n, contratosVencendo: docs.contratos, experienciasVencendo: docs.experiencias,
    vagasAbertas: ultimo?.vagas_abertas || 0,
    ponto: cons, metaAbsenteismo: Number(m.rh_meta_absenteismo ?? 3) / 100, metaTurnover: Number(m.rh_meta_turnover ?? 4) / 100,
    absenteismo: cons.absenteismo, taxaAtraso: cons.taxaAtraso, horasExtras: cons.horas_extras,
    recrutamento: { candidatos: cons.candidatos, entrevistas: cons.entrevistas, contratacoes: cons.contratacoes, funil: cons.funil },
    treino: { treinamentos: cons.treinamentos, participantes: cons.treino_participantes, presenca: cons.presencaTreino },
    diasComEnvio: diarios.length,
  };
}

export const fechamentoRhDoDia = (userId, dia) => q1('SELECT * FROM hr_daily_closings WHERE user_id=$1 AND data_ref=$2', [userId, dia]);
