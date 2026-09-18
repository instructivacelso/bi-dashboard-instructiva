import { exigirUsuario } from '@/lib/auth.js';
import { q } from '@/lib/db.js';
import { vePainelEmpresa, veDashboardSetor, ehSuperadmin, gerenteDe, lancaComercial } from '@/lib/perm.js';
import Menu from '@/components/Menu.js';
import { LogOut } from 'lucide-react';
import BotaoTema from '@/components/BotaoTema.js';
import { sair } from '@/app/login/actions.js';

export const dynamic = 'force-dynamic';

async function montarMenu(u) {
  // Colaborador e prestador externo: só os próprios formulários e histórico
  if (['colaborador', 'externo'].includes(u.papel)) {
    return [{ itens: [{ href: '/', rotulo: 'Meus formulários', icone: 'inicio' }, { href: '/historico', rotulo: 'Meus envios', icone: 'historico' }] }];
  }
  const setores = await q('SELECT slug, nome, modulo_ativo FROM departments WHERE ativo ORDER BY ordem');
  const meus = vePainelEmpresa(u) ? setores : setores.filter((s) => u.lotacoes.some((l) => l.setor === s.slug));
  const grupos = [
    { itens: [
      { href: '/', rotulo: 'Início', icone: 'inicio' },
      { href: '/historico', rotulo: 'Histórico', icone: 'historico' },
      { href: '/acoes', rotulo: 'Ações e problemas', icone: 'acoes' },
    ] },
    { titulo: 'Setores', itens: meus.map((s) => ({ href: `/setor/${s.slug}`, rotulo: s.nome, icone: s.slug })) },
  ];
  if (veDashboardSetor(u, 'marketing')) {
    grupos.push({ titulo: 'Dashboards', itens: [{ href: '/marketing/dashboard', rotulo: 'Marketing', icone: 'dashboard' }] });
  }
  const adm = [];
  if (ehSuperadmin(u)) {
    adm.push({ href: '/admin/usuarios', rotulo: 'Usuários', icone: 'usuarios' }, { href: '/admin/setores', rotulo: 'Setores e formulários', icone: 'setores' }, { href: '/admin/produtos', rotulo: 'Produtos', icone: 'produtos' });
  }
  if (ehSuperadmin(u) || gerenteDe(u, 'marketing')) adm.push({ href: '/admin/lancamentos', rotulo: 'Lançamentos', icone: 'lancamentos' });
  if (lancaComercial(u)) adm.push({ href: '/admin/comercial', rotulo: 'Vendas por lançamento', icone: 'comercial' });
  if (vePainelEmpresa(u) || gerenteDe(u, 'marketing')) adm.push({ href: '/admin/pendencias', rotulo: 'Pendências da equipe', icone: 'pendencias' });
  if (vePainelEmpresa(u)) adm.push({ href: '/admin/tv', rotulo: 'Painel da TV', icone: 'tv' });
  if (vePainelEmpresa(u)) adm.push({ href: '/admin/auditoria', rotulo: 'Auditoria', icone: 'auditoria' });
  if (adm.length) grupos.push({ titulo: 'Gestão', itens: adm });
  return grupos;
}

function Lateral({ u, grupos }) {
  const funcao = u.lotacoes.map((l) => l.subsetorNome || l.setorNome).filter(Boolean);
  return (
    <aside className="lateral">
      <a className="marca" href="/">
        <img src="/logo.jpeg" alt="" />
        <div><strong>Escola Instructiva</strong><span>Painel de gestão</span></div>
      </a>
      <Menu grupos={grupos} />
      <div className="usuario-box">
        <span className="mini-av" aria-hidden="true">{u.nome.split(' ').map((x) => x[0]).slice(0, 2).join('').toUpperCase()}</span>
        <div>
          <strong>{u.nome}</strong>
          <small>{funcao.length ? [...new Set(funcao)].join(', ') : 'Acesso completo'}</small>
        </div>
        <BotaoTema />
        <form action={sair}><button type="submit" aria-label="Sair" title="Sair"><LogOut size={16} /></button></form>
      </div>
    </aside>
  );
}

export default async function AppLayout({ children }) {
  const u = await exigirUsuario();
  const grupos = await montarMenu(u);
  return (
    <div className="app">
      <Lateral u={u} grupos={grupos} />
      <details className="barra-movel">
        <summary><strong>Escola Instructiva</strong><span>Menu</span></summary>
        <Lateral u={u} grupos={grupos} />
      </details>
      <main className="conteudo">{children}</main>
    </div>
  );
}
