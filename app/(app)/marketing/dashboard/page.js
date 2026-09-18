import { exigirUsuario } from '@/lib/auth.js';
import { q } from '@/lib/db.js';
import { hoje, somarDias, fmtData } from '@/lib/datas.js';
import { moeda, numero, pct, multiplo } from '@/lib/formato.js';
import { dividir, semaforo, variacao } from '@/lib/calc.js';
import { STATUS_LANCAMENTO, GARGALOS } from '@/lib/formularios.js';
import { veDashboardSetor } from '@/lib/perm.js';
import { dashboardMarketing, lancamentosVisiveis, responsaveisMarketing, pendenciasEquipe, problemasAbertos } from '@/lib/dados.js';
import { Topo, Aviso, Kpi, Semaforo, Vazio, StatusTarefa } from '@/components/Ui.js';
import Serie from '@/components/Serie.js';
import { Users, Radio, Settings2, ArrowDownUp, DollarSign } from 'lucide-react';

export const dynamic = 'force-dynamic';
const PERIODOS = [7, 15, 30, 60, 90];
const ORDEM = { vermelho: 3, amarelo: 2, verde: 1, neutro: 0 };
const pior = (...c) => c.sort((a, b) => ORDEM[b] - ORDEM[a])[0];
const corQuebra = (v) => (v === null ? '' : v <= 0.3 ? 'verde' : v <= 0.5 ? 'amarelo' : 'vermelho');

function Bloco({ icone: I, titulo, descricao, children }) {
  return (
    <section className="secao">
      <div className="bloco-cab">
        <span className="icone-card" aria-hidden="true"><I /></span>
        <div><h2>{titulo}</h2>{descricao && <p className="suave pequeno">{descricao}</p>}</div>
      </div>
      <div className="grade g4">{children}</div>
    </section>
  );
}

