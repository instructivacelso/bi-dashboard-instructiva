import { notFound } from 'next/navigation';
import { exigirUsuario } from '@/lib/auth.js';
import { q, q1 } from '@/lib/db.js';
import { hoje, fmtData, somarDias } from '@/lib/datas.js';
import { moeda, numero, pct } from '@/lib/formato.js';
import {
  FORMULARIOS, formularioAplicavel, lancamentoAberto, ETAPAS_AUTOMACAO_ROTULOS, TIPOS_ENTREGA, SITUACAO_EDITOR, PRIORIDADES,
} from '@/lib/formularios.js';
import { formulariosDo, podeEditar, ehSuperadmin } from '@/lib/perm.js';
import { lancamentosDoUsuario, dashboardMarketing, responsaveisMarketing } from '@/lib/dados.js';
import { calcTrafego, calcWhatsapp, dividir, semaforo } from '@/lib/calc.js';
import FormEstado from '@/components/FormEstado.js';
import { Numero, Texto, Escolha, Selecao, DataCampo, SIM_NAO, sn } from '@/components/Campos.js';
import { Topo, Aviso, Vazio, Kpi, Semaforo } from '@/components/Ui.js';
import { salvarFormulario } from '../actions.js';

export const dynamic = 'force-dynamic';

export default async function PaginaFormulario(props) {
  const params = await props.params;
  const searchParams = await props.searchParams;
  const form = params.form;
  const cfg = FORMULARIOS[form];
  if (!cfg) notFound();
  const u = await exigirUsuario();
  const dia = hoje();
  const sub = await q1(`SELECT s.* FROM subdepartments s JOIN departments d ON d.id=s.department_id WHERE d.slug='marketing' AND s.formulario=$1`, [form]);

  let registro = null;
  let correcao = false;
  let lanc = null;
  let opcoes = [];

  if (searchParams.registro) {
    registro = await q1(`SELECT * FROM ${cfg.tabela} WHERE id=$1`, [Number(searchParams.registro)]);
    if (!registro) notFound();
    const perm = podeEditar(u, registro, dia);
    if (!perm.pode) return <><Topo titulo={cfg.titulo} /><Aviso tipo="erro">Você não pode alterar este registro.</Aviso></>;
    correcao = perm.correcao;
    lanc = await q1('SELECT * FROM launches WHERE id=$1', [registro.launch_id]);
    opcoes = [lanc];
  } else {
    if (!ehSuperadmin(u) && !formulariosDo(u).includes(form)) {
      return <><Topo titulo={cfg.titulo} /><Aviso tipo="erro">Este formulário não está atribuído a você.</Aviso></>;
    }
    if (sub && !sub.formulario_ativo) {
      return <><Topo titulo={cfg.titulo} /><Aviso>Este formulário foi desativado pelo administrador.</Aviso></>;
    }
    opcoes = (await lancamentosDoUsuario(u)).filter((l) => formularioAplicavel(form, l, dia));
    if (!opcoes.length) {
      return (
        <>
          <Topo titulo={cfg.titulo} descricao={sub?.descricao} />
          <Vazio>
            {form === 'live'
              ? 'Nenhuma live hoje. Este formulário aparece no dia da live ou quando o gerente libera.'
              : 'Nenhum lançamento ativo atribuído a você para este formulário hoje.'}
          </Vazio>
        </>
      );
    }
    lanc = opcoes.find((l) => l.id === Number(searchParams.lancamento)) || opcoes[0];
    registro = await q1(
      `SELECT * FROM ${cfg.tabela} WHERE launch_id=$1 AND data_ref=$2 ${cfg.porUsuario ? 'AND created_by=$3' : ''}`,
      cfg.porUsuario ? [lanc.id, dia, u.id] : [lanc.id, dia]
    );
    if (registro) {
      const perm = podeEditar(u, registro, dia);
      if (!perm.pode) {
        return (
          <>
            <Topo titulo={cfg.titulo} descricao={lanc.nome} />
            <Aviso>O resultado deste dia já foi enviado por outra pessoa. Para corrigir, fale com o gerente.</Aviso>
          </>
        );
      }
      correcao = perm.correcao;
    }
  }

  const v = registro || {};
  const somenteLeitura = !correcao && !lancamentoAberto(lanc);
  const autor = registro && registro.created_by !== u.id ? await q1('SELECT nome FROM users WHERE id=$1', [registro.created_by]) : null;

  return (
    <>
      <Topo titulo={cfg.titulo} descricao={sub?.descricao}>
        <a className="btn sec" href={`/historico?form=${form}`}>Histórico</a>
      </Topo>

      {opcoes.length > 1 && (
        <nav className="acoes-linha" aria-label="Escolher lançamento" style={{ marginBottom: 16 }}>
          {opcoes.map((l) => (
            <a key={l.id} href={`/marketing/${form}?lancamento=${l.id}`} className={`btn peq ${l.id === lanc.id ? '' : 'sec'}`} aria-current={l.id === lanc.id ? 'true' : undefined}>
              {l.nome}
            </a>
          ))}
        </nav>
      )}

      <div className="grade g2" style={{ alignItems: 'start' }}>
        <div className="painel">
          <div className="painel-cab">
            <h2>{lanc.nome}</h2>
            <span className="suave pequeno">Referência: {fmtData(registro?.data_ref || dia)}</span>
          </div>

          {correcao && <Aviso tipo="info">Você está corrigindo um registro{autor ? ` de ${autor.nome}` : ''}. A alteração fica registrada na auditoria.</Aviso>}
          {!correcao && registro && <Aviso tipo="ok">Você já enviou hoje. Pode ajustar até o fim do dia.</Aviso>}
          {somenteLeitura && <Aviso>Lançamento encerrado: disponível só para consulta.</Aviso>}

          {!somenteLeitura && (
            <FormEstado action={salvarFormulario} botao={registro ? 'Salvar alterações' : 'Enviar fechamento'} botaoEnviando="Enviando…">
              <input type="hidden" name="form" value={form} />
              <input type="hidden" name="launch_id" value={lanc.id} />
              {correcao && <input type="hidden" name="registro_id" value={registro.id} />}
              <Campos form={form} v={v} lanc={lanc} responsaveis={form === 'gerente' ? await responsaveisMarketing() : []} />
              {correcao && <Texto nome="motivo" rotulo="Motivo da correção" obrig longo dica="Obrigatório. Explique o que estava errado." />}
            </FormEstado>
          )}
        </div>

        <Calculos form={form} v={v} lanc={lanc} dia={dia} />
      </div>
    </>
  );
}

