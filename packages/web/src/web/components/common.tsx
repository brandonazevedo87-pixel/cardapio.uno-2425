import { Link } from "wouter";
import { useEffect, useRef } from "react";
import { UtensilsCrossed, ArrowUpRight, Loader2, X } from "lucide-react";
export const money = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n / 100);
export const date = (s: string) =>
  new Date(s.length === 10 ? s + "T12:00:00" : s).toLocaleDateString("pt-BR");
export const statusLabels: Record<string, string> = {
  active: "Ativa",
  suspended: "Suspensa",
  cancelled: "Cancelada",
  trial: "Período de teste",
  received: "Recebido",
  confirmed: "Confirmado",
  preparing: "Em preparação",
  ready: "Pronto para retirada",
  out: "Saiu para entrega",
  completed: "Concluído",
};
export function Brand({ light = false }: { light?: boolean }) {
  return (
    <Link to="/" className={`brand ${light ? "light" : ""}`}>
      <span className="brand-icon">
        <UtensilsCrossed size={24} />
      </span>
      <span>
        cardápio
        <span className="brand-online">
          online<span className="brand-dot">.</span>
        </span>
      </span>
    </Link>
  );
}
export function Header() {
  return (
    <header className="site-header">
      <Brand />
      <nav>
        <a href="/#como-funciona">Como funciona</a>
        <a href="/#recursos">Recursos</a>
        <a href="/#planos">Planos</a>
      </nav>
      <div className="header-actions">
        <Link to="/login" className="login-link">
          Entrar
        </Link>
        <Link to="/cadastro" className="btn small yellow">
          Começar agora <ArrowUpRight size={16} />
        </Link>
      </div>
    </header>
  );
}
export function Loading() {
  return (
    <div className="loading">
      <Loader2 className="spin" /> Carregando…
    </div>
  );
}
export function ErrorBox({ error }: { error: unknown }) {
  if (!error) return null;
  return (
    <div className="notice error" role="alert">
      {error instanceof Error ? error.message : String(error)}
    </div>
  );
}
export function Empty({
  title,
  text,
  children,
}: {
  title: string;
  text: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="empty">
      <UtensilsCrossed />
      <h3>{title}</h3>
      <p>{text}</p>
      {children}
    </div>
  );
}
export function Badge({ status }: { status: string }) {
  return <span className={`badge ${status}`}>{statusLabels[status] ?? status}</span>;
}
export function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <div>
      <dialog ref={ref} className="modal" aria-modal="true" aria-label={title} onCancel={onClose}>
        <div className="modal-header">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Fechar">
            <X />
          </button>
        </div>
        {children}
      </dialog>
    </div>
  );
}
export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}
export function Submit({ busy, label = "Salvar alterações" }: { busy: boolean; label?: string }) {
  return (
    <button className="btn red" type="submit" disabled={busy}>
      {busy ? (
        <>
          <Loader2 size={17} className="spin" /> Salvando…
        </>
      ) : (
        label
      )}
    </button>
  );
}
export function Footer() {
  return (
    <footer className="site-footer">
      <Brand light />
      <p>
        Seu cardápio. Sua identidade.
        <br />
        Um novo jeito de servir.
      </p>
      <div>
        <Link to="/loja/burger-da-casa">Ver demonstração</Link>
        <Link to="/login">Acessar painel</Link>
        <a href="/#planos">Conhecer planos</a>
      </div>
      <small>
        © {new Date().getFullYear()} Cardápio Online. Feito para quem alimenta boas experiências.
      </small>
    </footer>
  );
}
