import { exigirUsuario } from '@/lib/auth.js';
import { hoje, somarDias, fmtData } from '@/lib/datas.js';
import { operaPosvenda, STATUS_FECHAMENTO_PV } from '@/lib/posvenda.js';
import { fechamentoPvDoDia } from '@/lib/dadosPosvenda.js';
import { Topo, Aviso } from '@/components/Ui.js';
import FormEstado from '@/components/FormEstado.js';
import Etapas from '@/components/Etapas.js';
import Condicionais from '@/components/Condicionais.js';
import DataRegistro from '@/components/DataRegistro.js';
import { Numero, Texto, Escolha, Selecao, SIM_NAO } from '@/components/Campos.js';
import { salvarFechamentoPosvenda } from '../actions.js';

export const dynamic = 'force-dynamic';
const Sec = ({ titulo, children }) => <div className="secao-form"><h3>{titulo}</h3>{children}</div>;
const opc = (o) => Object.entries(o).map(([valor, rotulo]) => ({ valor, rotulo }));

export default async function FechamentoPosvenda(props) {
  const sp = await props.searchParams;
  const u = await exigirUsuario();
  if (!operaPosvenda(u)) return <><Topo titulo="Fechamento do pós-venda" /><Aviso tipo="erro">Este fechamento é da equipe de pós-venda. Peça ao administrador para incluir você em Pós-venda → Operação.</Aviso></>;
  const dia = hoje(); const min = somarDias(dia, -7);
  const dataRef = /^\d{4}-\d{2}-\d{2}$/.test(sp.data || '') && sp.data <= dia && sp.data >= min ? sp.data : dia;
  const a = (await fechamentoPvDoDia(u.id, dataRef)) || {};
  const houve = (semKey) => (a.id ? (a[semKey] ? 'nao' : 'sim') : undefined);
  const outroDia = dataRef !== dia;

  return (
    <>
      <Topo titulo="Fechamento do pós-venda" descricao={`${fmtData(dataRef)} · ${u.nome}. Marque “não” nas seções sem ocorrência e siga.`}>
        <a className="btn sec" href="/pos-venda">Painel</a>
      </Topo>
      {a.id && <Aviso tipo="ok">Fechamento de {fmtData(dataRef)} já enviado. Você pode ajustar abaixo.</Aviso>}

      <div className="painel form-claro">
        <FormEstado action={salvarFechamentoPosvenda} botao={a.id ? 'Salvar fechamento' : 'Enviar fechamento'} protegerSaida progresso>
          <Condicionais /><Etapas />

          <Sec titulo="Identificação">
            <DataRegistro valor={dataRef} min={min} max={dia} rota="/pos-venda/fechamento" />
            {outroDia && <Texto nome="justificativa_data" rotulo="Por que outra data?" valor={a.justificativa_data} obrig />}
            <Texto nome="unidade" rotulo="Unidade" valor={a.unidade} obrig={false} dica="Deixe em branco para toda a empresa." />
            <Selecao nome="status" rotulo="Status" valor={a.status || 'enviado'} opcoes={opc(STATUS_FECHAMENTO_PV)} />
          </Sec>

          <Sec titulo="Onboarding de novos alunos">
            <Escolha nome="onb_houve" rotulo="Houve onboarding hoje?" opcoes={SIM_NAO} valor={houve('sem_onboarding')} classe="gatilho" />
            <div className="condicional" data-se="onb_houve:sim">
              <div className="linha-campos"><Numero nome="novos_alunos" rotulo="Novos alunos" valor={a.novos_alunos} obrig={false} /><Numero nome="onboarding_concluidos" rotulo="Onboardings concluídos" valor={a.onboarding_concluidos} obrig={false} /></div>
            </div>
          </Sec>

          <Sec titulo="Acompanhamento">
            <Escolha nome="acomp_houve" rotulo="Fez acompanhamento?" opcoes={SIM_NAO} valor={houve('sem_acompanhamento')} classe="gatilho" />
            <div className="condicional" data-se="acomp_houve:sim">
              <div className="linha-campos"><Numero nome="contatos" rotulo="Contatos realizados" valor={a.contatos} obrig={false} /><Numero nome="alunos_risco" rotulo="Alunos em risco identificados" valor={a.alunos_risco} obrig={false} /></div>
            </div>
          </Sec>

          <Sec titulo="Renovações">
            <Escolha nome="renov_houve" rotulo="Houve renovações no dia?" opcoes={SIM_NAO} valor={houve('sem_renovacoes')} classe="gatilho" />
            <div className="condicional" data-se="renov_houve:sim">
              <div className="linha-campos"><Numero nome="renov_vencendo" rotulo="Contratos vencendo" valor={a.renov_vencendo} obrig={false} /><Numero nome="renov_feitas" rotulo="Renovações feitas" valor={a.renov_feitas} obrig={false} /><Numero nome="renov_valor" rotulo="Valor renovado" valor={a.renov_valor} moeda obrig={false} /></div>
            </div>
          </Sec>

          <Sec titulo="Cancelamentos">
            <Escolha nome="cancel_houve" rotulo="Houve cancelamentos?" opcoes={SIM_NAO} valor={houve('sem_cancelamentos')} classe="gatilho" />
            <div className="condicional" data-se="cancel_houve:sim">
              <Numero nome="cancelamentos" rotulo="Cancelamentos" valor={a.cancelamentos} obrig={false} />
              <Texto nome="cancel_motivo" rotulo="Principal motivo" valor={a.cancel_motivo} obrig />
            </div>
          </Sec>

          <Sec titulo="Upsell e cross-sell">
            <Escolha nome="upsell_houve" rotulo="Ofereceu upsell?" opcoes={SIM_NAO} valor={houve('sem_upsell')} classe="gatilho" />
            <div className="condicional" data-se="upsell_houve:sim">
              <div className="linha-campos"><Numero nome="upsell_ofertas" rotulo="Ofertas" valor={a.upsell_ofertas} obrig={false} /><Numero nome="upsell_vendas" rotulo="Vendas" valor={a.upsell_vendas} obrig={false} /><Numero nome="upsell_valor" rotulo="Valor" valor={a.upsell_valor} moeda obrig={false} /></div>
            </div>
          </Sec>

          <Sec titulo="Satisfação (NPS)">
            <Escolha nome="nps_houve" rotulo="Coletou satisfação hoje?" opcoes={SIM_NAO} valor={houve('sem_satisfacao')} classe="gatilho" />
            <div className="condicional" data-se="nps_houve:sim">
              <div className="linha-campos"><Numero nome="nps_respostas" rotulo="Respostas" valor={a.nps_respostas} obrig={false} /><Numero nome="nps_promotores" rotulo="Promotores (9-10)" valor={a.nps_promotores} obrig={false} /><Numero nome="nps_neutros" rotulo="Neutros (7-8)" valor={a.nps_neutros} obrig={false} /><Numero nome="nps_detratores" rotulo="Detratores (0-6)" valor={a.nps_detratores} obrig={false} /></div>
            </div>
          </Sec>

          <Sec titulo="Inadimplência de renovação">
            <Escolha nome="inad_houve" rotulo="Houve inadimplência?" opcoes={SIM_NAO} valor={houve('sem_inadimplencia')} classe="gatilho" />
            <div className="condicional" data-se="inad_houve:sim">
              <div className="linha-campos"><Numero nome="inad_alunos" rotulo="Alunos inadimplentes" valor={a.inad_alunos} obrig={false} /><Numero nome="inad_valor" rotulo="Valor em aberto" valor={a.inad_valor} moeda obrig={false} /></div>
            </div>
          </Sec>

          <Sec titulo="Riscos e observação">
            <Texto nome="risco" rotulo="Risco que exige atenção" valor={a.risco} obrig={false} longo />
            <Texto nome="plano" rotulo="Plano de ação" valor={a.plano} obrig={false} longo />
            <div className="campo"><label htmlFor="prazo">Prazo</label><input id="prazo" name="prazo" type="date" defaultValue={a.prazo ? String(a.prazo).slice(0, 10) : ''} /></div>
            <Texto nome="observacao" rotulo="Observação" valor={a.observacao} obrig={false} />
          </Sec>
        </FormEstado>
      </div>
    </>
  );
}
