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

// ---------- Etapa 2: folha e clima/eNPS ----------
import { custoFolha, folhaPercentReceita, enps, climaExibivel } from './rh.js';
import { receitaPeriodo } from './dadosFinanceiro.js';

const fimMes = (comp) => { const [a, m] = comp.split('-').map(Number); const d = new Date(Date.UTC(a, m, 0)); return `${a}-${String(m).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`; };

export async function folhaDoMes(mes) {
  const competencia = `${mes}-01`;
  const [linhas, receita, cfg] = await Promise.all([
    q(`SELECT e.id employee_id, e.nome, e.salario, d.nome setor, e.department_id,
              f.id folha_id, f.salario_base, f.variavel, f.beneficios, f.encargos, f.descontos, f.provisoes, f.custo_total, f.status
         FROM hr_employees e LEFT JOIN departments d ON d.id=e.department_id
         LEFT JOIN hr_payroll f ON f.employee_id=e.id AND f.competencia=$1
        WHERE e.status<>'desligado' ORDER BY d.nome NULLS LAST, e.nome`, [competencia]),
    receitaPeriodo(competencia, fimMes(mes)),
    q1(`SELECT valor FROM configuracoes WHERE chave='rh_folha_encargos_pct'`),
  ]);
  const custoTotal = Math.round(linhas.reduce((s, l) => s + Number(l.custo_total || 0), 0) * 100) / 100;
  const porSetor = {};
  for (const l of linhas) { const k = l.setor || 'Sem setor'; (porSetor[k] ||= { setor: k, n: 0, custo: 0 }); porSetor[k].n++; porSetor[k].custo += Number(l.custo_total || 0); }
  const lancadas = linhas.filter((l) => l.folha_id).length;
  return {
    competencia, linhas, custoTotal, porSetor: Object.values(porSetor).map((x) => ({ ...x, custo: Math.round(x.custo * 100) / 100 })),
    receita: receita.total, folhaPercentReceita: folhaPercentReceita(custoTotal, receita.total),
    encargosPct: Number(cfg?.valor ?? 0) / 100, total: linhas.length, lancadas,
    enviada: linhas.length > 0 && linhas.every((l) => l.status === 'enviada_financeiro'),
  };
}

export async function climaDoPeriodo() {
  const cfg = await q(`SELECT chave, valor FROM configuracoes WHERE chave IN ('rh_min_respostas_clima','rh_meta_enps')`);
  const m = Object.fromEntries(cfg.map((c) => [c.chave, Number(c.valor)]));
  const minimo = m.rh_min_respostas_clima ?? 5;
  const linhas = await q(`SELECT c.*, d.nome setor FROM hr_climate c LEFT JOIN departments d ON d.id=c.department_id ORDER BY c.competencia DESC, d.nome NULLS FIRST LIMIT 24`);
  return {
    minimo, metaEnps: (m.rh_meta_enps ?? 20) / 100,
    linhas: linhas.map((l) => ({ ...l, enps: enps(l.promotores, l.detratores, l.respostas), exibivel: climaExibivel(l.respostas, minimo) })),
  };
}

// ---------- Etapa 2 (parte 2): desempenho, treinamentos, sucessão ----------
import { mediaCriterios, resumoPdi, horasTreinoPorPessoa, taxaConclusaoTreino, prioridadeSucessao } from './rh.js';
import { hoje as hojeIso } from './datas.js';

export async function desempenhoResumo(desde, ate) {
  const [avals, pdis] = await Promise.all([
    q(`SELECT a.*, e.nome colaborador, u.nome avaliador FROM hr_evaluations a JOIN hr_employees e ON e.id=a.employee_id LEFT JOIN users u ON u.id=a.avaliador_id
        WHERE a.competencia BETWEEN $1 AND $2 ORDER BY a.competencia DESC, a.id DESC`, [desde, ate]),
    q('SELECT * FROM hr_pdi'),
  ]);
  const notas = avals.map((a) => Number(a.nota_geral)).filter((n) => Number.isFinite(n));
  const media = notas.length ? Math.round((notas.reduce((s, n) => s + n, 0) / notas.length) * 100) / 100 : null;
  return {
    avaliacoes: avals.map((a) => ({ ...a, media_criterios: mediaCriterios(a.criterios) })),
    mediaGeral: media, total: avals.length, pdi: resumoPdi(pdis, hojeIso()),
  };
}
export const avaliacoesDe = (id) => q('SELECT a.*, u.nome avaliador FROM hr_evaluations a LEFT JOIN users u ON u.id=a.avaliador_id WHERE a.employee_id=$1 ORDER BY a.competencia DESC', [id]);
export const pdiDe = (id) => q('SELECT * FROM hr_pdi WHERE employee_id=$1 ORDER BY (status<>\'concluido\') DESC, prazo NULLS LAST', [id]);

export async function treinamentosPeriodo(desde, ate) {
  const linhas = await q(`SELECT t.*, COUNT(p.id)::int inscritos, COUNT(p.id) FILTER (WHERE p.presente)::int presentes,
      AVG(p.nota_aprendizagem) FILTER (WHERE p.nota_aprendizagem IS NOT NULL) nota
      FROM hr_trainings t LEFT JOIN hr_training_participants p ON p.training_id=t.id
     WHERE t.competencia BETWEEN $1 AND $2 GROUP BY t.id ORDER BY t.data_treino DESC NULLS LAST, t.id DESC`, [desde, ate]);
  const cargaTotal = linhas.reduce((s, t) => s + Number(t.carga_horaria || 0) * Number(t.presentes || 0), 0);
  const pessoas = linhas.reduce((s, t) => s + Number(t.presentes || 0), 0);
  const inscritos = linhas.reduce((s, t) => s + Number(t.inscritos || 0), 0);
  const presentes = linhas.reduce((s, t) => s + Number(t.presentes || 0), 0);
  const custo = linhas.reduce((s, t) => s + Number(t.custo || 0), 0);
  return {
    treinamentos: linhas.map((t) => ({ ...t, nota: t.nota != null ? Math.round(Number(t.nota) * 100) / 100 : null, conclusao: taxaConclusaoTreino(t.presentes, t.inscritos) })),
    total: linhas.length, custo: Math.round(custo * 100) / 100,
    horasPorPessoa: horasTreinoPorPessoa(cargaTotal, pessoas), conclusao: taxaConclusaoTreino(presentes, inscritos),
  };
}

export async function sucessaoLista() {
  const linhas = await q(`SELECT s.*, e.nome colaborador, e.department_id, d.nome setor, c.nome cargo, su.nome sucessor
      FROM hr_succession s JOIN hr_employees e ON e.id=s.employee_id LEFT JOIN departments d ON d.id=e.department_id
      LEFT JOIN hr_positions c ON c.id=e.position_id LEFT JOIN hr_employees su ON su.id=s.sucessor_id ORDER BY e.nome`);
  const comPrioridade = linhas.map((s) => ({ ...s, prioridade: prioridadeSucessao(s) }));
  const ordem = { alta: 0, media: 1, baixa: 2 };
  return comPrioridade.sort((a, b) => ordem[a.prioridade] - ordem[b.prioridade]);
}
