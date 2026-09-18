import { notFound } from 'next/navigation';
import { exigirUsuario } from '@/lib/auth.js';
import { q, q1 } from '@/lib/db.js';
import { ehSuperadmin, gerenteDe } from '@/lib/perm.js';
import { STATUS_LANCAMENTO } from '@/lib/formularios.js';
import { Topo, Aviso } from '@/components/Ui.js';
import FormEstado from '@/components/FormEstado.js';
import { salvarLancamento } from '../../actions.js';

export const dynamic = 'force-dynamic';

const C = ({ n, r, t = 'text', v, req, dica }) => (
  <div className="campo">
    <label htmlFor={n}>{r}</label>
    <input id={n} name={n} type={t} defaultValue={v ?? ''} required={req} inputMode={t === 'text' && /meta|orcamento|max|min/.test(n) ? 'decimal' : undefined} />
    {dica && <small>{dica}</small>}
  </div>
);

export default async function EditarLancamento(props) {
  const params = await props.params;
  const u = await exigirUsuario();
  if (!ehSuperadmin(u) && !gerenteDe(u, 'marketing')) return <Aviso tipo="erro">Área restrita.</Aviso>;
  const novo = params.id === 'novo';
  const l = novo ? {} : await q1('SELECT * FROM launches WHERE id=$1', [Number(params.id)]);
  if (!l) notFound();
  const [produtos, gerentes, equipe, atribuidos] = await Promise.all([
    q('SELECT id, nome FROM products WHERE ativo ORDER BY nome'),
    q(`SELECT DISTINCT u.id, u.nome FROM users u JOIN user_department_assignments a ON a.user_id=u.id JOIN departments d ON d.id=a.department_id
        WHERE u.ativo AND d.slug='marketing' AND a.gerente ORDER BY u.nome`),
    q(`SELECT u.id, u.nome, r.nome perfil, string_agg(s.nome, ', ') atividades FROM users u JOIN roles r ON r.id=u.role_id
         JOIN user_department_assignments a ON a.user_id=u.id JOIN departments d ON d.id=a.department_id LEFT JOIN subdepartments s ON s.id=a.subdepartment_id
        WHERE u.ativo AND d.slug='marketing' GROUP BY u.id, u.nome, r.nome ORDER BY u.nome`),
    novo ? [] : q('SELECT user_id FROM launch_user_assignments WHERE launch_id=$1', [l.id]),
  ]);
  const ids = new Set(atribuidos.map((a) => a.user_id));

  return (
    <>
      <Topo titulo={novo ? 'Novo lançamento' : l.nome}><a className="btn sec" href="/admin/lancamentos">Voltar</a></Topo>
      <div className="painel">
        <FormEstado action={salvarLancamento} botao={novo ? 'Criar lançamento' : 'Salvar lançamento'}>
          {!novo && <input type="hidden" name="id" value={l.id} />}
          <h2>Identificação</h2>
          <C n="nome" r="Nome do lançamento" v={l.nome} req />
          <div className="linha-campos">
            <div className="campo"><label htmlFor="product_id">Produto</label>
              <select id="product_id" name="product_id" defaultValue={l.product_id || ''}><option value="">—</option>{produtos.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}</select>
            </div>
            <C n="professor" r="Professor" v={l.professor} />
            <div className="campo"><label htmlFor="gerente_id">Gerente responsável</label>
              <select id="gerente_id" name="gerente_id" defaultValue={l.gerente_id || ''}><option value="">—</option>{gerentes.map((g) => <option key={g.id} value={g.id}>{g.nome}</option>)}</select>
            </div>
            <div className="campo"><label htmlFor="status">Status</label>
              <select id="status" name="status" defaultValue={l.status || 'planejamento'}>{Object.entries(STATUS_LANCAMENTO).map(([k, r]) => <option key={k} value={k}>{r}</option>)}</select>
            </div>
          </div>
          <h2>Datas</h2>
          <div className="linha-campos">
            <C n="captacao_inicio" r="Início da captação" t="date" v={l.captacao_inicio} />
            <C n="captacao_fim" r="Fim da captação" t="date" v={l.captacao_fim} />
            <C n="data_live" r="Data da live/evento" t="date" v={l.data_live} />
            <C n="vendas_inicio" r="Abertura das vendas" t="date" v={l.vendas_inicio} />
            <C n="vendas_fim" r="Fechamento das vendas" t="date" v={l.vendas_fim} />
          </div>
          <label className="pequeno"><input type="checkbox" name="live_liberada" defaultChecked={l.live_liberada} /> Liberar o formulário da live fora da data da live</label>
          <h2>Metas</h2>
          <div className="linha-campos">
            <C n="orcamento" r="Orçamento de marketing (R$)" v={l.orcamento} />
            <C n="meta_cadastros" r="Meta de cadastros" v={l.meta_cadastros} />
            <C n="meta_grupos" r="Meta de pessoas nos grupos" v={l.meta_grupos} />
            <C n="meta_live" r="Meta de audiência na live" v={l.meta_live} />
            <C n="meta_lista" r="Meta de lista de reserva" v={l.meta_lista} />
            <C n="meta_vendas" r="Meta de vendas" v={l.meta_vendas} />
            <C n="meta_faturamento" r="Meta de faturamento (R$)" v={l.meta_faturamento} />
            <C n="cpl_max" r="CPL máximo (R$)" v={l.cpl_max} />
            <C n="cac_max" r="CAC máximo (R$)" v={l.cac_max} />
            <C n="roas_min" r="ROAS mínimo" v={l.roas_min} dica="Ex.: 3 para 3x" />
          </div>
          <h2>Links</h2>
          <div className="linha-campos">
            <C n="link_pagina" r="Página" t="url" v={l.link_pagina} />
            <C n="link_grupo" r="Grupo" t="url" v={l.link_grupo} />
            <C n="link_live" r="Live" t="url" v={l.link_live} />
            <C n="link_checkout" r="Checkout" t="url" v={l.link_checkout} />
          </div>
          <h2>Equipe atribuída</h2>
          <p className="suave pequeno">Só quem estiver marcado vê este lançamento e recebe os formulários dele. Prestadores externos veem apenas os lançamentos marcados aqui.</p>
          <div className="escolha">
            {equipe.map((p) => (
              <label key={p.id}><input type="checkbox" name="usuarios" value={p.id} defaultChecked={ids.has(p.id)} /> {p.nome} <span className="suave pequeno">· {p.atividades || p.perfil}</span></label>
            ))}
          </div>
        </FormEstado>
      </div>
    </>
  );
}
