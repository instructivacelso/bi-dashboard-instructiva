import { exigirUsuario } from '@/lib/auth.js';
import { q } from '@/lib/db.js';
import { hoje, somarDias, fmtData } from '@/lib/datas.js';
import { moeda, numero, pct, multiplo } from '@/lib/formato.js';
import { dividir, semaforo } from '@/lib/calc.js';
import { STATUS_LANCAMENTO } from '@/lib/formularios.js';
import { veDashboardSetor } from '@/lib/perm.js';
import { dashboardMarketing, lancamentosVisiveis, responsaveisMarketing, pendenciasEquipe, problemasAbertos } from '@/lib/dados.js';
import { Topo, Aviso, Kpi, Semaforo, Vazio, StatusTarefa } from '@/components/Ui.js';
import Serie from '@/components/Serie.js';

export const dynamic = 'force-dynamic';

const PERIODOS = [7, 15, 30, 60, 90];

export default async function DashboardMarketing({ searchParams }) {
  const u = await exigirUsuario();
  if (!veDashboardSetor(u, 'marketing')) {
    return <><Topo titulo="Dashboard do Marketing" /><Aviso tipo="erro">Este dashboard é restrito à gerência de Marketing e à Diretoria.</Aviso></>;
  }
  const dia = hoje();
  const dias = PERIODOS.includes(Number(searchParams.dias)) ? Number(searchParams.dias) : 30;
  const desde = /^\d{4}-\d{2}-\d{2}$/.test(searchParams.desde || '') ? searchParams.desde : somarDias(dia, -(dias - 1));
  const ate = /^\d{4}-\d{2}-\d{2}$/.test(searchParams.ate || '') ? searchParams.ate : dia;

  const [todos, produtos, responsaveis] = await Promise.all([
    lancamentosVisiveis(u),
    q('SELECT id, nome FROM products WHERE ativo ORDER BY nome'),
    responsaveisMarketing(),
  ]);
  const fLanc = Number(searchParams.lancamento) || null;
  const fProd = Number(searchParams.produto) || null;
  const fResp = Number(searchParams.responsavel) || null;
  const filtrados = todos.filter((l) => (!fLanc || l.id === fLanc) && (!fProd || l.product_id === fProd));
  const ids = filtrados.map((l) => l.id);

  const d = await dashboardMarketing({ desde, ate, launchIds: ids, responsavelId: fResp });
  const [pend, prob] = await Promise.all([pendenciasEquipe(dia), problemasAbertos(u)]);
  const pendHoje = pend.filter((p) => ids.includes(p.lancamento.id));
  const acoes = prob.acoes.filter((a) => !a.launch_id || ids.includes(a.launch_id));
  const incidentes = prob.incidentes.filter((i) => ids.includes(i.launch_id));

  const { totais: t, metas: m, indicadores: ind, funil } = d;
  const unico = filtrados.length === 1 ? filtrados[0] : null;
  const qs = new URLSearchParams({ desde, ate, ...(fLanc && { lancamento: fLanc }), ...(fProd && { produto: fProd }), ...(fResp && { responsavel: fResp }) }).toString();
  const maxFunil = Math.max(...funil.etapas.map((e) => e.valor || 0), 1);

  return (
    <>
      <Topo titulo="Dashboard do Marketing" descricao={`${fmtData(desde)} a ${fmtData(ate)} · ${filtrados.length} ${filtrados.length === 1 ? 'lançamento' : 'lançamentos'}`}>
        <a className="btn sec" href={`/api/exportar/marketing?${qs}`}>Exportar CSV</a>
      </Topo>

      <form className="filtros" method="get">
        <div className="campo"><label htmlFor="f-dias">Período</label>
          <select id="f-dias" name="dias" defaultValue={searchParams.desde ? '' : dias}>
            {PERIODOS.map((p) => <option key={p} value={p}>Últimos {p} dias</option>)}
          </select>
        </div>
        <div className="campo"><label htmlFor="f-l">Lançamento</label>
          <select id="f-l" name="lancamento" defaultValue={fLanc || ''}>
            <option value="">Todos</option>
            {todos.map((l) => <option key={l.id} value={l.id}>{l.nome}</option>)}
          </select>
        </div>
        <div className="campo"><label htmlFor="f-p">Produto</label>
          <select id="f-p" name="produto" defaultValue={fProd || ''}>
            <option value="">Todos</option>
            {produtos.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
          </select>
        </div>
        <div className="campo"><label htmlFor="f-r">Responsável</label>
          <select id="f-r" name="responsavel" defaultValue={fResp || ''}>
            <option value="">Todos</option>
            {responsaveis.map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}
          </select>
        </div>
        <button className="btn peq" type="submit">Aplicar</button>
      </form>

      {fResp && <Aviso>Filtro por responsável aplicado aos formulários. Vendas e faturamento não dependem de responsável.</Aviso>}

      <section className="grade g4">
        <Kpi rotulo="Investimento" valor={moeda(t.investimento, 0)} meta={m.orcamento ? `orçamento ${moeda(m.orcamento, 0)} · ${pct(dividir(t.investimento, m.orcamento))}` : null}
          cor={m.orcamento ? semaforo(t.investimento, m.orcamento, 'menor') : ''} />
        <Kpi rotulo="Visitas na página" valor={numero(t.visitas)} />
        <Kpi rotulo="Cadastros" valor={numero(t.cadastros)} cor={semaforo(t.cadastros, m.cadastros)} meta={m.cadastros ? `meta ${numero(m.cadastros)} · ${pct(dividir(t.cadastros, m.cadastros))}` : null} />
        <Kpi rotulo="CPL" valor={moeda(ind.cpl)} cor={semaforo(ind.cpl, m.cplMax, 'menor')} meta={m.cplMax ? `máximo ${moeda(m.cplMax)}` : null} />
        <Kpi rotulo="Conversão da página" valor={pct(ind.conversaoPagina)} />
        <Kpi rotulo="Pessoas nos grupos" valor={numero(t.grupos)} cor={semaforo(t.grupos, m.grupos)} meta={m.grupos ? `meta ${numero(m.grupos)}` : null} />
        <Kpi rotulo="Cadastrados nos grupos" valor={pct(ind.entradaWhatsapp)} meta={ind.naoEntraramWhatsapp != null ? `${numero(ind.naoEntraramWhatsapp)} ainda fora` : null} />
        <Kpi rotulo="Pessoas únicas na live" valor={numero(t.live)} cor={semaforo(t.live, m.live)} meta={m.live ? `meta ${numero(m.live)}` : null} />
        <Kpi rotulo="Lista de reserva" valor={numero(t.lista)} cor={semaforo(t.lista, m.lista)} meta={m.lista ? `meta ${numero(m.lista)}` : null} />
        <Kpi rotulo="Vendas" valor={numero(t.vendas)} cor={semaforo(t.vendas, m.vendas)} meta={m.vendas ? `meta ${numero(m.vendas)}` : null} />
        <Kpi rotulo="Faturamento" valor={moeda(t.faturamento, 0)} cor={semaforo(t.faturamento, m.faturamento)} meta={m.faturamento ? `meta ${moeda(m.faturamento, 0)}` : null} />
        <Kpi rotulo="CAC" valor={moeda(ind.cac)} cor={semaforo(ind.cac, m.cacMax, 'menor')} meta={m.cacMax ? `máximo ${moeda(m.cacMax)}` : null} />
        <Kpi rotulo="ROAS" valor={multiplo(ind.roas)} cor={semaforo(ind.roas, m.roasMin)} meta={m.roasMin ? `mínimo ${multiplo(m.roasMin)}` : null} />
      </section>

      <section className="secao painel">
        <div className="painel-cab">
          <h2>Funil do lançamento</h2>
          <p>Investimento de {moeda(t.investimento, 0)} até {moeda(t.faturamento, 0)} de faturamento. O gargalo é a passagem mais abaixo do planejado nas metas.</p>
        </div>
        <div className="funil">
          {funil.etapas.map((e, i) => (
            <div key={e.chave}>
              {i > 0 && (
                <div className={`funil-passagem ${e.gargalo ? 'gargalo' : ''}`}>
                  <span />
                  <span className="taxa">
                    {pct(e.conversao)} passaram{e.conversaoMeta ? ` · planejado ${pct(e.conversaoMeta)}` : ''}{e.gargalo ? ' · maior gargalo' : ''}
                  </span>
                  <span />
                </div>
              )}
              <div className={`funil-etapa ${e.gargalo ? 'gargalo' : ''}`}>
                <div className="funil-nome">{e.nome}</div>
                <div className="funil-barra">
                  <span className="preench" style={{ width: `${e.valor ? Math.max((e.valor / maxFunil) * 100, 0.8) : 0}%` }} />
                  <b>{numero(e.valor)}</b>
                </div>
                <div className="funil-meta">{e.meta ? `meta ${numero(e.meta)} · ${pct(dividir(e.valor, e.meta))}` : 'sem meta'}</div>
              </div>
            </div>
          ))}
        </div>
        {!funil.gargalo && <p className="suave pequeno" style={{ marginTop: 10 }}>Nenhuma passagem abaixo do planejado, ou faltam metas cadastradas no lançamento para comparar.</p>}
        <div className="grade g4" style={{ marginTop: 16 }}>
          <Kpi rotulo="Comparecimento à live" valor={pct(ind.comparecimentoLive)} />
          <Kpi rotulo="Conversão para lista" valor={pct(ind.conversaoLista)} />
          <Kpi rotulo="Conversão em vendas" valor={pct(ind.conversaoVendas)} />
          <Kpi rotulo="Conversão geral" valor={pct(ind.conversaoGeral)} />
        </div>
      </section>

      <section className="secao">
        <h2>Evolução diária</h2>
        <div className="grade g3">
          <Serie titulo="Investimento" pontos={d.serie.map((p) => ({ data: p.data, v: p.investimento }))} formato={(v) => moeda(v, 0)} barras />
          <Serie titulo="Cadastros" pontos={d.serie.map((p) => ({ data: p.data, v: p.cadastros }))} formato={(v) => numero(v)} cor="var(--laranja)" barras />
          <Serie titulo="CPL" pontos={d.serie.map((p) => ({ data: p.data, v: p.cpl }))} formato={(v) => moeda(v)} cor="var(--grafite)" />
        </div>
      </section>

      <section className="secao painel">
        <div className="painel-cab"><h2>Lançamentos: meta versus realizado</h2></div>
        {d.porLancamento.length === 0 ? <Vazio>Nenhum lançamento no filtro.</Vazio> : (
          <div className="tabela-wrap"><table>
            <thead><tr><th>Lançamento</th><th>Fase</th><th className="num">Investido</th><th className="num">Cadastros</th><th className="num">Meta</th><th className="num">CPL</th><th>Semáforo</th><th>Gerente</th></tr></thead>
            <tbody>
              {d.porLancamento.map((l) => {
                const cpl = dividir(l.gasto, l.cadastros);
                const corCad = semaforo(Number(l.cadastros), l.meta_cadastros);
                const corCpl = semaforo(cpl, l.cpl_max, 'menor');
                const ordem = { vermelho: 3, amarelo: 2, verde: 1, neutro: 0 };
                const pior = [corCad, corCpl].sort((a, b) => ordem[b] - ordem[a])[0];
                return (
                  <tr key={l.id}>
                    <td><a href={`?${new URLSearchParams({ desde, ate, lancamento: l.id })}`}>{l.nome}</a></td>
                    <td>{STATUS_LANCAMENTO[l.status]}</td>
                    <td className="num">{moeda(l.gasto, 0)}</td>
                    <td className="num">{numero(l.cadastros)}</td>
                    <td className="num">{l.meta_cadastros ? pct(dividir(l.cadastros, l.meta_cadastros)) : '—'}</td>
                    <td className="num">{moeda(cpl)}</td>
                    <td><Semaforo cor={pior} /></td>
                    <td>{l.situacao ? <Semaforo cor={l.situacao} texto={`${l.situacao[0].toUpperCase()}${l.situacao.slice(1)} · ${fmtData(l.situacao_data).slice(0, 5)}`} /> : <span className="suave">sem fechamento</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table></div>
        )}
      </section>

      <section className="secao grade g2">
        <div className="painel">
          <div className="painel-cab"><h2>Gargalos e ações</h2><a className="pequeno" href="/acoes">Gerenciar</a></div>
          {d.fechamentos.length + acoes.length + incidentes.length === 0 ? <p className="suave">Nenhum gargalo ou ação em aberto.</p> : (
            <table><tbody>
              {incidentes.map((i) => (
                <tr key={`i${i.id}`}><td><Semaforo cor={['alta', 'critica'].includes(i.prioridade) ? 'vermelho' : 'amarelo'} texto="Incidente" /></td>
                  <td>{i.descricao}<br /><span className="suave pequeno">{i.lancamento} · aberto por {i.autor}</span></td></tr>
              ))}
              {acoes.map((a) => (
                <tr key={`a${a.id}`}><td><span className="selo laranja">Ação</span></td>
                  <td>{a.acao}{a.gargalo && <><br /><span className="pequeno">Gargalo: {a.gargalo}</span></>}<br /><span className="suave pequeno">{a.responsavel || 'sem responsável'} · prazo {fmtData(a.prazo)} · {a.lancamento || 'geral'}</span></td></tr>
              ))}
            </tbody></table>
          )}
        </div>
        <div className="painel">
          <div className="painel-cab"><h2>Formulários de hoje</h2><span className="pequeno suave">{pendHoje.filter((p) => p.concluido).length} de {pendHoje.length} concluídos</span></div>
          {pendHoje.length === 0 ? <p className="suave">Nenhum formulário previsto hoje.</p> : (
            <table><tbody>
              {pendHoje.sort((a, b) => a.concluido - b.concluido).map((p) => (
                <tr key={`${p.usuarioId}-${p.form}-${p.lancamento.id}`}>
                  <td>{p.usuario}<br /><span className="suave pequeno">{p.titulo} · {p.lancamento.nome}</span></td>
                  <td><StatusTarefa concluido={p.concluido} /></td>
                </tr>
              ))}
            </tbody></table>
          )}
        </div>
      </section>
      {!unico && <p className="suave pequeno" style={{ marginTop: 16 }}>Metas de CPL, CAC e ROAS aparecem quando um único lançamento está filtrado.</p>}
    </>
  );
}
