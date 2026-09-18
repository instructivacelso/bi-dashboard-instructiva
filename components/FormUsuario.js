import FormEstado from '@/components/FormEstado.js';
import { salvarUsuario } from '@/app/(app)/admin/actions.js';

// Formulário de usuário (criação e edição) com perfil e lotações
export default function FormUsuario({ usuario = {}, perfis, setores, subsetores, lotacoes = [] }) {
  const temSub = (id) => lotacoes.some((l) => l.subdepartment_id === id);
  const temDep = (id) => lotacoes.some((l) => l.department_id === id);
  const ger = (id) => lotacoes.some((l) => l.department_id === id && l.gerente);
  return (
    <FormEstado action={salvarUsuario} botao={usuario.id ? 'Salvar usuário' : 'Criar usuário'}>
      {usuario.id && <input type="hidden" name="id" value={usuario.id} />}
      <div className="linha-campos">
        <div className="campo"><label htmlFor="nome">Nome</label><input id="nome" name="nome" type="text" defaultValue={usuario.nome} required /></div>
        <div className="campo"><label htmlFor="email">E-mail</label><input id="email" name="email" type="email" defaultValue={usuario.email} required /></div>
      </div>
      <div className="linha-campos">
        <div className="campo"><label htmlFor="cargo">Cargo</label><input id="cargo" name="cargo" type="text" defaultValue={usuario.cargo || ''} /></div>
        <div className="campo"><label htmlFor="role_id">Perfil de acesso</label>
          <select id="role_id" name="role_id" defaultValue={usuario.role_id || ''} required>
            <option value="">Escolha…</option>
            {perfis.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
          </select>
        </div>
      </div>
      <div className="campo">
        <label htmlFor="senha">{usuario.id ? 'Nova senha (deixe em branco para manter)' : 'Senha inicial'}</label>
        <input id="senha" name="senha" type="password" minLength={8} autoComplete="new-password" required={!usuario.id} />
      </div>
      <label className="escolha" style={{ fontWeight: 600 }}>
        <span style={{ display: 'inline-flex', gap: 8 }}><input type="checkbox" name="ativo" defaultChecked={usuario.id ? usuario.ativo : true} /> Acesso ativo</span>
      </label>
      <fieldset className="campo" style={{ border: 0, padding: 0, margin: 0 }}>
        <legend className="rot" style={{ fontWeight: 700, marginBottom: 6 }}>Setores e atividades</legend>
        <small className="suave">Marque as atividades que a pessoa executa. Os formulários dela vêm daqui. Prestador externo: marque só a atividade dele.</small>
        {setores.map((s) => {
          const subs = subsetores.filter((x) => x.department_id === s.id);
          return (
            <div key={s.id} style={{ borderTop: '1px solid var(--linha)', paddingTop: 10, marginTop: 10 }}>
              <div className="acoes-linha" style={{ alignItems: 'center' }}>
                {subs.length === 0
                  ? <label><input type="checkbox" name="dep" value={s.id} defaultChecked={temDep(s.id)} /> <strong>{s.nome}</strong></label>
                  : <strong>{s.nome}</strong>}
                <label className="pequeno suave"><input type="checkbox" name="ger" value={s.id} defaultChecked={ger(s.id)} /> gerente deste setor</label>
              </div>
              {subs.length > 0 && (
                <div className="escolha" style={{ marginTop: 6 }}>
                  {subs.map((x) => (
                    <label key={x.id}><input type="checkbox" name="sub" value={x.id} defaultChecked={temSub(x.id)} /> {x.nome}</label>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </fieldset>
    </FormEstado>
  );
}
