import FormEstado from '@/components/FormEstado.js';
import { redefinirSenha } from '@/app/login/actions.js';

export default async function Redefinir(props) {
  const params = await props.params;
  return (
    <main className="login-form" style={{ minHeight: '100vh' }}>
      <FormEstado action={redefinirSenha} botao="Salvar nova senha" sucesso="Senha alterada. Você já pode entrar.">
        <h2>Criar nova senha</h2>
        <input type="hidden" name="token" value={params.token} />
        <div className="campo">
          <label htmlFor="senha">Nova senha</label>
          <input id="senha" name="senha" type="password" minLength={8} autoComplete="new-password" required />
          <small>Mínimo de 8 caracteres.</small>
        </div>
        <div className="campo">
          <label htmlFor="confirmacao">Repita a nova senha</label>
          <input id="confirmacao" name="confirmacao" type="password" minLength={8} autoComplete="new-password" required />
        </div>
        <a href="/login" className="pequeno">Ir para o login</a>
      </FormEstado>
    </main>
  );
}
