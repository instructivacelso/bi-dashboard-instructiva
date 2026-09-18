import { exigirUsuario } from '@/lib/auth.js';
import { q1 } from '@/lib/db.js';
import { hoje, fmtData } from '@/lib/datas.js';
import { TURNOS, CLASSIFICACAO } from '@/lib/suporte.js';
import { numerosSuporte, atendentes } from '@/lib/dadosSuporte.js';
import { configuracao } from '@/lib/dadosComercial.js';
import { Topo, Aviso } from '@/components/Ui.js';
import FormEstado from '@/components/FormEstado.js';
import Etapas from '@/components/Etapas.js';
import Condicionais from '@/components/Condicionais.js';
import ListaQtd from '@/components/ListaQtd.js';
import { Numero, Texto, Escolha, Selecao, DataCampo, SIM_NAO, sn } from '@/components/Campos.js';
import { Recebidos, Trabalhados, Resolvidos, Backlog, Sla, Categorias, Encaminhamentos } from '@/components/NumerosSuporte.js';
import { salvarFechamentoSuporte } from '../actions.js';

export const dynamic = 'force-dynamic';
const B = ({ n, children }) => <><span className="bloco-num">{n}</span>{children}</>;
const Sec = ({ titulo, children }) => <div className="secao-form"><h3>{titulo}</h3>{children}</div>;

