import { useState } from "react";
import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  Store,
  CreditCard,
  Settings,
  Package,
  Tags,
  ShoppingBag,
  Palette,
  BarChart3,
  LogOut,
  ExternalLink,
  Menu,
  X,
  ChevronRight,
  ShieldCheck,
} from "lucide-react";
import { Brand } from "./common";
import { logout } from "../lib/auth";
const ownerNav = [
  { path: "", text: "Visão geral", icon: LayoutDashboard },
  { path: "/empresas", text: "Empresas", icon: Store },
  { path: "/planos", text: "Planos", icon: Tags },
  { path: "/assinaturas", text: "Assinaturas", icon: CreditCard },
  { path: "/relatorios", text: "Relatórios", icon: BarChart3 },
  { path: "/configuracoes", text: "Configurações", icon: Settings },
];
const merchantNav = [
  { path: "", text: "Visão geral", icon: LayoutDashboard },
  { path: "/produtos", text: "Produtos", icon: Package },
  { path: "/categorias", text: "Categorias", icon: Tags },
  { path: "/pedidos", text: "Pedidos", icon: ShoppingBag },
  { path: "/personalizacao", text: "Minha loja", icon: Palette },
  { path: "/relatorios", text: "Relatórios", icon: BarChart3 },
  { path: "/assinatura", text: "Assinatura", icon: CreditCard },
];
export function DashboardShell({
  owner,
  name,
  slug,
  children,
}: {
  owner: boolean;
  name: string;
  slug?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [location] = useLocation();
  const base = owner ? "/dono" : "/painel",
    nav = owner ? ownerNav : merchantNav,
    active = nav.find((n) => base + n.path === location);
  return (
    <div className="dashboard">
      <aside className={`sidebar ${open ? "open" : ""}`}>
        <Brand />
        <button
          className="sidebar-close icon-btn"
          onClick={() => setOpen(false)}
          aria-label="Fechar menu"
        >
          <X />
        </button>
        <div className="workspace">
          <span className="workspace-icon">
            {owner ? <ShieldCheck size={22} /> : <Store size={22} />}
          </span>
          <div>
            <strong>{owner ? "Sua plataforma" : name}</strong>
            <small>{owner ? "Proprietário" : "Meu estabelecimento"}</small>
          </div>
        </div>
        <span className="nav-caption">GERENCIAMENTO</span>
        <nav>
          {nav.map((n) => (
            <Link
              onClick={() => setOpen(false)}
              className={location === base + n.path ? "active" : ""}
              key={n.path}
              to={base + n.path}
            >
              <n.icon size={19} />
              {n.text}
              <ChevronRight size={14} />
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          {slug && (
            <Link className="public-link" to={`/loja/${slug}`} target="_blank">
              <ExternalLink size={17} /> Abrir meu cardápio
            </Link>
          )}
          <button onClick={() => void logout()}>
            <LogOut size={18} /> Sair da conta
          </button>
          <small>cardápio online. • Seu negócio em boas mãos.</small>
        </div>
      </aside>
      {open && <button aria-label="Fechar navegação" className="sidebar-overlay" onClick={() => setOpen(false)} />}
      <div className="dashboard-body">
        <header className="dashboard-top">
          <button
            className="mobile-menu icon-btn"
            onClick={() => setOpen(true)}
            aria-label="Abrir menu"
          >
            <Menu />
          </button>
          <span>
            {owner ? "Painel do proprietário" : "Painel da loja"} <ChevronRight size={14} />{" "}
            <b>{active?.text ?? "Detalhes"}</b>
          </span>
          <div className="user-chip">
            <span>{name.charAt(0).toUpperCase()}</span>
            <strong>{name}</strong>
          </div>
        </header>
        <main className="dashboard-main">{children}</main>
      </div>
    </div>
  );
}
export function PageHeading({
  eyebrow,
  title,
  text,
  children,
}: {
  eyebrow: string;
  title: string;
  text: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{text}</p>
      </div>
      {children}
    </div>
  );
}
export function Stats({
  items,
}: {
  items: { label: string; value: string | number; note?: string; icon?: React.ReactNode }[];
}) {
  return (
    <div className="stats-grid">
      {items.map((s) => (
        <article key={s.label}>
          <div>
            <span>{s.label}</span>
            {s.icon}
          </div>
          <strong>{s.value}</strong>
          {s.note && <small>{s.note}</small>}
        </article>
      ))}
    </div>
  );
}
export function Bars({ items }: { items: { label: string; value: number }[] }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <div className="bars">
      {items.map((i) => (
        <div key={i.label}>
          <span>{i.label}</span>
          <div>
            <i style={{ width: `${(i.value / max) * 100}%` }} />
          </div>
          <strong>{i.value}</strong>
        </div>
      ))}
    </div>
  );
}
