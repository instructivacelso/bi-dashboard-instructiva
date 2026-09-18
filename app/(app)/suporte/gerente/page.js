import { exigirUsuario } from '@/lib/auth.js';
import { q, q1 } from '@/lib/db.js';
import { hoje, fmtData } from '@/lib/datas.js';
import { numero, pct } from '@/lib/formato.js';
import { variacao } from '@/lib/calc.js';
import { CLASSIFICACAO_SLA, GARGALOS_SUPORTE, PRIORIDADES_ACAO, SETORES_ENCAMINHAMENTO, TIPOS_FEEDBACK, TURNOS, fmtDuracao } from '@/lib/suporte.js';
import { numerosSuporte, desempenhoAtendentes, atendentes } from '@/lib/dadosSuporte.js';
import { configuracao } from '@/lib/dadosComercial.js';
import { Topo, Aviso, Semaforo } from '@/components/Ui.js';
import FormEstado from '@/components/FormEstado.js';
import Etapas from '@/components/Etapas.js';
import Condicionais from '@/components/Condicionais.js';
import ListaQtd from '@/components/ListaQtd.js';
import { Numero, Texto, Escolha, Selecao, DataCampo, SIM_NAO, sn } from '@/components/Campos.js';
import { Resolvidos, Backlog, Sla, Categorias, Encaminhamentos, Qualidade } from '@/components/NumerosSuporte.js';
import { salvarGerenteSuporte } from '../actions.js';

export const dynamic = 'force-dynamic';
const B = ({ n, children }) => <><span className="bloco-num">{n}</span>{children}</>;
const Sec = ({ titulo, children }) => <div className="secao-form"><h3>{titulo}</h3>{children}</div>;
const opc = (o) => Object.entries(o).map(([valor, rotulo]) => ({ valor, rotulo }));