export default async function FechamentoSuporte() {
  const u = await exigirUsuario();
  if (!u.lotacoes.some((l) => l.formulario === 'suporte_fechamento')) return <><Topo titulo="Fechamento do Suporte" /><Aviso tipo="erro">Este formulário é da equipe de atendimento do Suporte. Peça ao administrador para marcar a atividade “Atendimento”.</Aviso></>;
  const dia = hoje();
  const [n, atual, limite, equipe] = await Promise.all([numerosSuporte([u.id], dia), q1('SELECT * FROM support_daily_closings WHERE user_id=$1 AND data_ref=$2', [u.id, dia]), configuracao('suporte_horario_limite', '19:00'), atendentes()]);
  const v = atual || {};
  const critVenc = n.vencidos > 0 || n.criticosAbertos > 0;
  return (
    <>
      <Topo titulo="Fechamento do Suporte" descricao={`${fmtData(dia)} · envie até as ${limite}. Os números vêm dos seus atendimentos; você só confere e analisa.`}>
        <a className="btn sec" href="/suporte">Meus atendimentos</a>
      </Topo>
      <div className="painel form-claro">
        {atual && <Aviso tipo="ok">Você já enviou hoje. Pode ajustar até o fim do dia.</Aviso>}
        <FormEstado action={salvarFechamentoSuporte} botao={atual ? 'Salvar alterações' : 'Enviar fechamento'} botaoEnviando="Enviando…" protegerSaida progresso>
          <Condicionais />
          <Etapas />
          <Sec titulo="Turno e atendimentos recebidos">
            <div className="campo"><span className="rot"><B n="1">Colaborador e turno</B></span><div className="cidade-fixa">{u.nome} <small>· {fmtData(dia)}</small></div></div>
            <Escolha nome="turno" rotulo="Turno" opcoes={TURNOS} valor={v.turno} />
            <span className="rot"><B n="2">Atendimentos recebidos</B></span>
            <Recebidos n={n} />
            <Escolha nome="confere_recebidos" rotulo="Os números estão corretos?" opcoes={SIM_NAO} valor={sn(v.confere_recebidos)} />
            <div data-se="confere_recebidos:nao"><Texto nome="divergencia_recebidos" rotulo="O que está diferente?" valor={v.divergencia_recebidos} obrig /></div>
          </Sec>
          <Sec titulo="Trabalhados e resolvidos">
            <span className="rot"><B n="3">Atendimentos trabalhados</B></span>
            <Trabalhados n={n} />
            <Escolha nome="confere_trabalhados" rotulo="Os números estão corretos?" opcoes={SIM_NAO} valor={sn(v.confere_trabalhados)} />
            <div data-se="confere_trabalhados:nao"><Texto nome="divergencia_trabalhados" rotulo="O que está diferente?" valor={v.divergencia_trabalhados} obrig /></div>
            <span className="rot"><B n="4">Atendimentos resolvidos</B></span>
            <Resolvidos n={n} />
            <Escolha nome="classificacao" rotulo="Como foi o seu resultado hoje?" opcoes={CLASSIFICACAO} valor={v.classificacao} />
          </Sec>
          <Sec titulo="Pendências e SLA">
            <span className="rot"><B n="5">Pendências e backlog</B></span>
            <Backlog n={n} />
            {critVenc && <Texto nome="justificativa_backlog" rotulo="Há ticket crítico ou vencido: o que aconteceu?" valor={v.justificativa_backlog} obrig longo />}
            <span className="rot"><B n="6">Tempo e SLA</B></span>
            <Sla n={n} />
            {n.foraPrazo > 0 && <Texto nome="motivo_atraso_sla" rotulo="Principal motivo de atraso" valor={v.motivo_atraso_sla} obrig />}
          </Sec>
          <Sec titulo="Problemas e encaminhamentos">
            <span className="rot"><B n="7">Categorias e problemas recorrentes</B></span>
            <Categorias n={n} />
            <Texto nome="problema_recorrente" rotulo="Problema mais recorrente hoje" valor={v.problema_recorrente} obrig />
            <div className="linha-campos">
              <Texto nome="curso_afetado" rotulo="Curso mais afetado" valor={v.curso_afetado} obrig dica="Se nenhum, escreva “nenhum”." />
              <Texto nome="causa" rotulo="Possível causa" valor={v.causa} obrig />
            </div>
            <Texto nome="prevencao" rotulo="Sugestão de prevenção" valor={v.prevencao} obrig />
            <span className="rot"><B n="8">Encaminhamentos</B></span>
            <Encaminhamentos n={n} />
            <Texto nome="encaminhamento_critico" rotulo="Encaminhamento mais crítico do dia" valor={v.encaminhamento_critico} obrig dica="Se não houve, escreva “nenhum”." />
          </Sec>
          <Sec titulo="Casos críticos e experiência">
            <span className="rot"><B n="9">Casos críticos e experiência do aluno</B></span>
            <div className="linha-campos">
              <Escolha nome="caso_critico" rotulo="Houve caso crítico?" opcoes={SIM_NAO} valor={sn(v.caso_critico)} />
              <Escolha nome="reclamacao_grave" rotulo="Houve reclamação grave?" opcoes={SIM_NAO} valor={sn(v.reclamacao_grave)} />
            </div>
            <div className="linha-campos">
              <Escolha nome="risco_cancelamento" rotulo="Houve risco de cancelamento?" opcoes={SIM_NAO} valor={sn(v.risco_cancelamento)} />
              <Escolha nome="aluno_sem_resposta" rotulo="Aluno sem resposta por muito tempo?" opcoes={SIM_NAO} valor={sn(v.aluno_sem_resposta)} />
            </div>
            <div className="linha-campos">
              <Numero nome="aval_positivas" rotulo="Avaliações positivas" valor={v.aval_positivas} />
              <Numero nome="aval_negativas" rotulo="Avaliações negativas" valor={v.aval_negativas} />
            </div>
            <div data-se="caso_critico:sim;reclamacao_grave:sim;risco_cancelamento:sim;aluno_sem_resposta:sim">
              <Numero nome="casos_qtd" rotulo="Quantos casos você vai registrar?" valor={v.casos?.length} dica="Risco de cancelamento vai para o Pós-venda." />
              <ListaQtd campoQtd="casos_qtd" prefixo="caso" titulo="Caso" inicial={v.casos || []}
                campos={[{ nome: 'aluno', rotulo: 'Aluno' }, { nome: 'problema', rotulo: 'Problema' }, { nome: 'responsavel', rotulo: 'Responsável' }, { nome: 'acao', rotulo: 'Ação' }, { nome: 'prazo', rotulo: 'Prazo', tipo: 'data' }]} />
            </div>
          </Sec>
          <Sec titulo="Fechamento e plano de ação">
            <span className="rot"><B n="10">Fechamento e plano de ação</B></span>
            <Texto nome="dificuldade" rotulo="Principal dificuldade do dia" valor={v.dificuldade} obrig dica="Se não houve, escreva “Operação dentro do esperado”." />
            <Texto nome="melhoria" rotulo="Principal melhoria identificada" valor={v.melhoria} obrig />
            <Texto nome="acao_amanha" rotulo="Ação para amanhã" valor={v.acao_amanha} obrig />
            <div className="linha-campos">
              <Selecao nome="responsavel_id" rotulo="Responsável" valor={v.responsavel_id || u.id} opcoes={equipe.map((x) => ({ valor: x.id, rotulo: x.nome }))} />
              <DataCampo nome="prazo" rotulo="Prazo" valor={v.prazo} obrig />
            </div>
            <Texto nome="observacao" rotulo="Observação para o gerente" valor={v.observacao} obrig />
          </Sec>
        </FormEstado>
      </div>
    </>
  );
}
