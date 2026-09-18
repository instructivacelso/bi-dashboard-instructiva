'use client';
import { usePathname } from 'next/navigation';
import {
  Home, History, AlertTriangle, Megaphone, Briefcase, Wallet, Users, Headphones, HeartHandshake, Smile, Share2, GraduationCap,
  Crown, BarChart3, UserCog, Layers, Package, Rocket, DollarSign, ClipboardCheck, ShieldCheck, Tv, Circle, ChevronRight, LifeBuoy,
} from 'lucide-react';

const ICONES = {
  inicio: Home, historico: History, acoes: AlertTriangle, diretoria: Crown, marketing: Megaphone,
  'comercial-jesuitas': Briefcase, 'comercial-toledo': Briefcase, 'comercial-diretoria': Briefcase, financeiro: Wallet, rh: Users, suporte: Headphones,
  'pos-venda': HeartHandshake, cscx: Smile, indicacoes: Share2, academico: GraduationCap, dashboard: BarChart3,
  usuarios: UserCog, setores: Layers, produtos: Package, lancamentos: Rocket, comercial: DollarSign,
  pendencias: ClipboardCheck, 'suporte-menu': LifeBuoy, auditoria: ShieldCheck, tv: Tv,
};

const estaEm = (atual, href) => (href === '/' ? atual === '/' : atual === href || atual.startsWith(href + '/') || atual.startsWith(href + '?'));

function Link({ i, atual, sub }) {
  const ativo = i.href.split('#')[0] === atual;
  const Icone = ICONES[i.icone] || Circle;
  return (
    <a href={i.href} className={`${ativo ? 'ativo' : ''} ${sub ? 'sub' : ''}`} aria-current={ativo ? 'page' : undefined}>
      {!sub && <Icone aria-hidden="true" />}
      <span className="rot-menu">{i.rotulo}</span>
    </a>
  );
}

export default function Menu({ grupos }) {
  const caminho = usePathname();
  // Marca só o item mais específico que corresponde à página atual
  const hrefs = grupos.flatMap((g) => g.itens.flatMap((i) => (i.filhos ? i.filhos.map((f) => f.href) : [i.href]))).map((h) => h.split('#')[0]);
  const melhor = hrefs.filter((h) => estaEm(caminho, h)).sort((a, b) => b.length - a.length)[0];
  const atual = melhor || caminho;
  return (
    <nav className="menu" aria-label="Menu principal">
      {grupos.map((g) => (
        <div key={g.titulo || 'topo'} style={{ display: 'contents' }}>
          {g.titulo && <div className="menu-grupo">{g.titulo}</div>}
          {g.itens.map((i) => {
            if (!i.filhos) return <Link key={i.href} i={i} atual={atual} />;
            const Icone = ICONES[i.icone] || Circle;
            const aberto = i.filhos.some((f) => f.href.split('#')[0] === atual) || (i.base && estaEm(caminho, i.base));
            return (
              <details key={i.rotulo} className="menu-pai" open={aberto}>
                <summary className={aberto ? 'dentro' : ''}>
                  <Icone aria-hidden="true" />
                  <span className="rot-menu">{i.rotulo}</span>
                  <ChevronRight className="seta" aria-hidden="true" />
                </summary>
                <div className="submenu">
                  {i.filhos.map((f) => <Link key={f.href} i={f} atual={atual} sub />)}
                </div>
              </details>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