function Campos({ form, v, lanc, responsaveis }) {
  switch (form) {
    case 'trafego':
      return (
        <>
          <div className="linha-campos">
            <Numero nome="valor_gasto" rotulo="Valor gasto no dia (R$)" valor={v.valor_gasto} moeda />
            <Numero nome="visitas" rotulo="Visitas na página" valor={v.visitas} />
            <Numero nome="cadastros" rotulo="Cadastros no dia" valor={v.cadastros} />
          </div>
          <Escolha nome="houve_problema" rotulo="Houve algum problema?" opcoes={SIM_NAO} valor={sn(v.houve_problema)} classe="gatilho-problema" />
          <div className="condicional cond-problema">
            <Texto nome="problema_descricao" rotulo="Descrição curta do problema" valor={v.problema_descricao} />
            <Texto nome="problema_acao" rotulo="Ação que está sendo realizada" valor={v.problema_acao} />
          </div>
        </>
      );
    case 'whatsapp':
      return (
        <>
          <div className="linha-campos">
            <Numero nome="convites_api" rotulo="Convites enviados via API" valor={v.convites_api} />
            <Numero nome="entradas_api" rotulo="Entraram por API" valor={v.entradas_api} />
            <Numero nome="entradas_organico" rotulo="Entraram pelo orgânico" valor={v.entradas_organico} />
          </div>
          <Numero nome="total_grupos" rotulo="Total atual de pessoas nos grupos" valor={v.total_grupos} dica="Soma de todos os grupos deste lançamento agora." />
          <Numero nome="custo_disparos" rotulo="Valor gasto com disparos no dia (R$)" valor={v.custo_disparos} moeda obrig={false} />
          <div className="campo gatilho-problema">
            <label className="escolha" style={{ fontWeight: 600 }}>
              <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
                <input type="checkbox" name="houve_problema" value="sim" defaultChecked={v.houve_problema} /> Registrar problema
              </span>
            </label>
          </div>
          <div className="condicional cond-problema">
            <Texto nome="problema_descricao" rotulo="Descrição curta do problema" valor={v.problema_descricao} />
          </div>
        </>
      );
    case 'automacao':
      return (
        <>
          <Escolha nome="captacao_ok" rotulo="Página, formulário e entrada no WhatsApp estão funcionando?" opcoes={SIM_NAO} valor={sn(v.captacao_ok)} classe="gatilho-incidente" />
          <Escolha nome="checkout_ok" rotulo="Checkout e confirmação de compra estão funcionando?" opcoes={SIM_NAO} valor={sn(v.checkout_ok)} classe="gatilho-incidente" />
          <Escolha nome="onboarding_ok" rotulo="Onboarding dos compradores está funcionando?" opcoes={SIM_NAO} valor={sn(v.onboarding_ok)} classe="gatilho-incidente" />
          <Escolha nome="houve_problema" rotulo="Existe algum problema?" opcoes={SIM_NAO} valor={sn(v.houve_problema)} classe="gatilho-problema-auto" />
          <div className="condicional cond-incidente">
            <p className="pequeno"><strong>Registrar incidente.</strong> Ele aparece para o gerente até ser resolvido.</p>
            <Selecao nome="etapa" rotulo="Etapa afetada" obrig={false} opcoes={Object.entries(ETAPAS_AUTOMACAO_ROTULOS).map(([valor, rotulo]) => ({ valor, rotulo }))} />
            <Numero nome="afetados" rotulo="Pessoas ou alunos afetados (estimativa)" obrig={false} />
            <Texto nome="incidente_descricao" rotulo="Descrição curta" longo />
            <Escolha nome="prioridade" rotulo="Prioridade" opcoes={PRIORIDADES} obrig={false} />
            <DataCampo nome="previsao_solucao" rotulo="Previsão de solução" />
          </div>
          <details className="bloco pequeno">
            <summary>Fluxo de onboarding sob responsabilidade da Automação</summary>
            <p className="suave">
              Compra aprovada, página de obrigado, mensagem de boas-vindas, criação ou liberação da conta, link do grupo de alunos,
              confirmação de entrada, regras do grupo, orientação de acesso e indicação do canal de suporte. Depois que o aluno
              recebeu o acesso, entrou no grupo e recebeu as orientações, a responsabilidade passa ao Suporte.
            </p>
          </details>
        </>
      );
    case 'editor':
      return (
        <>
          <Escolha nome="tipo_entrega" rotulo="Tipo de entrega" opcoes={TIPOS_ENTREGA} valor={v.tipo_entrega} />
          <Numero nome="quantidade" rotulo="Quantidade concluída no dia" valor={v.quantidade} />
          <Escolha nome="situacao" rotulo="Status" opcoes={SITUACAO_EDITOR} valor={v.situacao} classe="gatilho-atraso" />
          <Texto nome="entrega" rotulo="Link da entrega ou descrição curta" valor={v.entrega} obrig max={400} />
          <div className="condicional cond-atraso">
            <Texto nome="motivo_atraso" rotulo="Motivo do atraso" valor={v.motivo_atraso} />
          </div>
        </>
      );
    case 'live':
      return (
        <>
          <div className="linha-campos">
            <Numero nome="participantes_unicos" rotulo="Pessoas únicas que participaram" valor={v.participantes_unicos} />
            <Numero nome="lista_reserva" rotulo="Entraram na lista de reserva" valor={v.lista_reserva} />
          </div>
          <Escolha nome="problema_tecnico" rotulo="Houve problema técnico?" opcoes={SIM_NAO} valor={sn(v.problema_tecnico)} classe="gatilho-problema" />
          <div className="condicional cond-problema">
            <Texto nome="observacao" rotulo="O que aconteceu?" valor={v.observacao} />
          </div>
        </>
      );
    case 'gerente':
      return (
        <>
          <Escolha nome="situacao" rotulo="Situação do dia" opcoes={{ verde: 'Verde', amarelo: 'Amarelo', vermelho: 'Vermelho' }} valor={v.situacao} classe="gatilho-situacao" />
          <p className="suave pequeno">Se estiver tudo verde, é só confirmar o fechamento.</p>
          <div className="condicional cond-situacao">
            <Texto nome="gargalo" rotulo="Principal gargalo" valor={v.gargalo} />
            <Texto nome="acao" rotulo="Ação que será tomada" valor={v.acao} />
            <Selecao nome="responsavel_id" rotulo="Responsável pela ação" obrig={false} valor={v.responsavel_id} opcoes={responsaveis.map((r) => ({ valor: r.id, rotulo: r.nome }))} />
            <DataCampo nome="prazo" rotulo="Prazo da ação" valor={v.prazo} />
          </div>
        </>
      );
    default:
      return null;
  }
}

