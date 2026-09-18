import { exigirUsuario } from '@/lib/auth.js';
import { q } from '@/lib/db.js';
import { ehSuperadmin, gerenteDe } from '@/lib/perm.js';
import { fmtData } from '@/lib/datas.js';
import { moeda, numero } from '@/lib/formato.js';
import { STATUS_LANCAMENTO } from '@/lib/formularios.js';
import { Topo, Aviso, Vazio } from '@/components/Ui.js';
import BotaoExcluir from '@/components/BotaoExcluir.js';
import { excluirLancamento } from '../actions.js';

export const dynamic = 'force-dynamic';

export default async function Lancamentos() {
  const u = await exigirUsuario();
  if (!ehSuperadmin(u) && !gerenteDe(u, 'marketing')) return <Aviso tipo="erro">Área restrita ao gerente de Marketing e ao superadministrador.</Aviso>;
  const lancs = await q(`SELECT l.*, p.nome produto, g.nome gerente, (SELECT COUNT(*) FROM launch_user_assignments a WHERE a.launch_id=l.id)::int equipe,
       ((SELECT COUNT(*) FROM traffic_daily_entries x WHERE x.launch_id=l.id) + (SELECT COUNT(*) FROM whatsapp_daily_entries x WHERE x.launch_id=l.id) + (SELECT COUNT(*) FROM automation_daily_entries x WHERE x.launch_id=l.id) + (SELECT COUNT(*) FROM editor_daily_entries x WHERE x.launch_id=l.id) + (SELECT COUNT(*) FROM live_results x WHERE x.launch_id=l.id) + (SELECT COUNT(*) FROM manager_daily_closings x WHERE x.launch_id=l.id) + (SELECT COUNT(*) FROM commercial_launch_results x WHERE x.launch_id=l.id))::int registros
                           FROM launches l LEFT JOIN products p ON p.id=l.product_id LEFT JOIN users g ON g.id=l.gerente_id ORDER BY l.id DESC`);
  return (
    <>
      <Topo titulo="Lançamentos" descricao="Cadastro feito uma vez pelo gerente. Todos os formulários e métricas do Marketing ficam vinculados ao lançamento.">
        <a className="btn sec" href="/admin/produtos">Produtos</a>
        <a className="btn sec" href="/admin/comercial">Vendas por lançamento</a>
        <a className="btn" href="/admin/lancamentos/novo">Novo lançamento</a>
      </Topo>
      {lancs.length === 0 ? <Vazio>Nenhum lançamento cadastrado.</Vazio> : (
        <div className="painel tabela-wrap"><table>
          <thead><tr><th>Lançamento</th><th>Fase</th><th>Captação</th><th>Live</th><th className="num">Orçamento</th><th className="num">Meta cadastros</th><th className="num">Equipe</th><th /></tr></thead>
          <tbody>{lancs.map((l) => (
            <tr key={l.id}>
              <td><a href={`/admin/lancamentos/${l.id}`}>{l.nome}</a><br /><span className="suave pequeno">{l.produto || 'sem produto'} · {l.gerente || 'sem gerente'}</span></td>
              <td>{STATUS_LANCAMENTO[l.status]}</td>
              <td className="pequeno">{fmtData(l.captacao_inicio)} a {fmtData(l.captacao_fim)}</td>
              <td className="pequeno">{fmtData(l.data_live)}{l.live_liberada ? ' · liberada' : ''}</td>
              <td className="num">{l.orcamento ? moeda(l.orcamento, 0) : '—'}</td>
              <td className="num">{l.meta_cadastros ? numero(l.meta_cadastros) : '—'}</td>
              <td className="num">{l.equipe}</td>
              <td>{l.permanente ? <span className="selo neutro">Fixo</span> : <BotaoExcluir action={excluirLancamento} id={l.id} nome={l.nome} registros={l.registros} />}</td>
            </tr>
          ))}</tbody>
        </table></div>
      )}
    </>
  );
}
