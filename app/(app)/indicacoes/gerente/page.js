import { exigirUsuario } from '@/lib/auth.js';
import { q, q1 } from '@/lib/db.js';
import { hoje, fmtData, somarDias } from '@/lib/datas.js';
import { numero, pct, moeda } from '@/lib/formato.js';
import { variacao } from '@/lib/calc.js';
import { STATUS_CAMPANHA, CLASSIFICACAO, ETAPAS_QUEBRA, GARGALOS_INDICACAO, TIPOS_FEEDBACK } from '@/lib/indicacao.js';
import { numerosIndicacao, campanhasAtivas, todasCampanhas } from '@/lib/dadosIndicacao.js';
import { configuracao } from '@/lib/dadosComercial.js';
import { Topo, Aviso, Semaforo } from '@/components/Ui.js';
import FormEstado from '@/components/FormEstado.js';
import Etapas from '@/components/Etapas.js';
import Condicionais from '@/components/Condicionais.js';
import ListaQtd from '@/components/ListaQtd.js';
import { Numero, Texto, Escolha, Selecao, DataCampo, SIM_NAO, sn } from '@/components/Campos.js';
import { Convites, Validacao, AvisoInd, Atendimento, Vendas, Funil, Beneficios } from '@/components/NumerosIndicacao.js';
import { salvarGerenteIndicacao } from '../actions.js';

export const dynamic = 'force-dynamic';
const B = ({ n, children }) => <><span className="bloco-num">{n}</span>{children}</>;
const Sec = ({ titulo, children }) => <div className="secao-form"><h3>{titulo}</h3>{children}</div>;
const opc = (o) => Object.entries(o).map(([valor, rotulo]) => ({ valor, rotulo }));