// Painel lateral com os números calculados pelo sistema (nunca digitados)
async function Calculos({ form, v, lanc, dia }) {
  const inicio = lanc.captacao_inicio || somarDias(dia, -60);

  if (form === 'trafego') {
    const acc = await q1(
      `SELECT COALESCE(SUM(valor_gasto),0) gasto, COALESCE(SUM(cadastros),0) cad, COUNT(*)::int n FROM traffic_daily_entries WHERE launch_id=$1`,
      [lanc.id]
    );
    const doDia = registroTem(v) ? calcTrafego(v) : null;
    const cplAcum = dividir(acc.gasto, acc.cad);
    return (
      <aside className="grade">
        <h2>Calculado pelo sistema</h2>
        {doDia && (
          <div className="grade g4">
            <Kpi rotulo="CPL do dia" valor={moeda(doDia.cpl)} cor={semaforo(doDia.cpl, lanc.cpl_max, 'menor')} meta={lanc.cpl_max ? `máximo ${moeda(lanc.cpl_max)}` : null} />
            <Kpi rotulo="Custo por visita" valor={moeda(doDia.custoVisita)} />
            <Kpi rotulo="Conversão da página" valor={pct(doDia.conversaoPagina)} />
          </div>
        )}
        <div className="grade g4">
          <Kpi rotulo="Investimento acumulado" valor={acc.n ? moeda(acc.gasto, 0) : 'sem dados'} meta={lanc.orcamento ? `orçamento ${moeda(lanc.orcamento, 0)}` : null} />
          <Kpi rotulo="Cadastros acumulados" valor={acc.n ? numero(acc.cad) : 'sem dados'} cor={semaforo(Number(acc.cad), lanc.meta_cadastros)}
            meta={lanc.meta_cadastros ? `meta ${numero(lanc.meta_cadastros)} · ${pct(dividir(acc.cad, lanc.meta_cadastros))}` : null} />
          <Kpi rotulo="CPL acumulado" valor={moeda(cplAcum)} cor={semaforo(cplAcum, lanc.cpl_max, 'menor')} />
        </div>
      </aside>
    );
  }

  if (form === 'whatsapp') {
    const cad = await q1(`SELECT COALESCE(SUM(cadastros),0) cad, COUNT(*)::int n FROM traffic_daily_entries WHERE launch_id=$1`, [lanc.id]);
    const ant = await q1(`SELECT total_grupos FROM whatsapp_daily_entries WHERE launch_id=$1 AND data_ref < $2 ORDER BY data_ref DESC, updated_at DESC LIMIT 1`, [lanc.id, v.data_ref || dia]);
    const c = registroTem(v) ? calcWhatsapp(v) : null;
    const total = v.total_grupos ?? null;
    return (
      <aside className="grade">
        <h2>Calculado pelo sistema</h2>
        {!c && <Vazio>Os cálculos aparecem depois do envio.</Vazio>}
        {c && (
          <div className="grade g4">
            <Kpi rotulo="Entradas do dia" valor={numero(c.entradasTotais)} />
            <Kpi rotulo="Conversão dos convites" valor={pct(c.conversaoConvites)} />
            <Kpi rotulo="Custo por entrada (API)" valor={moeda(c.custoPorEntradaApi)} />
            <Kpi rotulo="Crescimento dos grupos" valor={ant ? numero(total - ant.total_grupos) : 'sem dados'} />
            <Kpi rotulo="Cadastrados nos grupos" valor={cad.n ? pct(dividir(total, cad.cad)) : 'sem dados'} meta={lanc.meta_grupos ? `meta ${numero(lanc.meta_grupos)} pessoas` : null} />
            <Kpi rotulo="Cadastros fora do WhatsApp" valor={cad.n && total != null ? numero(Math.max(cad.cad - total, 0)) : 'sem dados'} />
          </div>
        )}
      </aside>
    );
  }

  if (form === 'gerente') {
    const d = await dashboardMarketing({ desde: inicio, ate: dia, launchIds: [lanc.id] });
    const inc = await q1(`SELECT COUNT(*)::int n FROM automation_incidents WHERE launch_id=$1 AND status='aberto'`, [lanc.id]);
    return (
      <aside className="grade">
        <h2>Consolidado do lançamento</h2>
        <p className="suave pequeno">Números enviados pela equipe desde {fmtData(inicio)}. Você não precisa redigitar.</p>
        <div className="grade g4">
          <Kpi rotulo="Investimento" valor={moeda(d.totais.investimento, 0)} />
          <Kpi rotulo="Cadastros" valor={numero(d.totais.cadastros)} cor={semaforo(d.totais.cadastros, d.metas.cadastros)} meta={d.metas.cadastros ? `meta ${numero(d.metas.cadastros)}` : null} />
          <Kpi rotulo="CPL" valor={moeda(d.indicadores.cpl)} cor={semaforo(d.indicadores.cpl, lanc.cpl_max, 'menor')} />
          <Kpi rotulo="Nos grupos" valor={numero(d.totais.grupos)} meta={pct(d.indicadores.entradaWhatsapp)} />
          <Kpi rotulo="Incidentes abertos" valor={numero(inc.n)} cor={inc.n ? 'vermelho' : 'verde'} />
        </div>
        {d.funil.gargalo && (
          <Aviso tipo="erro">Maior gargalo pelo planejado: <strong>{d.funil.gargalo.nome}</strong> ({pct(d.funil.gargalo.conversao)} contra {pct(d.funil.gargalo.conversaoMeta)} esperado).</Aviso>
        )}
        <a className="btn sec" href={`/marketing/dashboard?lancamento=${lanc.id}`}>Ver dashboard completo</a>
      </aside>
    );
  }

  if (form === 'live') {
    const c = registroTem(v) ? { conv: dividir(v.lista_reserva, v.participantes_unicos) } : null;
    return (
      <aside className="grade">
        <h2>Calculado pelo sistema</h2>
        {c ? (
          <div className="grade g4">
            <Kpi rotulo="Conversão para lista" valor={pct(c.conv)} />
            <Kpi rotulo="Participantes vs meta" valor={pct(dividir(v.participantes_unicos, lanc.meta_live))} cor={semaforo(v.participantes_unicos, lanc.meta_live)} />
          </div>
        ) : <Vazio>Os cálculos aparecem depois do envio.</Vazio>}
      </aside>
    );
  }

  if (form === 'automacao') {
    const abertos = await q(`SELECT * FROM automation_incidents WHERE launch_id=$1 AND status='aberto' ORDER BY id DESC`, [lanc.id]);
    return (
      <aside className="painel">
        <div className="painel-cab"><h2>Incidentes abertos</h2><a className="pequeno" href="/acoes">Gerenciar</a></div>
        {abertos.length === 0 ? <p className="suave">Nenhum incidente aberto neste lançamento.</p> : (
          <table><tbody>
            {abertos.map((i) => (
              <tr key={i.id}>
                <td><Semaforo cor={['alta', 'critica'].includes(i.prioridade) ? 'vermelho' : 'amarelo'} texto={PRIORIDADES[i.prioridade]} /></td>
                <td>{i.descricao}<br /><span className="suave pequeno">{ETAPAS_AUTOMACAO_ROTULOS[i.etapa]} · {fmtData(i.data_ref)}</span></td>
              </tr>
            ))}
          </tbody></table>
        )}
      </aside>
    );
  }
  return <div />;
}

function registroTem(v) {
  return v && v.id;
}
