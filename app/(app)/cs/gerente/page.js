import { exigirUsuario } from '@/lib/auth.js';
import { q, q1 } from '@/lib/db.js';
import { hoje, fmtData, somarDias } from '@/lib/datas.js';
import { numero, pct, moeda } from '@/lib/formato.js';
import { SITUACAO_BASE, SETORES, ETAPAS_JORNADA, GARGALOS_CS, TIPOS_FEEDBACK } from '@/lib/cscx.js';
import { numerosCs, desempenhoCs, equipeCs } from '@/lib/dadosCs.js';
import { configuracao } from '@/lib/dadosComercial.js';
import { Topo, Aviso, Semaforo } from '@/components/Ui.js';
import FormEstado from '@/components/FormEstado.js';
import Etapas from '@/components/Etapas.js';
import Condicionais from '@/components/Condicionais.js';
import ListaQtd from '@/components/ListaQtd.js';
import { Numero, Texto, Escolha, Selecao, DataCampo, SIM_NAO, sn } from '@/components/Campos.js';
import { Base, Onboarding, Engajamento, Health, Satisfacao, Voz, Retencao, Expansao } from '@/components/NumerosCs.js';
import { salvarGerenteCs } from '../actions.js';

export const dynamic = 'force-dynamic';
const B = ({ n, children }) => <><span className="bloco-num">{n}</span>{children}</>;
const Sec = ({ titulo, children }) => <div className="secao-form"><h3>{titulo}</h3>{children}</div>;
const opc = (o) => Object.entries(o).map(([valor, rotulo]) => ({ valor, rotulo }));

