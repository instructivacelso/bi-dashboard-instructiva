import { exigirUsuario } from '@/lib/auth.js';
import { q } from '@/lib/db.js';
import { configuraAcademico, veAcademico, STATUS_PROFESSOR } from '@/lib/academico.js';
import { professores } from '@/lib/dadosAcademico.js';
import { Topo, Aviso, Semaforo } from '@/components/Ui.js';
import FormEstado from '@/components/FormEstado.js';
import { salvarProfessor, salvarMetasAcademico } from '../actions.js';

export const dynamic = 'force-dynamic';

export default async function CadastrosAcademico() {
  const u = await exigirUsuario();
  if (!configuraAcademico(u)) return <><Topo titulo="Cadastros do Acadêmico" /><Aviso tipo="erro">Só a coordenação e o administrador acessam.</Aviso></>;
  const [lista, usuarios, metas, cfg] = await Promise.all([
    professores(), q('SELECT id, nome FROM users WHERE ativo ORDER BY nome'),
    q('SELECT * FROM academic_goals'), q(`SELECT valor FROM configuracoes WHERE chave='academico_horario_limite'`),
  ]);
  const limite = cfg[0]?.valor || '20:00';
  const metaDe = Object.fromEntries(metas.map((m) => [m.user_id, m]));
  // professores com login vinculado entram nas metas
  const comLogin = lista.filter((p) => p.user_id);
  const opt = (o) => Object.entries(o).map(([v, r]) => <option key={v} value={v}>{r}</option>);
  const Campos = ({ p = {} }) => (
    <>
      <div className="linha-campos">
        <div className="campo"><label>Nome</label><input name="nome" defaultValue={p.nome} required /></div>
        <div className="campo"><label>Login vinculado</label><select name="user_id" defaultValue={p.user_id || ''}><option value="">—</option>{usuarios.map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}</select></div>
        <div className="campo"><label>Status</label><select name="status" defaultValue={p.status || 'ativo'}>{opt(STATUS_PROFESSOR)}</select></div>
      </div>
      <div className="linha-campos">
        <div className="campo"><label>Especialidade</label><input name="especialidade" defaultValue={p.especialidade || ''} /></div>
        <div className="campo"><label>Unidade</label><input name="unidade" defaultValue={p.unidade || ''} /></div>
        <div className="campo"><label>Gestor</label><select name="gestor_id" defaultValue={p.gestor_id || ''}><option value="">—</option>{usuarios.map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}</select></div>
      </div>
    </>
  );

  return (
    <>
      <Topo titulo="Cadastros do Acadêmico" descricao="Professores e metas."><a className="btn sec" href="/academico">Painel</a></Topo>

      <section className="secao painel"><h2>Novo professor</h2>
        <FormEstado action={salvarProfessor} botao="Cadastrar professor"><Campos /></FormEstado>
      </section>

      {lista.length > 0 && (
        <section className="secao painel"><h2>Professores</h2>
          <div className="grade g2">{lista.map((p) => (
            <div className="painel" key={p.id}><FormEstado action={salvarProfessor} botao="Salvar">
              <input type="hidden" name="id" value={p.id} /><Campos p={p} />
              <Semaforo cor={p.status === 'ativo' ? 'verde' : p.status === 'inativo' ? 'vermelho' : 'amarelo'} texto={STATUS_PROFESSOR[p.status]} />
            </FormEstado></div>
          ))}</div>
        </section>
      )}

      <section className="secao painel"><h2>Metas por professor (mês)</h2>
        {comLogin.length === 0 ? <Aviso>Vincule um login aos professores para definir metas.</Aviso> : (
          <FormEstado action={salvarMetasAcademico} botao="Salvar metas">
            <div className="linha-campos" style={{ maxWidth: 320 }}>
              <div className="campo"><label>Horário-limite do registro</label><input name="horario_limite" type="time" defaultValue={limite} /></div>
            </div>
            <div className="tabela-wrap"><table>
              <thead><tr><th>Professor</th><th className="num">Aulas</th><th className="num">Criativos</th><th className="num">Páginas</th><th className="num">Lives</th><th className="num">Receita</th><th className="num">Entrega no prazo %</th></tr></thead>
              <tbody>{comLogin.map((p) => { const m = metaDe[p.user_id] || {}; const inp = (k, v) => <input name={`${k}_${p.user_id}`} type="text" inputMode="decimal" pattern="[0-9.,]*" defaultValue={v ?? ''} style={{ width: 90 }} />; return (
                <tr key={p.id}><td>{p.nome}<input type="hidden" name="professor" value={p.user_id} /></td>
                  <td className="num">{inp('aulas', m.meta_aulas_mes)}</td><td className="num">{inp('criativos', m.meta_criativos_mes)}</td><td className="num">{inp('paginas', m.meta_paginas_mes)}</td>
                  <td className="num">{inp('lives', m.meta_lives_mes)}</td><td className="num">{inp('receita', m.meta_receita_mes)}</td><td className="num">{inp('prazo', m.meta_entrega_prazo)}</td></tr>
              ); })}</tbody>
            </table></div>
          </FormEstado>
        )}
      </section>
    </>
  );
}
