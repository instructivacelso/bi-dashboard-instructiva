import { exigirUsuario } from '@/lib/auth.js';
import { q } from '@/lib/db.js';
import { hoje, somarDias, fmtData } from '@/lib/datas.js';
import { moeda, numero, pct } from '@/lib/formato.js';
import { dividir, semaforo } from '@/lib/calc.js';
import { CIDADES, FUNIS, PAGAMENTOS, STATUS_VENDA, cidadesVisiveis, cidadeDoVendedor, ehDiretorComercial, projecaoMensal } from '@/lib/comercial.js';
import { painelComercial, pendenciasComercial, faturamentoPeriodos } from '@/lib/dadosComercial.js';
import { Topo, Aviso, Kpi, Semaforo, Vazio } from '@/components/Ui.js';
import Serie from '@/components/Serie.js';
import { atualizarStatusVenda } from '../actions.js';

export const dynamic = 'force-dynamic';
const PERIODOS = { hoje: 'Hoje', 7: 'Últimos 7 dias', 30: 'Últimos 30 dias', mes: 'Este mês' };

export default async function DashboardComercial(props) {
  const sp = await props.searchParams;
  const u = await exigirUsuario();
  const gestao = cidadesVisiveis(u);
  const minhaCidade = cidadeDoVendedor(u);
  const soVendedor = gestao.length === 0;
  if (soVendedor && !minhaCidade) return <><Topo titulo="Dashboard comercial" /><Aviso tipo="erro">Seu perfil não tem acesso ao Comercial.</Aviso></>;

  const dia = hoje();
  const per = PERIODOS[sp.periodo] ? sp.periodo : 'mes';
  const desde = per === 'hoje' ? dia : per === 'mes' ? `${dia.slice(0, 8)}01` : somarDias(dia, -(Number(per) - 1));
  const cidades = soVendedor ? [minhaCidade] : (CIDADES[sp.cidade] && gestao.includes(sp.cidade) ? [sp.cidade] : gestao);
  const filtros = {
    vendedorId: soVendedor ? u.id : (Number(sp.vendedor) || null),
    funil: FUNIS[sp.funil] ? sp.funil : null, produto: Number(sp.produto) || null,
    pagamento: PAGAMENTOS[sp.pagamento] ? sp.pagamento : null, status: STATUS_VENDA[sp.status] ? sp.status : null,
  };
  const [p, pend, produtos, periodos] = await Promise.all([
    painelComercial({ cidades, desde, ate: dia, ...filtros }),
    soVendedor ? [] : pendenciasComercial(cidades, dia),
    q('SELECT id, nome FROM products ORDER BY nome'),
    null,
  ]);
  void periodos;
  if (p.vazio) return <><Topo titulo="Dashboard comercial" /><Vazio>Nenhum vendedor cadastrado {cidades.length === 1 ? `em ${CIDADES[cidades[0]]}` : 'nos times'} ainda. Cadastre em Comercial → {cidades.length === 1 ? CIDADES[cidades[0]] : 'Jesuítas/Toledo'} → Equipe.</Vazio></>;
  const ids = p.vendedores.map((v) => v.id);
  const fp = await faturamentoPeriodos(filtros.vendedorId ? [filtros.vendedorId] : ids, dia);
  const metasBase = filtros.vendedorId ? p.vendedores.filter((v) => v.id === filtros.vendedorId) : p.vendedores;
  const sm = (k) => (metasBase.some((v) => v[k]) ? metasBase.reduce((s, v) => s + (Number(v[k]) || 0), 0) : null);
  const meta = { dia: sm('meta_diaria'), semana: sm('meta_semanal'), mes: sm('meta_mensal') };
  const proj = projecaoMensal(fp.mes, dia);
  const t = p.totais;
  const semAtividade = p.linhas.filter((l) => l.diasEnviados === 0 || l.atividade === 0);
  const pipelineBaixa = p.linhas.filter((l) => l.meta_mensal && Number(l.pipeline_valor || 0) < Number(l.meta_mensal) - 0);
  const vendasRecentes = p.vendas.filter((s) => ['boleto_gerado', 'aguardando'].includes(s.status)).slice(-15).reverse();
  const nomeVend = Object.fromEntries(p.vendedores.map((v) => [v.id, v.nome]));

  return (
    <>
      <Topo titulo={soVendedor ? 'Meus resultados' : 'Dashboard comercial'} descricao={`${PERIODOS[per]} · ${cidades.map((c) => CIDADES[c]).join(' e ')}${soVendedor ? '' : ` · ${p.vendedores.length} vendedores`}`}>
        {soVendedor && <a className="btn" href="/comercial/vendedor">Preencher fechamento</a>}
        {ehDiretorComercial(u) && <a className="btn sec" href="/comercial/metas">Metas</a>}
      </Topo>

      <form className="filtros" method="get">
        <div className="campo"><label htmlFor="f-p">Período</label><select id="f-p" name="periodo" defaultValue={per}>{Object.entries(PERIODOS).map(([k, r]) => <option key={k} value={k}>{r}</option>)}</select></div>
        {gestao.length > 1 && <div className="campo"><label htmlFor="f-c">Cidade</label><select id="f-c" name="cidade" defaultValue={sp.cidade || ''}><option value="">Jesuítas e Toledo</option>{gestao.map((c) => <option key={c} value={c}>{CIDADES[c]}</option>)}</select></div>}
        {!soVendedor && <div className="campo"><label htmlFor="f-v">Vendedor</label><select id="f-v" name="vendedor" defaultValue={sp.vendedor || ''}><option value="">Todos</option>{p.vendedores.map((v) => <option key={v.id} value={v.id}>{v.nome}</option>)}</select></div>}
        <div className="campo"><label htmlFor="f-f">Funil</label><select id="f-f" name="funil" defaultValue={sp.funil || ''}><option value="">Todos</option>{Object.entries(FUNIS).map(([k, r]) => <option key={k} value={k}>{r}</option>)}</select></div>
        <div className="campo"><label htmlFor="f-pr">Curso</label><select id="f-pr" name="produto" defaultValue={sp.produto || ''}><option value="">Todos</option>{produtos.map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}</select></div>
        <div className="campo"><label htmlFor="f-pg">Pagamento</label><select id="f-pg" name="pagamento" defaultValue={sp.pagamento || ''}><option value="">Todos</option>{Object.entries(PAGAMENTOS).map(([k, r]) => <option key={k} value={k}>{r}</option>)}</select></div>
        <div className="campo"><label htmlFor="f-s">Status</label><select id="f-s" name="status" defaultValue={sp.status || ''}><option value="">Todos</option>{Object.entries(STATUS_VENDA).map(([k, r]) => <option key={k} value={k}>{r}</option>)}</select></div>
        <button className="btn peq" type="submit">Aplicar</button>
      </form>

      <section className="grade g4">
        <Kpi rotulo="Faturamento hoje" valor={moeda(fp.dia, 0)} cor={semaforo(fp.dia, meta.dia)} progresso={dividir(fp.dia, meta.dia)} meta={meta.dia ? `meta ${moeda(meta.dia, 0)}` : 'meta não definida'} />
        <Kpi rotulo="Faturamento na semana" valor={moeda(fp.semana, 0)} cor={semaforo(fp.semana, meta.semana)} progresso={dividir(fp.semana, meta.semana)} meta={meta.semana ? `meta ${moeda(meta.semana, 0)}` : 'meta não definida'} />
        <Kpi rotulo="Faturamento no mês" valor={moeda(fp.mes, 0)} cor={semaforo(fp.mes, meta.mes)} progresso={dividir(fp.mes, meta.mes)} meta={meta.mes ? `meta ${moeda(meta.mes, 0)} · ${pct(dividir(fp.mes, meta.mes))}` : 'meta não definida'} />
        <Kpi rotulo="Projeção do mês" valor={moeda(proj, 0)} cor={semaforo(proj, meta.mes)} meta="ritmo por dia útil" />
      </section>

      <section className="secao"><h2>No período</h2>
        <div className="grade g4">
          <Kpi rotulo="Vendas" valor={numero(t.qtd)} meta={`ticket médio ${moeda(t.ticketMedio, 0)}`} />
          <Kpi rotulo="Faturamento" valor={moeda(t.total, 0)} meta={`aprovado ${moeda(t.aprovado, 0)} · recebido ${moeda(t.recebido, 0)}`} />
          <Kpi rotulo="Leads recebidos" valor={numero(t.leads)} meta={`conversão ${pct(t.conversao)}`} />
          <Kpi rotulo="Cartão / PIX / Boleto" valor={`${pct(t.pctCartao)} · ${pct(t.pctPix)} · ${pct(t.pctBoleto)}`} meta={`${moeda(t.cartao, 0)} · ${moeda(t.pix, 0)} · ${moeda(t.boleto, 0)}`} />
          <Kpi rotulo="Pipeline" valor={moeda(t.pipeline_valor, 0)} meta={`${numero(t.pipeline_qtd)} leads · cobertura ${pct(dividir(t.pipeline_valor, meta.mes))} da meta do mês`} />
          <Kpi rotulo="Em negociação" valor={moeda(t.negociacao_valor, 0)} meta={`${numero(t.negociacao_qtd)} leads · ticket ${moeda(dividir(t.negociacao_valor, t.negociacao_qtd), 0)}`} />
          <Kpi rotulo="Em fechamento" valor={moeda(t.fechamento_valor, 0)} meta={`${numero(t.fechamento_qtd)} leads · cobre ${pct(dividir(t.fechamento_valor, meta.mes ? Math.max(meta.mes - fp.mes, 0) : null))} do que falta`} />
          <Kpi rotulo="Ligações / follow-ups / agendamentos" valor={`${numero(t.ligacoes)} · ${numero(t.followups)} · ${numero(t.agendamentos)}`} />
        </div>
      </section>

      {!soVendedor && p.porCidade.length > 1 && (
        <section className="secao painel">
          <div className="painel-cab"><h2>Jesuítas × Toledo</h2></div>
          <div className="tabela-wrap"><table>
            <thead><tr><th>Cidade</th><th className="num">Vendedores</th><th className="num">Vendas</th><th className="num">Faturamento</th><th className="num">% meta</th><th className="num">Conversão</th><th className="num">Ticket</th><th className="num">Pipeline</th><th className="num">Atividade</th></tr></thead>
            <tbody>{p.porCidade.map((c) => (
              <tr key={c.cidade}><td><a href={`?periodo=${per}&cidade=${c.cidade}`}><b>{c.nome}</b></a></td><td className="num">{c.vendedores}</td><td className="num">{numero(c.qtd)}</td><td className="num">{moeda(c.total, 0)}</td>
                <td className="num"><Semaforo cor={semaforo(c.total, c.meta)} texto={pct(c.pctMeta)} /></td><td className="num">{pct(c.conversao)}</td><td className="num">{moeda(c.ticketMedio, 0)}</td><td className="num">{moeda(c.pipeline, 0)}</td><td className="num">{numero(c.atividade)}</td></tr>
            ))}</tbody>
          </table></div>
        </section>
      )}

      <section className="secao">
        <h2>Faturamento por dia</h2>
        <div className="grade g3"><Serie titulo="Faturamento" pontos={p.serie.map((x) => ({ data: x.data, v: x.total }))} formato={(v) => moeda(v, 0)} cor="#ff8a3d" barras /></div>
      </section>

      {!soVendedor && (
        <section className="secao painel">
          <div className="painel-cab"><h2>Vendedores (ranking equilibrado)</h2><p>Meta 35% · conversão 25% · atividade 20% · valor em fechamento 20%.</p></div>
          <div className="tabela-wrap"><table>
            <thead><tr><th>#</th><th>Vendedor</th><th className="num">Faturamento</th><th className="num">% meta</th><th className="num">Vendas</th><th className="num">Conversão</th><th className="num">Leads</th><th className="num">Ligações+follow</th><th className="num">Pipeline</th><th className="num">Fechamento</th><th className="num">Envios</th></tr></thead>
            <tbody>{p.linhas.map((l, i) => (
              <tr key={l.id}><td>{i + 1}</td><td><b>{l.nome}</b><br /><span className="suave pequeno">{CIDADES[l.cidade]}</span></td><td className="num">{moeda(l.faturamento, 0)}</td>
                <td className="num"><Semaforo cor={semaforo(l.faturamento, l.metaPeriodo)} texto={pct(l.pctMeta)} /></td><td className="num">{numero(l.vendas)}</td><td className="num">{pct(l.conversao)}</td>
                <td className="num">{numero(l.leads)}</td><td className="num">{numero(l.atividade)}</td><td className="num">{moeda(l.pipeline_valor, 0)}</td><td className="num">{moeda(l.fechamento_valor, 0)}</td>
                <td className="num">{l.diasEnviados}{l.atrasados ? <span className="suave pequeno"> ({l.atrasados} atras.)</span> : ''}</td></tr>
            ))}</tbody>
          </table></div>
        </section>
      )}

      <section className="secao grade g3">
        {[['Por funil', p.porFunil, (k) => FUNIS[k] || k], ['Por curso', p.porProduto, (k) => k], ['Por pagamento', p.porPagamento, (k) => PAGAMENTOS[k] || k]].map(([tit, lista, rot]) => (
          <div className="painel" key={tit}>
            <div className="painel-cab"><h2>{tit}</h2></div>
            {lista.length === 0 ? <p className="suave">Sem vendas no período.</p> : (
              <table><tbody>{lista.map((x) => <tr key={x.chave}><td>{rot(x.chave)}</td><td className="num">{numero(x.qtd)}</td><td className="num"><b>{moeda(x.total, 0)}</b></td></tr>)}</tbody></table>
            )}
          </div>
        ))}
      </section>

      {!soVendedor && (
        <section className="secao grade g2">
          <div className="painel">
            <div className="painel-cab"><h2>Fechamentos de hoje</h2><span className="suave pequeno">{pend.filter((x) => x.enviado).length} de {pend.length}</span></div>
            <div className="acoes-linha">{pend.map((x) => <span key={x.id} className={`selo ${!x.enviado ? 'vermelho' : x.pontualidade === 'atrasado' ? 'amarelo' : 'verde'}`}>{x.nome}{!x.enviado ? ' · pendente' : x.pontualidade === 'atrasado' ? ' · com atraso' : ''}</span>)}</div>
          </div>
          <div className="painel">
            <div className="painel-cab"><h2>Atenção</h2></div>
            {semAtividade.length + pipelineBaixa.length === 0 ? <p className="suave">Nenhum alerta no período.</p> : (
              <table><tbody>
                {semAtividade.map((l) => <tr key={`a${l.id}`}><td><Semaforo cor="vermelho" texto="Sem atividade" /></td><td>{l.nome}</td></tr>)}
                {pipelineBaixa.map((l) => <tr key={`p${l.id}`}><td><Semaforo cor="amarelo" texto="Pipeline curta" /></td><td>{l.nome} · pipeline {moeda(l.pipeline_valor, 0)} para meta de {moeda(l.meta_mensal, 0)}</td></tr>)}
              </tbody></table>
            )}
          </div>
        </section>
      )}

      {vendasRecentes.length > 0 && (
        <section className="secao painel">
          <div className="painel-cab"><h2>Boletos e pagamentos a confirmar</h2><p>Atualize quando o pagamento cair. O histórico do status fica guardado.</p></div>
          <div className="tabela-wrap"><table>
            <thead><tr><th>Data</th>{!soVendedor && <th>Vendedor</th>}<th>Curso</th><th>Pagamento</th><th className="num">Valor</th><th>Status</th></tr></thead>
            <tbody>{vendasRecentes.map((s) => (
              <tr key={s.id}><td>{fmtData(s.data_ref).slice(0, 5)}</td>{!soVendedor && <td>{nomeVend[s.user_id]}</td>}<td>{s.produto}</td><td>{PAGAMENTOS[s.forma_pagamento]}</td><td className="num">{moeda(Number(s.valor))}</td>
                <td><form action={atualizarStatusVenda} className="acoes-linha" style={{ flexWrap: 'nowrap' }}><input type="hidden" name="id" value={s.id} />
                  <select name="status" defaultValue={s.status} aria-label="Status da venda" style={{ width: 'auto' }}>{Object.entries(STATUS_VENDA).map(([k, r]) => <option key={k} value={k}>{r}</option>)}</select>
                  <button className="btn sec peq">Salvar</button></form></td></tr>
            ))}</tbody>
          </table></div>
        </section>
      )}
    </>
  );
}
