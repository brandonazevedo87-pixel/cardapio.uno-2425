import { useState } from "react";
import { Link, useLocation, Redirect } from "wouter";
import { ArrowLeft, ArrowUpRight, Eye, EyeOff, ShieldCheck } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Brand, Field, Submit, ErrorBox, Loading } from "../components/common";
import { authClient, captureToken } from "../lib/auth";
import { client } from "../lib/api";
import { useOfferings, useProfile, useOperation } from "../queries/platform";

export default function Login({ signup = false }: { signup?: boolean }) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [show, setShow] = useState(false),
    [forgot, setForgot] = useState(false);
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const f = new FormData(e.currentTarget);
    try {
      const email = String(f.get("email")).trim().toLowerCase(),
        password = String(f.get("password"));
      const result = signup
        ? await authClient.signUp.email(
            { name: String(f.get("name")), email, password },
            { onSuccess: captureToken },
          )
        : await authClient.signIn.email({ email, password }, { onSuccess: captureToken });
      if (result.error) throw new Error(result.error.message ?? "Não foi possível entrar.");
      qc.clear();
      const profile = await client.account.profile();
      navigate(
        profile.membership?.role === "admin"
          ? "/dono"
          : profile.membership
            ? "/painel"
            : "/configurar" + window.location.search,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao autenticar.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="auth-page">
      <div className="auth-story">
        <Brand light />
        <span className="eyebrow">SEU NEGÓCIO. UM NOVO JEITO DE SERVIR.</span>
        <h1>
          UM CARDÁPIO
          <br />
          QUE DÁ
          <br />
          <span>ÁGUA NA BOCA.</span>
        </h1>
        <img src="/images/hero.png" alt="Hambúrguer e batatas" />
        <small>
          <ShieldCheck size={16} /> Sua marca em destaque. Sua gestão em um só lugar.
        </small>
      </div>
      <div className="auth-form-side">
        <Link to="/" className="back-link">
          <ArrowLeft size={17} /> Voltar ao início
        </Link>
        <div className="auth-form">
          <span className="eyebrow">CARDÁPIO ONLINE</span>
          <h2>{signup ? "Vamos abrir o apetite?" : "Bom ter você de volta."}</h2>
          <p>
            {signup
              ? "Crie sua conta e configure seu estabelecimento."
              : "Entre para cuidar do seu negócio."}
          </p>
          <form onSubmit={submit}>
            {signup && (
              <Field label="Seu nome">
                <input
                  aria-label="Seu nome"
                  name="name"
                  required
                  minLength={2}
                  autoComplete="name"
                  placeholder="Como podemos chamar você?"
                />
              </Field>
            )}
            <Field label="E-mail">
              <input
                aria-label="E-mail"
                type="email"
                name="email"
                required
                autoComplete="email"
                placeholder="voce@seunegocio.com.br"
              />
            </Field>
            <Field label={signup ? "Crie uma senha (mínimo 12 caracteres)" : "Senha"}>
              <div className="password-input">
                <input
                  aria-label={signup ? "Crie uma senha (mínimo 12 caracteres)" : "Senha"}
                  type={show ? "text" : "password"}
                  name="password"
                  required
                  minLength={signup ? 12 : 1}
                  maxLength={128}
                  autoComplete={signup ? "new-password" : "current-password"}
                  placeholder="Sua senha segura"
                />
                <button
                  type="button"
                  onClick={() => setShow(!show)}
                  aria-label={show ? "Ocultar senha" : "Mostrar senha"}
                >
                  {show ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </Field>
            {!signup && (
              <button type="button" className="text-link forgot" onClick={() => setForgot(!forgot)}>
                Esqueci minha senha
              </button>
            )}
            {forgot && (
              <div className="notice">
                Solicite ao administrador da plataforma um link privado de recuperação. Ele verifica
                sua identidade e gera um link de uso único válido por 30 minutos. Não há envio
                automático de e-mail configurado.
              </div>
            )}
            <ErrorBox error={error} />
            <Submit busy={busy} label={signup ? "Criar minha conta" : "Entrar no painel"} />
          </form>
          <div className="auth-switch">
            {signup ? "Já tem uma conta?" : "Ainda não tem seu cardápio?"}{" "}
            <Link to={signup ? "/login" : "/cadastro"}>
              {signup ? "Entrar" : "Começar agora"} <ArrowUpRight size={14} />
            </Link>
          </div>
          <small className="muted">
            O painel do proprietário é exclusivo da conta administrativa autorizada.
          </small>
        </div>
      </div>
    </div>
  );
}
export function Setup() {
  const offers = useOfferings(),
    profile = useProfile();
  const [, navigate] = useLocation();
  const op = useOperation(client.account.setup);
  const initial = new URLSearchParams(window.location.search).get("plano") ?? "profissional";
  if (offers.isLoading || profile.isLoading) return <Loading />;
  if (profile.isError) return <Login />;
  if (profile.data?.membership) {
    return <Redirect to={profile.data.membership.role === "admin" ? "/dono" : "/painel"} />;
  }
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    try {
      await op.mutateAsync({
        name: String(f.get("name")),
        slug: String(f.get("slug")),
        segment: String(f.get("segment")),
        planId: String(f.get("plan")),
        template: f.get("template") === "on",
      });
      navigate("/painel");
    } catch {
      /* error rendered */
    }
  }
  return (
    <div className="setup-page">
      <Brand />
      <section className="setup-card">
        <span className="eyebrow">PASSO FINAL • SEU ESTABELECIMENTO</span>
        <h1>
          Vamos colocar
          <br />
          seu cardápio na mesa.
        </h1>
        <p>Escolha seu segmento e comece com categorias recomendadas.</p>
        <ErrorBox error={offers.error} />
        <form onSubmit={submit}>
          <Field label="Nome do estabelecimento">
            <input
              aria-label="Nome do estabelecimento"
              name="name"
              minLength={2}
              maxLength={100}
              required
              placeholder="Ex.: Burger da Vila"
            />
          </Field>
          <Field label="Link do cardápio">
            <div className="slug-input">
              <span>/loja/</span>
              <input
                aria-label="Link do cardápio"
                name="slug"
                required
                pattern="[a-z0-9]+(-[a-z0-9]+)*"
                minLength={3}
                maxLength={80}
                placeholder="burger-da-vila"
              />
            </div>
            <small>Somente letras minúsculas, números e hífens.</small>
          </Field>
          <div className="form-grid">
            <Field label="Segmento">
              <select aria-label="Segmento" name="segment">
                {offers.data?.segments.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </Field>
            <Field label="Plano mensal">
              <select aria-label="Plano mensal" name="plan" defaultValue={initial}>
                {offers.data?.plans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} • R$ {(p.price / 100).toFixed(2)}/mês
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <label className="checkbox">
            <input
              aria-label="Incluir produtos demonstrativos editáveis"
              type="checkbox"
              name="template"
              defaultChecked
            />{" "}
            Incluir produtos demonstrativos editáveis
          </label>
          <div className="notice">
            Os exemplos e imagens são ilustrativos. Revise os produtos, preços e informações antes
            de compartilhar. A assinatura começa com o período de teste do plano escolhido.
          </div>
          <ErrorBox error={op.error} />
          <Submit busy={op.isPending} label="Criar meu estabelecimento" />
        </form>
      </section>
    </div>
  );
}
export function ChangePassword() {
  const op = useOperation(client.account.changePassword);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    try {
      const result = await op.mutateAsync({
        currentPassword: String(f.get("current")),
        newPassword: String(f.get("new")),
      });
      if (result.token) localStorage.setItem("cardapio-session", result.token);
      window.location.reload();
    } catch {
      /* inline */
    }
  }
  return (
    <div className="setup-page">
      <Brand />
      <section className="setup-card">
        <ShieldCheck size={34} />
        <h1>Primeiro, sua segurança.</h1>
        <p>Troque a senha provisória para liberar seu painel.</p>
        <form onSubmit={submit}>
          <Field label="Senha provisória">
            <input
              aria-label="Senha provisória"
              name="current"
              type="password"
              required
              autoComplete="current-password"
            />
          </Field>
          <Field label="Nova senha (mínimo 12 caracteres)">
            <input
              aria-label="Nova senha (mínimo 12 caracteres)"
              name="new"
              type="password"
              required
              minLength={12}
              maxLength={128}
              autoComplete="new-password"
            />
          </Field>
          <ErrorBox error={op.error} />
          <Submit busy={op.isPending} label="Trocar senha e continuar" />
        </form>
      </section>
    </div>
  );
}
export function ResetPassword() {
  const token = new URLSearchParams(window.location.search).get("token") ?? "";
  const op = useOperation(client.account.resetPassword);
  const [done, setDone] = useState(false);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    try {
      await op.mutateAsync({
        token,
        password: String(new FormData(e.currentTarget).get("password")),
      });
      setDone(true);
    } catch {
      /* inline */
    }
  }
  return (
    <div className="setup-page">
      <Brand />
      <section className="setup-card">
        <h1>
          Uma nova senha.
          <br />
          Um acesso seguro.
        </h1>
        {done ? (
          <>
            <div className="notice success">
              Senha redefinida. Todas as sessões anteriores foram encerradas.
            </div>
            <Link className="btn red" to="/login">
              Entrar
            </Link>
          </>
        ) : (
          <form onSubmit={submit}>
            <p>Link privado, de uso único. Escolha uma senha forte.</p>
            <Field label="Nova senha">
              <input
                aria-label="Nova senha"
                type="password"
                name="password"
                required
                minLength={12}
                maxLength={128}
              />
            </Field>
            <ErrorBox error={op.error} />
            <Submit busy={op.isPending} label="Redefinir senha" />
          </form>
        )}
      </section>
    </div>
  );
}