export default async function GerenteCs() {
  const u = await exigirUsuario();
  if (!u.lotacoes.some((l) => l.formulario === 'cs_gerente')) return <><Topo titulo="Fechamento do gerente de CS/CX" /><Aviso tipo="erro">Este formulário é do gerente de CS/CX. Peça ao administrador para marcar a atividade “Gerente de CS/CX”.</Aviso></>;
  const dia = hoje(); const d30 = somarDias(dia, -29);
  const [n, equipe, pessoas, atual, limite] = await Promise.all([numerosCs(d30, dia), desempenhoCs(d30, dia), equipeCs(), q1('SELECT * FROM cs_manager_closings WHERE user_id=$1 AND data_ref=$2', [u.id, dia]), configuracao('cs_horario_limite', '19:00')]);
  const v = atual?.respostas || {};
  const destaque = equipe[0];
  const acompanhar = equipe.length > 1 ? equipe[equipe.length - 1] : null;
  const carregado = [...equipe].sort((x, y) => y.carteira - x.carteira)[0];
  return (
    <>
      <Topo titulo="Fechamento do gerente de CS/CX" descricao={`${fmtData(dia)} · limite ${limite}. Números dos últimos 30 dias, a partir da carteira e dos registros da equipe.`}><a className="btn sec" href="/cs/dashboard">Dashboard</a></Topo>
      <div className="painel form-claro">
        {atual && <Aviso tipo="ok">Você já enviou hoje. Pode ajustar até o fim do dia.</Aviso>}
        <FormEstado action={salvarGerenteCs} botao={atual ? 'Salvar alterações' : 'Enviar fechamento'} botaoEnviando="Enviando…" protegerSaida progresso>
          <Condicionais /><Etapas />
          <Sec titulo="Base e onboarding">
            <span className="rot"><B n="1">Base de alunos e movimentação</B></span><Base n={n} />
            <Escolha nome="dados_conferidos" rotulo="Os dados estão corretos?" opcoes={SIM_NAO} valor={sn(v.dados_conferidos)} />
            <div data-se="dados_conferidos:nao"><Texto nome="divergencia" rotulo="Qual a divergência?" valor={v.divergencia} obrig /></div>
            <Escolha nome="situacao_base" rotulo="Situação da base" opcoes={SITUACAO_BASE} valor={v.situacao_base} />
            <div data-se="situacao_base:atencao|critica"><Texto nome="causa_base" rotulo="Causa" valor={v.causa_base} obrig /><Texto nome="acao_base" rotulo="Ação" valor={v.acao_base} obrig /></div>
            <span className="rot"><B n="2">Onboarding e ativação</B></span><Onboarding n={n} />
            <Texto nome="quebra_onboarding" rotulo="Principal quebra do onboarding" valor={v.quebra_onboarding} obrig />
            <div className="linha-campos"><Texto nome="curso_onboarding" rotulo="Curso ou processo mais afetado" valor={v.curso_onboarding} obrig /><Selecao nome="setor_onboarding" rotulo="Setor responsável" valor={v.setor_onboarding} opcoes={opc(SETORES)} /></div>
            <div className="linha-campos"><Texto nome="acao_onboarding" rotulo="Ação corretiva" valor={v.acao_onboarding} obrig /><DataCampo nome="prazo_onboarding" rotulo="Prazo" valor={v.prazo_onboarding} obrig /></div>
          </Sec>
          <Sec titulo="Engajamento e risco">
            <span className="rot"><B n="3">Engajamento e progresso</B></span><Engajamento n={n} />
            <div className="linha-campos"><Texto nome="curso_menor_engajamento" rotulo="Curso com menor engajamento" valor={v.curso_menor_engajamento} obrig /><Texto nome="causa_engajamento" rotulo="Causa provável" valor={v.causa_engajamento} obrig /></div>
            <div className="linha-campos"><Texto nome="segmento_engajamento" rotulo="Segmento a trabalhar" valor={v.segmento_engajamento} obrig /><Texto nome="acao_engajamento" rotulo="Ação de recuperação" valor={v.acao_engajamento} obrig /></div>
            <span className="rot"><B n="4">Health score e alunos em risco</B></span><Health n={n} />
            <Texto nome="grupo_prioritario" rotulo="Grupo prioritário" valor={v.grupo_prioritario} obrig />
            <Texto nome="acao_risco" rotulo="Ação de recuperação" valor={v.acao_risco} obrig />
            <div className="linha-campos"><Texto nome="responsavel_risco" rotulo="Responsável" valor={v.responsavel_risco} obrig /><DataCampo nome="prazo_risco" rotulo="Prazo" valor={v.prazo_risco} obrig /></div>
          </Sec>
          <Sec titulo="Satisfação e voz do cliente">
            <span className="rot"><B n="5">Satisfação, NPS, CSAT e CES</B></span><Satisfacao n={n} />
            <div className="linha-campos"><Texto nome="motivo_promotores" rotulo="Principal motivo dos promotores" valor={v.motivo_promotores} obrig /><Texto nome="motivo_detratores" rotulo="Principal motivo dos detratores" valor={v.motivo_detratores} obrig /></div>
            <div className="linha-campos"><Selecao nome="pior_ponto" rotulo="Ponto da jornada com pior avaliação" valor={v.pior_ponto} opcoes={opc(ETAPAS_JORNADA)} /><Texto nome="acao_satisfacao" rotulo="Ação de melhoria" valor={v.acao_satisfacao} obrig /></div>
            <span className="rot"><B n="6">Voz do cliente, reclamações e atritos</B></span><Voz n={n} />
            <div className="linha-campos">{[1, 2, 3].map((k) => <Texto key={k} nome={`dor_${k}`} rotulo={`Dor ${k} do aluno`} valor={v.dores?.[k - 1]} obrig max={150} />)}</div>
            <Texto nome="atrito" rotulo="Principal atrito da jornada" valor={v.atrito} obrig />
            <div className="linha-campos"><Texto nome="causa_atrito" rotulo="Causa provável" valor={v.causa_atrito} obrig /><Selecao nome="setor_atrito" rotulo="Setor envolvido" valor={v.setor_atrito} opcoes={opc(SETORES)} /></div>
            <div className="linha-campos"><Texto nome="impacto_atrito" rotulo="Impacto" valor={v.impacto_atrito} obrig /><Texto nome="sugestao_atrito" rotulo="Sugestão de melhoria" valor={v.sugestao_atrito} obrig /></div>
          </Sec>
          <Sec titulo="Retenção e expansão">
            <span className="rot"><B n="7">Retenção, cancelamentos e recuperação</B></span><Retencao n={n} />
            <div className="linha-campos"><Texto nome="motivo_cancelamento" rotulo="Principal motivo de cancelamento" valor={v.motivo_cancelamento} obrig /><Texto nome="estrategia_retencao" rotulo="Estratégia de retenção utilizada" valor={v.estrategia_retencao} obrig /></div>
            <Texto nome="acao_preventiva" rotulo="Ação preventiva" valor={v.acao_preventiva} obrig />
            <div className="linha-campos"><Texto nome="responsavel_retencao" rotulo="Responsável" valor={v.responsavel_retencao} obrig /><DataCampo nome="prazo_retencao" rotulo="Prazo" valor={v.prazo_retencao} obrig /></div>
            <span className="rot"><B n="8">Expansão e indicação</B></span><Expansao n={n} />
            <div className="linha-campos"><Texto nome="segmento_expansao" rotulo="Segmento prioritário" valor={v.segmento_expansao} obrig /><Texto nome="oferta_recomendada" rotulo="Oferta ou continuidade recomendada" valor={v.oferta_recomendada} obrig /></div>
            <div className="linha-campos"><Numero nome="qtd_encaminhada" rotulo="Quantidade encaminhada" valor={v.qtd_encaminhada} /><Selecao nome="setor_expansao" rotulo="Setor responsável" valor={v.setor_expansao} opcoes={[{ valor: 'indicacoes', rotulo: 'Indicações' }, { valor: 'comercial', rotulo: 'Comercial' }]} /><DataCampo nome="prazo_expansao" rotulo="Prazo" valor={v.prazo_expansao} obrig /></div>
          </Sec>
          <Sec titulo="Equipe, feedbacks e reunião">
            <span className="rot"><B n="9">Desempenho da equipe (carteira, riscos, recuperação e satisfação)</B></span>
            {equipe.length === 0 ? <p className="suave pequeno">Nenhum colaborador de CS/CX cadastrado.</p> : (
              <div className="tabela-wrap"><table>
                <thead><tr><th>Colaborador</th><th className="num">Carteira</th><th className="num">Em risco</th><th className="num">Contatos</th><th className="num">Recuperados</th><th className="num">Preservado</th><th className="num">Pendências</th></tr></thead>
                <tbody>{equipe.map((l) => (
                  <tr key={l.id}><td>{l.nome} {l.id === destaque?.id && <Semaforo cor="verde" texto="Destaque" />} {l.id === acompanhar?.id && <Semaforo cor="amarelo" texto="Acompanhar" />} {l.id === carregado?.id && equipe.length > 1 && <Semaforo cor="vermelho" texto="Maior carteira" />}</td>
                    <td className="num">{numero(l.carteira)}</td><td className="num">{numero(l.em_risco)}</td><td className="num">{numero(l.contatos)}</td><td className="num">{numero(l.recuperados)}</td><td className="num">{moeda(Number(l.preservada), 0)}</td><td className="num">{numero(l.pendencias)}</td></tr>
                ))}</tbody>
              </table></div>
            )}
            <Numero nome="feedbacks_qtd" rotulo="Feedbacks realizados hoje" valor={v.feedbacks_qtd} />
            <ListaQtd campoQtd="feedbacks_qtd" prefixo="fb" titulo="Feedback" inicial={v.feedbacks || []} campos={[{ nome: 'colaborador', rotulo: 'Colaborador' }, { nome: 'tipo', rotulo: 'Tipo', tipo: 'opcao', opcoes: TIPOS_FEEDBACK }, { nome: 'tema', rotulo: 'Tema' }, { nome: 'prazo', rotulo: 'Prazo', tipo: 'data' }]} />
            <Escolha nome="reuniao_realizada" rotulo="Houve reunião diária?" opcoes={SIM_NAO} valor={sn(v.reuniao_realizada)} />
            <div data-se="reuniao_realizada:sim"><Texto nome="reuniao_tema" rotulo="Tema" valor={v.reuniao_tema} obrig /><Texto nome="reuniao_assuntos" rotulo="Assuntos abordados" valor={v.reuniao_assuntos} obrig /></div>
            <div data-se="reuniao_realizada:nao"><Texto nome="reuniao_motivo" rotulo="Por que não houve?" valor={v.reuniao_motivo} obrig /></div>
            <Texto nome="reconhecimento" rotulo={`Reconhecimento realizado${destaque ? ` (${destaque.nome})` : ''}`} valor={v.reconhecimento} obrig />
            <Texto nome="acao_desenvolvimento" rotulo={`Ação de desenvolvimento${acompanhar ? ` (${acompanhar.nome})` : ''}`} valor={v.acao_desenvolvimento} obrig />
            <DataCampo nome="proximo_acompanhamento" rotulo="Próximo acompanhamento" valor={v.proximo_acompanhamento} obrig />
          </Sec>
          <Sec titulo="Gargalo e plano de ação">
            <span className="rot"><B n="10">Gargalos, decisões e plano de ação</B></span>
            <div className="linha-campos"><Selecao nome="gargalo" rotulo="Principal gargalo" valor={v.gargalo} opcoes={opc(GARGALOS_CS)} /><Selecao nome="etapa_jornada" rotulo="Etapa da jornada" valor={v.etapa_jornada} opcoes={opc(ETAPAS_JORNADA)} /></div>
            <div className="linha-campos"><Selecao nome="setor_envolvido" rotulo="Setor envolvido" valor={v.setor_envolvido} opcoes={opc(SETORES)} /><Numero nome="alunos_afetados" rotulo="Alunos afetados" valor={v.alunos_afetados} /></div>
            <Texto nome="impacto" rotulo="Impacto financeiro ou de experiência" valor={v.impacto} obrig />
            <Texto nome="decisao" rotulo="Decisão tomada" valor={v.decisao} obrig />
            <Texto nome="acao" rotulo="Ação corretiva" valor={v.acao} obrig />
            <div className="linha-campos"><Selecao nome="responsavel_id" rotulo="Responsável" valor={atual?.responsavel_id} opcoes={pessoas.map((x) => ({ valor: x.id, rotulo: x.nome }))} /><DataCampo nome="prazo" rotulo="Prazo" valor={atual?.prazo} obrig /></div>
            <Escolha nome="prioridade" rotulo="Prioridade" opcoes={{ baixa: 'Baixa', media: 'Média', alta: 'Alta', critica: 'Crítica' }} valor={atual?.prioridade} />
          </Sec>
        </FormEstado>
      </div>
    </>
  );
}
