import { notFound } from 'next/navigation';
import { exigirUsuario } from '@/lib/auth.js';
import { q, q1 } from '@/lib/db.js';
import { ehSuperadmin } from '@/lib/perm.js';
import { Topo, Aviso } from '@/components/Ui.js';
import FormUsuario from '@/components/FormUsuario.js';
import FormEstado from '@/components/FormEstado.js';
import { gerarLinkSenha } from '../../actions.js';

export const dynamic = 'force-dynamic';

export default async function EditarUsuario(props) {
  const params = await props.params;
  const u = await exigirUsuario();
  if (!ehSuperadmin(u)) return <Aviso tipo="erro">Área restrita ao superadministrador.</Aviso>;
  const usuario = await q1('SELECT id, nome, email, cargo, role_id, ativo FROM users WHERE id=$1', [Number(params.id)]);
  if (!usuario) notFound();
  const [perfis, setores, subsetores, lotacoes] = await Promise.all([
    q('SELECT * FROM roles ORDER BY id'),
    q('SELECT * FROM departments WHERE ativo ORDER BY ordem'),
    q('SELECT * FROM subdepartments WHERE ativo ORDER BY ordem'),
    q('SELECT * FROM user_department_assignments WHERE user_id=$1', [usuario.id]),
  ]);
  return (
    <>
      <Topo titulo={usuario.nome} descricao={usuario.email}><a className="btn sec" href="/admin/usuarios">Voltar</a></Topo>
      <div className="grade g2" style={{ alignItems: 'start' }}>
        <div className="painel"><FormUsuario usuario={usuario} perfis={perfis} setores={setores} subsetores={subsetores} lotacoes={lotacoes} /></div>
        <div className="painel">
          <h2>Recuperação de senha</h2>
          <p className="suave pequeno" style={{ margin: '6px 0 12px' }}>Gere um link e envie para a pessoa. Ele vale 24 horas e só funciona uma vez.</p>
          <FormEstado action={gerarLinkSenha} botao="Gerar link de redefinição" className="form">
            <input type="hidden" name="id" value={usuario.id} />
          </FormEstado>
        </div>
      </div>
    </>
  );
}