export default async function DashboardMarketing(props) {
  const sp = await props.searchParams;
  const u = await exigirUsuario();
  if (!veDashboardSetor(u, 'marketing')) return <><Topo titulo="Dashboard do Marketing" /><Aviso tipo="erro">Este dashboard é restrito à gerência de Marketing e à Diretoria.</Aviso></>;
  const dia = hoje();
  const dias = PERIODOS.includes(Number(sp.dias)) ? Number(sp.dias) : 30;
  const desde = /^\d{4}-\d{2}-\d{2}$/.test(sp.desde || '') ? sp.desde : somarDias(dia, -(dias - 1));
  const ate = /^\d{4}-\d{2}-\d{2}$/.test(sp.ate || '') ? sp.ate : dia;

  const [todos, produtos, responsaveis] = await Promise.all([lancamentosVisiveis(u), q('SELECT id, nome FROM products WHERE ativo ORDER BY nome'), responsaveisMarketing()]);
  const fLanc = Number(sp.lancamento) || null;
  const fProd = Number(sp.produto) || null;
  const fResp = Number(sp.responsavel) || null;
  const filtrados = todos.filter((l) => (!fLanc || l.id === fLanc) && (!fProd || l.product_id === fProd));
  const ids = filtrados.map((l) => l.id);

  const d = await dashboardMarketing({ desde, ate, launchIds: ids, responsavelId: fResp });
  const [pend, prob] = await Promise.all([pendenciasEquipe(dia), problemasAbertos(u)]);
  const pendHoje = pend.filter((p) => ids.includes(p.lancamento.id));
  const feitos = pendHoje.filter((p) => p.concluido).length;
  const acoes = prob.acoes.filter((a) => !a.launch_id || ids.includes(a.launch_id));
  const incidentes = prob.incidentes.filter((i) => ids.includes(i.launch_id));

  const { totais: t, metas: m, indicadores: ind, funil } = d;
  const varInvest = variacao(t.investimentoDia, t.investimentoOntem);
  const qs = new URLSearchParams({ desde, ate, ...(fLanc && { lancamento: fLanc }), ...(fProd && { produto: fProd }), ...(fResp && { responsavel: fResp }) }).toString();
  const maxFunil = Math.max(...funil.etapas.map((e) => e.valor || 0), 1);
  const temVendas = t.vendas !== null;
  const gargalosGer = d.gerentes.filter((g) => g.gargalo && g.gargalo !== 'nenhum');

  return (
    <>
      <Topo titulo="Dashboard do Marketing" descricao={`${fmtData(desde)} a ${fmtData(ate)} · ${filtrados.length} ${filtrados.length === 1 ? 'lançamento' : 'lançamentos'} · ${feitos} de ${pendHoje.length} formulários de hoje enviados`}>
        <a className="btn sec" href={`/api/exportar/marketing?${qs}`}>Exportar CSV</a>
      </Topo>

      <form className="filtros" method="get">
        <div className="campo"><label htmlFor="f-dias">Período</label>
          <select id="f-dias" name="dias" defaultValue={sp.desde ? '' : dias}>{PERIODOS.map((p) => <option key={p} value={p}>Últimos {p} dias</option>)}</select>
        </div>
        <div className="campo"><label htmlFor="f-l">Lançamento</label>
          <select id="f-l" name="lancamento" defaultValue={fLanc || ''}><option value="">Todos</option>{todos.map((l) => <option key={l.id} value={l.id}>{l.nome}</option>)}</select>
        </div>
        <div className="campo"><label htmlFor="f-p">Produto</label>
          <select id="f-p" name="produto" defaultValue={fProd || ''}><option value="">Todos</option>{produtos.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}</select>
        </div>
        <div className="campo"><label htmlFor="f-r">Responsável</label>
          <select id="f-r" name="responsavel" defaultValue={fResp || ''}><option value="">Todos</option>{responsaveis.map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}</select>
        </div>
        <button className="btn peq" type="submit">Aplicar</button>
      </form>

      <section className="painel">
        <div className="painel-cab">
          <div><h2>Funil de captação</h2><p>Visitas → cadastros → grupos → live → lista de reserva{temVendas ? ' → vendas' : ''}. O gargalo é a passagem mais abaixo do planejado.</p></div>
          {funil.gargalo ? <Semaforo cor="vermelho" texto={`Gargalo: ${funil.gargalo.nome}`} /> : <Semaforo cor="neutro" texto="Sem gargalo pelas metas" />}
        </div>
        <div className="funil">
          {funil.etapas.map((e, i) => (
            <div key={e.chave}>
              {i > 0 && (
                <div className={`funil-passagem ${e.gargalo ? 'gargalo' : ''}`}>
                  <span /><span className="taxa">{pct(e.conversao)} passaram{e.conversaoMeta ? ` · planejado ${pct(e.conversaoMeta)}` : ''}{e.gargalo ? ' · maior gargalo' : ''}</span><span />
                </div>
              )}
              <div className={`funil-etapa ${e.gargalo ? 'gargalo' : ''}`}>
                <div className="funil-nome">{e.nome}</div>
                <div className="funil-barra"><span className="preench" style={{ width: `${e.valor ? Math.max((e.valor / maxFunil) * 100, 0.8) : 0}%` }} /><b>{numero(e.valor)}</b></div>
                <div className="funil-meta">{e.meta ? `meta ${numero(e.meta)} · ${pct(dividir(e.valor, e.meta))}` : 'sem meta'}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <Bloco icone={DollarSign} titulo="Investimento e tráfego" descricao="Somado no período, exceto os números do dia.">
        <Kpi rotulo="Investimento no período" valor={moeda(t.investimento, 0)} progresso={dividir(t.investimento, m.orcamento)} meta={m.orcamento ? `orçamento total ${moeda(m.orcamento, 0)}` : null} />
        <Kpi rotulo="% do orçamento diário utilizado" valor={pct(ind.usoOrcamento)} cor={ind.usoOrcamento === null ? '' : ind.usoOrcamento > 1.1 ? 'vermelho' : ind.usoOrcamento < 0.8 ? 'amarelo' : 'verde'} meta={`previsto ${moeda(t.orcamentoPrevisto, 0)}`} />
        <Kpi rotulo={`Investimento em ${fmtData(ate).slice(0, 5)}`} valor={moeda(t.investimentoDia, 0)} meta={`orçamento do dia ${moeda(t.orcamentoDia, 0)}`} />
        <Kpi rotulo="Investimento do dia anterior" valor={moeda(t.investimentoOntem, 0)} meta={varInvest === null ? 'variação: sem dados' : `variação ${varInvest > 0 ? '+' : ''}${pct(varInvest)}`} />
        <Kpi rotulo="Impressões" valor={numero(t.impressoes)} />
        <Kpi rotulo="Cliques no link" valor={numero(t.cliques)} />
        <Kpi rotulo="CTR" valor={pct(ind.ctr)} />
        <Kpi rotulo="CPC" valor={moeda(ind.cpc)} />
        <Kpi rotulo="Visitas" valor={numero(t.visitas)} meta={`carregamento médio ${numero(t.tempoCarregamento, 1)}s`} />
        <Kpi rotulo="Cadastros" valor={numero(t.cadastros)} cor={semaforo(t.cadastros, m.cadastros)} progresso={dividir(t.cadastros, m.cadastros)} meta={m.cadastros ? `meta ${numero(m.cadastros)} · ${pct(dividir(t.cadastros, m.cadastros))}` : null} />
        <Kpi rotulo="CPL" valor={moeda(ind.cpl)} cor={semaforo(ind.cpl, m.cplMax, 'menor')} meta={m.cplMax ? `máximo ${moeda(m.cplMax)}` : null} />
        <Kpi rotulo="Conversão da página" valor={pct(ind.conversaoPagina)} />
      </Bloco>

      <Bloco icone={ArrowDownUp} titulo="Do clique ao grupo" descricao="Onde as pessoas se perdem entre o anúncio, a página, o cadastro e o WhatsApp.">
        <Kpi rotulo="Taxa de carregamento da página" valor={pct(ind.taxaCarregamento)} meta="visitas ÷ cliques" />
        <Kpi rotulo="Quebra clique → página" valor={pct(ind.quebraCliquePagina)} cor={corQuebra(ind.quebraCliquePagina)} />
        <Kpi rotulo="Quebra página → cadastro" valor={pct(ind.quebraPaginaCadastro)} />
        <Kpi rotulo="Conversão cadastro → grupo" valor={pct(ind.conversaoCadastroGrupo)} meta="entradas pela página ÷ cadastros" />
        <Kpi rotulo="Quebra cadastro → grupo" valor={pct(ind.quebraCadastroGrupo)} cor={corQuebra(ind.quebraCadastroGrupo)} />
        <Kpi rotulo="Conversão página → grupo" valor={pct(ind.conversaoPaginaGrupo)} />
        <Kpi rotulo="Quebra página → grupo" valor={pct(ind.quebraPaginaGrupo)} />
      </Bloco>

      <Bloco icone={Users} titulo="WhatsApp e grupos">
        <Kpi rotulo="Pessoas nos grupos" valor={numero(t.grupos)} cor={semaforo(t.grupos, m.grupos)} progresso={dividir(t.grupos, m.grupos)} meta={m.grupos ? `meta ${numero(m.grupos)}` : null} />
        <Kpi rotulo="Grupos ativos" valor={numero(t.gruposAtivos)} />
        <Kpi rotulo="Cadastrados nos grupos" valor={pct(ind.entradaWhatsapp)} meta={ind.naoEntraramWhatsapp != null ? `${numero(ind.naoEntraramWhatsapp)} ainda fora` : null} />
        <Kpi rotulo="Convites enviados / entregues" valor={`${numero(t.convites)} / ${numero(t.convitesEntregues)}`} meta={`taxa de entrega ${pct(ind.taxaEntrega)}`} />
        <Kpi rotulo="Entradas por API" valor={numero(t.entradasApi)} meta={`conversão da API ${pct(ind.conversaoApi)}`} />
        <Kpi rotulo="Entradas pela página" valor={numero(t.entradasPagina)} />
        <Kpi rotulo="Entradas orgânicas" valor={numero(t.entradasOrganico)} />
        <Kpi rotulo="Saídas / saldo" valor={`${numero(t.saidas)} / ${numero(t.saldoGrupos)}`} cor={t.saldoGrupos === null ? '' : t.saldoGrupos >= 0 ? 'verde' : 'vermelho'} meta={`custo dos disparos ${moeda(t.custoDisparos, 0)}`} />
      </Bloco>

      <Bloco icone={Radio} titulo="Live e lista de reserva">
        <Kpi rotulo="Pessoas únicas na live" valor={numero(t.live)} cor={semaforo(t.live, m.live)} progresso={dividir(t.live, m.live)} meta={`comparecimento ${pct(ind.comparecimentoLive)}`} />
        <Kpi rotulo="Presentes no pitch" valor={numero(t.pitch)} meta={`retenção ${pct(ind.retencaoPitch)}`} />
        <Kpi rotulo="Cliques na oferta" valor={numero(t.cliquesOferta)} />
        <Kpi rotulo="Lista de reserva" valor={numero(t.lista)} cor={semaforo(t.lista, m.lista)} progresso={dividir(t.lista, m.lista)} meta={`conversão ${pct(ind.conversaoLista)} · do pitch ${pct(ind.conversaoPitchLista)}`} />
        <Kpi rotulo="Checkouts iniciados" valor={numero(t.checkouts)} meta={`${pct(ind.conversaoCheckout)} dos participantes`} />
      </Bloco>

      {temVendas && (
        <Bloco icone={DollarSign} titulo="Vendas" descricao="Lançadas por perfil autorizado.">
          <Kpi rotulo="Vendas" valor={numero(t.vendas)} cor={semaforo(t.vendas, m.vendas)} progresso={dividir(t.vendas, m.vendas)} meta={`conversão da lista ${pct(ind.conversaoVendas)}`} />
          <Kpi rotulo="Faturamento" valor={moeda(t.faturamento, 0)} cor={semaforo(t.faturamento, m.faturamento)} progresso={dividir(t.faturamento, m.faturamento)} />
          <Kpi rotulo="CAC" valor={moeda(ind.cac)} cor={semaforo(ind.cac, m.cacMax, 'menor')} />
          <Kpi rotulo="ROAS" valor={multiplo(ind.roas)} cor={semaforo(ind.roas, m.roasMin)} />
        </Bloco>
      )}

      <Bloco icone={Settings2} titulo="Operação">
        <Kpi rotulo="Saúde da automação" valor={pct(t.saudeAutomacao)} cor={t.saudeAutomacao === null ? '' : t.saudeAutomacao === 1 ? 'verde' : t.saudeAutomacao >= 0.8 ? 'amarelo' : 'vermelho'} meta="etapas funcionando ÷ 9" />
        <Kpi rotulo="Incidentes abertos" valor={numero(incidentes.length)} cor={incidentes.length ? 'vermelho' : 'verde'} />
        <Kpi rotulo="Entregas de vídeo e criativos" valor={`${numero(t.entregasConcluidas)} / ${numero(t.entregasPlanejadas)}`} progresso={ind.conclusaoEntregas} meta={`${pct(ind.conclusaoEntregas)} concluído · ${numero(t.entregasAtrasadas)} atrasadas`} />
        <Kpi rotulo="Formulários de hoje" valor={`${feitos} / ${pendHoje.length}`} cor={!pendHoje.length ? '' : feitos === pendHoje.length ? 'verde' : feitos >= pendHoje.length / 2 ? 'amarelo' : 'vermelho'} progresso={dividir(feitos, pendHoje.length)} />
      </Bloco>

      <section className="secao">
        <h2>Evolução diária</h2>
        <div className="grade g3">
          <Serie titulo="Investimento" pontos={d.serie.map((p) => ({ data: p.data, v: p.investimento }))} formato={(v) => moeda(v, 0)} cor="#ffb627" barras />
          <Serie titulo="Cadastros" pontos={d.serie.map((p) => ({ data: p.data, v: p.cadastros }))} formato={(v) => numero(v)} cor="var(--laranja)" barras />
          <Serie titulo="CPL" pontos={d.serie.map((p) => ({ data: p.data, v: p.cpl }))} formato={(v) => moeda(v)} cor="#ff8a3d" />
        </div>
      </section>

      <section className="secao painel">
        <div className="painel-cab"><h2>Lançamentos: meta versus realizado</h2></div>
        {d.porLancamento.length === 0 ? <Vazio>Nenhum lançamento no filtro.</Vazio> : (
          <div className="tabela-wrap"><table>
            <thead><tr><th>Lançamento</th><th>Fase</th><th className="num">Investido</th><th className="num">Cadastros</th><th className="num">Meta</th><th className="num">CPL</th><th>Semáforo</th><th>Situação gerencial</th></tr></thead>
            <tbody>{d.porLancamento.map((l) => {
              const cpl = dividir(l.gasto, l.cadastros);
              return (
                <tr key={l.id}>
                  <td><a href={`?${new URLSearchParams({ desde, ate, lancamento: l.id })}`}>{l.nome}</a></td>
                  <td>{STATUS_LANCAMENTO[l.status]}</td>
                  <td className="num">{moeda(l.gasto, 0)}</td>
                  <td className="num">{numero(l.cadastros)}</td>
                  <td className="num">{l.meta_cadastros ? pct(dividir(l.cadastros, l.meta_cadastros)) : '—'}</td>
                  <td className="num">{moeda(cpl)}</td>
                  <td><Semaforo cor={pior(semaforo(Number(l.cadastros), l.meta_cadastros), semaforo(cpl, l.cpl_max, 'menor'))} /></td>
                  <td>{l.situacao ? <Semaforo cor={l.situacao} texto={`${l.situacao[0].toUpperCase()}${l.situacao.slice(1)} · ${fmtData(l.situacao_data).slice(0, 5)}`} /> : <span className="suave">sem fechamento</span>}</td>
                </tr>
              );
            })}</tbody>
          </table></div>
        )}
      </section>

      <section className="secao grade g2">
        <div className="painel">
          <div className="painel-cab"><h2>Gargalos e ações</h2><a className="pequeno" href="/acoes">Gerenciar</a></div>
          {gargalosGer.length + acoes.length + incidentes.length === 0 ? <p className="suave">Nenhum gargalo ou ação em aberto.</p> : (
            <table><tbody>
              {gargalosGer.map((g) => (
                <tr key={`g${g.id}`}><td><Semaforo cor={g.situacao} texto="Gerente" /></td><td>Gargalo: <b>{GARGALOS[g.gargalo] || g.gargalo}</b><br /><span className="suave pequeno">{g.lancamento} · {g.acao}</span></td></tr>
              ))}
              {incidentes.map((i) => (
                <tr key={`i${i.id}`}><td><Semaforo cor={['alta', 'critica'].includes(i.prioridade) ? 'vermelho' : 'amarelo'} texto="Incidente" /></td><td>{i.descricao}<br /><span className="suave pequeno">{i.lancamento} · {i.status === 'em_andamento' ? 'em andamento' : 'aberto'} · {i.responsavel || 'sem responsável'}</span></td></tr>
              ))}
              {acoes.map((a) => (
                <tr key={`a${a.id}`}><td><span className={`selo ${a.prazo && a.prazo < dia ? 'vermelho' : 'laranja'}`}>{a.prazo && a.prazo < dia ? 'Vencida' : 'Ação'}</span></td><td>{a.acao}<br /><span className="suave pequeno">{a.responsavel || 'sem responsável'} · prazo {fmtData(a.prazo)} · {a.lancamento || 'geral'}</span></td></tr>
              ))}
            </tbody></table>
          )}
        </div>
        <div className="painel">
          <div className="painel-cab"><h2>Formulários de hoje</h2><span className="pequeno suave">{feitos} de {pendHoje.length} concluídos</span></div>
          {pendHoje.length === 0 ? <p className="suave">Nenhum formulário previsto hoje.</p> : (
            <table><tbody>{pendHoje.sort((a, b) => a.concluido - b.concluido).map((p) => (
              <tr key={`${p.usuarioId}-${p.form}-${p.lancamento.id}`}><td>{p.usuario}<br /><span className="suave pequeno">{p.titulo} · {p.lancamento.nome}{p.detalhe ? ` · ${p.detalhe}` : ''}</span></td><td><StatusTarefa concluido={p.concluido} /></td></tr>
            ))}</tbody></table>
          )}
        </div>
      </section>
    </>
  );
}
