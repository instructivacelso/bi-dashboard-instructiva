import { exigirUsuario } from '@/lib/auth.js';
import { hoje, fmtData } from '@/lib/datas.js';
import { moeda, numero, pct } from '@/lib/formato.js';
import { dividir, variacao, semaforo } from '@/lib/calc.js';
import { CIDADES, FUNIS, PAGAMENTOS, STATUS_VENDA, STATUS_VENDA_INICIAL, MOTIVOS_SEM_VENDA, DIFICULDADES, cidadeDoVendedor, totaisVendas } from '@/lib/comercial.js';
import { produtosAtivos, fechamentoVendedor, anteriorVendedor, faturamentoPeriodos, configuracao } from '@/lib/dadosComercial.js';
import { q, q1 } from '@/lib/db.js';
import { Topo, Aviso, Kpi } from '@/components/Ui.js';
import FormEstado from '@/components/FormEstado.js';
import Etapas from '@/components/Etapas.js';
import InputMoeda from '@/components/InputMoeda.js';
import ProdutosSelect from '@/components/ProdutosSelect.js';
import VendasDia from '@/components/VendasDia.js';
import JustificativaPipeline from '@/components/JustificativaPipeline.js';
import { Numero, Texto, Selecao } from '@/components/Campos.js';
import { salvarVendedor } from '../actions.js';

export const dynamic = 'force-dynamic';
const B = ({ n, children }) => <><span className="bloco-num">{n}</span>{children}</>;
const Sec = ({ titulo, children }) => <div className="secao-form"><h3>{titulo}</h3>{children}</div>;
function Moeda({ nome, rotulo, valor, dica }) {
  return <div className="campo"><label htmlFor={nome}>{rotulo}</label><InputMoeda id={nome} name={nome} valorInicial={valor} />{dica && <small>{dica}</small>}</div>;
}

