import { exigirUsuario } from '@/lib/auth.js';
import { q } from '@/lib/db.js';
import { fmtData, hoje } from '@/lib/datas.js';
import { gereConteudo, ETAPAS_CONTEUDO, ORDEM_CONTEUDO, PRIORIDADES } from '@/lib/academico.js';
import { pipelineBoard } from '@/lib/dadosAcademico.js';
import { Topo, Aviso } from '@/components/Ui.js';
import FormEstado from '@/components/FormEstado.js';
import { salvarConteudo } from '../actions.js';

export const dynamic = 'force-dynamic';
const COLS = [...ORDEM_CONTEUDO, 'atualizacao'];

export default async function Pipeline() {
  const u = await exigirUsuario();
  if (!gereConteudo(u)) return <><Topo titulo="Pipeline de conteúdo" /><Aviso tipo="erro">Área da coordenação e dos professores.</Aviso></>;
  const [itens, produtos, usuarios] = await Promise.all([
    pipelineBoard(), q('SELECT id, nome FROM products ORDER BY nome'), q('SELECT id, nome FROM users WHERE ativo ORDER BY nome'),
  ]);
  const porEtapa = Object.fromEntries(COLS.map((e) => [e, []]));
  for (const it of itens) (porEtapa[it.etapa] ||= []).push(it);
  const dia = hoje();

  return (
    <>
      <Topo titulo="Pipeline de conteúdo" descricao="Da ideia à publicação. O conteúdo só avança de etapa."><a className="btn sec" href="/academico">Painel</a></Topo>

      <div className="painel"><h2>Novo conteúdo</h2>
        <FormEstado action={salvarConteudo} botao="Criar no pipeline">
          <div className="linha-campos">
            <div className="campo"><label>Título</label><input name="titulo" required /></div>
            <div className="campo"><label>Produto</label><select name="product_id" defaultValue=""><option value="">—</option>{produtos.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}</select></div>
            <div className="campo"><label>Tipo</label><input name="tipo" placeholder="aula, apostila, criativo…" /></div>
          </div>
          <div className="linha-campos">
            <div className="campo"><label>Etapa</label><select name="etapa" defaultValue="ideia">{Object.entries(ETAPAS_CONTEUDO).map(([v, r]) => <option key={v} value={v}>{r}</option>)}</select></div>
            <div className="campo"><label>Prioridade</label><select name="prioridade" defaultValue="media">{Object.entries(PRIORIDADES).map(([v, r]) => <option key={v} value={v}>{r}</option>)}</select></div>
            <div className="campo"><label>Prazo</label><input name="prazo" type="date" /></div>
            <div className="campo"><label>Responsável</label><select name="responsavel_id" defaultValue={u.id}>{usuarios.map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}</select></div>
          </div>
        </FormEstado>
      </div>

      <div className="kanban" style={{ marginTop: 18 }}>
        {COLS.map((e) => (
          <section key={e} className={`kanban-col ${e === 'atualizacao' ? 'final' : ''}`}>
            <header><b>{ETAPAS_CONTEUDO[e]}</b><span className="suave">{porEtapa[e].length}</span></header>
            {porEtapa[e].map((it) => {
              const atrasado = it.prazo && String(it.prazo).slice(0, 10) < dia;
              return (
                <div key={it.id} className={`kanban-card ${atrasado ? 'vencido' : ''}`}>
                  <b>{it.titulo}</b>
                  <span className="kanban-rodape">{it.produto || it.curso || '—'} · {PRIORIDADES[it.prioridade]}</span>
                  {it.prazo && <span className="suave pequeno">prazo {fmtData(it.prazo)}{atrasado ? ' · atrasado' : ''}</span>}
                  {it.responsavel && <span className="suave pequeno">{it.responsavel}</span>}
                  <form action={salvarConteudo} className="mover">
                    <input type="hidden" name="id" value={it.id} />
                    <input type="hidden" name="prioridade" value={it.prioridade} />
                    <input type="hidden" name="prazo" value={it.prazo ? String(it.prazo).slice(0, 10) : ''} />
                    <input type="hidden" name="responsavel_id" value={it.responsavel_id || ''} />
                    <input type="hidden" name="link" value={it.link || ''} />
                    <input type="hidden" name="observacao" value={it.observacao || ''} />
                    <select name="etapa" defaultValue={it.etapa}>{Object.entries(ETAPAS_CONTEUDO).map(([v, r]) => <option key={v} value={v}>{r}</option>)}</select>
                    <button className="btn sec peq" type="submit">Mover</button>
                  </form>
                </div>
              );
            })}
            {porEtapa[e].length === 0 && <span className="suave pequeno">—</span>}
          </section>
        ))}
      </div>
    </>
  );
}
