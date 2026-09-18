import { exigirUsuario } from '@/lib/auth.js';
import { ehSuperadmin, vePainelEmpresa } from '@/lib/perm.js';
import { Topo, Aviso } from '@/components/Ui.js';

export const dynamic = 'force-dynamic';

export default async function LinkTV() {
  const u = await exigirUsuario();
  if (!ehSuperadmin(u) && !vePainelEmpresa(u)) return <Aviso tipo="erro">Área restrita.</Aviso>;
  const chave = process.env.TV_CHAVE;
  const base = process.env.APP_URL || '';
  const link = chave ? `${base}/tv?chave=${encodeURIComponent(chave)}` : null;
  return (
    <>
      <Topo titulo="Painel da TV" descricao="Tela única com os números gerais da empresa, para deixar aberta na TV. Atualiza sozinha a cada minuto e não precisa de login." />
      <div className="painel">
        {link ? (
          <>
            <h2>Link do painel</h2>
            <p className="suave" style={{ margin: '8px 0 14px' }}>Abra este endereço no navegador da TV e coloque em tela cheia (tecla F11). Quem tiver o link consegue ver o painel, então não compartilhe fora da empresa.</p>
            <input type="text" readOnly value={link} aria-label="Link do painel da TV" />
            <div className="acoes-linha" style={{ marginTop: 14 }}><a className="btn" href={link} target="_blank">Abrir painel</a></div>
            <p className="suave pequeno" style={{ marginTop: 14 }}>Para trocar o link, altere a variável TV_CHAVE no Railway. O link antigo para de funcionar na hora.</p>
          </>
        ) : (
          <Aviso>Para ativar o painel, crie a variável <b>TV_CHAVE</b> no Railway com um texto aleatório (como fez na SESSION_SECRET) e aguarde o sistema reiniciar.</Aviso>
        )}
      </div>
    </>
  );
}
