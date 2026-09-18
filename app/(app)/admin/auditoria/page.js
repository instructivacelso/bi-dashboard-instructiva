import { exigirUsuario } from '@/lib/auth.js';
import { q } from '@/lib/db.js';
import { vePainelEmpresa } from '@/lib/perm.js';
import { fmtDataHora } from '@/lib/datas.js';
import { Topo, Aviso } from '@/components/Ui.js';

export const dynamic = 'force-dynamic';

function diferencas(antes, depois) {
  if (!antes || !depois) return null;
  const ign = ['updated_at', 'created_at', 'updated_by', 'senha_hash'];
  return Object.keys(depois).filter((k) => !ign.includes(k) && JSON.stringify(antes[k]) !== JSON.stringify(depois[k]))
    .map((k) => `${k}: ${antes[k] ?? '—'} → ${depois[k] ?? '—'}`).join(' · ');
}

export default async function Auditoria({ searchParams }) {
  const u = await exigirUsuario();
  if (!vePainelEmpresa(u)) return <Aviso tipo="erro">Área restrita à Diretoria e ao superadministrador.</Aviso>;
  const ent = searchParams.entidade || null;
  const [logs, entidades] = await Promise.all([
    q(`SELECT a.*, u.nome FROM audit_logs a LEFT JOIN users u ON u.id=a.user_id WHERE ($1::text IS NULL OR a.entidade=$1) ORDER BY a.id DESC LIMIT 300`, [ent]),
    q('SELECT DISTINCT entidade FROM audit_logs ORDER BY entidade'),
  ]);
  return (
    <>
      <Topo titulo="Auditoria" descricao="Quem fez o quê e quando. Correções mostram o motivo e o que mudou.">
        <a className="btn sec" href="/api/exportar/auditoria">Exportar CSV</a>
      </Topo>
      <form className="filtros" method="get">
        <div className="campo"><label htmlFor="ent">Tipo de registro</label>
          <select id="ent" name="entidade" defaultValue={ent || ''}><option value="">Todos</option>{entidades.map((e) => <option key={e.entidade}>{e.entidade}</option>)}</select>
        </div>
        <button className="btn peq">Filtrar</button>
      </form>
      <div className="painel tabela-wrap"><table>
        <thead><tr><th>Quando</th><th>Quem</th><th>Ação</th><th>Registro</th><th>Detalhe</th></tr></thead>
        <tbody>{logs.map((l) => (
          <tr key={l.id}>
            <td className="pequeno">{fmtDataHora(l.created_at)}</td>
            <td>{l.nome || '—'}</td>
            <td><span className={`selo ${l.acao === 'corrigir' ? 'amarelo' : 'neutro'}`}>{l.acao}</span></td>
            <td className="pequeno">{l.entidade}{l.entidade_id ? ` #${l.entidade_id}` : ''}</td>
            <td className="pequeno">{l.depois?.motivo && <><strong>Motivo:</strong> {l.depois.motivo}<br /></>}{diferencas(l.antes, l.depois)}</td>
          </tr>
        ))}</tbody>
      </table></div>
    </>
  );
}
