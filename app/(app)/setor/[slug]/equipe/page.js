import { notFound } from 'next/navigation';
import { exigirUsuario } from '@/lib/auth.js';
import { q1 } from '@/lib/db.js';
import { ehSuperadmin, gerenteDe } from '@/lib/perm.js';
import { Topo, Aviso } from '@/components/Ui.js';
import EquipeSetor from '@/components/EquipeSetor.js';

export default async function EquipeDoSetor(props) {
  const params = await props.params;
  const u = await exigirUsuario();
  const setor = await q1('SELECT * FROM departments WHERE slug=$1 AND ativo', [params.slug]);
  if (!setor) notFound();
  if (!ehSuperadmin(u) && !gerenteDe(u, setor.slug)) return <Aviso tipo="erro">Só o gerente do setor e o administrador cadastram a equipe.</Aviso>;
  return (
    <>
      <Topo titulo={`Equipe — ${setor.nome}`} descricao="Cada pessoa cadastrada aqui vê só este setor e o formulário dela.">
        <a className="btn sec" href={`/setor/${setor.slug}`}>Voltar</a>
      </Topo>
      <EquipeSetor setor={setor} u={u} />
    </>
  );
}
