import { notFound } from 'next/navigation';
import { exigirUsuario } from '@/lib/auth.js';
import { q, q1 } from '@/lib/db.js';
import { hoje, fmtData, somarDias } from '@/lib/datas.js';
import { moeda, numero, pct } from '@/lib/formato.js';
import {
  FORMULARIOS, formularioAplicavel, lancamentoAberto, DESCRICOES, ETAPAS_AUTOMACAO_ROTULOS, ETAPAS_MONITORADAS, PRIORIDADES,
  TIPOS_ENTREGA, SITUACAO_EDITOR, PRIORIDADE_EDITOR, PLATAFORMAS_LIVE, SEMAFORO_OPCOES, GARGALOS, rotuloEtapa,
} from '@/lib/formularios.js';
import { formulariosDo, podeEditar, ehSuperadmin } from '@/lib/perm.js';
import { lancamentosDoUsuario, dashboardMarketing, responsaveisMarketing, plataformasDo } from '@/lib/dados.js';
import { calcTrafego, calcWhatsapp, calcLive, dividir, semaforo, variacao } from '@/lib/calc.js';
import FormEstado from '@/components/FormEstado.js';
import InputMoeda from '@/components/InputMoeda.js';
import { Numero, Texto, Escolha, Selecao, DataCampo, SIM_NAO, sn } from '@/components/Campos.js';
import { Topo, Aviso, Vazio, Kpi, Semaforo } from '@/components/Ui.js';
import { salvarFormulario } from '../actions.js';

export const dynamic = 'force-dynamic';
const opcoesDe = (obj) => Object.entries(obj).map(([valor, rotulo]) => ({ valor, rotulo }));

function Moeda({ nome, rotulo, valor }) {
  return (
    <div className="campo">
      <label htmlFor={nome}>{rotulo}</label>
      <InputMoeda id={nome} name={nome} valorInicial={valor} />
    </div>
  );
}
function Decimal({ nome, rotulo, valor, dica }) {
  return (
    <div className="campo">
      <label htmlFor={nome}>{rotulo}</label>
      <input id={nome} name={nome} type="text" inputMode="decimal" pattern="[0-9]+([.,][0-9]{1,2})?" defaultValue={valor ?? ''} required placeholder="0,0" autoComplete="off" />
      {dica && <small>{dica}</small>}
    </div>
  );
}
function Hora({ nome, rotulo, valor }) {
  return (
    <div className="campo">
      <label htmlFor={nome}>{rotulo}</label>
      <input id={nome} name={nome} type="time" defaultValue={valor ? String(valor).slice(0, 5) : ''} required />
    </div>
  );
}