export default async function GerenteIndicacao() {
  const u = await exigirUsuario();
  if (!u.lotacoes.some((l) => l.formulario === 'indicacao_gerente')) return <><Topo titulo="Fechamento do gerente de Indicação" /><Aviso tipo="erro">Este formulário é do gerente de Indicação. Peça ao administrador para marcar a atividade “Gerente de Indicação”.</Aviso></>;
  const dia = hoje();
  const d30 = somarDias(dia, -29);
  const [n, n30, camps, todas, atual, anterior, limite, pessoas] = await Promise.all([
    numerosIndicacao(dia, dia), numerosIndicacao(d30, dia), campanhasAtivas(), todasCampanhas(),
    q1('SELECT * FROM referral_manager_closings WHERE user_id=$1 AND data_ref=$2', [u.id, dia]),
    q1('SELECT numeros, data_ref FROM referral_manager_closings WHERE data_ref < $1 ORDER BY data_ref DESC LIMIT 1', [dia]),
    configuracao('indicacao_horario_limite', '19:00'),
    q(`SELECT DISTINCT x.id, x.nome FROM users x JOIN user_department_assignments a ON a.user_id=x.id JOIN departments d ON d.id=a.department_id WHERE x.ativo AND d.slug='indicacoes' ORDER BY x.nome`),
  ]);
  const v = atual || {};
  const a = anterior?.numeros;
  const equipe = n30.porVendedor;
  const destaque = equipe[0];
  const acompanhar = equipe.length > 1 ? [...equipe].sort((x, y) => (x.conversao ?? 0) - (y.conversao ?? 0))[0] : null;
  const carregado = [...equipe].sort((x, y) => y.pendentes - x.pendentes)[0];
  const livre = equipe.length > 1 ? [...equipe].sort((x, y) => x.pendentes - y.pendentes)[0] : null;
  const metaInd = camps.reduce((s, c) => s + (c.meta_diaria_indicacoes || 0), 0) || null;
  const metaVend = camps.reduce((s, c) => s + (c.meta_diaria_vendas || 0), 0) || null;
  const comp = a ? [['Convites', n.convidados, a.convidados, numero], ['Indicações', n.recebidas, a.recebidas, numero], ['Validação', n.funil.validacao, a.funil?.validacao, pct],
    ['Contatos', n.contatadas, a.contatadas, numero], ['Respostas', n.responderam, a.responderam, numero], ['Agendamentos', n.agendamentos, a.agendamentos, numero],
    ['Propostas', n.propostas, a.propostas, numero], ['Vendas', n.vendas, a.vendas, numero], ['Faturamento', n.faturamento, a.faturamento, (x) => moeda(x, 0)], ['Benefícios', n.beneficiosEntregues, a.beneficiosEntregues, numero]] : [];

  return (
    <>
      <Topo titulo="Fechamento do gerente de Indicação" descricao={`${fmtData(dia)} · limite ${limite}. Os números vêm dos registros do time; você confere e analisa.`}>
        <a className="btn sec" href="/indicacoes/dashboard">Dashboard</a>
      </Topo>
      {comp.length > 0 && (
        <section className="painel" style={{ marginBottom: 16 }}>
          <div className="painel-cab" style={{ marginBottom: 10 }}><h2>Comparado a {fmtData(anterior.data_ref).slice(0, 5)}</h2></div>
          <div className="leitura">{comp.map(([r, h, x, f]) => { const vr = variacao(h, x); return <div key={r}><span>{r}</span><b>{f(x)}</b><span style={{ fontWeight: 700 }} className={vr > 0 ? 'var-pos' : vr < 0 ? 'var-neg' : ''}>hoje {vr === null ? '—' : `${vr > 0 ? '+' : ''}${pct(vr)}`}</span></div>; })}</div>
        </section>
      )}
      <div className="painel form-claro">
        {atual && <Aviso tipo="ok">Você já enviou hoje. Pode ajustar até o fim do dia.</Aviso>}
        <FormEstado action={salvarGerenteIndicacao} botao={atual ? 'Salvar alterações' : 'Enviar fechamento'} botaoEnviando="Enviando…" protegerSaida progresso>
          <Condicionais />
          <Etapas />
          <Sec titulo="Campanha e operação">
            <fieldset className="campo" style={{ border: 0, padding: 0, margin: 0 }}>
              <legend className="rot" style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: 6 }}><B n="1">Campanhas trabalhadas</B></legend>
              <div className="escolha" data-grupo-obrigatorio="Campanhas trabalhadas">{todas.map((c) => <label key={c.id}><input type="checkbox" name="campanhas" value={c.id} defaultChecked={v.campanhas?.includes(c.id) || (!atual && c.status === 'ativa')} /> {c.nome}</label>)}</div>
              {todas.length === 0 && <p className="suave pequeno">Cadastre uma campanha em Indicações → Campanhas.</p>}
            </fieldset>
            <div className="linha-campos"><Texto nome="produto_principal" rotulo="Produto ou curso principal" valor={v.produto_principal ?? camps[0]?.produto ?? 'Todos os cursos'} obrig /><Texto nome="equipe_envolvida" rotulo="Equipe envolvida" valor={v.equipe_envolvida} obrig /></div>
            <div className="linha-campos"><Numero nome="meta_indicacoes" rotulo="Meta diária de indicações" valor={v.meta_indicacoes ?? metaInd} /><Numero nome="meta_vendas" rotulo="Meta diária de vendas" valor={v.meta_vendas ?? metaVend} /></div>
            <Escolha nome="situacao_campanha" rotulo="Situação da campanha" opcoes={STATUS_CAMPANHA} valor={v.situacao_campanha || 'ativa'} />
          </Sec>
          <Sec titulo="Convites e validação">
            <span className="rot"><B n="2">Convites e participação (hoje)</B></span>
            <Convites n={n} />
            <Escolha nome="convites_conferidos" rotulo="Os números estão corretos?" opcoes={SIM_NAO} valor={sn(v.convites_conferidos)} />
            <div data-se="convites_conferidos:nao"><Texto nome="convites_divergencia" rotulo="Qual a divergência?" valor={v.convites_divergencia} obrig /></div>
            <Escolha nome="classificacao_convites" rotulo="Como foi a participação?" opcoes={CLASSIFICACAO} valor={v.classificacao_convites} />
            <div data-se="classificacao_convites:abaixo|critico"><Texto nome="causa_convites" rotulo="Causa" valor={v.causa_convites} obrig /><Texto nome="acao_convites" rotulo="Ação" valor={v.acao_convites} obrig /></div>
            <span className="rot"><B n="3">Indicações recebidas e validação (hoje)</B></span>
            <Validacao n={n} />
            <Texto nome="motivo_invalidacao" rotulo="Principal motivo de invalidação" valor={v.motivo_invalidacao} obrig dica="Se não houve, escreva “nenhum”." />
            <Texto nome="problema_qualidade" rotulo="Problema de qualidade identificado" valor={v.problema_qualidade} obrig />
            <Texto nome="acao_qualidade" rotulo="Ação para melhorar a qualidade" valor={v.acao_qualidade} obrig />
          </Sec>
          <Sec titulo="Aviso e atendimento">
            <span className="rot"><B n="4">Aviso ao indicado e conformidade (hoje)</B></span>
            <AvisoInd n={n} />
            <Escolha nome="problema_privacidade" rotulo="Houve problema de abordagem ou privacidade?" opcoes={SIM_NAO} valor={sn(v.problema_privacidade)} />
            <Texto nome="acao_privacidade" rotulo="Ação tomada" valor={v.acao_privacidade} obrig dica="Se não houve problema, escreva “nenhuma”." />
            <Texto nome="ajuste_mensagem" rotulo="Ajuste necessário na mensagem ou processo" valor={v.ajuste_mensagem} obrig />
            <span className="rot"><B n="5">Atendimento comercial dos indicados (hoje)</B></span>
            <Atendimento n={n} />
            <Texto nome="problema_atendimento" rotulo="Principal problema de atendimento" valor={v.problema_atendimento} obrig />
            <div className="linha-campos"><Numero nome="qtd_priorizar" rotulo="Quantas priorizar" valor={v.qtd_priorizar ?? n.semContato} /><Texto nome="acao_recuperacao" rotulo="Ação de recuperação" valor={v.acao_recuperacao} obrig /></div>
          </Sec>
          <Sec titulo="Vendas e conversões">
            <span className="rot"><B n="6">Vendas e faturamento (hoje)</B></span>
            <Vendas n={n} />
            <Escolha nome="vendas_corretas" rotulo="Os números estão corretos?" opcoes={SIM_NAO} valor={sn(v.vendas_corretas)} />
            <div data-se="vendas_corretas:nao"><Texto nome="vendas_divergencia" rotulo="Divergência" valor={v.vendas_divergencia} obrig /><Texto nome="vendas_origem" rotulo="Origem" valor={v.vendas_origem} obrig /><Texto nome="vendas_acao" rotulo="Ação corretiva" valor={v.vendas_acao} obrig /></div>
            <span className="rot"><B n="7">Conversões do funil (últimos 30 dias)</B></span>
            <Funil n={n30} />
            {n30.maiorQuebra && <p className="pequeno">Maior quebra pelos números: <Semaforo cor="vermelho" texto={ETAPAS_QUEBRA[n30.maiorQuebra]} /></p>}
            <Selecao nome="etapa_maior_quebra" rotulo="Etapa com maior quebra" valor={v.etapa_maior_quebra || n30.maiorQuebra} opcoes={opc(ETAPAS_QUEBRA)} />
            <Texto nome="motivo_quebra" rotulo="Motivo provável" valor={v.motivo_quebra} obrig />
            <Texto nome="acao_conversao" rotulo="Ação para melhorar a conversão" valor={v.acao_conversao} obrig />
          </Sec>
          <Sec titulo="Equipe e feedbacks">
            <span className="rot"><B n="8">Desempenho da equipe (últimos 30 dias)</B></span>
            {equipe.length === 0 ? <p className="suave pequeno">Nenhuma indicação distribuída a vendedores no período.</p> : (
              <div className="tabela-wrap"><table>
                <thead><tr><th>Vendedor</th><th className="num">Recebidas</th><th className="num">Trabalhadas</th><th className="num">Tentativas</th><th className="num">Vendas</th><th className="num">Faturamento</th><th className="num">Conversão</th><th className="num">Pendentes</th></tr></thead>
                <tbody>{equipe.map((l) => (
                  <tr key={l.id}><td>{l.nome} {l.id === destaque?.id && <Semaforo cor="verde" texto="Destaque" />} {l.id === acompanhar?.id && <Semaforo cor="amarelo" texto="Acompanhar" />} {l.id === carregado?.id && l.pendentes > 0 && <Semaforo cor="vermelho" texto="Mais carregado" />} {l.id === livre?.id && <Semaforo cor="neutro" texto="Com capacidade" />}</td>
                    <td className="num">{numero(l.recebidas)}</td><td className="num">{numero(l.trabalhadas)}</td><td className="num">{numero(l.tentativas)}</td><td className="num">{numero(l.vendas)}</td><td className="num">{moeda(l.faturamento, 0)}</td><td className="num">{pct(l.conversao)}</td><td className="num">{numero(l.pendentes)}</td></tr>
                ))}</tbody>
              </table></div>
            )}
            <Numero nome="feedbacks_qtd" rotulo="Feedbacks realizados hoje" valor={v.feedbacks_qtd} />
            <ListaQtd campoQtd="feedbacks_qtd" prefixo="fb" titulo="Feedback" inicial={v.feedbacks || []}
              campos={[{ nome: 'colaborador', rotulo: 'Colaborador' }, { nome: 'tipo', rotulo: 'Tipo', tipo: 'opcao', opcoes: TIPOS_FEEDBACK }, { nome: 'tema', rotulo: 'Tema' }, { nome: 'acao', rotulo: 'Ação' }, { nome: 'prazo', rotulo: 'Prazo', tipo: 'data' }]} />
            <Texto nome="reconhecimento" rotulo={`Reconhecimento do destaque${destaque ? ` (${destaque.nome})` : ''}`} valor={v.reconhecimento} obrig />
            <Texto nome="acao_acompanhamento" rotulo={`Ação de acompanhamento${acompanhar ? ` (${acompanhar.nome})` : ''}`} valor={v.acao_acompanhamento} obrig />
            <Texto nome="redistribuicao" rotulo="Redistribuição necessária" valor={v.redistribuicao} obrig dica="Se nenhuma, escreva “nenhuma”." />
          </Sec>
          <Sec titulo="Benefícios e custo">
            <span className="rot"><B n="9">Indicadores, benefícios e custo (últimos 30 dias)</B></span>
            <Beneficios n={n30} />
            <Escolha nome="beneficios_atrasados" rotulo="Existem benefícios atrasados?" opcoes={SIM_NAO} valor={sn(v.beneficios_atrasados ?? (n30.beneficiosAtrasados > 0 ? true : undefined))} />
            <div data-se="beneficios_atrasados:sim"><Texto nome="pendencia_beneficio" rotulo="Principal pendência" valor={v.pendencia_beneficio} obrig /><div className="linha-campos"><Texto nome="responsavel_beneficio" rotulo="Responsável" valor={v.responsavel_beneficio} obrig /><DataCampo nome="prazo_beneficio" rotulo="Prazo" valor={v.prazo_beneficio} obrig /></div></div>
            <Escolha nome="beneficio_excepcional" rotulo="Houve benefício excepcional (fora da regra)?" opcoes={SIM_NAO} valor={sn(v.beneficio_excepcional)} />
            <div data-se="beneficio_excepcional:sim"><Texto nome="justificativa_excepcional" rotulo="Justificativa" valor={v.justificativa_excepcional} obrig /><Texto nome="aprovacao_excepcional" rotulo="Aprovado por" valor={v.aprovacao_excepcional} obrig /></div>
          </Sec>
          <Sec titulo="Reunião e plano de ação">
            <span className="rot"><B n="10">Reunião, objeções, gargalo e plano de ação</B></span>
            <Escolha nome="reuniao_realizada" rotulo="Houve reunião diária?" opcoes={SIM_NAO} valor={sn(v.reuniao_realizada)} />
            <div data-se="reuniao_realizada:sim"><Texto nome="reuniao_tema" rotulo="Tema" valor={v.reuniao_tema} obrig /><Texto nome="reuniao_assuntos" rotulo="Assuntos abordados" valor={v.reuniao_assuntos} obrig /></div>
            <div data-se="reuniao_realizada:nao"><Texto nome="reuniao_motivo" rotulo="Por que não houve?" valor={v.reuniao_motivo} obrig /><Texto nome="reuniao_compensacao" rotulo="Ação de compensação" valor={v.reuniao_compensacao} obrig /></div>
            <div className="linha-campos">{[1, 2, 3].map((k) => <Texto key={k} nome={`objecao_${k}`} rotulo={`Objeção ${k} dos indicados`} valor={v.objecoes?.[k - 1]} obrig max={150} />)}</div>
            <div className="linha-campos"><Selecao nome="gargalo" rotulo="Principal gargalo" valor={v.gargalo} opcoes={opc(GARGALOS_INDICACAO)} /><Selecao nome="etapa_afetada" rotulo="Etapa afetada" valor={v.etapa_afetada} opcoes={opc(ETAPAS_QUEBRA)} /></div>
            <Texto nome="acao" rotulo="Ação corretiva" valor={v.acao} obrig />
            <div className="linha-campos"><Selecao nome="responsavel_id" rotulo="Responsável" valor={v.responsavel_id} opcoes={pessoas.map((x) => ({ valor: x.id, rotulo: x.nome }))} /><DataCampo nome="prazo" rotulo="Prazo" valor={v.prazo} obrig /></div>
            <Escolha nome="prioridade" rotulo="Prioridade" opcoes={{ baixa: 'Baixa', media: 'Média', alta: 'Alta', critica: 'Crítica' }} valor={v.prioridade} />
          </Sec>
        </FormEstado>
      </div>
    </>
  );
}
