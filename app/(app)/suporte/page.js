import { exigirUsuario } from '@/lib/auth.js';
import { fmtDataHora } from '@/lib/datas.js';
import { STATUS, PRIORIDADES, CATEGORIAS, ABERTOS, situacaoSla, veTodoSuporte, ehDoSuporte } from '@/lib/suporte.js';
import { filaTickets, atendentes } from '@/lib/dadosSuporte.js';
import { Topo, Aviso, Vazio, Semaforo } from '@/components/Ui.js';

export const dynamic = 'force-dynamic';
const COR_PRIOR = { critica: 'vermelho', alta: 'amarelo', normal: 'neutro', baixa: 'neutro' };

export default async function Fila(props) {
  const sp = await props.searchParams;
  const u = await exigirUsuario();
  if (!ehDoSuporte(u)) return <><Topo titulo="Atendimentos" /><Aviso tipo="erro">Área da equipe de Suporte.</Aviso></>;
  const tudo = veTodoSuporte(u);
  const f = { status: sp.status || 'abertos', prioridade: PRIORIDADES[sp.prioridade] ? sp.prioridade : null, categoria: CATEGORIAS[sp.categoria] ? sp.categoria : null, responsavel: tudo ? Number(sp.responsavel) || null : null, busca: String(sp.busca || '').trim().slice(0, 80) || null };
  const [lista, abertos, equipe] = await Promise.all([filaTickets(u, tudo, f), filaTickets(u, tudo, { status: 'abertos' }), tudo ? atendentes() : []]);
  const agora = new Date();
  const cont = (fn) => abertos.filter(fn).length;
  const cartoes = [
    ['Novos', cont((t) => t.status === 'novo'), 'novo'], ['Em atendimento', cont((t) => t.status === 'em_atendimento'), 'em_atendimento'],
    ['Aguardando aluno', cont((t) => t.status === 'aguardando_aluno'), 'aguardando_aluno'], ['Aguardando setor', cont((t) => t.status === 'aguardando_setor'), 'aguardando_setor'],
    ['Críticos', cont((t) => t.prioridade === 'critica'), null], ['Fora do SLA', cont((t) => situacaoSla(t, agora) === 'vencido'), null],
  ];

  return (
    <>
      <Topo titulo={tudo ? 'Atendimentos da equipe' : 'Meus atendimentos'} descricao={`${abertos.length} em aberto`}>
        {tudo && <a className="btn sec" href="/suporte/dashboard">Dashboard</a>}
        <a className="btn" href="/suporte/ticket/novo">Novo atendimento</a>
      </Topo>
      {cont((t) => t.prioridade === 'critica') > 0 && <Aviso tipo="erro">Há atendimento crítico em aberto. Priorize.</Aviso>}
      <section className="grade g4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', marginTop: 12 }}>
        {cartoes.map(([rot, n, st]) => (
          <a key={rot} href={st ? `?status=${st}` : rot === 'Críticos' ? '?prioridade=critica' : '?status=abertos'} className="painel atalho">
            <span>{rot}</span><b style={{ fontSize: '1.6rem' }}>{n}</b>
          </a>
        ))}
      </section>
      <form className="filtros" method="get" style={{ marginTop: 16 }}>
        <div className="campo"><label htmlFor="f-b">Buscar</label><input id="f-b" name="busca" type="search" defaultValue={sp.busca || ''} placeholder="Protocolo, aluno, e-mail ou telefone" /></div>
        <div className="campo"><label htmlFor="f-s">Status</label><select id="f-s" name="status" defaultValue={f.status}><option value="abertos">Em aberto</option><option value="todos">Todos</option>{Object.entries(STATUS).map(([k, r]) => <option key={k} value={k}>{r}</option>)}</select></div>
        <div className="campo"><label htmlFor="f-p">Prioridade</label><select id="f-p" name="prioridade" defaultValue={f.prioridade || ''}><option value="">Todas</option>{Object.entries(PRIORIDADES).map(([k, r]) => <option key={k} value={k}>{r}</option>)}</select></div>
        <div className="campo"><label htmlFor="f-c">Categoria</label><select id="f-c" name="categoria" defaultValue={f.categoria || ''}><option value="">Todas</option>{Object.entries(CATEGORIAS).map(([k, r]) => <option key={k} value={k}>{r}</option>)}</select></div>
        {tudo && <div className="campo"><label htmlFor="f-r">Responsável</label><select id="f-r" name="responsavel" defaultValue={f.responsavel || ''}><option value="">Todos</option>{equipe.map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}</select></div>}
        <button className="btn peq" type="submit">Filtrar</button>
      </form>
      {lista.length === 0 ? <Vazio>Nenhum atendimento encontrado.</Vazio> : (
        <div className="painel tabela-wrap"><table>
          <thead><tr><th>Protocolo</th><th>Aluno</th><th>Categoria</th><th>Prioridade</th><th>Status</th><th>SLA</th>{tudo && <th>Responsável</th>}<th>Aberto em</th></tr></thead>
          <tbody>{lista.map((t) => {
            const sla = situacaoSla(t, agora);
            return (
              <tr key={t.id}>
                <td><a href={`/suporte/ticket/${t.id}`}><b>{t.protocolo}</b></a></td>
                <td>{t.aluno}<br /><span className="suave pequeno">{t.produto || 'Atendimento geral'}</span></td>
                <td className="pequeno">{CATEGORIAS[t.categoria]}</td>
                <td><Semaforo cor={COR_PRIOR[t.prioridade]} texto={PRIORIDADES[t.prioridade]} /></td>
                <td className="pequeno">{STATUS[t.status]}</td>
                <td>{ABERTOS.includes(t.status) || sla === 'vencido' ? <Semaforo cor={sla === 'vencido' ? 'vermelho' : sla === 'atencao' ? 'amarelo' : 'verde'} texto={sla === 'vencido' ? 'Vencido' : sla === 'atencao' ? 'Perto do limite' : 'No prazo'} /> : <span className="selo verde">No prazo</span>}</td>
                {tudo && <td className="pequeno">{t.responsavel}</td>}
                <td className="pequeno suave">{fmtDataHora(t.aberto_em)}</td>
              </tr>
            );
          })}</tbody>
        </table></div>
      )}
    </>
  );
}