export default async function PaginaFormulario(props) {
  const params = await props.params;
  const searchParams = await props.searchParams;
  const form = params.form;
  const cfg = FORMULARIOS[form];
  if (!cfg) notFound();
  const u = await exigirUsuario();
  const dia = hoje();
  const sub = await q1(`SELECT s.* FROM subdepartments s JOIN departments d ON d.id=s.department_id WHERE d.slug='marketing' AND s.formulario=$1`, [form]);
  const titulo = cfg.titulo;
  const descricao = DESCRICOES[form];

  let registros = [];
  let correcao = false;
  let lanc = null;
  let opcoes = [];
  let plataformas = [];

  if (searchParams.registro) {
    const r = await q1(`SELECT * FROM ${cfg.tabela} WHERE id=$1`, [Number(searchParams.registro)]);
    if (!r) notFound();
    const perm = podeEditar(u, r, dia);
    if (!perm.pode) return <><Topo titulo={titulo} /><Aviso tipo="erro">Você não pode alterar este registro.</Aviso></>;
    correcao = perm.correcao;
    registros = [r];
    lanc = await q1('SELECT * FROM launches WHERE id=$1', [r.launch_id]);
    opcoes = [lanc];
    plataformas = form === 'trafego' ? [r.plataforma] : [];
  } else {
    if (!ehSuperadmin(u) && !formulariosDo(u).includes(form)) return <><Topo titulo={titulo} /><Aviso tipo="erro">Este formulário não está atribuído a você.</Aviso></>;
    if (sub && !sub.formulario_ativo) return <><Topo titulo={titulo} /><Aviso>Este formulário foi desativado pelo administrador.</Aviso></>;
    opcoes = (await lancamentosDoUsuario(u)).filter((l) => formularioAplicavel(form, l, dia));
    if (!opcoes.length) {
      return (
        <>
          <Topo titulo={titulo} descricao={descricao}><a className="btn sec" href="/">Voltar</a></Topo>
          <Vazio>{form === 'live' ? 'Nenhuma live hoje. Este formulário aparece no dia da live ou quando o gerente libera.' : 'Nenhum lançamento ativo atribuído a você para este formulário hoje.'}</Vazio>
        </>
      );
    }
    lanc = opcoes.find((l) => l.id === Number(searchParams.lancamento)) || opcoes[0];
    registros = await q(
      `SELECT * FROM ${cfg.tabela} WHERE launch_id=$1 AND data_ref=$2 ${cfg.porUsuario ? 'AND created_by=$3' : ''}`,
      cfg.porUsuario ? [lanc.id, dia, u.id] : [lanc.id, dia]
    );
    if (registros.length && !podeEditar(u, registros[0], dia).pode) {
      return <><Topo titulo={titulo} descricao={lanc.nome} /><Aviso>O resultado deste dia já foi enviado por outra pessoa. Para corrigir, fale com o gerente.</Aviso></>;
    }
    if (form === 'trafego') plataformas = await plataformasDo(u.id, lanc.id);
  }

  const v = registros[0] || {};
  const somenteLeitura = !correcao && !lancamentoAberto(lanc);
  const autor = v.created_by && v.created_by !== u.id ? await q1('SELECT nome FROM users WHERE id=$1', [v.created_by]) : null;
  const gestor = !['colaborador', 'externo'].includes(u.papel);
  const responsaveis = form === 'gerente' ? await responsaveisMarketing() : [];

  return (
    <>
      <Topo titulo={titulo} descricao={descricao}>
        <a className="btn sec" href={`/historico?form=${form}`}>Ver histórico</a>
      </Topo>

      {opcoes.length > 1 && (
        <nav className="acoes-linha" aria-label="Escolher lançamento" style={{ marginBottom: 16 }}>
          {opcoes.map((l) => (
            <a key={l.id} href={`/marketing/${form}?lancamento=${l.id}`} className={`btn peq ${l.id === lanc.id ? '' : 'sec'}`} aria-current={l.id === lanc.id ? 'true' : undefined}>{l.nome}</a>
          ))}
        </nav>
      )}

      {form === 'trafego' && <ComparativoTrafego lanc={lanc} dia={v.data_ref || dia} />}

      <div className="grade g2" style={{ alignItems: 'start', marginTop: form === 'trafego' ? 16 : 0 }}>
        <div className="painel">
          <div className="painel-cab">
            <h2>{lanc.nome}</h2>
            <span className="suave pequeno">Referência: {fmtData(v.data_ref || dia)}</span>
          </div>
          {correcao && <Aviso tipo="info">Você está corrigindo um registro{autor ? ` de ${autor.nome}` : ''}. A alteração fica registrada na auditoria.</Aviso>}
          {!correcao && registros.length > 0 && <Aviso tipo="ok">Você já enviou hoje. Pode ajustar até o fim do dia.</Aviso>}
          {somenteLeitura && <Aviso>Lançamento encerrado: disponível só para consulta.</Aviso>}

          {!somenteLeitura && (
            <FormEstado
              action={salvarFormulario}
              botao={registros.length ? 'Salvar alterações' : 'Enviar fechamento'}
              botaoEnviando="Enviando…"
              protegerSaida
              extra={form === 'gerente' && !correcao ? <button type="submit" name="rapido" value="sim" formNoValidate className="btn sec">Operação dentro do esperado</button> : null}
            >
              <input type="hidden" name="form" value={form} />
              <input type="hidden" name="launch_id" value={lanc.id} />
              {correcao && <input type="hidden" name="registro_id" value={v.id} />}
              <p className="contador">Todos os campos são obrigatórios. Se não houve movimento, informe 0.</p>
              <Campos form={form} v={v} registros={registros} plataformas={plataformas} responsaveis={responsaveis} />
              {correcao && <Texto nome="motivo" rotulo="Motivo da correção" obrig longo dica="Obrigatório. Explique o que estava errado." />}
            </FormEstado>
          )}
        </div>
        {gestor && <Calculos form={form} v={v} lanc={lanc} dia={dia} />}
      </div>
    </>
  );
}

