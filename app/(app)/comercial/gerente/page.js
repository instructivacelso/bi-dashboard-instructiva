import { exigirUsuario } from '@/lib/auth.js';
import { q, q1 } from '@/lib/db.js';
import { hoje, fmtData } from '@/lib/datas.js';
import { moeda, numero, pct } from '@/lib/formato.js';
import { dividir, variacao, semaforo } from '@/lib/calc.js';
import {
  CIDADES, OPERACOES, CLASSIFICACAO_CONVERSAO, TEMAS_REUNIAO, TIPOS_MOTIVACAO, TIPOS_FEEDBACK, GARGALOS_COMERCIAL, ETAPAS_FUNIL, PRIORIDADES, FUNIS, cidadeDoGerente,
} from '@/lib/comercial.js';
import { painelComercial, pendenciasComercial, configuracao } from '@/lib/dadosComercial.js';
import { Topo, Aviso, Semaforo } from '@/components/Ui.js';
import FormEstado from '@/components/FormEstado.js';
import Etapas from '@/components/Etapas.js';
import Condicionais from '@/components/Condicionais.js';
import InputMoeda from '@/components/InputMoeda.js';
import FeedbacksLista from '@/components/FeedbacksLista.js';
import { Numero, Texto, Escolha, Selecao, DataCampo, SIM_NAO, sn } from '@/components/Campos.js';
import { salvarGerenteComercial } from '../actions.js';

export const dynamic = 'force-dynamic';
const B = ({ n, children }) => <><span className="bloco-num">{n}</span>{children}</>;
const Sec = ({ titulo, children }) => <div className="secao-form"><h3>{titulo}</h3>{children}</div>;
const opc = (o) => Object.entries(o).map(([valor, rotulo]) => ({ valor, rotulo }));
const Leitura = ({ itens }) => <div className="leitura">{itens.map(([r, v]) => <div key={r}><span>{r}</span><b>{v}</b></div>)}</div>;

