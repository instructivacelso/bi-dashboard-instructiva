import { exigirUsuario } from '@/lib/auth.js';
import { q } from '@/lib/db.js';
import { hoje, somarDias, fmtData } from '@/lib/datas.js';
import { operaRh, STATUS_FECHAMENTO_RH } from '@/lib/rh.js';
import { fechamentoRhDoDia } from '@/lib/dadosRh.js';
import { Topo, Aviso } from '@/components/Ui.js';
import FormEstado from '@/components/FormEstado.js';
import Etapas from '@/components/Etapas.js';
import Condicionais from '@/components/Condicionais.js';
import DataRegistro from '@/components/DataRegistro.js';
import { Numero, Texto, Escolha, Selecao, SIM_NAO } from '@/components/Campos.js';
import { salvarFechamentoRh } from '../actions.js';

export const dynamic = 'force-dynamic';
const Sec = ({ titulo, children }) => <div className="secao-form"><h3>{titulo}</h3>{children}</div>;
const opc = (o) => Object.entries(o).map(([valor, rotulo]) => ({ valor, rotulo }));
const sn = (b) => (b === true ? 'nao' : b === false ? 'sim' : undefined); // sem_* verdadeiro => "não houve"

export default async function FechamentoRh(props) {
  const sp = await props.searchParams;
  const u = await exigirUsuario();
  if (!operaRh(u)) return <><Topo titulo="Fechamento do RH" /><Aviso tipo="erro">Este fechamento é da equipe de RH. Peça ao administrador para incluir você em RH → Operação.</Aviso></>;
  const dia = hoje(); const min = somarDias(dia, -7);
  const dataRef = /^\d{4}-\d{2}-\d{2}$/.test(sp.data || '') && sp.data <= dia && sp.data >= min ? sp.data : dia;
  const usuarios = await q('SELECT id, nome FROM users WHERE ativo ORDER BY nome');
  const a = (await fechamentoRhDoDia(u.id, dataRef)) || {};
  const houve = (semKey) => (a.id ? (a[semKey] ? 'nao' : 'sim') : undefined);
  const outroDia = dataRef !== dia;

  return (
    <>
      <Topo titulo="Fechamento do RH" descricao={`${fmtData(dataRef)} · ${u.nome}. Marque “não” nas seções sem ocorrência e siga.`}>
        <a className="btn sec" href="/rh">Painel</a>
      </Topo>
      {a.id && <Aviso tipo="ok">Fechamento de {fmtData(dataRef)} já enviado. Você pode ajustar abaixo.</Aviso>}

      <div className="painel form-claro">
        <FormEstado action={salvarFechamentoRh} botao={a.id ? 'Salvar fechamento' : 'Enviar fechamento'} protegerSaida progresso>
          <Condicionais /><Etapas />

          <Sec titulo="Identificação">
            <DataRegistro valor={dataRef} min={min} max={dia} rota="/rh/fechamento" />
            {outroDia && <Texto nome="justificativa_data" rotulo="Por que outra data?" valor={a.justificativa_data} obrig />}
            <Texto nome="unidade" rotulo="Unidade" valor={a.unidade} obrig={false} dica="Deixe em branco para toda a empresa." />
            <Selecao nome="status" rotulo="Status" valor={a.status || 'enviado'} opcoes={opc(STATUS_FECHAMENTO_RH)} />
          </Sec>

          <Sec titulo="Movimentação de pessoas">
            <Escolha nome="mov_houve" rotulo="Houve movimentação hoje?" opcoes={SIM_NAO} valor={houve('sem_movimentacao')} classe="gatilho" />
            <div className="condicional" data-se="mov_houve:sim">
              <div className="linha-campos"><Numero nome="admissoes" rotulo="Admissões" valor={a.admissoes} obrig={false} /><Numero nome="deslig_vol" rotulo="Deslig. voluntários" valor={a.deslig_vol} obrig={false} /><Numero nome="deslig_invol" rotulo="Deslig. involuntários" valor={a.deslig_invol} obrig={false} /></div>
              <div className="linha-campos"><Numero nome="promocoes" rotulo="Promoções" valor={a.promocoes} obrig={false} /><Numero nome="transferencias" rotulo="Transferências" valor={a.transferencias} obrig={false} /><Numero nome="exp_inicio" rotulo="Início de experiência" valor={a.exp_inicio} obrig={false} /><Numero nome="exp_fim" rotulo="Fim de experiência" valor={a.exp_fim} obrig={false} /></div>
            </div>
          </Sec>

          <Sec titulo="Ponto e jornada">
            <Escolha nome="ponto_houve" rotulo="Registrar ponto de hoje?" opcoes={SIM_NAO} valor={houve('sem_ponto')} classe="gatilho" />
            <div className="condicional" data-se="ponto_houve:sim">
              <div className="linha-campos"><Numero nome="presentes" rotulo="Presentes" valor={a.presentes} obrig={false} /><Numero nome="faltas_just" rotulo="Faltas justificadas" valor={a.faltas_just} obrig={false} /><Numero nome="faltas_injust" rotulo="Faltas não justificadas" valor={a.faltas_injust} obrig={false} /></div>
              <div className="linha-campos"><Numero nome="atrasos" rotulo="Atrasos" valor={a.atrasos} obrig={false} /><Numero nome="saidas_antec" rotulo="Saídas antecipadas" valor={a.saidas_antec} obrig={false} /><Numero nome="horas_extras" rotulo="Horas extras" valor={a.horas_extras} moeda obrig={false} /><Numero nome="pendencias_ponto" rotulo="Pendências de ponto" valor={a.pendencias_ponto} obrig={false} /></div>
            </div>
          </Sec>

          <Sec titulo="Ocorrências e atendimentos">
            <Escolha nome="ocorr_houve" rotulo="Houve solicitações ou ocorrências?" opcoes={SIM_NAO} valor={houve('sem_ocorrencias')} classe="gatilho" />
            <div className="condicional" data-se="ocorr_houve:sim">
              <div className="linha-campos"><Numero nome="solicitacoes" rotulo="Solicitações recebidas" valor={a.solicitacoes} obrig={false} /><Numero nome="solic_resolvidas" rotulo="Resolvidas" valor={a.solic_resolvidas} obrig={false} /><Numero nome="solic_pendentes" rotulo="Pendentes" valor={a.solic_pendentes} obrig={false} /><Numero nome="conflitos" rotulo="Conflitos/ocorrências" valor={a.conflitos} obrig={false} /></div>
            </div>
          </Sec>

          <Sec titulo="Recrutamento">
            <Escolha nome="recrut_houve" rotulo="Houve atividade de recrutamento?" opcoes={SIM_NAO} valor={houve('sem_recrutamento')} classe="gatilho" />
            <div className="condicional" data-se="recrut_houve:sim">
              <div className="linha-campos"><Numero nome="vagas_abertas" rotulo="Vagas abertas (total)" valor={a.vagas_abertas} obrig={false} /><Numero nome="candidatos" rotulo="Candidatos recebidos" valor={a.candidatos} obrig={false} /><Numero nome="entrevistas" rotulo="Entrevistas" valor={a.entrevistas} obrig={false} /></div>
              <div className="linha-campos"><Numero nome="aprovados" rotulo="Aprovados" valor={a.aprovados} obrig={false} /><Numero nome="propostas" rotulo="Propostas enviadas" valor={a.propostas} obrig={false} /><Numero nome="contratacoes" rotulo="Contratações" valor={a.contratacoes} obrig={false} /></div>
            </div>
          </Sec>

          <Sec titulo="Treinamentos e integração">
            <Escolha nome="treino_houve" rotulo="Houve treinamento ou integração?" opcoes={SIM_NAO} valor={houve('sem_treinamentos')} classe="gatilho" />
            <div className="condicional" data-se="treino_houve:sim">
              <div className="linha-campos"><Numero nome="integracoes" rotulo="Integrações" valor={a.integracoes} obrig={false} /><Numero nome="treinamentos" rotulo="Treinamentos" valor={a.treinamentos} obrig={false} /><Numero nome="treino_participantes" rotulo="Participantes" valor={a.treino_participantes} obrig={false} /><Numero nome="treino_ausentes" rotulo="Ausentes" valor={a.treino_ausentes} obrig={false} /></div>
            </div>
          </Sec>

          <Sec titulo="Riscos e prioridades">
            <Texto nome="risco" rotulo="Colaborador, equipe ou prazo que exige atenção" valor={a.risco} obrig={false} longo dica="Sem diagnóstico médico. Descreva a situação e o risco." />
            <Escolha nome="precisa_diretoria" rotulo="Precisa de decisão da diretoria?" opcoes={SIM_NAO} valor={sn(a.precisa_diretoria)} obrig={false} />
            <Texto nome="plano" rotulo="Plano de ação" valor={a.plano} obrig={false} longo />
            <div className="linha-campos">
              <div className="campo"><label htmlFor="prazo">Prazo</label><input id="prazo" name="prazo" type="date" defaultValue={a.prazo ? String(a.prazo).slice(0, 10) : ''} /></div>
              <Selecao nome="responsavel_id" rotulo="Responsável" valor={a.responsavel_id} obrig={false} vazio="—" opcoes={usuarios.map((x) => ({ valor: x.id, rotulo: x.nome }))} />
            </div>
            <Texto nome="observacao" rotulo="Observação" valor={a.observacao} obrig={false} />
          </Sec>
        </FormEstado>
      </div>
    </>
  );
}