export default async function GerenteSuporte() {
  const u = await exigirUsuario();
  if (!u.lotacoes.some((l) => l.formulario === 'suporte_gerente')) return <><Topo titulo="Fechamento do gerente de Suporte" /><Aviso tipo="erro">Este formulário é do gerente de Suporte. Peça ao administrador para marcar a atividade “Gerente de Suporte”.</Aviso></>;
  const dia = hoje();
  const [n, equipe, perf, atual, anterior, limite, criticos, fechamentos] = await Promise.all([
    numerosSuporte(null, dia), atendentes(), desempenhoAtendentes(dia),
    q1('SELECT * FROM support_manager_closings WHERE user_id=$1 AND data_ref=$2', [u.id, dia]),
    q1('SELECT numeros, data_ref FROM support_manager_closings WHERE data_ref < $1 ORDER BY data_ref DESC LIMIT 1', [dia]),
    configuracao('suporte_horario_limite', '19:00'),
    q(`SELECT t.protocolo, t.prioridade, t.categoria, s.nome aluno, r.nome responsavel FROM support_tickets t JOIN students s ON s.id=t.student_id JOIN users r ON r.id=t.responsavel_id
        WHERE t.status NOT IN ('resolvido','encerrado') AND (t.prioridade='critica' OR t.categoria='cancelamento') ORDER BY t.aberto_em LIMIT 20`),
    q(`SELECT c.user_id, c.turno, c.pontualidade, c.risco_cancelamento, c.reclamacao_grave FROM support_daily_closings c WHERE c.data_ref=$1`, [dia]),
  ]);
  const v = atual || {};
  const a = anterior?.numeros;
  const comFech = perf.filter((l) => l.trabalhados > 0);
  const destaque = comFech[0];
  const acompanhar = comFech.length > 1 ? comFech[comFech.length - 1] : null;
  const sobrecarregado = [...perf].sort((x, y) => y.backlogFinal - x.backlogFinal)[0];
  const livre = [...perf].sort((x, y) => x.backlogFinal - y.backlogFinal)[0];
  const presentes = fechamentos.length;
  const turnos = fechamentos.reduce((m, f) => ({ ...m, [f.turno]: (m[f.turno] || 0) + 1 }), {});
  const comp = a ? [['Recebidos', n.novos, a.novos, numero], ['Resolvidos', n.resolvidos, a.resolvidos, numero], ['Backlog', n.backlogFinal, a.backlogFinal, numero],
    ['SLA', n.cumprimentoSla, a.cumprimentoSla, pct], ['1ª resposta', n.tempoPrimeiraResposta, a.tempoPrimeiraResposta, fmtDuracao], ['Solução', n.tempoSolucao, a.tempoSolucao, fmtDuracao],
    ['Reaberturas', n.reabertos, a.reabertos, numero], ['Satisfação', n.satisfacaoPositiva, a.satisfacaoPositiva, pct], ['Críticos', n.criticosAbertos, a.criticosAbertos, numero], ['Encaminhados', n.encaminhados, a.encaminhados, numero]] : [];

  return (
    <>
      <Topo titulo="Fechamento do gerente de Suporte" descricao={`${fmtData(dia)} · ${presentes} de ${perf.length} atendentes enviaram o fechamento · limite ${limite}.`}>
        <a className="btn sec" href="/suporte/dashboard">Dashboard</a>
      </Topo>
      {comp.length > 0 && (
        <section className="painel" style={{ marginBottom: 16 }}>
          <div className="painel-cab" style={{ marginBottom: 10 }}><h2>Comparado a {fmtData(anterior.data_ref).slice(0, 5)}</h2></div>
          <div className="leitura">{comp.map(([r, h, x, f]) => { const vr = variacao(h, x); return <div key={r}><span>{r}</span><b>{f(x)}</b><span style={{ fontWeight: 700 }} className={vr > 0 ? 'var-pos' : vr < 0 ? 'var-neg' : ''}>hoje {vr === null ? '—' : `${vr > 0 ? '+' : ''}${pct(vr)}`}</span></div>; })}</div>
        </section>
      )}
      <div className="painel form-claro">
        {atual && <Aviso tipo="ok">Você já enviou hoje. Pode ajustar até o fim do dia.</Aviso>}
        <FormEstado action={salvarGerenteSuporte} botao={atual ? 'Salvar alterações' : 'Enviar fechamento'} botaoEnviando="Enviando…" protegerSaida progresso>
          <Condicionais />
          <Etapas />
          <Sec titulo="Equipe e cobertura">
            <span className="rot"><B n="1">Equipe, turno e cobertura</B></span>
            <div className="leitura">
              <div><span>Atendentes</span><b>{perf.length}</b></div><div><span>Enviaram fechamento</span><b>{presentes}</b></div>
              <div><span>Sem fechamento</span><b>{perf.length - presentes}</b></div>
              {Object.entries(turnos).map(([t, q2]) => <div key={t}><span>{TURNOS[t]}</span><b>{q2}</b></div>)}
            </div>
            <div className="linha-campos">
              <Escolha nome="cobertura_suficiente" rotulo="A cobertura foi suficiente?" opcoes={SIM_NAO} valor={sn(v.cobertura_suficiente)} />
              <Escolha nome="ausencia_sobrecarga" rotulo="Houve ausência ou sobrecarga?" opcoes={SIM_NAO} valor={sn(v.ausencia_sobrecarga)} />
            </div>
            <Texto nome="ajuste_distribuicao" rotulo="Ajuste de distribuição realizado" valor={v.ajuste_distribuicao} obrig dica="Se nenhum, escreva “nenhum”." />
            <div data-se="cobertura_suficiente:nao">
              <Texto nome="impacto_cobertura" rotulo="Qual foi o impacto?" valor={v.impacto_cobertura} obrig />
              <Texto nome="acao_cobertura" rotulo="Ação tomada" valor={v.acao_cobertura} obrig />
            </div>
          </Sec>
          <Sec titulo="Resultado e SLA">
            <span className="rot"><B n="2">Resultado geral</B></span>
            <Resolvidos n={n} />
            <Escolha nome="numeros_corretos" rotulo="Os números estão corretos?" opcoes={SIM_NAO} valor={sn(v.numeros_corretos)} />
            <div data-se="numeros_corretos:nao">
              <Texto nome="divergencia" rotulo="Qual é a divergência?" valor={v.divergencia} obrig />
              <Texto nome="responsavel_correcao" rotulo="Responsável pela correção" valor={v.responsavel_correcao} obrig />
            </div>
            <span className="rot"><B n="3">SLA e tempos</B></span>
            <Sla n={n} />
            <Escolha nome="classificacao_sla" rotulo="Como está o SLA?" opcoes={CLASSIFICACAO_SLA} valor={v.classificacao_sla} />
            <div data-se="classificacao_sla:abaixo|critico">
              <Texto nome="causa_sla" rotulo="Causa" valor={v.causa_sla} obrig />
              <Texto nome="acao_sla" rotulo="Ação imediata" valor={v.acao_sla} obrig />
            </div>
          </Sec>
          <Sec titulo="Backlog e qualidade">
            <span className="rot"><B n="4">Backlog, pendências e vencidos</B></span>
            <Backlog n={n} />
            <Texto nome="motivo_backlog" rotulo="Motivo principal do backlog" valor={v.motivo_backlog} obrig />
            <div className="linha-campos">
              <Numero nome="qtd_priorizar" rotulo="Quantos priorizar amanhã" valor={v.qtd_priorizar} />
              <Texto nome="responsavel_backlog" rotulo="Responsável" valor={v.responsavel_backlog} obrig />
            </div>
            <Texto nome="estrategia_backlog" rotulo="Estratégia de redução" valor={v.estrategia_backlog} obrig />
            <span className="rot"><B n="5">Qualidade e satisfação</B></span>
            <Qualidade n={n} />
            <Texto nome="motivo_insatisfacao" rotulo="Principal motivo de insatisfação" valor={v.motivo_insatisfacao} obrig dica="Se não houve, escreva “nenhum”." />
            <Texto nome="atendimento_revisao" rotulo="Atendimento que precisa de revisão" valor={v.atendimento_revisao} obrig dica="Protocolo ou “nenhum”." />
            <Texto nome="acao_qualidade" rotulo="Ação de melhoria da qualidade" valor={v.acao_qualidade} obrig />
          </Sec>
          <Sec titulo="Recorrências e casos críticos">
            <span className="rot"><B n="6">Problemas recorrentes e causa raiz</B></span>
            <Categorias n={n} />
            <Texto nome="problema_recorrente" rotulo="Principal problema recorrente" valor={v.problema_recorrente} obrig />
            <div className="linha-campos">
              <Texto nome="curso_afetado" rotulo="Curso ou produto afetado" valor={v.curso_afetado} obrig />
              <Selecao nome="setor_causa" rotulo="Setor que pode eliminar a causa" valor={v.setor_causa} opcoes={opc(SETORES_ENCAMINHAMENTO)} />
            </div>
            <Texto nome="causa_provavel" rotulo="Causa provável" valor={v.causa_provavel} obrig />
            <Texto nome="sugestao_preventiva" rotulo="Sugestão preventiva" valor={v.sugestao_preventiva} obrig />
            <Escolha nome="prioridade_recorrente" rotulo="Prioridade" opcoes={PRIORIDADES_ACAO} valor={v.prioridade_recorrente} />
            <span className="rot"><B n="7">Casos críticos e riscos</B></span>
            {criticos.length === 0 ? <p className="suave pequeno">Nenhum ticket crítico ou de cancelamento em aberto.</p> : (
              <div className="tabela-wrap"><table><tbody>{criticos.map((c) => <tr key={c.protocolo}><td><b>{c.protocolo}</b></td><td>{c.aluno}</td><td className="pequeno">{c.categoria === 'cancelamento' ? 'Cancelamento → Pós-venda' : 'Crítico'}</td><td className="pequeno">{c.responsavel}</td></tr>)}</tbody></table></div>
            )}
            <Numero nome="casos_qtd" rotulo="Quantos casos críticos você vai registrar?" valor={v.casos_qtd} dica="Cancelamento e retenção vão para o Pós-venda; falha de liberação vai para a Automação." />
            <ListaQtd campoQtd="casos_qtd" prefixo="caso" titulo="Caso crítico" inicial={v.casos || []}
              campos={[{ nome: 'aluno', rotulo: 'Aluno' }, { nome: 'problema', rotulo: 'Problema' }, { nome: 'impacto', rotulo: 'Impacto' }, { nome: 'responsavel', rotulo: 'Responsável atual' },
                { nome: 'setor', rotulo: 'Setor envolvido' }, { nome: 'acao', rotulo: 'Ação imediata' }, { nome: 'prazo', rotulo: 'Prazo', tipo: 'data' }, { nome: 'status', rotulo: 'Status' }]} />
          </Sec>
          <Sec titulo="Desempenho da equipe">
            <span className="rot"><B n="8">Desempenho e carga (volume, SLA, resolução, criticidade e reabertura)</B></span>
            {perf.length === 0 ? <p className="suave">Nenhum atendente cadastrado.</p> : (
              <div className="tabela-wrap"><table>
                <thead><tr><th>Atendente</th><th className="num">Trabalhados</th><th className="num">Resolvidos</th><th className="num">SLA</th><th className="num">Reabertura</th><th className="num">Em aberto</th></tr></thead>
                <tbody>{perf.map((l) => (
                  <tr key={l.id}><td>{l.nome} {l.id === destaque?.id && <Semaforo cor="verde" texto="Destaque" />} {l.id === acompanhar?.id && <Semaforo cor="amarelo" texto="Acompanhar" />} {l.id === sobrecarregado?.id && l.backlogFinal > 0 && <Semaforo cor="vermelho" texto="Mais carregado" />} {l.id === livre?.id && perf.length > 1 && <Semaforo cor="neutro" texto="Com capacidade" />}</td>
                    <td className="num">{numero(l.trabalhados)}</td><td className="num">{numero(l.resolvidos)}</td><td className="num">{pct(l.sla)}</td><td className="num">{pct(l.taxaReabertura)}</td><td className="num">{numero(l.backlogFinal)}</td></tr>
                ))}</tbody>
              </table></div>
            )}
            <Texto nome="reconhecimento" rotulo={`Reconhecimento do destaque${destaque ? ` (${destaque.nome})` : ''}`} valor={v.reconhecimento} obrig />
            <Texto nome="acao_acompanhamento" rotulo={`Ação de acompanhamento${acompanhar ? ` (${acompanhar.nome})` : ''}`} valor={v.acao_acompanhamento} obrig />
            <Texto nome="redistribuicao" rotulo="Redistribuição necessária" valor={v.redistribuicao} obrig dica="Se nenhuma, escreva “nenhuma”." />
          </Sec>
          <Sec titulo="Feedbacks, reunião e desenvolvimento">
            <span className="rot"><B n="9">Feedbacks, reunião e desenvolvimento</B></span>
            <Numero nome="feedbacks_qtd" rotulo="Feedbacks individuais realizados" valor={v.feedbacks_qtd} />
            <ListaQtd campoQtd="feedbacks_qtd" prefixo="fb" titulo="Feedback" inicial={v.feedbacks || []}
              campos={[{ nome: 'colaborador', rotulo: 'Colaborador' }, { nome: 'tipo', rotulo: 'Tipo', tipo: 'opcao', opcoes: TIPOS_FEEDBACK }, { nome: 'tema', rotulo: 'Tema' }, { nome: 'acao', rotulo: 'Ação combinada' }, { nome: 'prazo', rotulo: 'Prazo', tipo: 'data' }]} />
            <div data-se="feedbacks_qtd:0|"><Texto nome="motivo_sem_feedback" rotulo="Por que não houve feedback?" valor={v.motivo_sem_feedback} obrig /></div>
            <Escolha nome="reuniao_realizada" rotulo="Houve reunião diária?" opcoes={SIM_NAO} valor={sn(v.reuniao_realizada)} />
            <div data-se="reuniao_realizada:sim">
              <Texto nome="reuniao_tema" rotulo="Tema" valor={v.reuniao_tema} obrig />
              <Texto nome="reuniao_assuntos" rotulo="Assuntos abordados" valor={v.reuniao_assuntos} obrig />
              <Texto nome="reuniao_decisoes" rotulo="Decisões tomadas" valor={v.reuniao_decisoes} obrig />
            </div>
            <div data-se="reuniao_realizada:nao"><Texto nome="reuniao_justificativa" rotulo="Por que não houve reunião?" valor={v.reuniao_justificativa} obrig /></div>
            <Escolha nome="treinamento" rotulo="Houve treinamento ou orientação?" opcoes={SIM_NAO} valor={sn(v.treinamento)} />
            <div data-se="treinamento:sim"><Texto nome="treinamento_tema" rotulo="Tema do treinamento" valor={v.treinamento_tema} obrig /></div>
            <DataCampo nome="proximo_acompanhamento" rotulo="Próximo acompanhamento" valor={v.proximo_acompanhamento} obrig />
          </Sec>
          <Sec titulo="Encaminhamentos e plano de ação">
            <span className="rot"><B n="10">Encaminhamentos, gargalo e plano de ação</B></span>
            <Encaminhamentos n={n} />
            <div className="linha-campos">
              <Selecao nome="gargalo" rotulo="Principal gargalo" valor={v.gargalo} opcoes={opc(GARGALOS_SUPORTE)} />
              <Selecao nome="setor_envolvido" rotulo="Setor envolvido" valor={v.setor_envolvido} opcoes={opc(SETORES_ENCAMINHAMENTO)} />
            </div>
            <Texto nome="etapa_afetada" rotulo="Etapa afetada" valor={v.etapa_afetada} obrig />
            <Texto nome="impacto" rotulo="Impacto estimado" valor={v.impacto} obrig />
            <Texto nome="acao" rotulo="Ação corretiva" valor={v.acao} obrig />
            <div className="linha-campos">
              <Selecao nome="responsavel_id" rotulo="Responsável" valor={v.responsavel_id} opcoes={equipe.map((x) => ({ valor: x.id, rotulo: x.nome }))} />
              <DataCampo nome="prazo" rotulo="Prazo" valor={v.prazo} obrig />
            </div>
            <Escolha nome="prioridade" rotulo="Prioridade" opcoes={PRIORIDADES_ACAO} valor={v.prioridade} />
          </Sec>
        </FormEstado>
      </div>
    </>
  );
}