export default async function FormGerenteComercial() {
  const u = await exigirUsuario();
  const cidade = cidadeDoGerente(u);
  if (!cidade) return <><Topo titulo="Fechamento do gerente comercial" /><Aviso tipo="erro">Seu cadastro não está ligado como gerente de Jesuítas ou Toledo. Peça ao administrador para marcar a atividade “Gerente comercial” no seu time.</Aviso></>;
  const dia = hoje();
  const dep = await q1('SELECT id FROM departments WHERE slug=$1', [cidade]);
  const antData = (await q1(`SELECT MAX(c.data_ref) d FROM seller_daily_closings c WHERE c.department_id=$1 AND c.data_ref < $2`, [dep.id, dia]))?.d;
  const [p, pa, pend, atual, antGer, limite, pessoas] = await Promise.all([
    painelComercial({ cidades: [cidade], desde: dia, ate: dia }),
    antData ? painelComercial({ cidades: [cidade], desde: antData, ate: antData }) : null,
    pendenciasComercial([cidade], dia),
    q1('SELECT * FROM commercial_manager_closings WHERE user_id=$1 AND department_id=$2 AND data_ref=$3', [u.id, dep.id, dia]),
    q1('SELECT * FROM commercial_manager_closings WHERE department_id=$1 AND data_ref < $2 ORDER BY data_ref DESC LIMIT 1', [dep.id, dia]),
    configuracao('comercial_horario_limite', '19:00'),
    q(`SELECT DISTINCT x.id, x.nome FROM users x JOIN user_department_assignments a ON a.user_id=x.id JOIN departments d ON d.id=a.department_id
        WHERE x.ativo AND d.slug=$1 ORDER BY x.nome`, [cidade]),
  ]);
  const v = atual || {};
  const fbs = atual ? await q('SELECT * FROM commercial_manager_feedbacks WHERE closing_id=$1 ORDER BY id', [atual.id]) : [];
  const t = p.totais || {};
  const ta = pa?.totais;
  const enviados = pend.filter((x) => x.enviado).length;
  const comFechamento = p.linhas.filter((l) => l.diasEnviados > 0);
  const destaque = comFechamento[0];
  const acompanhar = comFechamento.length > 1 ? comFechamento[comFechamento.length - 1] : null;
  const metaDia = p.vendedores.some((x) => x.meta_diaria) ? p.vendedores.reduce((s, x) => s + (Number(x.meta_diaria) || 0), 0) : null;
  const comparar = ta ? [
    ['Faturamento', t.total, ta.total, (x) => moeda(x, 0)], ['Vendas', t.qtd, ta.qtd, numero], ['Conversão', t.conversao, ta.conversao, pct],
    ['Ticket médio', t.ticketMedio, ta.ticketMedio, (x) => moeda(x, 0)], ['Pipeline', t.pipeline_valor, ta.pipeline_valor, (x) => moeda(x, 0)],
    ['Em fechamento', t.fechamento_valor, ta.fechamento_valor, (x) => moeda(x, 0)], ['Disparos', v.disparos_valor, antGer?.disparos_valor, (x) => moeda(x, 0)],
    ['Ligações', t.ligacoes, ta.ligacoes, numero], ['Follow-ups', t.followups, ta.followups, numero], ['Agendamentos', t.agendamentos, ta.agendamentos, numero],
  ] : [];

  return (
    <>
      <Topo titulo="Fechamento do gerente comercial" descricao={`Time ${CIDADES[cidade]} · ${enviados} de ${pend.length} vendedores enviaram hoje · limite ${limite}.`}>
        <a className="btn sec" href="/comercial/dashboard">Dashboard comercial</a>
      </Topo>

      <section className="painel">
        <div className="painel-cab"><h2>Vendedores hoje</h2><span className="suave pequeno">{enviados} de {pend.length}</span></div>
        {pend.length === 0 ? <p className="suave">Nenhum vendedor cadastrado neste time.</p> : (
          <div className="acoes-linha">{pend.map((x) => <span key={x.id} className={`selo ${!x.enviado ? 'vermelho' : x.pontualidade === 'atrasado' ? 'amarelo' : 'verde'}`}>{x.nome}{!x.enviado ? ' · pendente' : x.pontualidade === 'atrasado' ? ' · atrasado' : ''}</span>)}</div>
        )}
      </section>

      {comparar.length > 0 && (
        <section className="painel" style={{ marginTop: 16 }}>
          <div className="painel-cab" style={{ marginBottom: 10 }}><h2>Comparado ao dia {fmtData(antData).slice(0, 5)}</h2></div>
          <div className="leitura">{comparar.map(([r, h, a, f]) => {
            const vr = variacao(h, a);
            return <div key={r}><span>{r}</span><b>{f(a)}</b><span className={vr > 0 ? 'var-pos' : vr < 0 ? 'var-neg' : ''} style={{ fontWeight: 700 }}>hoje {vr === null ? '—' : `${vr > 0 ? '+' : ''}${pct(vr)}`}</span></div>;
          })}</div>
        </section>
      )}

      <div className="painel form-claro" style={{ marginTop: 16 }}>
        <div className="painel-cab"><h2>Fechamento de {fmtData(dia)}</h2>{atual && <span className={`selo ${v.pontualidade === 'atrasado' ? 'amarelo' : 'verde'}`}>{v.pontualidade === 'atrasado' ? 'Enviado com atraso' : 'Enviado no prazo'}</span>}</div>
        {atual && <Aviso tipo="ok">Você já enviou hoje. Pode ajustar até o fim do dia.</Aviso>}
        <FormEstado action={salvarGerenteComercial} botao={atual ? 'Salvar alterações' : 'Enviar fechamento'} botaoEnviando="Enviando…" protegerSaida progresso>
          <Condicionais />
          <Etapas />

          <Sec titulo="Time e operação">
            <div className="campo"><span className="rot"><B n="1">Cidade/Equipe</B></span><div className="cidade-fixa">{CIDADES[cidade]} <small>· definido no seu cadastro</small></div></div>
            <fieldset className="campo" style={{ border: 0, padding: 0, margin: 0 }}>
              <legend className="rot" style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: 6 }}><B n="2">Operações trabalhadas hoje</B></legend>
              <div className="escolha" data-grupo-obrigatorio="Operações trabalhadas">{Object.entries(OPERACOES).map(([k, r]) => <label key={k}><input type="checkbox" name="operacoes" value={k} defaultChecked={v.operacoes?.includes(k)} /> {r}</label>)}</div>
            </fieldset>
          </Sec>

          <Sec titulo="Resultado de vendas">
            <span className="rot"><B n="3">Resultado geral (vem dos vendedores)</B></span>
            <Leitura itens={[['Vendas', numero(t.qtd)], ['Faturamento', moeda(t.total, 0)], ['Aprovado', moeda(t.aprovado, 0)], ['Cartão', moeda(t.cartao, 0)],
              ['PIX', moeda(t.pix, 0)], ['Boleto gerado', moeda(t.boleto, 0)], ['Recebido', moeda(t.recebido, 0)], ['Ticket médio', moeda(t.ticketMedio, 0)],
              ['Meta do dia', metaDia ? moeda(metaDia, 0) : 'não definida'], ['% da meta', pct(dividir(t.total, metaDia))]]} />
            <Escolha nome="numeros_conferidos" rotulo="Os números estão conferidos?" opcoes={SIM_NAO} valor={sn(v.numeros_conferidos)} />
            <div data-se="numeros_conferidos:nao">
              <Texto nome="divergencia_descricao" rotulo="Qual é a divergência?" valor={v.divergencia_descricao} obrig />
              <Texto nome="divergencia_origem" rotulo="Vendedor ou origem afetada" valor={v.divergencia_origem} obrig />
              <Texto nome="divergencia_acao" rotulo="Ação para correção" valor={v.divergencia_acao} obrig />
            </div>
          </Sec>

          <Sec titulo="Disparos">
            <span className="rot"><B n="4">Gastos com disparos hoje</B></span>
            <div className="linha-campos">
              <div className="campo"><label htmlFor="disparos_valor">Valor gasto com API/disparos</label><InputMoeda id="disparos_valor" name="disparos_valor" valorInicial={v.disparos_valor} /></div>
              <Numero nome="mensagens_enviadas" rotulo="Mensagens enviadas" valor={v.mensagens_enviadas} />
            </div>
            <div className="linha-campos">
              <Numero nome="mensagens_entregues" rotulo="Mensagens entregues" valor={v.mensagens_entregues} />
              <Numero nome="respostas" rotulo="Respostas recebidas" valor={v.respostas} dica="Se não tiver esse número, informe 0." />
            </div>
            <Texto nome="campanha_disparo" rotulo="Principal campanha ou finalidade" valor={v.campanha_disparo} obrig />
            {atual && <Leitura itens={[['Custo por enviada', moeda(dividir(v.disparos_valor, v.mensagens_enviadas))], ['Custo por entregue', moeda(dividir(v.disparos_valor, v.mensagens_entregues))], ['Custo por resposta', moeda(dividir(v.disparos_valor, v.respostas))]]} />}
          </Sec>

          <Sec titulo="Conversão do time">
            <span className="rot"><B n="5">Conversão geral</B></span>
            <Leitura itens={[['Leads recebidos', numero(t.leads)], ['Vendas', numero(t.qtd)], ['Conversão', pct(t.conversao)],
              ...p.porFunil.map((x) => [`Vendas · ${FUNIS[x.chave] || x.chave}`, numero(x.qtd)])]} />
            <small className="suave">Conversão = vendas ÷ leads recebidos pelos vendedores (leads únicos trabalhados ainda não são registrados).</small>
            <Escolha nome="conversao_classificacao" rotulo="Como você classifica a conversão de hoje?" opcoes={CLASSIFICACAO_CONVERSAO} valor={v.conversao_classificacao} />
            <div data-se="conversao_classificacao:abaixo|critica"><Texto nome="conversao_justificativa" rotulo="Por que ficou abaixo?" valor={v.conversao_justificativa} obrig longo /></div>
          </Sec>

          <Sec titulo="Desempenho dos vendedores">
            <span className="rot"><B n="6">Desempenho (ranking equilibrado: meta, conversão, atividade e fechamento)</B></span>
            {comFechamento.length === 0 ? <p className="suave">Nenhum vendedor enviou o fechamento hoje ainda.</p> : (
              <div className="tabela-wrap"><table>
                <thead><tr><th>Vendedor</th><th className="num">Receita</th><th className="num">% meta</th><th className="num">Conversão</th><th className="num">Atividade</th><th className="num">Em fechamento</th></tr></thead>
                <tbody>{comFechamento.map((l) => (
                  <tr key={l.id}><td>{l.nome}{l.id === destaque?.id && <> <Semaforo cor="verde" texto="Destaque" /></>}{l.id === acompanhar?.id && <> <Semaforo cor="amarelo" texto="Acompanhar" /></>}</td>
                    <td className="num">{moeda(l.faturamento, 0)}</td><td className="num">{pct(l.pctMeta)}</td><td className="num">{pct(l.conversao)}</td>
                    <td className="num">{numero(l.atividade)}</td><td className="num">{moeda(l.fechamento_valor, 0)}</td></tr>
                ))}</tbody>
              </table></div>
            )}
            <Texto nome="destaque_positivo" rotulo={`Destaque positivo${destaque ? ` (${destaque.nome})` : ''}`} valor={v.destaque_positivo} obrig />
            <Texto nome="acao_acompanhamento" rotulo={`Ação de acompanhamento para o vendedor que necessita maior acompanhamento${acompanhar ? ` (${acompanhar.nome})` : ''}`} valor={v.acao_acompanhamento} obrig />
          </Sec>

          <Sec titulo="Feedbacks">
            <span className="rot"><B n="7">Feedbacks realizados</B></span>
            <Numero nome="feedbacks_qtd" rotulo="Quantos feedbacks você deu hoje?" valor={v.feedbacks_qtd} />
            <div className="linha-campos">
              <Escolha nome="feedback_individual" rotulo="Houve feedback individual?" opcoes={SIM_NAO} valor={sn(v.feedback_individual)} />
              <Escolha nome="feedback_coletivo" rotulo="Houve feedback coletivo?" opcoes={SIM_NAO} valor={sn(v.feedback_coletivo)} />
            </div>
            <FeedbacksLista tipos={TIPOS_FEEDBACK} inicial={fbs} />
            <div data-se="feedbacks_qtd:0|"><Texto nome="feedback_motivo" rotulo="Por que não houve feedback hoje?" valor={v.feedback_motivo} obrig /></div>
          </Sec>

          <Sec titulo="Reunião diária">
            <span className="rot"><B n="8">Reunião diária</B></span>
            <Escolha nome="reuniao_realizada" rotulo="A reunião diária foi realizada?" opcoes={SIM_NAO} valor={sn(v.reuniao_realizada)} />
            <div data-se="reuniao_realizada:sim">
              <fieldset className="campo" style={{ border: 0, padding: 0, margin: 0 }}>
                <legend className="rot" style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: 6 }}>Temas</legend>
                <div className="escolha" data-grupo-obrigatorio="Temas da reunião">{Object.entries(TEMAS_REUNIAO).map(([k, r]) => <label key={k}><input type="checkbox" name="reuniao_temas" value={k} defaultChecked={v.reuniao_temas?.includes(k)} /> {r}</label>)}</div>
              </fieldset>
              <Texto nome="reuniao_assuntos" rotulo="Assuntos abordados" valor={v.reuniao_assuntos} obrig />
              <Texto nome="reuniao_decisoes" rotulo="Decisões tomadas" valor={v.reuniao_decisoes} obrig />
              <Texto nome="reuniao_pendencias" rotulo="Pendências geradas" valor={v.reuniao_pendencias} obrig dica="Se não houve, escreva “nenhuma”." />
            </div>
            <div data-se="reuniao_realizada:nao">
              <Texto nome="reuniao_motivo" rotulo="Por que não houve reunião?" valor={v.reuniao_motivo} obrig />
              <Texto nome="reuniao_compensacao" rotulo="Nova data ou ação de compensação" valor={v.reuniao_compensacao} obrig />
            </div>
          </Sec>

          <Sec titulo="Motivação e desenvolvimento">
            <span className="rot"><B n="9">Ação de motivação ou desenvolvimento</B></span>
            <Escolha nome="motivacao_houve" rotulo="Houve ação hoje?" opcoes={SIM_NAO} valor={sn(v.motivacao_houve)} />
            <div data-se="motivacao_houve:sim">
              <Selecao nome="motivacao_tipo" rotulo="Tipo da ação" valor={v.motivacao_tipo} opcoes={opc(TIPOS_MOTIVACAO)} />
              <Texto nome="motivacao_publico" rotulo="Público envolvido" valor={v.motivacao_publico} obrig />
              <Texto nome="motivacao_objetivo" rotulo="Objetivo" valor={v.motivacao_objetivo} obrig />
              <Texto nome="motivacao_resultado" rotulo="Resultado percebido" valor={v.motivacao_resultado} obrig />
            </div>
            <div data-se="motivacao_houve:nao">
              <Texto nome="motivacao_motivo" rotulo="Por que não houve?" valor={v.motivacao_motivo} obrig />
              <DataCampo nome="motivacao_proxima" rotulo="Previsão da próxima ação" valor={v.motivacao_proxima} obrig />
            </div>
          </Sec>

          <Sec titulo="Objeções, gargalo e plano de ação">
            <span className="rot"><B n="10">Objeções e plano de ação</B></span>
            <div className="linha-campos">
              {[1, 2, 3].map((n) => <Texto key={n} nome={`objecao_${n}`} rotulo={`Objeção ${n}`} valor={v.objecoes?.[n - 1]} obrig max={150} />)}
            </div>
            <div className="linha-campos">
              <Selecao nome="gargalo" rotulo="Principal gargalo" valor={v.gargalo} opcoes={opc(GARGALOS_COMERCIAL)} />
              <Selecao nome="etapa_afetada" rotulo="Etapa do funil afetada" valor={v.etapa_afetada} opcoes={opc(ETAPAS_FUNIL)} />
            </div>
            <Texto nome="impacto" rotulo="Impacto estimado" valor={v.impacto} obrig />
            <Texto nome="acao" rotulo="Ação corretiva" valor={v.acao} obrig />
            <div className="linha-campos">
              <Selecao nome="responsavel_id" rotulo="Responsável" valor={v.responsavel_id} opcoes={pessoas.map((x) => ({ valor: x.id, rotulo: x.nome }))} />
              <DataCampo nome="prazo" rotulo="Prazo" valor={v.prazo} obrig />
            </div>
            <Escolha nome="prioridade" rotulo="Prioridade" opcoes={PRIORIDADES} valor={v.prioridade} />
          </Sec>
        </FormEstado>
      </div>
    </>
  );
}
