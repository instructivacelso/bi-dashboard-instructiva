import { exigirUsuario } from '@/lib/auth.js';
import { q } from '@/lib/db.js';
import { vePainelEmpresa, veDashboardSetor, ehSuperadmin, gerenteDe, lancaComercial } from '@/lib/perm.js';
import Menu from '@/components/Menu.js';
import { LogOut } from 'lucide-react';
import BotaoTema from '@/components/BotaoTema.js';
import { rotaFormulario } from '@/lib/formularios.js';
import { veDashboardComercial, cidadesVisiveis, ehDiretorComercial, cidadeDoVendedor } from '@/lib/comercial.js';
import { ehDoSuporte, veTodoSuporte } from '@/lib/suporte.js';
import { ehDaIndicacao, veTodaIndicacao, registraIndicacao, ehColaboradorIndicacao } from '@/lib/indicacao.js';
import { ehDoCs, veTodoCs } from '@/lib/cscx.js';
import { veFinanceiro } from '@/lib/financeiro.js';
import { sair, sairVerComo } from '@/app/login/actions.js';

export const dynamic = 'force-dynamic';

const CURTOS = { cs_gerente: 'Fechamento do gerente', indicacao_gerente: 'Fechamento do gerente', indicacao_colaborador: 'Formulário do dia', suporte_fechamento: 'Fechamento do dia', suporte_gerente: 'Fechamento do gerente', trafego: 'Tráfego pago', whatsapp: 'WhatsApp', automacao: 'Automação', editor: 'Vídeos e criativos', live: 'Live', gerente: 'Fechamento do gerente', vendedor: 'Vendedores', gerente_comercial: 'Gerente comercial', financeiro_fechamento: 'Fechamento do dia' };

async function montarMenu(u) {
  // Colaborador e prestador externo: só os próprios formulários e histórico
  if (['colaborador', 'externo'].includes(u.papel)) {
    const itens = [{ href: '/', rotulo: 'Meus formulários', icone: 'inicio' }];
    if (cidadeDoVendedor(u)) itens.push({ href: '/comercial/dashboard', rotulo: 'Meus resultados', icone: 'dashboard' });
    else if (cidadesVisiveis(u).length) itens.push({ href: '/comercial/dashboard', rotulo: 'Dashboard comercial', icone: 'dashboard' });
    if (ehDoSuporte(u)) itens.push({ href: '/suporte', rotulo: 'Meus atendimentos', icone: 'suporte' });
    if (ehDoCs(u)) itens.push({ href: '/cs', rotulo: 'Minha carteira', icone: 'cscx' });
    if (ehColaboradorIndicacao(u)) itens.push({ href: '/indicacoes/painel', rotulo: 'Meu painel de indicação', icone: 'dashboard' });
    if (ehDaIndicacao(u)) itens.push({ href: '/indicacoes', rotulo: registraIndicacao(u) ? 'Pipeline de indicação' : 'Minhas indicações', icone: 'indicacoes' });
    if (u.lotacoes.some((l) => l.setor === 'marketing')) itens.push({ href: '/historico', rotulo: 'Meus envios', icone: 'historico' });
    return [{ itens }];
  }
  const setores = await q('SELECT slug, nome, modulo_ativo FROM departments WHERE ativo ORDER BY ordem, id');
  const meus = vePainelEmpresa(u) ? setores : setores.filter((s) => u.lotacoes.some((l) => l.setor === s.slug));
  // Setores em árvore: "Comercial — Toledo" vira Comercial > Toledo; setor com formulários mostra as atividades
  const subs = await q(`SELECT s.nome, s.slug AS sub, s.formulario, s.formulario_ativo, d.slug, d.modulo_ativo FROM subdepartments s
                          JOIN departments d ON d.id=s.department_id WHERE s.ativo ORDER BY s.ordem, s.id`);
  const arvore = [];
  for (const s of meus) {
    const [pai, filho] = s.nome.split(' — ');
    const atividades = (s.slug === 'suporte' && ehDoSuporte(u) ? [{ href: '/suporte', rotulo: 'Atendimentos' }] : [])
      .concat(s.slug === 'indicacoes' && ehDaIndicacao(u) ? [{ href: '/indicacoes', rotulo: 'Pipeline' }] : [])
      .concat(s.slug === 'cscx' && ehDoCs(u) ? [{ href: '/cs', rotulo: 'Carteira de alunos' }] : []).concat(subs.filter((x) => x.slug === s.slug).map((x) => ({
      href: x.formulario && x.formulario_ativo && x.modulo_ativo ? rotaFormulario(x.formulario) : `/setor/${s.slug}#${x.sub}`,
      rotulo: CURTOS[x.formulario] || x.nome,
    })));
    if (filho) {
      let g = arvore.find((x) => x.rotulo === pai);
      if (!g) { g = { rotulo: pai, icone: s.slug, filhos: [] }; arvore.push(g); }
      g.filhos.push({ href: `/setor/${s.slug}`, rotulo: filho });
    } else if (atividades.length) {
      arvore.push({ rotulo: s.nome, icone: s.slug, filhos: atividades, base: `/setor/${s.slug}` });
    } else {
      arvore.push({ href: `/setor/${s.slug}`, rotulo: s.nome, icone: s.slug });
    }
  }
  const grupos = [
    { itens: [{ href: '/', rotulo: 'Início', icone: 'inicio' }] },
    { titulo: 'Setores', itens: arvore },
  ];
  const extra = [];
  if (veDashboardSetor(u, 'marketing')) extra.push({ href: '/marketing/dashboard', rotulo: 'Dashboard Marketing', icone: 'dashboard' });
  if (veDashboardComercial(u)) extra.push({ href: '/comercial/dashboard', rotulo: 'Dashboard Comercial', icone: 'comercial' });
  if (veTodoCs(u)) extra.push({ href: '/cs/dashboard', rotulo: 'Dashboard CS/CX', icone: 'cscx' });
  if (veTodaIndicacao(u)) extra.push({ href: '/indicacoes/dashboard', rotulo: 'Dashboard Indicação', icone: 'indicacoes' });
  if (veTodoSuporte(u)) extra.push({ href: '/suporte/dashboard', rotulo: 'Dashboard Suporte', icone: 'suporte' });
  if (veFinanceiro(u)) extra.push({ href: '/financeiro', rotulo: 'Financeiro', icone: 'financeiro' });
  if (ehDiretorComercial(u)) extra.push({ href: '/comercial/metas', rotulo: 'Metas comerciais', icone: 'pendencias' });
  if (vePainelEmpresa(u)) extra.push({ href: '/admin/tv', rotulo: 'Painel da TV', icone: 'tv' });
  if (ehSuperadmin(u) || gerenteDe(u, 'marketing')) extra.push({ href: '/admin/lancamentos', rotulo: 'Lançamentos', icone: 'lancamentos' });
  if (ehSuperadmin(u)) extra.push({ href: '/admin/usuarios', rotulo: 'Usuários', icone: 'usuarios' });
  if (extra.length) grupos.push({ titulo: 'Gestão', itens: extra });
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
      <main className="conteudo">
        {u.vendoComo && (
          <div className="faixa-ver-como" role="status">
            <span>Você está vendo o sistema como <b>{u.nome}</b>. Os envios ficam bloqueados neste modo.</span>
            <form action={sairVerComo}><button className="btn peq">Voltar para minha conta</button></form>
          </div>
        )}
        {children}
      </main>
    </div>
  );
}