function Campos({ form, v, registros, plataformas, responsaveis }) {
  switch (form) {
    case 'trafego':
      return plataformas.map((pl, i) => {
        const r = registros.find((x) => x.plataforma === pl) || {};
        const p = (c) => `p${i}_${c}`;
        return (
          <section key={pl} className="bloco-plataforma" aria-label={pl}>
            <input type="hidden" name="plataforma" value={pl} />
            <h3>{pl}</h3>
            <div className="linha-campos">
              <Moeda nome={p('orcamento_dia')} rotulo="Orçamento previsto para o dia" valor={r.orcamento_dia} />
              <Moeda nome={p('valor_gasto')} rotulo="Valor gasto no dia" valor={r.valor_gasto} />
            </div>
            <div className="linha-campos">
              <Numero nome={p('impressoes')} rotulo="Impressões" valor={r.impressoes} />
              <Numero nome={p('cliques')} rotulo="Cliques no link" valor={r.cliques} />
              <Numero nome={p('visitas')} rotulo="Visitas reais na página" valor={r.visitas} />
            </div>
            <div className="linha-campos">
              <Numero nome={p('cadastros')} rotulo="Cadastros concluídos" valor={r.cadastros} />
              <Decimal nome={p('tempo_carregamento')} rotulo="Tempo médio de carregamento (s)" valor={r.tempo_carregamento} />
            </div>
            <div className={`gatilho-problema-${i}`}>
              <Escolha nome={p('houve_problema')} rotulo="Houve algum problema?" opcoes={SIM_NAO} valor={sn(r.houve_problema)} classe="gatilho-problema" />
            </div>
            <div className="condicional cond-problema">
              <Texto nome={p('problema_descricao')} rotulo="Descrição curta do problema" valor={r.problema_descricao} />
              <Texto nome={p('problema_acao')} rotulo="Ação que está sendo realizada" valor={r.problema_acao} />
            </div>
          </section>
        );
      });
    case 'whatsapp':
      return (
        <>
          <div className="linha-campos">
            <Numero nome="grupos_ativos" rotulo="Grupos ativos do lançamento" valor={v.grupos_ativos} />
            <Numero nome="total_grupos" rotulo="Total atual de pessoas nos grupos" valor={v.total_grupos} />
          </div>
          <div className="linha-campos">
            <Numero nome="convites_api" rotulo="Convites enviados via API" valor={v.convites_api} />
            <Numero nome="convites_entregues" rotulo="Convites entregues via API" valor={v.convites_entregues} />
          </div>
          <div className="linha-campos">
            <Numero nome="entradas_api" rotulo="Entraram por API" valor={v.entradas_api} />
            <Numero nome="entradas_pagina" rotulo="Entraram pelo link da página" valor={v.entradas_pagina} />
            <Numero nome="entradas_organico" rotulo="Entraram pelo orgânico" valor={v.entradas_organico} />
          </div>
          <div className="linha-campos">
            <Numero nome="saidas" rotulo="Saíram dos grupos" valor={v.saidas} />
            <Moeda nome="custo_disparos" rotulo="Valor gasto com disparos" valor={v.custo_disparos} />
          </div>
          <div className="campo gatilho-problema">
            <div className="escolha"><label><input type="checkbox" name="houve_problema" value="sim" defaultChecked={v.houve_problema} /> Registrar problema</label></div>
          </div>
          <div className="condicional cond-problema">
            <Texto nome="problema_descricao" rotulo="Descrição curta do problema" valor={v.problema_descricao} />
            <Texto nome="problema_acao" rotulo="Ação realizada ou necessária" valor={v.problema_acao} />
          </div>
        </>
      );
    case 'automacao':
      return (
        <>
          <div>
            {ETAPAS_MONITORADAS.map((e) => (
              <div className="status-linha" key={e.campo}>
                <span className="rot" style={{ fontWeight: 600, fontSize: '0.9rem' }} id={`r-${e.campo}`}>{e.rotulo}</span>
                <div className="escolha gatilho-falha" role="radiogroup" aria-labelledby={`r-${e.campo}`}>
                  <label><input type="radio" name={e.campo} value="ok" defaultChecked={v[e.campo] === true} required /> Funcionando</label>
                  <label><input type="radio" name={e.campo} value="falha" defaultChecked={v[e.campo] === false} /> Com falha</label>
                </div>
              </div>
            ))}
          </div>
          <div className="condicional cond-falha">
            <p className="pequeno"><strong>Registrar incidente.</strong> Ele fica aberto para o gerente até ser resolvido.</p>
            <Selecao nome="etapa" rotulo="Etapa afetada" obrig={false} opcoes={opcoesDe(ETAPAS_AUTOMACAO_ROTULOS)} />
            <Numero nome="afetados" rotulo="Pessoas ou alunos afetados (estimativa)" obrig={false} />
            <Texto nome="incidente_descricao" rotulo="Descrição curta" longo />
            <Escolha nome="prioridade" rotulo="Prioridade" opcoes={PRIORIDADES} obrig={false} />
            <DataCampo nome="previsao_solucao" rotulo="Previsão de solução" />
          </div>
          <details className="bloco pequeno">
            <summary>Fluxo sob responsabilidade da Automação</summary>
            <p className="suave">Compra aprovada → página de obrigado → boas-vindas → conta liberada → grupo de alunos → regras → orientação de acesso → entrega ao Suporte. A responsabilidade passa ao Suporte só depois que o aluno recebeu o acesso, entrou no grupo e recebeu as orientações iniciais.</p>
          </details>
        </>
      );
    case 'editor':
      return (
        <>
          <Escolha nome="tipo_entrega" rotulo="Tipo de entrega" opcoes={TIPOS_ENTREGA} valor={v.tipo_entrega} />
          <div className="linha-campos">
            <Texto nome="titulo" rotulo="Nome ou título da entrega" valor={v.titulo} obrig max={200} />
            <Texto nome="solicitante" rotulo="Solicitante da entrega" valor={v.solicitante} obrig max={120} />
          </div>
          <Escolha nome="prioridade" rotulo="Prioridade" opcoes={PRIORIDADE_EDITOR} valor={v.prioridade} />
          <div className="linha-campos">
            <Numero nome="quantidade_planejada" rotulo="Quantidade planejada" valor={v.quantidade_planejada} />
            <Numero nome="quantidade" rotulo="Quantidade concluída no dia" valor={v.quantidade} />
            <DataCampo nome="prazo" rotulo="Prazo previsto de entrega" valor={v.prazo} obrig />
          </div>
          <Escolha nome="situacao" rotulo="Status" opcoes={SITUACAO_EDITOR} valor={v.situacao} classe="gatilho-atraso" />
          <Texto nome="entrega" rotulo="Link da entrega ou da pasta do projeto" valor={v.entrega} obrig max={500} />
          <div className="condicional cond-atraso">
            <Texto nome="motivo_atraso" rotulo="Motivo do atraso" valor={v.motivo_atraso} />
          </div>
        </>
      );
    case 'live':
      return (
        <>
          <Escolha nome="plataforma" rotulo="Plataforma da live" opcoes={PLATAFORMAS_LIVE} valor={v.plataforma} />
          <div className="linha-campos">
            <Hora nome="horario_previsto" rotulo="Horário previsto de início" valor={v.horario_previsto} />
            <Hora nome="horario_real" rotulo="Horário real de início" valor={v.horario_real} />
          </div>
          <div className="linha-campos">
            <Numero nome="participantes_unicos" rotulo="Pessoas únicas que participaram" valor={v.participantes_unicos} />
            <Numero nome="pessoas_pitch" rotulo="Pessoas presentes no pitch" valor={v.pessoas_pitch} />
            <Numero nome="cliques_oferta" rotulo="Cliques no link da oferta" valor={v.cliques_oferta} />
          </div>
          <div className="linha-campos">
            <Numero nome="lista_reserva" rotulo="Entraram na lista de reserva" valor={v.lista_reserva} />
            <Numero nome="checkouts_iniciados" rotulo="Checkouts iniciados" valor={v.checkouts_iniciados} />
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
          <Escolha nome="situacao" rotulo="Situação do dia" opcoes={SEMAFORO_OPCOES} valor={v.situacao} />
          <Escolha nome="sit_trafego" rotulo="Situação do tráfego" opcoes={SEMAFORO_OPCOES} valor={v.sit_trafego} />
          <Escolha nome="sit_pagina" rotulo="Situação da página e captação" opcoes={SEMAFORO_OPCOES} valor={v.sit_pagina} />
          <Escolha nome="sit_grupos" rotulo="Situação dos grupos e WhatsApp" opcoes={SEMAFORO_OPCOES} valor={v.sit_grupos} />
          <Escolha nome="sit_automacao" rotulo="Situação das automações e onboarding" opcoes={SEMAFORO_OPCOES} valor={v.sit_automacao} />
          <Selecao nome="gargalo" rotulo="Principal gargalo" valor={v.gargalo && GARGALOS[v.gargalo] ? v.gargalo : ''} opcoes={opcoesDe(GARGALOS)} />
          <Texto nome="acao" rotulo="Ação que será tomada" valor={v.acao} obrig />
          <div className="linha-campos">
            <Selecao nome="responsavel_id" rotulo="Responsável pela ação" valor={v.responsavel_id} opcoes={responsaveis.map((r) => ({ valor: r.id, rotulo: r.nome }))} />
            <DataCampo nome="prazo" rotulo="Prazo da ação" valor={v.prazo} obrig />
          </div>
          <p className="suave pequeno">Tudo verde? Use “Operação dentro do esperado” para confirmar sem preencher o resto.</p>
        </>
      );
    default:
      return null;
  }
}

