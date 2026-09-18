import { exigirUsuario } from '@/lib/auth.js';
import { q } from '@/lib/db.js';
import { fmtData } from '@/lib/datas.js';
import { FAIXAS, COR_FAIXA, MATRICULA, veTodoCs, ehDoCs } from '@/lib/cscx.js';
import { carteira, equipeCs } from '@/lib/dadosCs.js';
import { Topo, Aviso, Vazio, Semaforo } from '@/components/Ui.js';

export const dynamic = 'force-dynamic';
export default async function Carteira(props) {
  const sp = await props.searchParams;
  const u = await exigirUsuario();
  if (!ehDoCs(u)) return <><Topo titulo="Carteira de alunos" /><Aviso tipo="erro">Área da equipe de CS/CX.</Aviso></>;
  const tudo = veTodoCs(u);
  const f = { faixa: FAIXAS[sp.faixa] ? sp.faixa : null, matricula: MATRICULA[sp.matricula] ? sp.matricula : sp.matricula === 'todas' ? null : 'ativa', produto: Number(sp.produto) || null, responsavel: tudo ? Number(sp.responsavel) || null : null, busca: String(sp.busca || '').trim().slice(0, 80) || null };
  const [lista, produtos, equipe] = await Promise.all([carteira(u, tudo, f), q('SELECT id, nome FROM products ORDER BY nome'), tudo ? equipeCs() : []]);
  const cont = (fx) => lista.filter((a) => a.faixa === fx).length;
  return (
    <>
      <Topo titulo={tudo ? 'Carteira de alunos' : 'Minha carteira'} descricao={`${lista.length} alunos no filtro. Os em risco aparecem primeiro.`}>
        {tudo && <a className="btn sec" href="/cs/dashboard">Dashboard</a>}
        {tudo && <a className="btn sec" href="/cs/health">Health score</a>}
        <a className="btn" href="/cs/aluno/novo">Adicionar aluno</a>
      </Topo>
      <section className="grade g4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))' }}>
        {Object.entries(FAIXAS).map(([k, r]) => <a key={k} href={`?faixa=${k}`} className="painel atalho"><span>{r}</span><b style={{ fontSize: '1.6rem' }}>{cont(k)}</b></a>)}
      </section>
      <form className="filtros" method="get" style={{ marginTop: 16 }}>
        <div className="campo"><label htmlFor="f-b">Buscar</label><input id="f-b" name="busca" type="search" defaultValue={sp.busca || ''} placeholder="Nome, e-mail ou telefone" /></div>
        <div className="campo"><label htmlFor="f-f">Saúde</label><select id="f-f" name="faixa" defaultValue={f.faixa || ''}><option value="">Todas</option>{Object.entries(FAIXAS).map(([k, r]) => <option key={k} value={k}>{r}</option>)}</select></div>
        <div className="campo"><label htmlFor="f-m">Matrícula</label><select id="f-m" name="matricula" defaultValue={sp.matricula || 'ativa'}><option value="todas">Todas</option>{Object.entries(MATRICULA).map(([k, r]) => <option key={k} value={k}>{r}</option>)}</select></div>
        <div className="campo"><label htmlFor="f-p">Curso</label><select id="f-p" name="produto" defaultValue={f.produto || ''}><option value="">Todos</option>{produtos.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}</select></div>
        {tudo && <div className="campo"><label htmlFor="f-r">Responsável</label><select id="f-r" name="responsavel" defaultValue={f.responsavel || ''}><option value="">Todos</option>{equipe.map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}</select></div>}
        <button className="btn peq" type="submit">Filtrar</button>
      </form>
      {lista.length === 0 ? <Vazio>Nenhum aluno encontrado. Adicione alunos à carteira pelo botão acima.</Vazio> : (
        <div className="painel tabela-wrap"><table>
          <thead><tr><th>Aluno</th><th>Curso</th><th>Saúde</th><th className="num">Progresso</th><th>Último acesso</th>{tudo && <th>Responsável</th>}</tr></thead>
          <tbody>{lista.map((a) => (
            <tr key={a.id}><td><a href={`/cs/aluno/${a.id}`}><b>{a.nome}</b></a><br /><span className="suave pequeno">{a.email || a.telefone} · {MATRICULA[a.matricula]}</span></td>
              <td className="pequeno">{a.produto || '—'}</td>
              <td>{a.faixa ? <Semaforo cor={COR_FAIXA[a.faixa]} texto={`${FAIXAS[a.faixa]} · ${a.health_score}`} /> : '—'}</td>
              <td className="num">{a.progresso}%</td><td className="pequeno">{a.ultimo_acesso ? fmtData(a.ultimo_acesso) : 'nunca'}</td>{tudo && <td className="pequeno">{a.responsavel || '—'}</td>}</tr>
          ))}</tbody>
        </table></div>
      )}
    </>
  );
}
