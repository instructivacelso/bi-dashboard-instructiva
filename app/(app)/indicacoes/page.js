import { exigirUsuario } from '@/lib/auth.js';
import { fmtData } from '@/lib/datas.js';
import { ETAPAS, ORDEM_ETAPAS, ETAPAS_FINAIS, veTodaIndicacao, registraIndicacao, ehDaIndicacao, gereBeneficios, ehColaboradorIndicacao } from '@/lib/indicacao.js';
import { listaIndicacoes, vendedoresIndicacao } from '@/lib/dadosIndicacao.js';
import { q } from '@/lib/db.js';
import { Topo, Aviso } from '@/components/Ui.js';

export const dynamic = 'force-dynamic';

export default async function Pipeline(props) {
  const sp = await props.searchParams;
  const u = await exigirUsuario();
  if (!ehDaIndicacao(u)) return <><Topo titulo="Indicações" /><Aviso tipo="erro">Área do time de Indicação.</Aviso></>;
  const tudo = veTodaIndicacao(u);
  const f = { busca: String(sp.busca || '').trim().slice(0, 80) || null, vendedor: tudo ? Number(sp.vendedor) || null : null };
  let lista = await listaIndicacoes(u, tudo, f);
  if (tudo && Number(sp.responsavel)) lista = lista.filter((r) => r.responsavel_id === Number(sp.responsavel));
  const [vend, equipe] = await Promise.all([tudo ? vendedoresIndicacao() : [], tudo ? q(`SELECT DISTINCT x.id, x.nome FROM users x JOIN user_department_assignments a ON a.user_id=x.id JOIN departments d ON d.id=a.department_id WHERE x.ativo AND d.slug='indicacoes' ORDER BY x.nome`) : []]);
  const hojeISO = new Date(Date.now() - 3 * 3600000).toISOString().slice(0, 10);
  const colunas = sp.finais ? [...ORDEM_ETAPAS, ...ETAPAS_FINAIS] : ORDEM_ETAPAS;
  const porEtapa = (e) => lista.filter((r) => r.etapa === e);
  const finais = lista.filter((r) => ETAPAS_FINAIS.includes(r.etapa)).length;
  return (
    <>
      <Topo titulo={tudo ? 'Pipeline de indicação' : 'Meu pipeline'} descricao={`${lista.length} indicações${finais ? ` · ${finais} encerradas (sem resposta, sem interesse, inválidas ou perdidas)` : ''}`}>
        {ehColaboradorIndicacao(u) && <a className="btn sec" href="/indicacoes/painel">Meu painel</a>}
        {ehColaboradorIndicacao(u) && <a className="btn sec" href="/indicacoes/diario">Formulário do dia</a>}
        {tudo && <a className="btn sec" href="/indicacoes/dashboard">Dashboard</a>}
        {tudo && <a className="btn sec" href="/indicacoes/campanhas">Campanhas</a>}
        {tudo && <a className="btn sec" href="/indicacoes/metas">Metas</a>}
        {gereBeneficios(u) && <a className="btn sec" href="/indicacoes/beneficios">Benefícios</a>}
        {registraIndicacao(u) && <a className="btn" href="/indicacoes/registrar">Registrar indicações</a>}
      </Topo>
      <form className="filtros" method="get">
        <div className="campo"><label htmlFor="f-b">Buscar</label><input id="f-b" name="busca" type="search" defaultValue={sp.busca || ''} placeholder="Nome, telefone ou aluno indicador" /></div>
        {tudo && <div className="campo"><label htmlFor="f-r">Colaborador</label><select id="f-r" name="responsavel" defaultValue={sp.responsavel || ''}><option value="">Todos</option>{equipe.map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}</select></div>}
        {tudo && <div className="campo"><label htmlFor="f-v">Vendedor</label><select id="f-v" name="vendedor" defaultValue={sp.vendedor || ''}><option value="">Todos</option>{vend.map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}</select></div>}
        <label className="escolha" style={{ alignSelf: 'end' }}><span style={{ display: 'inline-flex', gap: 8 }}><input type="checkbox" name="finais" value="1" defaultChecked={!!sp.finais} /> Mostrar encerradas</span></label>
        <button className="btn peq" type="submit">Filtrar</button>
      </form>
      <div className="kanban">
        {colunas.map((e) => {
          const cards = porEtapa(e);
          return (
            <section key={e} className={`kanban-col ${ETAPAS_FINAIS.includes(e) ? 'final' : ''}`}>
              <header><b>{ETAPAS[e]}</b><span>{cards.length}</span></header>
              {cards.slice(0, 60).map((r) => {
                const vencido = r.proximo_contato && String(r.proximo_contato).slice(0, 10) < hojeISO;
                return (
                  <a key={r.id} href={`/indicacoes/${r.id}`} className={`kanban-card ${vencido ? 'vencido' : ''} ${r.aviso === 'bloqueado' ? 'bloqueado' : ''}`}>
                    <b>{r.nome}</b>
                    <span>indicado por {r.indicador}</span>
                    {r.interesse && <span>{r.interesse}</span>}
                    <span className="kanban-rodape">
                      {r.proximo_contato ? <em className={vencido ? 'atrasado' : ''}>{vencido ? 'atrasado · ' : ''}{fmtData(r.proximo_contato).slice(0, 5)}</em> : <em>sem próximo contato</em>}
                      {tudo && r.responsavel ? <i>{r.responsavel.split(' ')[0]}</i> : r.vendedor ? <i>{r.vendedor.split(' ')[0]}</i> : null}
                    </span>
                  </a>
                );
              })}
              {cards.length > 60 && <p className="suave pequeno">+{cards.length - 60} (use a busca)</p>}
            </section>
          );
        })}
      </div>
    </>
  );
}
