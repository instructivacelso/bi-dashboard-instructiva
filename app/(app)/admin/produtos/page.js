import { exigirUsuario } from '@/lib/auth.js';
import { q } from '@/lib/db.js';
import { ehSuperadmin } from '@/lib/perm.js';
import { Topo, Aviso } from '@/components/Ui.js';
import FormEstado from '@/components/FormEstado.js';
import { salvarProduto } from '../actions.js';

export const dynamic = 'force-dynamic';
const CATEGORIAS = ['Curso profissionalizante', 'Curso técnico', 'Pós-graduação', 'Outro'];

export default async function Produtos() {
  const u = await exigirUsuario();
  if (!ehSuperadmin(u)) return <Aviso tipo="erro">Área restrita ao superadministrador.</Aviso>;
  const produtos = await q('SELECT * FROM products ORDER BY ativo DESC, nome');
  const Campos = ({ p = {} }) => (
    <div className="linha-campos">
      <div className="campo"><label>Nome</label><input name="nome" type="text" defaultValue={p.nome} required /></div>
      <div className="campo"><label>Categoria</label>
        <select name="categoria" defaultValue={p.categoria || ''}><option value="">—</option>{CATEGORIAS.map((c) => <option key={c}>{c}</option>)}</select>
      </div>
    </div>
  );
  return (
    <>
      <Topo titulo="Produtos" descricao="Cursos vinculados aos lançamentos." />
      <div className="painel">
        <h2>Novo produto</h2>
        <FormEstado action={salvarProduto} botao="Adicionar produto"><Campos /></FormEstado>
      </div>
      <div className="grade g2" style={{ marginTop: 18 }}>
        {produtos.map((p) => (
          <div className="painel" key={p.id}>
            <FormEstado action={salvarProduto} botao="Salvar">
              <input type="hidden" name="id" value={p.id} />
              <Campos p={p} />
              <label className="pequeno"><input type="checkbox" name="ativo" defaultChecked={p.ativo} /> Ativo</label>
            </FormEstado>
          </div>
        ))}
      </div>
    </>
  );
}
