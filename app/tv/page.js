import { q } from '@/lib/db.js';
import { hoje, somarDias, fmtData, fmtDataHora } from '@/lib/datas.js';
import { moeda, numero, pct, multiplo } from '@/lib/formato.js';
import { dividir, semaforo } from '@/lib/calc.js';
import { STATUS_LANCAMENTO, PRIORIDADES } from '@/lib/formularios.js';
import { dashboardMarketing, pendenciasEquipe } from '@/lib/dados.js';
import { Kpi, Semaforo } from '@/components/Ui.js';
import Relogio from '@/components/Relogio.js';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Painel Instructiva — TV' };

// Painel para televisão: abre sem login, protegido por chave secreta (TV_CHAVE)
export default async function PainelTV(props) {
  const sp = await props.searchParams;
  const chave = process.env.TV_CHAVE;
  if (!chave || sp.chave !== chave) {
    return <main className="tv tema-escuro" style={{ justifyContent: 'center', alignItems: 'center' }}><h1>Link do painel inválido</h1><p className="suave">Peça o link atualizado ao administrador.</p></main>;
  }
  const dia = hoje();
  const desde = somarDias(dia, -29);
  const ativos = await q(`SELECT id FROM launches WHERE status IN ('captacao','evento','vendas')`);
  const ids = ativos.map((l) => l.id);
  const [d, pend, inc, acoes, setores] = await Promise.all([
    dashboardMarketing({ desde, ate: dia, launchIds: ids }),
    pendenciasEquipe(dia),
    q(`SELECT i.descricao, i.prioridade, l.nome lancamento FROM automation_incidents i JOIN launches l ON l.id=i.launch_id WHERE i.status='aberto'
        ORDER BY CASE i.prioridade WHEN 'critica' THEN 0 WHEN 'alta' THEN 1 WHEN 'media' THEN 2 ELSE 3 END LIMIT 5`),
    q(`SELECT a.acao, a.prazo, r.nome responsavel FROM action_items a LEFT JOIN users r ON r.id=a.responsavel_id
        WHERE a.status IN ('aberta','em_andamento') ORDER BY a.prazo NULLS LAST LIMIT 5`),
    q(`SELECT d.nome, d.modulo_ativo, (SELECT COUNT(DISTINCT a.user_id) FROM user_department_assignments a JOIN users u ON u.id=a.user_id AND u.ativo WHERE a.department_id=d.id)::int pessoas
         FROM departments d WHERE d.ativo ORDER BY d.ordem`),
  ]);
  const { totais: t, metas: m, indicadores: ind, funil } = d;
  const feitos = pend.filter((p) => p.concluido).length;
  const pendentes = pend.filter((p) => !p.concluido);

  return (
    <main className="tv tema-escuro">
      <meta httpEquiv="refresh" content="60" />
      <header className="tv-topo">
        <div className="marca"><img src="/logo.jpeg" alt="" /><div><strong>Instructiva</strong><span>Painel geral · últimos 30 dias · {ativos.length} lançamentos ativos</span></div></div>
        <Relogio />
      </header>

      <section className="tv-kpis">
        <Kpi rotulo="Investimento" valor={moeda(t.investimento, 0)} progresso={dividir(t.investimento, m.orcamento)} meta={m.orcamento ? `de ${moeda(m.orcamento, 0)}` : null} />
        <Kpi rotulo="Cadastros" valor={numero(t.cadastros)} cor={semaforo(t.cadastros, m.cadastros)} progresso={dividir(t.cadastros, m.cadastros)} meta={m.cadastros ? `meta ${numero(m.cadastros)}` : null} />
        <Kpi rotulo="CPL" valor={moeda(ind.cpl)} />
        <Kpi rotulo="Nos grupos" valor={numero(t.grupos)} cor={semaforo(t.grupos, m.grupos)} progresso={dividir(t.grupos, m.grupos)} meta={pct(ind.entradaWhatsapp) + ' dos cadastros'} />
        <Kpi rotulo="Vendas" valor={numero(t.vendas)} cor={semaforo(t.vendas, m.vendas)} progresso={dividir(t.vendas, m.vendas)} meta={m.vendas ? `meta ${numero(m.vendas)}` : null} />
        <Kpi rotulo="Faturamento" valor={moeda(t.faturamento, 0)} cor={semaforo(t.faturamento, m.faturamento)} progresso={dividir(t.faturamento, m.faturamento)} />
        <Kpi rotulo="ROAS" valor={multiplo(ind.roas)} />
      </section>

      <section className="tv-grade">
        <div className="painel">
          <div className="painel-cab"><h2>Funil de captação</h2>{funil.gargalo && <Semaforo cor="vermelho" texto={`Gargalo: ${funil.gargalo.nome}`} />}</div>
          <div className="funil">
            {funil.etapas.map((e, i) => {
              const max = Math.max(...funil.etapas.map((x) => x.valor || 0), 1);
              return (
                <div key={e.chave}>
                  {i > 0 && <div className={`funil-passagem ${e.gargalo ? 'gargalo' : ''}`}><span /><span className="taxa">{pct(e.conversao)}{e.conversaoMeta ? ` · planejado ${pct(e.conversaoMeta)}` : ''}</span><span /></div>}
                  <div className={`funil-etapa ${e.gargalo ? 'gargalo' : ''}`}>
                    <div className="funil-nome">{e.nome}</div>
                    <div className="funil-barra"><span className="preench" style={{ width: `${e.valor ? Math.max((e.valor / max) * 100, 0.8) : 0}%` }} /><b>{numero(e.valor)}</b></div>
                    <div className="funil-meta">{e.meta ? pct(dividir(e.valor, e.meta)) + ' da meta' : ''}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="painel">
          <div className="painel-cab"><h2>Lançamentos</h2></div>
          <table><tbody>
            {d.porLancamento.map((l) => {
              const cpl = dividir(l.gasto, l.cadastros);
              const cor = [semaforo(Number(l.cadastros), l.meta_cadastros), semaforo(cpl, l.cpl_max, 'menor')].sort((a, b) => ({ vermelho: 3, amarelo: 2, verde: 1, neutro: 0 }[b] - { vermelho: 3, amarelo: 2, verde: 1, neutro: 0 }[a]))[0];
              return (
                <tr key={l.id}>
                  <td><b>{l.nome}</b><br /><span className="suave pequeno">{STATUS_LANCAMENTO[l.status]} · {numero(l.cadastros)} cadastros · CPL {moeda(cpl)}</span></td>
                  <td><Semaforo cor={l.situacao || cor} /></td>
                </tr>
              );
            })}
            {d.porLancamento.length === 0 && <tr><td className="suave">Nenhum lançamento ativo.</td></tr>}
          </tbody></table>
        </div>

        <div className="painel">
          <div className="painel-cab"><h2>Hoje</h2><Semaforo cor={pend.length && feitos === pend.length ? 'verde' : pendentes.length > pend.length / 2 ? 'vermelho' : 'amarelo'} texto={`${feitos} de ${pend.length} formulários`} /></div>
          <table><tbody>
            {inc.map((i, k) => <tr key={`i${k}`}><td><Semaforo cor={['alta', 'critica'].includes(i.prioridade) ? 'vermelho' : 'amarelo'} texto={PRIORIDADES[i.prioridade]} /></td><td>{i.descricao}<br /><span className="suave pequeno">{i.lancamento}</span></td></tr>)}
            {acoes.map((a, k) => <tr key={`a${k}`}><td><span className={`selo ${a.prazo && a.prazo < dia ? 'vermelho' : 'laranja'}`}>Ação</span></td><td>{a.acao}<br /><span className="suave pequeno">{a.responsavel || 'sem responsável'}{a.prazo ? ` · ${fmtData(a.prazo).slice(0, 5)}` : ''}</span></td></tr>)}
            {pendentes.slice(0, 4).map((p, k) => <tr key={`p${k}`}><td><span className="selo neutro">Pendente</span></td><td>{p.usuario}<br /><span className="suave pequeno">{p.titulo}</span></td></tr>)}
            {inc.length + acoes.length + pendentes.length === 0 && <tr><td className="suave">Tudo em dia.</td></tr>}
          </tbody></table>
        </div>
      </section>

      <section className="tv-setores">
        {setores.map((s) => (
          <div className="tv-setor" key={s.nome}><b>{s.nome}</b><span>{s.modulo_ativo ? `${s.pessoas} pessoas · ativo` : 'em configuração'}</span></div>
        ))}
      </section>
      <p className="tv-rodape">Atualiza sozinho a cada minuto · {fmtDataHora(new Date())}</p>
    </main>
  );
}