// Comparativo com o dia anterior (Tráfego), por plataforma e total do lançamento
async function ComparativoTrafego({ lanc, dia }) {
  const ant = await q1('SELECT MAX(data_ref) d FROM traffic_daily_entries WHERE launch_id=$1 AND data_ref < $2', [lanc.id, dia]);
  const soma = (dataRef) => q(
    `SELECT plataforma, SUM(valor_gasto) gasto, SUM(impressoes) imp, SUM(cliques) cli, SUM(visitas) vis, SUM(cadastros) cad
       FROM traffic_daily_entries WHERE launch_id=$1 AND data_ref=$2 GROUP BY ROLLUP(plataforma) ORDER BY plataforma NULLS LAST`, [lanc.id, dataRef]);
  const [antes, agora] = await Promise.all([ant.d ? soma(ant.d) : [], soma(dia)]);
  const metr = (r) => r && r.gasto !== null && ({
    gasto: Number(r.gasto), imp: Number(r.imp), cli: Number(r.cli), vis: Number(r.vis), cad: Number(r.cad),
    ...calcTrafego({ valor_gasto: r.gasto, impressoes: r.imp, cliques: r.cli, visitas: r.vis, cadastros: r.cad }),
  });
  const linhas = [
    ['Valor gasto', 'gasto', (x) => moeda(x)], ['Impressões', 'imp', numero], ['Cliques', 'cli', numero], ['Visitas', 'vis', numero],
    ['Cadastros', 'cad', numero], ['CTR', 'ctr', pct], ['CPC', 'cpc', (x) => moeda(x)], ['CPL', 'cpl', (x) => moeda(x)], ['Conversão da página', 'conversaoPagina', pct],
  ];
  const grupos = [...new Set([...antes, ...agora].map((r) => r.plataforma))];
  const tabela = (pl) => {
    const a = metr(antes.find((r) => r.plataforma === pl));
    const h = metr(agora.find((r) => r.plataforma === pl));
    return (
      <div className="tabela-wrap" key={pl ?? 'total'}>
        <table className="comparativo">
          <thead><tr><th>{pl ?? 'Total do lançamento'}</th><th className="num">Anterior{ant.d ? ` (${fmtData(ant.d).slice(0, 5)})` : ''}</th><th className="num">Hoje</th><th className="num">Variação</th></tr></thead>
          <tbody>{linhas.map(([rot, k, f]) => {
            const vr = a && h ? variacao(h[k], a[k]) : null;
            return (
              <tr key={k}>
                <td>{rot}</td>
                <td className="num">{a ? f(a[k]) : '—'}</td>
                <td className="num">{h ? f(h[k]) : '—'}</td>
                <td className={`num ${vr > 0 ? 'var-pos' : vr < 0 ? 'var-neg' : ''}`}>{vr === null ? '—' : `${vr > 0 ? '+' : ''}${pct(vr)}`}</td>
              </tr>
            );
          })}</tbody>
        </table>
      </div>
    );
  };
  return (
    <section className="painel">
      <div className="painel-cab"><h2>Comparativo com o dia anterior</h2><span className="suave pequeno">{ant.d ? 'Somente leitura' : 'Sem registro anterior'}</span></div>
      {!ant.d && agora.length === 0 ? <p className="suave">Sem registro anterior. Os números aparecem aqui a partir do segundo dia.</p> : (
        <>
          {tabela(null)}
          {grupos.filter(Boolean).length > 1 && (
            <details className="bloco" style={{ marginTop: 10 }}>
              <summary>Ver por plataforma</summary>
              <div className="grade g2" style={{ marginTop: 10 }}>{grupos.filter(Boolean).map((pl) => tabela(pl))}</div>
            </details>
          )}
        </>
      )}
    </section>
  );
}

