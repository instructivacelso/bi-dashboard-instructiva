import { exigirUsuario } from '@/lib/auth.js';
import { hoje, somarDias, fmtData } from '@/lib/datas.js';
import { ehProfessor } from '@/lib/academico.js';
import { diarioProfessorDoDia } from '@/lib/dadosAcademico.js';
import { Topo, Aviso } from '@/components/Ui.js';
import FormEstado from '@/components/FormEstado.js';
import Etapas from '@/components/Etapas.js';
import Condicionais from '@/components/Condicionais.js';
import DataRegistro from '@/components/DataRegistro.js';
import { Numero, Texto, Escolha, SIM_NAO } from '@/components/Campos.js';
import { salvarDiarioProfessor } from '../actions.js';

export const dynamic = 'force-dynamic';
const Sec = ({ titulo, children }) => <div className="secao-form"><h3>{titulo}</h3>{children}</div>;

export default async function DiarioProfessor(props) {
  const sp = await props.searchParams;
  const u = await exigirUsuario();
  if (!ehProfessor(u)) return <><Topo titulo="Registro do dia" /><Aviso tipo="erro">Este formulário é dos professores. Peça ao administrador para incluir você em Acadêmico → Professores.</Aviso></>;
  const dia = hoje(); const min = somarDias(dia, -7);
  const dataRef = /^\d{4}-\d{2}-\d{2}$/.test(sp.data || '') && sp.data <= dia && sp.data >= min ? sp.data : dia;
  const a = (await diarioProfessorDoDia(u.id, dataRef)) || {};
  const tem = (k) => (a.atividades ? (a.atividades.includes(k) ? 'sim' : 'nao') : undefined);
  const outroDia = dataRef !== dia;

  return (
    <>
      <Topo titulo="Meu dia" descricao={`${fmtData(dataRef)} · ${u.nome}. Marque só o que fez hoje — leva poucos minutos.`}>
        <a className="btn sec" href="/academico/painel">Meu painel</a>
      </Topo>
      {a.id && <Aviso tipo="ok">Registro de {fmtData(dataRef)} já enviado. Você pode ajustar abaixo.</Aviso>}

      <div className="painel form-claro">
        <FormEstado action={salvarDiarioProfessor} botao={a.id ? 'Salvar registro' : 'Enviar registro'} protegerSaida progresso>
          <Condicionais /><Etapas />

          <Sec titulo="Resumo do dia">
            <DataRegistro valor={dataRef} min={min} max={dia} rota="/academico/diario" />
            {outroDia && <Texto nome="justificativa_data" rotulo="Por que outra data?" valor={a.justificativa_data} obrig />}
            <div className="linha-campos">
              <Numero nome="horas" rotulo="Horas trabalhadas" valor={a.horas} moeda obrig />
              <Texto nome="unidade" rotulo="Unidade" valor={a.unidade} obrig={false} />
            </div>
            <Texto nome="entrega_principal" rotulo="Principal entrega do dia" valor={a.entrega_principal} obrig />
            <div className="linha-campos">
              <Texto nome="dificuldade" rotulo="Dificuldade ou bloqueio" valor={a.dificuldade} obrig={false} />
              <Texto nome="prioridade" rotulo="Prioridade de amanhã" valor={a.prioridade} obrig={false} />
            </div>
          </Sec>

          <Sec titulo="Gravação de aulas">
            <Escolha nome="gravacao_houve" rotulo="Gravou aulas hoje?" opcoes={SIM_NAO} valor={tem('gravacao')} classe="gatilho" />
            <div className="condicional" data-se="gravacao_houve:sim">
              <div className="linha-campos"><Numero nome="grav_aulas" rotulo="Aulas gravadas" valor={a.grav_aulas} obrig={false} /><Numero nome="grav_minutos" rotulo="Minutos brutos" valor={a.grav_minutos} moeda obrig={false} /><Numero nome="grav_tempo" rotulo="Horas de trabalho" valor={a.grav_tempo} moeda obrig={false} /></div>
              <div className="linha-campos"><Numero nome="grav_publicadas" rotulo="Publicadas" valor={a.grav_publicadas} obrig={false} /><Numero nome="grav_regravadas" rotulo="Regravadas" valor={a.grav_regravadas} obrig={false} /></div>
            </div>
          </Sec>

          <Sec titulo="Criativos para marketing">
            <Escolha nome="criativos_houve" rotulo="Produziu criativos?" opcoes={SIM_NAO} valor={tem('criativos')} classe="gatilho" />
            <div className="condicional" data-se="criativos_houve:sim">
              <div className="linha-campos"><Numero nome="criativos_produzidos" rotulo="Produzidos" valor={a.criativos_produzidos} obrig={false} /><Numero nome="criativos_aprovados" rotulo="Aprovados" valor={a.criativos_aprovados} obrig={false} /><Numero nome="criativos_publicados" rotulo="Publicados" valor={a.criativos_publicados} obrig={false} /><Numero nome="criativos_refacao" rotulo="Em refação" valor={a.criativos_refacao} obrig={false} /></div>
              <p className="suave pequeno">As métricas de mídia (CTR, CPL, vendas) vêm do Marketing — você não precisa digitar.</p>
            </div>
          </Sec>

          <Sec titulo="Apostilas e materiais">
            <Escolha nome="materiais_houve" rotulo="Trabalhou em materiais?" opcoes={SIM_NAO} valor={tem('materiais')} classe="gatilho" />
            <div className="condicional" data-se="materiais_houve:sim">
              <div className="linha-campos"><Numero nome="mat_paginas_novas" rotulo="Páginas novas" valor={a.mat_paginas_novas} obrig={false} /><Numero nome="mat_paginas_revisadas" rotulo="Páginas revisadas" valor={a.mat_paginas_revisadas} obrig={false} /><Numero nome="mat_exercicios" rotulo="Exercícios" valor={a.mat_exercicios} obrig={false} /><Numero nome="mat_concluidos" rotulo="Materiais concluídos" valor={a.mat_concluidos} obrig={false} /></div>
            </div>
          </Sec>

          <Sec titulo="Suporte aos alunos">
            <Escolha nome="suporte_houve" rotulo="Fez suporte hoje?" opcoes={SIM_NAO} valor={tem('suporte')} classe="gatilho" />
            <div className="condicional" data-se="suporte_houve:sim">
              <div className="linha-campos"><Numero nome="sup_alunos" rotulo="Alunos atendidos" valor={a.sup_alunos} obrig={false} /><Numero nome="sup_chamados" rotulo="Dúvidas/chamados" valor={a.sup_chamados} obrig={false} /><Numero nome="sup_resolvidos" rotulo="Resolvidos" valor={a.sup_resolvidos} obrig={false} /></div>
              <div className="linha-campos"><Numero nome="sup_primeiro" rotulo="Resolvidos no 1º contato" valor={a.sup_primeiro} obrig={false} /><Numero nome="sup_pendentes" rotulo="Pendentes" valor={a.sup_pendentes} obrig={false} /></div>
            </div>
          </Sec>

          <Sec titulo="Lives e aulas ao vivo">
            <Escolha nome="lives_houve" rotulo="Fez live ou aula ao vivo?" opcoes={SIM_NAO} valor={tem('lives')} classe="gatilho" />
            <div className="condicional" data-se="lives_houve:sim">
              <div className="linha-campos"><Numero nome="live_realizadas" rotulo="Lives realizadas" valor={a.live_realizadas} obrig={false} /><Numero nome="live_inscritos" rotulo="Inscritos" valor={a.live_inscritos} obrig={false} /><Numero nome="live_presentes" rotulo="Presentes" valor={a.live_presentes} obrig={false} /></div>
              <div className="linha-campos"><Numero nome="live_leads" rotulo="Leads" valor={a.live_leads} obrig={false} /><Numero nome="live_vendas" rotulo="Vendas" valor={a.live_vendas} obrig={false} /><Numero nome="live_receita" rotulo="Receita" valor={a.live_receita} moeda obrig={false} /></div>
            </div>
          </Sec>

          <Sec titulo="Atendimento e vendas">
            <Escolha nome="vendas_houve" rotulo="Atendeu ou vendeu?" opcoes={SIM_NAO} valor={tem('vendas')} classe="gatilho" />
            <div className="condicional" data-se="vendas_houve:sim">
              <div className="linha-campos"><Numero nome="vnd_leads" rotulo="Leads atendidos" valor={a.vnd_leads} obrig={false} /><Numero nome="vnd_followups" rotulo="Follow-ups" valor={a.vnd_followups} obrig={false} /><Numero nome="vnd_qtd" rotulo="Vendas" valor={a.vnd_qtd} obrig={false} /><Numero nome="vnd_valor" rotulo="Valor vendido" valor={a.vnd_valor} moeda obrig={false} /></div>
              <div className="linha-campos"><Numero nome="vnd_pix" rotulo="Pix" valor={a.vnd_pix} moeda obrig={false} /><Numero nome="vnd_cartao" rotulo="Cartão" valor={a.vnd_cartao} moeda obrig={false} /><Numero nome="vnd_boleto" rotulo="Boleto" valor={a.vnd_boleto} moeda obrig={false} /></div>
            </div>
          </Sec>

          <Sec titulo="Planejamento e reuniões">
            <Escolha nome="planejamento_houve" rotulo="Teve reunião ou planejamento?" opcoes={SIM_NAO} valor={tem('planejamento')} classe="gatilho" />
            <div className="condicional" data-se="planejamento_houve:sim">
              <Numero nome="plan_reunioes" rotulo="Reuniões" valor={a.plan_reunioes} obrig={false} />
              <Texto nome="plan_decisao" rotulo="Decisão ou próxima ação" valor={a.plan_decisao} obrig longo />
            </div>
          </Sec>

          <Texto nome="observacao" rotulo="Observação" valor={a.observacao} obrig={false} />
        </FormEstado>
      </div>
    </>
  );
}
