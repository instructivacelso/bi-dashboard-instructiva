import { q } from '@/lib/db.js';
import { ehSuperadmin } from '@/lib/perm.js';
import FormEstado from '@/components/FormEstado.js';
import { salvarMembroSetor, alternarMembro } from '@/app/(app)/admin/actions.js';

// Lista e cadastro da equipe dentro do próprio setor
export default async function EquipeSetor({ setor, u }) {
  const [membros, subs] = await Promise.all([
    q(`SELECT x.id, x.nome, x.email, x.ativo, r.nome perfil, r.chave papel,
              string_agg(DISTINCT s.nome, ', ') atividades, bool_or(a.gerente) gerente
         FROM users x JOIN roles r ON r.id=x.role_id
         JOIN user_department_assignments a ON a.user_id=x.id
         LEFT JOIN subdepartments s ON s.id=a.subdepartment_id
        WHERE a.department_id=$1 GROUP BY x.id, r.nome, r.chave ORDER BY x.ativo DESC, x.nome`, [setor.id]),
    q('SELECT id, nome FROM subdepartments WHERE department_id=$1 AND ativo ORDER BY ordem', [setor.id]),
  ]);
  const admin = ehSuperadmin(u);
  return (
    <section className="secao grade g2" style={{ alignItems: 'start' }}>
      <div className="painel">
        <div className="painel-cab"><h2>Equipe do setor</h2><span className="suave pequeno">{membros.filter((m) => m.ativo).length} ativos</span></div>
        {membros.length === 0 ? <p className="suave">Ninguém cadastrado ainda.</p> : (
          <div className="tabela-wrap"><table className="equipe-lista"><tbody>
            {membros.map((m) => {
              const podeMexer = m.id !== u.id && (admin || ['colaborador', 'externo'].includes(m.papel));
              return (
                <tr key={m.id} style={{ opacity: m.ativo ? 1 : 0.55 }}>
                  <td>{m.nome}<br /><span className="suave pequeno" style={{ fontWeight: 400 }}>{m.email}</span></td>
                  <td className="pequeno">{m.gerente ? 'Gerente' : m.perfil}<br /><span className="suave">{m.atividades || '—'}</span></td>
                  <td>{podeMexer && (
                    <form action={alternarMembro}>
                      <input type="hidden" name="department_id" value={setor.id} />
                      <input type="hidden" name="user_id" value={m.id} />
                      <button className="btn sec peq">{m.ativo ? 'Desativar' : 'Reativar'}</button>
                    </form>
                  )}</td>
                </tr>
              );
            })}
          </tbody></table></div>
        )}
      </div>
      <div className="painel">
        <h2>Adicionar pessoa ao setor</h2>
        <p className="suave pequeno" style={{ margin: '6px 0 14px' }}>A pessoa vai ver só este setor e as atividades marcadas abaixo.</p>
        <FormEstado action={salvarMembroSetor} botao="Cadastrar pessoa">
          <input type="hidden" name="department_id" value={setor.id} />
          <div className="linha-campos">
            <div className="campo"><label htmlFor="m-nome">Nome</label><input id="m-nome" name="nome" type="text" required /></div>
            <div className="campo"><label htmlFor="m-email">E-mail</label><input id="m-email" name="email" type="email" required /></div>
          </div>
          <div className="linha-campos">
            <div className="campo"><label htmlFor="m-cargo">Cargo</label><input id="m-cargo" name="cargo" type="text" /></div>
            <div className="campo"><label htmlFor="m-senha">Senha inicial</label><input id="m-senha" name="senha" type="text" minLength={8} required autoComplete="off" /></div>
          </div>
          <fieldset className="campo" style={{ border: 0, padding: 0, margin: 0 }}>
            <legend className="rot" style={{ fontWeight: 700, marginBottom: 6 }}>Tipo de acesso</legend>
            <div className="escolha">
              <label><input type="radio" name="papel" value="colaborador" defaultChecked /> Colaborador</label>
              <label><input type="radio" name="papel" value="externo" /> Prestador externo</label>
              {admin && <label><input type="radio" name="papel" value="gerente" /> Gerente do setor</label>}
            </div>
          </fieldset>
          {subs.length > 0 && (
            <fieldset className="campo" style={{ border: 0, padding: 0, margin: 0 }}>
              <legend className="rot" style={{ fontWeight: 700, marginBottom: 6 }}>Atividades</legend>
              <div className="escolha">{subs.map((s) => <label key={s.id}><input type="checkbox" name="sub" value={s.id} /> {s.nome}</label>)}</div>
            </fieldset>
          )}
        </FormEstado>
      </div>
    </section>
  );
}
