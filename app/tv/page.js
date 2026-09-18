import { q, q1 } from '@/lib/db.js';
import { hoje, somarDias, fmtDataHora } from '@/lib/datas.js';
import { moeda, numero, pct } from '@/lib/formato.js';
import { dividir, semaforo } from '@/lib/calc.js';
import { dashboardMarketing, pendenciasEquipe } from '@/lib/dados.js';
import { painelComercial, pendenciasComercial, faturamentoPeriodos } from '@/lib/dadosComercial.js';
import { CIDADES, projecaoMensal } from '@/lib/comercial.js';
import { numerosSuporte, atendentes } from '@/lib/dadosSuporte.js';
import { numerosIndicacao } from '@/lib/dadosIndicacao.js';
import { numerosCs } from '@/lib/dadosCs.js';
import { Semaforo } from '@/components/Ui.js';
import Relogio from '@/components/Relogio.js';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Escola Instructiva — Painel geral' };

// Cada bloco é independente: se um setor ainda não tem dados (ou falhar), o painel continua de pé
async function seguro(fn, padrao = null) {
  try { return await fn(); } catch (e) { console.error('[tv]', e.message); return padrao; }
}

function Setor({ titulo, cor, status, itens, rodape }) {
  return (
    <section className={`painel tv-setor-card ${cor || ''}`}>
      <div className="tv-setor-cab"><h2>{titulo}</h2>{status}</div>
      <div className="tv-numeros">
        {itens.map(([rot, val, sub]) => (
          <div key={rot}><span>{rot}</span><b>{val === 'sem dados' ? '—' : val}</b>{sub && <small>{String(sub).replace('sem dados', '—')}</small>}</div>
        ))}
      </div>
      {rodape && <p className="tv-rodape-card">{rodape}</p>}
    </section>
  );
}

