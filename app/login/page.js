import { redirect } from 'next/navigation';
import { usuarioAtual } from '@/lib/auth.js';
import FormEstado from '@/components/FormEstado.js';
import { entrar } from './actions.js';

export const dynamic = 'force-dynamic';

export default async function Login() {
  if (await usuarioAtual()) redirect('/');
  return (
    <main className="login-wrap">
      <section className="login-lado">
        <div>
          <img src="/logo.jpeg" alt="Escola Instructiva" />
          <h1>Os números da escola em um só lugar</h1>
          <p>Preencha seu fechamento do dia em menos de dois minutos e acompanhe metas, pendências e gargalos.</p>
          <div className="orbita" aria-hidden="true" />
        </div>
        <p className="pequeno">BI Dashboard Instructiva</p>
      </section>
      <section className="login-form">
        <FormEstado action={entrar} botao="Entrar" botaoEnviando="Entrando…">
          <h2>Entrar</h2>
          <div className="campo">
            <label htmlFor="email">E-mail</label>
            <input id="email" name="email" type="email" autoComplete="email" required />
          </div>
          <div className="campo">
            <label htmlFor="senha">Senha</label>
            <input id="senha" name="senha" type="password" autoComplete="current-password" required />
          </div>
          <a href="/esqueci-senha" className="pequeno">Esqueci minha senha</a>
        </FormEstado>
      </section>
    </main>
  );
}
