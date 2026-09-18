import { exigirUsuario } from '@/lib/auth.js';
import { hoje } from '@/lib/datas.js';
import { moeda, numero, pct } from '@/lib/formato.js';
import { semaforo } from '@/lib/calc.js';
import { ehProfessor } from '@/lib/academico.js';
import { numerosAcademico, metasProfessor } from '@/lib/dadosAcademico.js';
import { Topo, Aviso, Kpi } from '@/components/Ui.js';

export const dynamic = 'force-dynamic';
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const rot = (mes) => { const [a, m] = mes.split('-'); return `${MESES[Number(m) - 1]}/${a}`; };
const fim = (mes) => { const [a, m] = mes.split('-').map(Number); const d = new Date(Date.UTC(a, m, 0)); return `${a}-${String(m).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`; };
const alvo = (v, meta) => (meta ? semaforo(v, meta, 'maior') : '');

export default async function PainelProfessor(props) {
  const sp = await props.searchParams;
  const u = await exigirUsuario();
  if (!ehProfessor(u)) return <><Topo titulo="Meu painel" /><Aviso tipo="erro">Área dos professores.</Aviso></>;
  const mes = /^\d{4}-\d{2}$/.test(sp.mes || '') && sp.mes <= hoje().slice(0, 7) ? sp.mes : hoje().slice(0, 7);
  const [n, meta] = await Promise.all([numerosAcademico(`${mes}-01`, fim(mes), u.id), metasProfessor(u.id)]);
  const c = n.cons;
  const m = meta || {};

  return (
    <>
      <Topo titulo="Meu painel" descricao={`${rot(mes)} · ${n.diasComEnvio} dia(s) registrado(s)`}>
        <a className="btn" href="/academico/diario">Registrar meu dia</a>
      </Topo>

      <section className="grade g4">
        <Kpi rotulo="Horas no mês" valor={numero(c.horas, 1)} />
        <Kpi rotulo="Aulas gravadas" valor={numero(c.grav_aulas)} cor={alvo(c.grav_aulas, m.meta_aulas_mes)} meta={m.meta_aulas_mes ? `meta ${m.meta_aulas_mes}` : ''} />
        <Kpi rotulo="Criativos" valor={numero(c.criativos_produzidos)} cor={alvo(c.criativos_produzidos, m.meta_criativos_mes)} meta={m.meta_criativos_mes ? `meta ${m.meta_criativos_mes}` : ''} />
        <Kpi rotulo="Receita atribuída" valor={moeda(c.vnd_valor + c.live_receita, 0)} cor={alvo(c.vnd_valor + c.live_receita, Number(m.meta_receita_mes || 0))} meta={m.meta_receita_mes ? `meta ${moeda(m.meta_receita_mes, 0)}` : ''} />
      </section>

      <section className="secao grade g2">
        <div className="painel"><div className="painel-cab"><h2>Conteúdo e materiais</h2></div>
          <div className="leitura">
            <div><span>Aulas publicadas</span><b>{numero(c.grav_publicadas)}</b></div>
            <div><span>Taxa de regravação</span><b>{pct(c.taxaRegravacao)}</b></div>
            <div><span>Páginas novas</span><b>{numero(c.mat_paginas_novas)}</b></div>
            <div><span>Páginas revisadas</span><b>{numero(c.mat_paginas_revisadas)}</b></div>
            <div><span>Criativos aprovados</span><b>{numero(c.criativos_aprovados)}</b></div>
          </div>
        </div>
        <div className="painel"><div className="painel-cab"><h2>Suporte, lives e vendas</h2></div>
          <div className="leitura">
            <div><span>Chamados / resolução</span><b>{numero(c.sup_chamados)} · {pct(c.resolucaoSuporte)}</b></div>
            <div><span>Lives realizadas</span><b>{numero(c.live_realizadas)}</b></div>
            <div><span>Comparecimento</span><b>{pct(c.comparecimentoLive)}</b></div>
            <div><span>Vendas</span><b>{numero(c.vnd_qtd)}</b></div>
            <div><span>Conversão</span><b>{pct(c.conversaoVenda)}</b></div>
            <div><span>Ticket médio</span><b>{moeda(c.ticketMedio, 0)}</b></div>
          </div>
        </div>
      </section>
    </>
  );
}
