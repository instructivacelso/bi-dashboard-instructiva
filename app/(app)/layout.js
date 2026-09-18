import { exigirUsuario } from '@/lib/auth.js';
import { q } from '@/lib/db.js';
import { vePainelEmpresa, veDashboardSetor, ehSuperadmin, gerenteDe, lancaComercial } from '@/lib/perm.js';
import Menu from '@/components/Menu.js';
import { sair } from '@/app/login/actions.js';

export const dynamic = 'force-dynamic';

async function montarMenu(u) {
  const setores = await q('SELECT slug, nome, modulo_ativo FROM departments WHERE ativo ORDER BY ordem');
  const meus = vePainelEmpresa(u) ? setores : setores.filter((s) => u.lotacoes.some((l) => l.setor === s.slug));
  const grupos = [
    { itens: [
      { href: '/', rotulo: 'Início' },
      { href: '/historico', rotulo: 'Histórico' },
      { href: '/acoes', rotulo: 'Ações e problemas' },
    ] },
    { titulo: 'Setores', itens: meus.map((s) => ({ href: `/setor/${s.slug}`, rotulo: s.nome, etiqueta: s.modulo_ativo ? null : 'em breve' })) },
  ];
  if (veDashboardSetor(u, 'marketing')) {
    grupos.push({ titulo: 'Dashboards', itens: [{ href: '/marketing/dashboard', rotulo: 'Marketing' }] });
  }
  const adm = [];
  if (ehSuperadmin(u)) {
    adm.push({ href: '/admin/usuarios', rotulo: 'Usuários' }, { href: '/admin/setores', rotulo: 'Setores e formulários' }, { href: '/admin/produtos', rotulo: 'Produtos' });
  }
  if (ehSuperadmin(u) || gerenteDe(u, 'marketing')) adm.push({ href: '/admin/lancamentos', rotulo: 'Lançamentos' });
  if (lancaComercial(u)) adm.push({ href: '/admin/comercial', rotulo: 'Vendas por lançamento' });
  if (vePainelEmpresa(u) || gerenteDe(u, 'marketing')) adm.push({ href: '/admin/pendencias', rotulo: 'Pendências da equipe' });
  if (vePainelEmpresa(u)) adm.push({ href: '/admin/auditoria', rotulo: 'Auditoria' });
  if (adm.length) grupos.push({ titulo: 'Gestão', itens: adm });
  return grupos;
}

function Lateral({ u, grupos }) {
  const funcao = u.lotacoes.map((l) => l.subsetorNome || l.setorNome).filter(Boolean);
  return (
    <aside className="lateral">
      <a className="marca" href="/">
        <img src="/logo.jpeg" alt="" />
        <div><strong>Instructiva</strong><span>BI Dashboard</span></div>
      </a>
      <Menu grupos={grupos} />
      <div className="usuario-box">
        <strong>{u.nome}</strong>
        <small>{u.papel_nome}{funcao.length ? ` · ${[...new Set(funcao)].join(', ')}` : ''}</small>
        <form action={sair}><button type="submit">Sair</button></form>
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
        <summary><strong>Instructiva</strong><span>Menu</span></summary>
        <Lateral u={u} grupos={grupos} />
      </details>
      <main className="conteudo">{children}</main>
    </div>
  );
}
