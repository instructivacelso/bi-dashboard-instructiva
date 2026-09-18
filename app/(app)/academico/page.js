import { exigirUsuario } from '@/lib/auth.js';
import { hoje } from '@/lib/datas.js';
import { moeda, numero, pct } from '@/lib/formato.js';
import { veAcademico, ehProfessor, configuraAcademico, gereConteudo, ETAPAS_CONTEUDO } from '@/lib/academico.js';
import { numerosAcademico } from '@/lib/dadosAcademico.js';
import { Topo, Aviso, Kpi } from '@/components/Ui.js';

export const dynamic = 'force-dynamic';
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const rot = (mes) => { const [a, m] = mes.split('-'); return `${MESES[Number(m) - 1]}/${a}`; };
const somaMes = (mes, n) => { const [a, m] = mes.split('-').map(Number); const d = new Date(Date.UTC(a, m - 1 + n, 1)); return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`; };
const fim = (mes) => { const [a, m] = mes.split('-').map(Number); const d = new Date(Date.UTC(a, m, 0)); return `${a}-${String(m).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`; };

export default async function PainelAcademico(props) {
  const sp = await props.searchParams;
  const u = await exigirUsuario();
  if (!veAcademico(u)) {
    return (<><Topo titulo="Acadêmico" descricao="Área da coordenação e da diretoria." />
      {ehProfessor(u) ? <Aviso>Você é professor: registre <a href="/academico/diario">seu dia</a> e acompanhe <a href="/academico/painel">seu painel</a>.</Aviso> : <Aviso tipo="erro">Sem acesso ao Acadêmico.</Aviso>}</>);
  }
  const mesAtual = hoje().slice(0, 7);
  const mes = /^\d{4}-\d{2}$/.test(sp.mes || '') && sp.mes <= mesAtual ? sp.mes : mesAtual;
  const n = await numerosAcademico(`${mes}-01`, fim(mes));
  const c = n.cons;

  return (
    <>
      <Topo titulo="Acadêmico — coordenação" descricao={`${rot(mes)} · ${n.professoresAtivos} professor(es) ativo(s) · ${n.diasComEnvio} registro(s) no mês`}>
        <a className="btn sec peq" href={`/academico?mes=${somaMes(mes, -1)}`}>← {rot(somaMes(mes, -1))}</a>
        {mes < mesAtual && <a className="btn sec peq" href={`/academico?mes=${somaMes(mes, 1)}`}>{rot(somaMes(mes, 1))} →</a>}
        {gereConteudo(u) && <a className="btn sec" href="/academico/pipeline">Pipeline</a>}
        {configuraAcademico(u) && <a className="btn sec" href="/academico/cadastros">Cadastros</a>}
      </Topo>

      <section className="grade g4">
        <Kpi rotulo="Horas registradas" valor={numero(c.horas, 1)} meta={`${n.professoresAtivos} professor(es)`} />
        <Kpi rotulo="Aulas gravadas" valor={numero(c.grav_aulas)} meta={`${numero(c.grav_publicadas)} publicadas · regravação ${pct(c.taxaRegravacao)}`} />
        <Kpi rotulo="Conteúdo em produção" valor={numero(n.emProducao)} cor={n.atrasados > 0 ? 'amarelo' : ''} meta={`${n.atrasados} atrasado(s) · ${n.proximos} p/ vencer`} />
        <Kpi rotulo="Receita atribuída" valor={moeda(c.vnd_valor + c.live_receita, 0)} meta={`${numero(c.vnd_qtd + c.live_vendas)} venda(s)`} />
      </section>

      <section className="secao grade g2">
        <div className="painel"><div className="painel-cab"><h2>Produção no mês</h2></div>
          <div className="leitura">
            <div><span>Criativos (prod./aprov.)</span><b>{numero(c.criativos_produzidos)} / {numero(c.criativos_aprovados)}</b></div>
            <div><span>Páginas (novas/revisadas)</span><b>{numero(c.mat_paginas_novas)} / {numero(c.mat_paginas_revisadas)}</b></div>
            <div><span>Lives realizadas</span><b>{numero(c.live_realizadas)}</b></div>
            <div><span>Comparecimento em lives</span><b>{pct(c.comparecimentoLive)}</b></div>
            <div><span>Suporte (chamados)</span><b>{numero(c.sup_chamados)} · resolução {pct(c.resolucaoSuporte)}</b></div>
            <div><span>Receita por live</span><b>{moeda(c.receitaPorLive, 0)}</b></div>
          </div>
        </div>
        <div className="painel"><div className="painel-cab"><h2>Pipeline por etapa</h2></div>
          <div className="leitura">
            {Object.entries(ETAPAS_CONTEUDO).filter(([e]) => e !== 'arquivado').map(([e, r]) => (
              <div key={e}><span>{r}</span><b>{numero(n.board[e] || 0)}</b></div>
            ))}
          </div>
        </div>
      </section>

      <section className="secao painel"><div className="painel-cab"><h2>Por professor</h2></div>
        {n.porProfessor.length === 0 ? <Aviso>Sem registros no mês.</Aviso> : (
          <div className="tabela-wrap"><table>
            <thead><tr><th>Professor</th><th className="num">Dias</th><th className="num">Horas</th><th className="num">Aulas</th><th className="num">Criativos</th><th className="num">Páginas</th><th className="num">Lives</th><th className="num">Vendas</th><th className="num">Receita</th></tr></thead>
            <tbody>{n.porProfessor.map((x) => (
              <tr key={x.user_id}><td>{x.nome}</td><td className="num">{x.dias}</td><td className="num">{numero(x.horas, 1)}</td><td className="num">{x.aulas}</td><td className="num">{x.criativos}</td><td className="num">{x.paginas}</td><td className="num">{x.lives}</td><td className="num">{x.vendas}</td><td className="num">{moeda(x.receita, 0)}</td></tr>
            ))}</tbody>
          </table></div>
        )}
      </section>
    </>
  );
}