// Painel lateral para gerente, diretoria e administrador
async function Calculos({ form, v, lanc, dia }) {
  const inicio = lanc.captacao_inicio || somarDias(dia, -60);
  if (form === 'gerente') {
    const d = await dashboardMarketing({ desde: inicio, ate: dia, launchIds: [lanc.id] });
    const inc = await q1(`SELECT COUNT(*)::int n FROM automation_incidents WHERE launch_id=$1 AND status <> 'resolvido'`, [lanc.id]);
    return (
      <aside className="grade">
        <h2>Consolidado do lançamento</h2>
        <p className="suave pequeno">Números enviados pela equipe desde {fmtData(inicio)}. Você não precisa redigitar.</p>
        <div className="grade g4">
          <Kpi rotulo="Investimento" valor={moeda(d.totais.investimento, 0)} />
          <Kpi rotulo="Cadastros" valor={numero(d.totais.cadastros)} cor={semaforo(d.totais.cadastros, d.metas.cadastros)} progresso={dividir(d.totais.cadastros, d.metas.cadastros)} />
          <Kpi rotulo="CPL" valor={moeda(d.indicadores.cpl)} cor={semaforo(d.indicadores.cpl, lanc.cpl_max, 'menor')} />
          <Kpi rotulo="Nos grupos" valor={numero(d.totais.grupos)} meta={pct(d.indicadores.entradaWhatsapp)} />
          <Kpi rotulo="Saúde da automação" valor={pct(d.totais.saudeAutomacao)} cor={d.totais.saudeAutomacao === null ? '' : d.totais.saudeAutomacao === 1 ? 'verde' : 'vermelho'} />
          <Kpi rotulo="Incidentes abertos" valor={numero(inc.n)} cor={inc.n ? 'vermelho' : 'verde'} />
        </div>
        {d.funil.gargalo && <Aviso tipo="erro">Maior gargalo pelo planejado: <strong>{d.funil.gargalo.nome}</strong> ({pct(d.funil.gargalo.conversao)} contra {pct(d.funil.gargalo.conversaoMeta)} esperado).</Aviso>}
        <a className="btn sec" href={`/marketing/dashboard?lancamento=${lanc.id}`}>Ver dashboard completo</a>
      </aside>
    );
  }
  if (form === 'whatsapp' && v.id) {
    const [cad, ant] = await Promise.all([
      q1(`SELECT COALESCE(SUM(cadastros),0) cad, COUNT(*)::int n FROM traffic_daily_entries WHERE launch_id=$1`, [lanc.id]),
      q1(`SELECT total_grupos FROM whatsapp_daily_entries WHERE launch_id=$1 AND data_ref < $2 ORDER BY data_ref DESC, updated_at DESC LIMIT 1`, [lanc.id, v.data_ref]),
    ]);
    const c = calcWhatsapp(v, ant?.total_grupos ?? null);
    return (
      <aside className="grade">
        <h2>Calculado pelo sistema</h2>
        <div className="grade g4">
          <Kpi rotulo="Entradas do dia" valor={numero(c.entradasTotais)} meta={`saldo ${numero(c.saldo)}`} />
          <Kpi rotulo="Taxa de entrega da API" valor={pct(c.taxaEntrega)} />
          <Kpi rotulo="Conversão da API" valor={pct(c.conversaoConvites)} />
          <Kpi rotulo="Custo por entrada (API)" valor={moeda(c.custoPorEntradaApi)} />
          <Kpi rotulo="Taxa de saída" valor={pct(c.taxaSaida)} />
          <Kpi rotulo="Crescimento dos grupos" valor={c.crescimento === null ? 'sem dados' : numero(c.crescimento)} />
          <Kpi rotulo="Cadastrados nos grupos" valor={cad.n ? pct(dividir(v.total_grupos, cad.cad)) : 'sem dados'} meta={cad.n ? `${numero(Math.max(cad.cad - v.total_grupos, 0))} ainda fora` : null} />
        </div>
      </aside>
    );
  }
  if (form === 'live' && v.id) {
    const cad = await q1(`SELECT COALESCE(SUM(cadastros),0) cad, COUNT(*)::int n FROM traffic_daily_entries WHERE launch_id=$1`, [lanc.id]);
    const c = calcLive(v, cad.n ? Number(cad.cad) : null);
    return (
      <aside className="grade">
        <h2>Calculado pelo sistema</h2>
        <div className="grade g4">
          <Kpi rotulo="Taxa de presença" valor={pct(c.presenca)} />
          <Kpi rotulo="Retenção até o pitch" valor={pct(c.retencaoPitch)} />
          <Kpi rotulo="Taxa de clique" valor={pct(c.taxaClique)} />
          <Kpi rotulo="Conversão para lista" valor={pct(c.conversaoLista)} />
          <Kpi rotulo="Pitch para lista" valor={pct(c.conversaoPitchLista)} />
          <Kpi rotulo="Início de checkout" valor={pct(c.conversaoCheckout)} />
        </div>
      </aside>
    );
  }
  if (form === 'automacao') {
    const abertos = await q(`SELECT * FROM automation_incidents WHERE launch_id=$1 AND status <> 'resolvido' ORDER BY id DESC`, [lanc.id]);
    return (
      <aside className="painel">
        <div className="painel-cab"><h2>Incidentes abertos</h2><a className="pequeno" href="/acoes">Gerenciar</a></div>
        {abertos.length === 0 ? <p className="suave">Nenhum incidente aberto neste lançamento.</p> : (
          <table><tbody>{abertos.map((i) => (
            <tr key={i.id}>
              <td><Semaforo cor={['alta', 'critica'].includes(i.prioridade) ? 'vermelho' : 'amarelo'} texto={PRIORIDADES[i.prioridade]} /></td>
              <td>{i.descricao}<br /><span className="suave pequeno">{rotuloEtapa(i.etapa)} · {i.status === 'em_andamento' ? 'em andamento' : 'aberto'}</span></td>
            </tr>
          ))}</tbody></table>
        )}
      </aside>
    );
  }
  return <div />;
}
