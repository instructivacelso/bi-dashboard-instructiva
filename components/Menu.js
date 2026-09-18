'use client';
import { usePathname } from 'next/navigation';
import {
  Home, History, AlertTriangle, Megaphone, Briefcase, Wallet, Users, Headphones, HeartHandshake, Smile, Share2, GraduationCap,
  Crown, BarChart3, UserCog, Layers, Package, Rocket, DollarSign, ClipboardCheck, ShieldCheck, Tv, Circle,
} from 'lucide-react';

const ICONES = {
  inicio: Home, historico: History, acoes: AlertTriangle, diretoria: Crown, marketing: Megaphone,
  'comercial-jesuitas': Briefcase, 'comercial-toledo': Briefcase, financeiro: Wallet, rh: Users, suporte: Headphones,
  'pos-venda': HeartHandshake, cscx: Smile, indicacoes: Share2, academico: GraduationCap, dashboard: BarChart3,
  usuarios: UserCog, setores: Layers, produtos: Package, lancamentos: Rocket, comercial: DollarSign,
  pendencias: ClipboardCheck, auditoria: ShieldCheck, tv: Tv,
};

export default function Menu({ grupos }) {
  const atual = usePathname();
  return (
    <nav className="menu" aria-label="Menu principal">
      {grupos.map((g) => (
        <div key={g.titulo || 'topo'} style={{ display: 'contents' }}>
          {g.titulo && <div className="menu-grupo">{g.titulo}</div>}
          {g.itens.map((i) => {
            const ativo = i.href === '/' ? atual === '/' : atual.startsWith(i.href);
            const Icone = ICONES[i.icone] || Circle;
            return (
              <a key={i.href} href={i.href} target={i.novaAba ? '_blank' : undefined} className={ativo ? 'ativo' : ''} aria-current={ativo ? 'page' : undefined}>
                <Icone aria-hidden="true" />
                <span className="rot-menu">{i.rotulo}</span>
                {i.etiqueta && <span className="etq">{i.etiqueta}</span>}
              </a>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