export default async function FormVendedor() {
  const u = await exigirUsuario();
  const cidade = cidadeDoVendedor(u);
  if (!cidade) {
    return <><Topo titulo="Fechamento do vendedor" /><Aviso tipo="erro">Seu cadastro não está ligado a um time comercial (Jesuítas ou Toledo). Peça ao administrador para marcar a atividade “Vendedores” no seu time.</Aviso></>;
  }
  const dia = hoje();
  const [produtos, atual, ant, periodos, metas, limite, ultimos] = await Promise.all([
    produtosAtivos(), fechamentoVendedor(u.id, dia), anteriorVendedor(u.id, dia), faturamentoPeriodos([u.id], dia),
    q1('SELECT * FROM seller_goals WHERE user_id=$1', [u.id]), configuracao('comercial_horario_limite', '19:00'),
    q(`SELECT c.data_ref, c.pontualidade, c.leads_recebidos, COALESCE(SUM(s.valor) FILTER (WHERE s.status <> 'cancelada'),0) total, COUNT(s.id) FILTER (WHERE s.status <> 'cancelada')::int vendas
         FROM seller_daily_closings c LEFT JOIN sales s ON s.closing_id=c.id WHERE c.user_id=$1 GROUP BY c.id ORDER BY c.data_ref DESC LIMIT 7`, [u.id]),
  ]);
  const f = atual.f || {};
  const a = ant.f;
  const ta = totaisVendas(ant.vendas);
  const th = atual.f ? totaisVendas(atual.vendas) : null;
  const m = metas || {};
  const comp = [
    ['Leads recebidos', a?.leads_recebidos, f.leads_recebidos, numero],
    ['Leads na pipeline', a?.pipeline_qtd, f.pipeline_qtd, numero],
    ['Valor da pipeline', a?.pipeline_valor, f.pipeline_valor, (x) => moeda(x, 0)],
    ['Em negociação', a?.negociacao_valor, f.negociacao_valor, (x) => moeda(x, 0)],
    ['Em fechamento', a?.fechamento_valor, f.fechamento_valor, (x) => moeda(x, 0)],
    ['Ligações', a?.ligacoes, f.ligacoes, numero],
    ['Follow-ups', a?.followups, f.followups, numero],
    ['Agendamentos', a?.agendamentos, f.agendamentos, numero],
    ['Vendas', a ? ta.qtd : undefined, th?.qtd, numero],
    ['Faturamento', a ? ta.total : undefined, th?.total, (x) => moeda(x, 0)],
  ];

  return (
    <>
      <Topo titulo="Fechamento do vendedor" descricao={`Time ${CIDADES[cidade]} · envie até as ${limite} de hoje (${fmtData(dia).slice(0, 5)}).`}>
        <a className="btn sec" href="/comercial/dashboard">Meus resultados</a>
      </Topo>

      <section className="grade g4">
        <Kpi rotulo="Hoje" valor={moeda(periodos.dia, 0)} cor={semaforo(periodos.dia, m.meta_diaria)} progresso={dividir(periodos.dia, m.meta_diaria)} meta={m.meta_diaria ? `meta ${moeda(m.meta_diaria, 0)}` : 'meta não definida'} />
        <Kpi rotulo="Semana" valor={moeda(periodos.semana, 0)} cor={semaforo(periodos.semana, m.meta_semanal)} progresso={dividir(periodos.semana, m.meta_semanal)} meta={m.meta_semanal ? `meta ${moeda(m.meta_semanal, 0)}` : 'meta não definida'} />
        <Kpi rotulo="Mês" valor={moeda(periodos.mes, 0)} cor={semaforo(periodos.mes, m.meta_mensal)} progresso={dividir(periodos.mes, m.meta_mensal)} meta={m.meta_mensal ? `meta ${moeda(m.meta_mensal, 0)} · ${pct(dividir(periodos.mes, m.meta_mensal))}` : 'meta não definida'} />
      </section>

      <section className="painel" style={{ marginTop: 16 }}>
        <div className="painel-cab" style={{ marginBottom: 10 }}><h2>{a ? `Seu último dia registrado (${fmtData(a.data_ref).slice(0, 5)})` : 'Dia anterior'}</h2>{!a && <span className="suave pequeno">Sem registro anterior</span>}</div>
        {a && (
          <div className="leitura">
            {comp.map(([rot, va, vh, fmt]) => {
              const vr = atual.f ? variacao(vh, va) : null;
              return <div key={rot}><span>{rot}</span><b>{fmt(Number(va))}</b>{vr !== null && <span className={vr > 0 ? 'var-pos' : vr < 0 ? 'var-neg' : ''} style={{ fontWeight: 700 }}>hoje {vr > 0 ? '+' : ''}{pct(vr)}</span>}</div>;
            })}
          </div>
        )}
      </section>

      <div className="painel form-claro" style={{ marginTop: 16 }}>
        <div className="painel-cab"><h2>Fechamento de {fmtData(dia)}</h2>{atual.f && <span className={`selo ${f.pontualidade === 'atrasado' ? 'amarelo' : 'verde'}`}>{f.pontualidade === 'atrasado' ? 'Enviado com atraso' : 'Enviado no prazo'}</span>}</div>
        {atual.f && <Aviso tipo="ok">Você já enviou hoje. Pode ajustar até o fim do dia.</Aviso>}
        <FormEstado action={salvarVendedor} botao={atual.f ? 'Salvar alterações' : 'Enviar fechamento'} botaoEnviando="Enviando…" protegerSaida progresso>
          <Etapas />
          <Sec titulo="Time, funis e cursos">
            <div className="campo"><span className="rot"><B n="1">Cidade/Equipe</B></span>
              <div className="cidade-fixa">{CIDADES[cidade]} <small>· definido no seu cadastro</small></div></div>
            <fieldset className="campo" style={{ border: 0, padding: 0, margin: 0 }}>
              <legend className="rot" style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: 6 }}><B n="2">Funis trabalhados hoje</B></legend>
              <div className="escolha" data-grupo-obrigatorio="Funis trabalhados">
                {Object.entries(FUNIS).map(([k, r]) => <label key={k}><input type="checkbox" name="funis" value={k} defaultChecked={f.funis?.includes(k)} /> {r}</label>)}
              </div>
              <small className="suave">Pode marcar mais de um.</small>
            </fieldset>
            <div className="campo"><span className="rot"><B n="3">Cursos trabalhados hoje</B></span>
              <ProdutosSelect produtos={produtos} selecionados={f.produtos || []} /></div>
          </Sec>

          <Sec titulo="Leads e pipeline">
            <Numero nome="leads_recebidos" rotulo={<B n="4">Leads novos recebidos hoje</B>} valor={f.leads_recebidos} />
            <div className="campo"><span className="rot"><B n="5">Pipeline total</B></span>
              <div className="linha-campos"><Numero nome="pipeline_qtd" rotulo="Leads ativos" valor={f.pipeline_qtd} /><Moeda nome="pipeline_valor" rotulo="Valor estimado" valor={f.pipeline_valor} /></div>
              <small>Todas as oportunidades abertas. {a ? `Ontem: ${numero(a.pipeline_qtd)} leads · ${moeda(a.pipeline_valor, 0)}.` : ''}</small></div>
            <div className="campo"><span className="rot"><B n="6">Em negociação</B></span>
              <div className="linha-campos"><Numero nome="negociacao_qtd" rotulo="Leads" valor={f.negociacao_qtd} /><Moeda nome="negociacao_valor" rotulo="Valor" valor={f.negociacao_valor} /></div>
              <small>Conversa ativa, análise da oferta, objeção ou proposta em andamento.</small></div>
            <div className="campo"><span className="rot"><B n="7">Em fechamento</B></span>
              <div className="linha-campos"><Numero nome="fechamento_qtd" rotulo="Leads" valor={f.fechamento_qtd} /><Moeda nome="fechamento_valor" rotulo="Valor previsto" valor={f.fechamento_valor} /></div>
              <small>Já recebeu a condição final, link de pagamento ou boleto.</small></div>
            <JustificativaPipeline anterior={a ? { pipeline_valor: Number(a.pipeline_valor) } : null} valorInicial={f.justificativa_pipeline} />
          </Sec>

          <Sec titulo="Atividades do dia">
            <span className="rot"><B n="8">Atividades comerciais</B></span>
            <div className="linha-campos">
              <Numero nome="ligacoes" rotulo="Ligações" valor={f.ligacoes} />
              <Numero nome="followups" rotulo="Follow-ups" valor={f.followups} />
              <Numero nome="agendamentos" rotulo="Agendamentos" valor={f.agendamentos} />
            </div>
          </Sec>

          <Sec titulo="Vendas de hoje">
            <span className="rot"><B n="9">Vendas realizadas</B></span>
            <VendasDia produtos={produtos} funis={FUNIS} pagamentos={PAGAMENTOS} motivos={MOTIVOS_SEM_VENDA}
              status={Object.fromEntries(STATUS_VENDA_INICIAL.map((k) => [k, STATUS_VENDA[k]]))}
              inicial={atual.f ? { houve: f.houve_venda ? 'sim' : 'nao', vendas: atual.vendas.filter((v) => v.origem === 'manual').map((v) => ({ ...v, valor: Number(v.valor) })), motivo: f.motivo_sem_venda } : null} />
          </Sec>

          <Sec titulo="Fechamento do dia">
            <span className="rot"><B n="10">Fechamento e próxima ação</B></span>
            <Selecao nome="dificuldade" rotulo="Principal dificuldade ou objeção de hoje" valor={f.dificuldade} opcoes={Object.entries(DIFICULDADES).map(([valor, rotulo]) => ({ valor, rotulo }))} />
            <Texto nome="prioridade_amanha" rotulo="Prioridade para amanhã" valor={f.prioridade_amanha} obrig dica="Ex.: retornar os 5 leads em fechamento." />
            <Texto nome="observacao" rotulo="Observação curta" valor={f.observacao} obrig />
          </Sec>
        </FormEstado>
      </div>

      {ultimos.length > 0 && (
        <section className="secao painel">
          <div className="painel-cab"><h2>Seus últimos envios</h2></div>
          <div className="tabela-wrap"><table>
            <thead><tr><th>Data</th><th className="num">Leads</th><th className="num">Vendas</th><th className="num">Faturamento</th><th>Envio</th></tr></thead>
            <tbody>{ultimos.map((r) => (
              <tr key={r.data_ref}><td>{fmtData(r.data_ref)}</td><td className="num">{numero(r.leads_recebidos)}</td><td className="num">{numero(r.vendas)}</td><td className="num">{moeda(Number(r.total), 0)}</td>
                <td><span className={`selo ${r.pontualidade === 'atrasado' ? 'amarelo' : 'verde'}`}>{r.pontualidade === 'atrasado' ? 'Com atraso' : 'No prazo'}</span></td></tr>
            ))}</tbody>
          </table></div>
        </section>
      )}
    </>
  );
}
