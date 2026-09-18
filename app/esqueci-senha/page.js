export default function EsqueciSenha() {
  return (
    <main className="login-form" style={{ minHeight: '100vh' }}>
      <div className="form">
        <h2>Recuperar senha</h2>
        <p className="suave">
          Peça ao administrador do sistema um link de redefinição. Ele gera o link na tela de usuários e envia para você
          pelo WhatsApp ou e-mail. O link vale por 24 horas e só pode ser usado uma vez.
        </p>
        <a className="btn sec" href="/login">Voltar para o login</a>
      </div>
    </main>
  );
}