export default async function PainelTV(props) {
  const sp = await props.searchParams;
  const chave = process.env.TV_CHAVE;
  if (!chave || sp.chave !== chave) {
    return <main className="tv tema-escuro" style={{ justifyContent: 'center', alignItems: 'center' }}><h1>Link do painel inválido</h1><p className="suave">Peça o link atualizado ao administrador.</p></main>;
  }
  const dia = hoje();
  const d30 = somarDias(dia, -29);
  const inicioMes = `${dia.slice(0, 8)}01`;
  const cidades = Object.keys(CIDADES);

  const [mkt, com, comDia, vend, fatMes, sup, atend, ind, cs, pendMkt, pendCom, supFech, acoesVencidas] = await Promise.all([
    seguro(async () => {
      const ids = (await q(`SELECT id FROM launches WHERE status IN ('captacao','evento','vendas') AND NOT permanente`)).map((l) => l.id);
      return ids.length ? dashboardMarketing({ desde: d30, ate: dia, launchIds: ids }) : null;
    }),
    seguro(() => painelComercial({ cidades, desde: inicioMes, ate: dia })),
    seguro(() => painelComercial({ cidades, desde: dia, ate: dia })),
    seguro(() => q(`SELECT DISTINCT x.id FROM users x JOIN user_department_assignments a ON a.user_id=x.id JOIN subdepartments s ON s.id=a.subdepartment_id AND s.formulario='vendedor' WHERE x.ativo`), []),
    null,
    seguro(() => numerosSuporte(null, dia)),
    seguro(() => atendentes(), []),
    seguro(() => numerosIndicacao(d30, dia)),
    seguro(() => numerosCs(d30, dia)),
    seguro(() => pendenciasEquipe(dia), []),
    seguro(() => pendenciasComercial(cidades, dia), []),
    seguro(() => q1('SELECT COUNT(*)::int n FROM support_daily_closings WHERE data_ref=$1', [dia]), { n: 0 }),
    seguro(() => q1(`SELECT COUNT(*)::int n FROM action_items WHERE status IN ('aberta','em_andamento') AND prazo < $1`, [dia]), { n: 0 }),
  ]);
  void fatMes;
  const fp = vend.length ? await seguro(() => faturamentoPeriodos(vend.map((v) => v.id), dia), { dia: 0, semana: 0, mes: 0 }) : { dia: 0, semana: 0, mes: 0 };
  const metaMes = com?.vendedores?.some((v) => v.meta_mensal) ? com.vendedores.reduce((s, v) => s + (Number(v.meta_mensal) || 0), 0) : null;
  const metaDia = com?.vendedores?.some((v) => v.meta_diaria) ? com.vendedores.reduce((s, v) => s + (Number(v.meta_diaria) || 0), 0) : null;
  const proj = projecaoMensal(fp.mes, dia);
  const ranking = (com?.linhas || []).filter((l) => l.faturamento > 0 || l.diasEnviados > 0).slice(0, 5);
  const atendentesCount = (atend || []).filter((a) => !a.gerente).length;

  const alertas = [
    sup && sup.criticosAbertos > 0 && ['vermelho', `${sup.criticosAbertos} atendimento(s) crítico(s) em aberto no Suporte`],
    sup && sup.vencidos > 0 && ['vermelho', `${sup.vencidos} atendimento(s) fora do SLA`],
    cs && cs.health.critico > 0 && ['vermelho', `${cs.health.critico} aluno(s) em situação crítica`],
    cs && cs.health.risco > 0 && ['amarelo', `${cs.health.risco} aluno(s) em risco alto · ${moeda(cs.health.valorEmRisco, 0)} em contratos`],
    cs && cs.retencao.abertos > 0 && ['amarelo', `${cs.retencao.abertos} pedido(s) de cancelamento em aberto`],
    ind && ind.beneficiosAtrasados > 0 && ['amarelo', `${ind.beneficiosAtrasados} benefício(s) de indicação atrasado(s)`],
    ind && ind.semContato > 0 && ['amarelo', `${ind.semContato} indicação(ões) válida(s) sem primeiro contato`],
    acoesVencidas?.n > 0 && ['vermelho', `${acoesVencidas.n} ação(ões) corretiva(s) com prazo vencido`],
    mkt?.funil?.gargalo && ['amarelo', `Marketing: gargalo em ${mkt.funil.gargalo.nome}`],
  ].filter(Boolean);

  const fechamentos = [
    ['Marketing', pendMkt.filter((x) => x.concluido).length, pendMkt.length],
    ['Vendedores', pendCom.filter((x) => x.enviado).length, pendCom.length],
    ['Suporte', supFech?.n || 0, atendentesCount],
  ];

  const corFat = semaforo(fp.dia, metaDia);
  return (
    <main className="tv tema-escuro">
      <meta httpEquiv="refresh" content="60" />
      <header className="tv-topo">
        <div className="marca"><img src="/logo.jpeg" alt="" /><div><strong>Escola Instructiva</strong><span>Painel geral da escola</span></div></div>
        <Relogio />
      </header>

      <div className="tv-setores-grade">
        <Setor titulo="Comercial" cor={corFat}
          status={metaDia ? <Semaforo cor={corFat} texto={`${pct(dividir(fp.dia, metaDia))} da meta do dia`} /> : null}
          itens={[['Faturamento hoje', moeda(fp.dia, 0), `${numero(comDia?.totais?.qtd)} vendas`], ['No mês', moeda(fp.mes, 0), metaMes ? `${pct(dividir(fp.mes, metaMes))} da meta` : 'meta não definida'],
            ['Projeção do mês', moeda(proj, 0)], ['Conversão no mês', pct(com?.totais?.conversao), `${numero(com?.totais?.leads)} leads`]]}
          rodape={com?.porCidade?.length ? com.porCidade.map((c) => `${c.nome} ${moeda(c.total, 0)}`).join('  ·  ') : null} />
        <Setor titulo="Marketing"
          status={mkt?.funil?.gargalo ? <Semaforo cor="vermelho" texto={`Gargalo: ${mkt.funil.gargalo.nome}`} /> : null}
          itens={mkt ? [['Investimento 30d', moeda(mkt.totais.investimento, 0)], ['Cadastros', numero(mkt.totais.cadastros), mkt.metas.cadastros ? `${pct(dividir(mkt.totais.cadastros, mkt.metas.cadastros))} da meta` : null],
            ['CPL', moeda(mkt.indicadores.cpl)], ['Nos grupos', numero(mkt.totais.grupos), pct(mkt.indicadores.entradaWhatsapp)]] : [['Lançamentos ativos', '0', 'nenhum em captação']]} />
        <Setor titulo="Suporte" cor={sup?.vencidos ? 'vermelho' : ''}
          status={sup ? <Semaforo cor={sup.vencidos ? 'vermelho' : sup.criticosAbertos ? 'amarelo' : 'verde'} texto={sup.vencidos ? `${sup.vencidos} fora do SLA` : 'SLA em dia'} /> : null}
          itens={sup ? [['Em aberto', numero(sup.backlogFinal), `${numero(sup.criticosAbertos)} críticos`], ['Recebidos hoje', numero(sup.novos)], ['Resolvidos hoje', numero(sup.resolvidos), `taxa ${pct(sup.taxaResolucao)}`], ['SLA hoje', pct(sup.cumprimentoSla)]] : []} />
        <Setor titulo="Indicação"
          itens={ind ? [['Indicações 30d', numero(ind.recebidas), `${numero(ind.validas)} válidas`], ['Vendas', numero(ind.vendas), moeda(ind.faturamento, 0)], ['Conversão', pct(ind.funil.conversaoGeral)], ['Benefícios pendentes', numero(ind.beneficiosPendentes + ind.beneficiosAprovados)]] : []} />
        <Setor titulo="CS/CX" cor={cs?.health?.critico ? 'vermelho' : ''}
          status={cs ? <Semaforo cor={cs.health.critico ? 'vermelho' : cs.health.risco ? 'amarelo' : 'verde'} texto={`${numero(cs.health.risco + cs.health.critico)} em risco`} /> : null}
          itens={cs ? [['Alunos ativos', numero(cs.ativos)], ['NPS 30d', cs.satisfacao.nps === null ? 'sem dados' : numero(cs.satisfacao.nps), `${numero(cs.satisfacao.respostas)} respostas`], ['Receita preservada', moeda(cs.retencao.preservada, 0)], ['Engajamento', pct(cs.engajamento.taxaEngajamento)]] : []} />
      </div>

      <div className="tv-meio">
        <section className="painel">
          <div className="painel-cab"><h2>Vendedores no mês</h2><span className="suave">ranking equilibrado</span></div>
          {ranking.length === 0 ? <p className="suave">Sem fechamentos de vendedores no mês ainda.</p> : (
            <table><tbody>{ranking.map((l, i) => (
              <tr key={l.id}><td className="tv-pos">{i + 1}º</td><td><b>{l.nome}</b><br /><span className="suave pequeno">{CIDADES[l.cidade]} · {numero(l.vendas)} vendas · conversão {pct(l.conversao)}</span></td>
                <td className="num"><b>{moeda(l.faturamento, 0)}</b>{l.pctMeta !== null && <><br /><Semaforo cor={semaforo(l.faturamento, l.metaPeriodo)} texto={pct(l.pctMeta)} /></>}</td></tr>
            ))}</tbody></table>
          )}
        </section>
        <section className="painel">
          <div className="painel-cab"><h2>Funil de captação</h2><span className="suave">30 dias</span></div>
          {!mkt ? <p className="suave">Nenhum lançamento em captação.</p> : (
            <div className="funil">{mkt.funil.etapas.map((e, i) => {
              const max = Math.max(...mkt.funil.etapas.map((x) => x.valor || 0), 1);
              return (
                <div key={e.chave}>
                  {i > 0 && <div className={`funil-passagem ${e.gargalo ? 'gargalo' : ''}`}><span /><span className="taxa">{e.conversao === null ? '—' : pct(e.conversao)}</span><span /></div>}
                  <div className={`funil-etapa ${e.gargalo ? 'gargalo' : ''}`}><div className="funil-nome">{e.nome}</div><div className="funil-barra"><span className="preench" style={{ width: `${e.valor ? Math.max((e.valor / max) * 100, 0.8) : 0}%` }} /><b>{numero(e.valor)}</b></div><div className="funil-meta" /></div>
                </div>
              );
            })}</div>
          )}
        </section>
        <section className="painel">
          <div className="painel-cab"><h2>Atenção hoje</h2>{alertas.length === 0 && <Semaforo cor="verde" texto="Tudo em dia" />}</div>
          {alertas.length === 0 ? <p className="suave">Nenhum alerta no momento.</p> : (
            <ul className="tv-alertas">{alertas.slice(0, 7).map(([cor, txt], k) => <li key={k}><Semaforo cor={cor} texto={cor === 'vermelho' ? 'Crítico' : 'Atenção'} /> {txt}</li>)}</ul>
          )}
        </section>
      </div>

      <footer className="tv-fechamentos">
        <span className="suave">Fechamentos de hoje:</span>
        {fechamentos.filter(([, , t]) => t > 0).map(([nome, f, t]) => (
          <Semaforo key={nome} cor={f === t ? 'verde' : f >= t / 2 ? 'amarelo' : 'vermelho'} texto={`${nome} ${f}/${t}`} />
        ))}
        <span className="tv-rodape">Atualiza sozinho a cada minuto · {fmtDataHora(new Date())}</span>
      </footer>
    </main>
  );
}
