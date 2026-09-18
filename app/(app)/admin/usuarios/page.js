import { exigirUsuario } from '@/lib/auth.js';
import { q } from '@/lib/db.js';
import { ehSuperadmin } from '@/lib/perm.js';
import { fmtDataHora } from '@/lib/datas.js';
import { Topo, Aviso } from '@/components/Ui.js';
import FormUsuario from '@/components/FormUsuario.js';

export const dynamic = 'force-dynamic';

export default async function Usuarios() {
  const u = await exigirUsuario();
  if (!ehSuperadmin(u)) return <Aviso tipo="erro">Área restrita ao superadministrador.</Aviso>;
  const [usuarios, perfis, setores, subsetores] = await Promise.all([
    q(`SELECT u.*, r.nome AS perfil,
          (SELECT string_agg(COALESCE(s.nome, d.nome), ', ') FROM user_department_assignments a
             JOIN departments d ON d.id=a.department_id LEFT JOIN subdepartments s ON s.id=a.subdepartment_id WHERE a.user_id=u.id) AS lotacao
        FROM users u JOIN roles r ON r.id=u.role_id ORDER BY u.ativo DESC, u.nome`),
    q('SELECT * FROM roles ORDER BY id'),
    q('SELECT * FROM departments WHERE ativo ORDER BY ordem'),
    q('SELECT * FROM subdepartments WHERE ativo ORDER BY ordem'),
  ]);
  return (
    <>
      <Topo titulo="Usuários" descricao={`${usuarios.filter((x) => x.ativo).length} ativos. Clique no nome para editar, trocar perfil ou gerar link de senha.`}>
        <a className="btn sec" href="/api/exportar/usuarios">Exportar CSV</a>
      </Topo>
      <div className="painel tabela-wrap">
        <table>
          <thead><tr><th>Nome</th><th>Perfil</th><th>Atividades</th><th>Último acesso</th><th>Situação</th></tr></thead>
          <tbody>{usuarios.map((x) => (
            <tr key={x.id}>
              <td><a href={`/admin/usuarios/${x.id}`}>{x.nome}</a><br /><span className="suave pequeno">{x.email}</span></td>
              <td>{x.perfil}</td>
              <td className="pequeno">{x.lotacao || '—'}</td>
              <td className="pequeno suave">{x.ultimo_login ? fmtDataHora(x.ultimo_login) : 'nunca'}</td>
              <td>{x.ativo ? <span className="selo verde">Ativo</span> : <span className="selo neutro">Inativo</span>}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
      <details className="painel bloco" style={{ marginTop: 18 }}>
        <summary>Novo usuário</summary>
        <div style={{ marginTop: 12 }}><FormUsuario perfis={perfis} setores={setores} subsetores={subsetores} /></div>
      </details>
    </>
  );
}
