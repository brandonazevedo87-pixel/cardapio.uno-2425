import { useState } from "react";
import { Link, useLocation, Redirect } from "wouter";
import {
  Plus,
  Search,
  Store,
  CreditCard,
  ShoppingBag,
  TrendingUp,
  ExternalLink,
  Copy,
  ShieldCheck,
} from "lucide-react";
import { useAdmin, useOfferings, useOperation, useProfile } from "../queries/platform";
import { client } from "../lib/api";
import { DashboardShell, PageHeading, Stats, Bars } from "../components/dashboard-shell";
import {
  Loading,
  ErrorBox,
  Badge,
  money,
  date,
  Modal,
  Field,
  Submit,
  Empty,
} from "../components/common";
import { ChangePassword } from "./login";
type Data = Awaited<ReturnType<typeof client.admin.overview>>;
type Company = Data["companies"][number];
type Plan = Data["plans"][number];
type Subscription = Data["subscriptions"][number];
export default function AdminPage() {
  const profile = useProfile();
  if (profile.isLoading) return <Loading />;
  if (profile.isError) return <Redirect to="/login" />;
  if (profile.data?.membership?.role !== "admin")
    return (
      <div className="setup-page">
        <div className="notice error">Acesso exclusivo do proprietário da plataforma.</div>
        <Link to="/painel" className="btn red">
          Ir para meu painel
        </Link>
      </div>
    );
  if (profile.data.membership.mustChange) return <ChangePassword />;
  return <AdminDashboard name={profile.data.user.name} />;
}
function AdminDashboard({ name }: { name: string }) {
  const q = useAdmin(),
    [location] = useLocation(),
    [search, setSearch] = useState(""),
    [filter, setFilter] = useState("all"),
    [dialog, setDialog] = useState<string | null>(null),
    [selected, setSelected] = useState<Company | null>(null),
    [plan, setPlan] = useState<Plan | null>(null),
    [sub, setSub] = useState<Subscription | null>(null);
  const update = useOperation(client.admin.updateCompany);
  const reset = useOperation(client.admin.resetLink);
  const [resetUrl, setResetUrl] = useState("");
  const [toast, setToast] = useState("");
  if (q.isLoading)
    return (
      <DashboardShell owner name={name}>
        <Loading />
      </DashboardShell>
    );
  if (q.isError || !q.data)
    return (
      <DashboardShell owner name={name}>
        <ErrorBox error={q.error} />
      </DashboardShell>
    );
  const d = q.data,
    companies = d.companies.filter((c) => !c.demo),
    subs = d.subscriptions.filter((s) => companies.some((c) => c.id === s.companyId)),
    today = new Date().toISOString().slice(0, 10),
    month = today.slice(0, 7),
    orders = d.orders.filter((o) => companies.some((c) => c.id === o.companyId)),
    active = companies.filter((c) => c.status === "active"),
    expired = subs.filter(
      (s) => s.dueDate < today && !["cancelled", "suspended"].includes(s.status),
    );
  const mrr = subs
      .filter(
        (s) =>
          ["active", "trial"].includes(s.status) &&
          companies.some((c) => c.id === s.companyId && c.status === "active"),
      )
      .reduce((a, s) => a + s.price, 0),
    section = location.replace("/dono", "") || "overview";
  const visible = companies.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) &&
      (filter === "all" || c.status === filter),
  );
  async function change(c: Company) {
    if (
      !window.confirm(
        c.status === "active"
          ? `Suspender ${c.name}? O acesso será bloqueado no servidor.`
          : `Reativar ${c.name}? A assinatura também deve estar em dia.`,
      )
    )
      return;
    try {
      await update.mutateAsync({
        id: c.id,
        name: c.name,
        status: c.status === "active" ? "suspended" : "active",
        publicWhenSuspended: c.publicWhenSuspended,
      });
      setToast("Situação da empresa atualizada.");
    } catch {
      /* inline */
    }
  }
  const companyTable = (
    <div className="panel">
      <div className="panel-head">
        <h3>Seus estabelecimentos</h3>
        <span>{visible.length} empresas</span>
      </div>
      <div className="table-toolbar">
        <div className="search-box">
          <Search size={17} />
          <input
            aria-label="Pesquisar empresas"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Pesquisar empresa…"
          />
        </div>
        <select
          aria-label="Filtrar resultados"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="all">Todas as situações</option>
          <option value="active">Ativas</option>
          <option value="suspended">Suspensas</option>
          <option value="cancelled">Canceladas</option>
        </select>
      </div>
      {!visible.length ? (
        <Empty
          title="Sua próxima empresa começa aqui"
          text="Cadastre um estabelecimento ou compartilhe a página de planos para receber novos clientes."
        />
      ) : (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Estabelecimento</th>
                <th>Plano / mensalidade</th>
                <th>Situação</th>
                <th>Vencimento</th>
                <th>Pedidos</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((c) => {
                const s = subs.find((s) => s.companyId === c.id),
                  p = d.plans.find((p) => p.id === s?.planId);
                return (
                  <tr key={c.id}>
                    <td aria-label="Informações e ações">
                      <button
                        className="table-name"
                        onClick={() => {
                          setSelected(c);
                          setDialog("company");
                        }}
                      >
                        <span className="table-avatar">{c.name[0]}</span>
                        <span>
                          <strong>{c.name}</strong>
                          <small>{c.segment}</small>
                        </span>
                      </button>
                    </td>
                    <td aria-label="Informações e ações">
                      {p?.name ?? "—"}
                      <small>{money(s?.price ?? 0)}/mês</small>
                    </td>
                    <td aria-label="Informações e ações">
                      <Badge status={c.status} />
                    </td>
                    <td
                      aria-label="Informações e ações"
                      className={s && s.dueDate < today ? "red-text" : ""}
                    >
                      {s ? date(s.dueDate) : "—"}
                    </td>
                    <td aria-label="Informações e ações">
                      {orders.filter((o) => o.companyId === c.id).length}
                    </td>
                    <td aria-label="Informações e ações">
                      <div className="table-actions">
                        <button disabled={update.isPending} onClick={() => void change(c)}>
                          {c.status === "active" ? "Suspender" : "Reativar"}
                        </button>
                        <button
                          onClick={() => {
                            setSelected(c);
                            setDialog("company");
                          }}
                        >
                          Detalhes
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
  return (
    <DashboardShell owner name={name}>
      {toast && <output className="notice success">{toast}</output>}
      <ErrorBox error={update.error} />
      <ErrorBox error={reset.error} />
      {section === "overview" && (
        <>
          <PageHeading
            eyebrow="SEU NEGÓCIO, POR INTEIRO"
            title="Visão geral da plataforma"
            text="Acompanhe seus estabelecimentos, assinaturas e crescimento."
          >
            <button className="btn red" onClick={() => setDialog("create")}>
              <Plus size={18} /> Nova empresa
            </button>
          </PageHeading>
          <Stats
            items={[
              {
                label: "Empresas cadastradas",
                value: companies.length,
                note: `${active.length} ativas`,
                icon: <Store size={19} />,
              },
              {
                label: "Receita mensal prevista",
                value: money(mrr),
                note: "Ativas e em teste • não é receita recebida",
                icon: <TrendingUp size={19} />,
              },
              {
                label: "Assinaturas vencidas",
                value: expired.length,
                note: "Regularização pendente",
                icon: <CreditCard size={19} />,
              },
              {
                label: "Pedidos na plataforma",
                value: orders.length,
                note: "Exclui demonstração",
                icon: <ShoppingBag size={19} />,
              },
            ]}
          />
          <div className="dashboard-columns">
            <div className="panel">
              <div className="panel-head">
                <h3>Novas empresas por mês</h3>
                <span>Últimos 6 meses</span>
              </div>
              <Bars
                items={Array.from({ length: 6 }, (_, i) => {
                  const dt = new Date();
                  dt.setMonth(dt.getMonth() - (5 - i));
                  const m = dt.toISOString().slice(0, 7);
                  return {
                    label: dt.toLocaleDateString("pt-BR", { month: "short" }),
                    value: companies.filter((c) => c.createdAt.startsWith(m)).length,
                  };
                })}
              />
            </div>
            <div className="panel">
              <div className="panel-head">
                <h3>Resumo operacional</h3>
              </div>
              <div className="summary-list">
                <div>
                  Empresas suspensas{" "}
                  <b>{companies.filter((c) => c.status === "suspended").length}</b>
                </div>
                <div>
                  Novas neste mês{" "}
                  <b>{companies.filter((c) => c.createdAt.startsWith(month)).length}</b>
                </div>
                <div>
                  Empresários cadastrados <b>{companies.filter((c) => c.ownerId).length}</b>
                </div>
                <div>
                  Empresas canceladas{" "}
                  <b>{companies.filter((c) => c.status === "cancelled").length}</b>
                </div>
              </div>
            </div>
          </div>
          {companyTable}
        </>
      )}
      {section === "/empresas" && (
        <>
          <PageHeading
            eyebrow="ESTABELECIMENTOS"
            title="Empresas"
            text="Cada empresa tem seu próprio painel, cardápio e assinatura."
          >
            <button className="btn red" onClick={() => setDialog("create")}>
              <Plus size={18} /> Cadastrar empresa
            </button>
          </PageHeading>
          {companyTable}
        </>
      )}
      {section === "/planos" && (
        <>
          <PageHeading
            eyebrow="SEU MODELO DE NEGÓCIO"
            title="Planos de assinatura"
            text="Preços em reais, limites efetivos no servidor e recursos por plano."
          >
            <button
              className="btn red"
              onClick={() => {
                setPlan(null);
                setDialog("plan");
              }}
            >
              <Plus size={18} /> Novo plano
            </button>
          </PageHeading>
          <div className="plans admin-plans">
            {d.plans.map((p) => (
              <article className="plan" key={p.id}>
                <Badge status={p.active ? "active" : "suspended"} />
                <h2>{p.name}</h2>
                <h3>
                  {money(p.price)}
                  <small>/mês</small>
                </h3>
                <ul>
                  <li>{p.productLimit} produtos</li>
                  <li>{p.categoryLimit} categorias</li>
                  <li>{p.trialDays} dias de teste</li>
                  <li>{p.reports ? "Relatórios habilitados" : "Relatórios básicos"}</li>
                  <li>{p.premium ? "Modelos 3D habilitados" : "Galeria de fotos"}</li>
                </ul>
                <button
                  className="btn outline"
                  onClick={() => {
                    setPlan(p);
                    setDialog("plan");
                  }}
                >
                  Editar plano
                </button>
              </article>
            ))}
          </div>
          <div className="notice">
            Esta versão permite um empresário por empresa. O limite de usuários é 1; não há gestão
            de equipe multiusuário implementada.
          </div>
        </>
      )}
      {section === "/assinaturas" && (
        <>
          <PageHeading
            eyebrow="CONTROLE DE COBRANÇA"
            title="Assinaturas e pagamentos"
            text="Cobrança manual. Registre somente pagamentos que você verificou."
          />
          <Stats
            items={[
              { label: "Mensalidade prevista", value: money(mrr) },
              { label: "Vencidas", value: expired.length },
              {
                label: "Em período de teste",
                value: subs.filter((s) => s.status === "trial").length,
              },
              {
                label: "Pagamentos registrados",
                value: money(d.payments.reduce((a, p) => a + p.amount, 0)),
              },
            ]}
          />
          <div className="panel">
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Empresa</th>
                    <th>Plano</th>
                    <th>Mensalidade</th>
                    <th>Vencimento</th>
                    <th>Situação</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {subs.map((s) => (
                    <tr key={s.id}>
                      <td aria-label="Informações e ações">
                        {companies.find((c) => c.id === s.companyId)?.name}
                      </td>
                      <td aria-label="Informações e ações">
                        {d.plans.find((p) => p.id === s.planId)?.name}
                      </td>
                      <td aria-label="Informações e ações">{money(s.price)}</td>
                      <td
                        aria-label="Informações e ações"
                        className={s.dueDate < today ? "red-text" : ""}
                      >
                        {date(s.dueDate)}
                      </td>
                      <td aria-label="Informações e ações">
                        <Badge status={s.status} />
                        {s.dueDate < today && <small>Vencida</small>}
                      </td>
                      <td aria-label="Informações e ações">
                        <div className="table-actions">
                          <button
                            onClick={() => {
                              setSub(s);
                              setDialog("subscription");
                            }}
                          >
                            Gerenciar
                          </button>
                          <button
                            onClick={() => {
                              setSub(s);
                              setDialog("payment");
                            }}
                          >
                            Registrar pagamento
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!subs.length && (
                <Empty
                  title="Nenhuma assinatura ainda"
                  text="Cadastre sua primeira empresa para começar."
                />
              )}
            </div>
          </div>
          <PaymentHistory data={d} />
        </>
      )}
      {section === "/relatorios" && (
        <>
          <PageHeading
            eyebrow="DADOS REAIS"
            title="Relatórios gerais"
            text="Utilização da plataforma e histórico de operações administrativas."
          />
          <div className="dashboard-columns">
            <div className="panel">
              <div className="panel-head">
                <h3>Empresas com mais pedidos</h3>
              </div>
              <Bars
                items={companies
                  .map((c) => ({
                    label: c.name,
                    value: orders.filter((o) => o.companyId === c.id).length,
                  }))
                  .sort((a, b) => b.value - a.value)
                  .slice(0, 8)}
              />
              {!companies.length && (
                <Empty
                  title="Sem dados ainda"
                  text="Os relatórios aparecem conforme a plataforma é utilizada."
                />
              )}
            </div>
            <div className="panel">
              <div className="panel-head">
                <h3>Visitas por estabelecimento</h3>
              </div>
              <Bars
                items={companies
                  .map((c) => ({ label: c.name, value: c.views }))
                  .sort((a, b) => b.value - a.value)
                  .slice(0, 8)}
              />
              <small className="panel-note">
                Contagem de aberturas de cardápio, não visitantes únicos.
              </small>
            </div>
          </div>
          <AuditHistory data={d} />
        </>
      )}
      {section === "/configuracoes" && (
        <>
          <PageHeading
            eyebrow="SUA PLATAFORMA"
            title="Configurações"
            text="Informações para regularização manual das assinaturas."
          />
          <PlatformSettings data={d} />
          <AuditHistory data={d} />
        </>
      )}
      {dialog === "create" && (
        <Modal title="Cadastrar estabelecimento" onClose={() => setDialog(null)}>
          <CreateCompany
            onDone={() => {
              setDialog(null);
              setToast(
                "Empresa criada. Envie a senha provisória ao empresário por um canal seguro.",
              );
            }}
          />
        </Modal>
      )}
      {dialog === "company" && selected && (
        <Modal
          title={selected.name}
          onClose={() => {
            setDialog(null);
            setResetUrl("");
          }}
        >
          <CompanyDetails
            company={selected}
            data={d}
            onDone={() => {
              setDialog(null);
              setToast("Dados atualizados.");
            }}
          />
          <div className="detail-links">
            <Link to={`/loja/${selected.slug}`} target="_blank" className="btn outline">
              Abrir cardápio <ExternalLink size={16} />
            </Link>
            <button
              className="btn outline"
              disabled={reset.isPending}
              onClick={async () => {
                if (
                  !window.confirm(
                    "Você verificou a identidade do empresário? O link concede acesso à troca de senha.",
                  )
                )
                  return;
                try {
                  const r = await reset.mutateAsync({ companyId: selected.id });
                  setResetUrl(`${window.location.origin}/recuperar?token=${r.token}`);
                } catch {
                  /* inline */
                }
              }}
            >
              <ShieldCheck size={16} /> Gerar recuperação segura
            </button>
          </div>
          {resetUrl && (
            <div className="notice">
              <strong>Link privado • expira em 30 minutos • uso único</strong>
              <p>
                Envie somente ao empresário após verificar sua identidade. Não publique este link.
              </p>
              <button
                className="btn outline small"
                onClick={async () => {
                  await navigator.clipboard.writeText(resetUrl);
                  setToast("Link privado copiado.");
                }}
              >
                <Copy size={16} /> Copiar link
              </button>
            </div>
          )}
        </Modal>
      )}
      {dialog === "plan" && (
        <Modal title={plan ? "Editar plano" : "Novo plano"} onClose={() => setDialog(null)}>
          <PlanForm plan={plan} onDone={() => setDialog(null)} />
        </Modal>
      )}
      {dialog === "subscription" && sub && (
        <Modal title="Gerenciar assinatura" onClose={() => setDialog(null)}>
          <SubscriptionForm sub={sub} plans={d.plans} onDone={() => setDialog(null)} />
        </Modal>
      )}
      {dialog === "payment" && sub && (
        <Modal title="Registrar pagamento verificado" onClose={() => setDialog(null)}>
          <PaymentForm sub={sub} onDone={() => setDialog(null)} />
        </Modal>
      )}
    </DashboardShell>
  );
}
function CreateCompany({ onDone }: { onDone: () => void }) {
  const offers = useOfferings(),
    op = useOperation(client.admin.createCompany);
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
        email: String(f.get("email")),
        ownerName: String(f.get("ownerName")),
        password: String(f.get("password")),
      });
      onDone();
    } catch {
      /* inline */
    }
  }
  if (offers.isLoading) return <Loading />;
  return (
    <form onSubmit={submit}>
      <div className="form-grid">
        <Field label="Nome da empresa">
          <input aria-label="Nome da empresa" name="name" required minLength={2} />
        </Field>
        <Field label="Link (slug)">
          <input
            aria-label="Link (slug)"
            name="slug"
            required
            minLength={3}
            pattern="[a-z0-9]+(-[a-z0-9]+)*"
            placeholder="nome-da-empresa"
          />
        </Field>
        <Field label="Segmento">
          <select aria-label="Segmento" name="segment">
            {offers.data?.segments.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </Field>
        <Field label="Plano">
          <select aria-label="Plano" name="plan">
            {offers.data?.plans.map((p) => (
              <option value={p.id} key={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Nome do empresário">
          <input aria-label="Nome do empresário" name="ownerName" required minLength={2} />
        </Field>
        <Field label="E-mail do empresário">
          <input aria-label="E-mail do empresário" name="email" type="email" required />
        </Field>
      </div>
      <Field label="Senha provisória (mínimo 12 caracteres)">
        <input
          aria-label="Senha provisória (mínimo 12 caracteres)"
          name="password"
          type="password"
          minLength={12}
          maxLength={128}
          required
          autoComplete="new-password"
        />
      </Field>
      <label className="checkbox">
        <input aria-label="template" type="checkbox" name="template" defaultChecked /> Criar
        categorias e produtos demonstrativos
      </label>
      <div className="notice">
        A senha será armazenada com hash. O empresário deverá trocá-la no primeiro acesso.
      </div>
      <ErrorBox error={op.error} />
      <Submit busy={op.isPending} label="Cadastrar empresa" />
    </form>
  );
}
function CompanyDetails({
  company: c,
  data: d,
  onDone,
}: {
  company: Company;
  data: Data;
  onDone: () => void;
}) {
  const op = useOperation(client.admin.updateCompany);
  const s = d.subscriptions.find((s) => s.companyId === c.id),
    u = d.users.find((u) => u.id === c.ownerId);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    try {
      await op.mutateAsync({
        id: c.id,
        name: String(f.get("name")),
        status: String(f.get("status")) as "active",
        publicWhenSuspended: f.get("public") === "on",
      });
      onDone();
    } catch {
      /* inline */
    }
  }
  return (
    <>
      <div className="summary-list">
        <div>
          Empresário <b>{u?.name ?? "—"}</b>
        </div>
        <div>
          E-mail <b>{u?.email ?? "—"}</b>
        </div>
        <div>
          Segmento <b>{c.segment}</b>
        </div>
        <div>
          Assinatura <b>{s ? money(s.price) : "—"} /mês</b>
        </div>
        <div>
          Vencimento <b>{s ? date(s.dueDate) : "—"}</b>
        </div>
      </div>
      <form onSubmit={submit}>
        <Field label="Nome do estabelecimento">
          <input
            aria-label="Nome do estabelecimento"
            name="name"
            defaultValue={c.name}
            required
            minLength={2}
          />
        </Field>
        <Field label="Situação">
          <select aria-label="Situação" name="status" defaultValue={c.status}>
            <option value="active">Ativa</option>
            <option value="suspended">Suspensa</option>
            <option value="cancelled">Cancelada</option>
          </select>
        </Field>
        <label className="checkbox">
          <input
            aria-label="public"
            name="public"
            type="checkbox"
            defaultChecked={c.publicWhenSuspended}
          />{" "}
          Manter cardápio visível durante suspensão (sem pedidos)
        </label>
        <ErrorBox error={op.error} />
        <Submit busy={op.isPending} />
      </form>
    </>
  );
}
function PlanForm({ plan: p, onDone }: { plan: Plan | null; onDone: () => void }) {
  const op = useOperation(client.admin.savePlan);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    try {
      await op.mutateAsync({
        id: p?.id ?? crypto.randomUUID(),
        name: String(f.get("name")),
        price: Math.round(Number(f.get("price")) * 100),
        productLimit: Number(f.get("products")),
        categoryLimit: Number(f.get("categories")),
        userLimit: 1,
        trialDays: Number(f.get("trial")),
        premium: f.get("premium") === "on",
        reports: f.get("reports") === "on",
        customization: f.get("customization") === "on",
        active: f.get("active") === "on",
      });
      onDone();
    } catch {
      /* inline */
    }
  }
  return (
    <form onSubmit={submit}>
      <div className="form-grid">
        <Field label="Nome">
          <input aria-label="Nome" name="name" required defaultValue={p?.name} />
        </Field>
        <Field label="Mensalidade (R$)">
          <input
            aria-label="Mensalidade (R$)"
            name="price"
            type="number"
            min="0"
            step="0.01"
            required
            defaultValue={(p?.price ?? 4990) / 100}
          />
        </Field>
        <Field label="Limite de produtos">
          <input
            aria-label="Limite de produtos"
            name="products"
            type="number"
            min="1"
            max="10000"
            defaultValue={p?.productLimit ?? 50}
            required
          />
        </Field>
        <Field label="Limite de categorias">
          <input
            aria-label="Limite de categorias"
            name="categories"
            type="number"
            min="1"
            max="1000"
            defaultValue={p?.categoryLimit ?? 10}
            required
          />
        </Field>
        <Field label="Dias de teste">
          <input
            aria-label="Dias de teste"
            name="trial"
            type="number"
            min="0"
            max="365"
            defaultValue={p?.trialDays ?? 7}
            required
          />
        </Field>
      </div>
      {[
        { name: "active", text: "Plano disponível para novas lojas", value: p?.active ?? true },
        { name: "premium", text: "Modelos 3D / Premium", value: p?.premium ?? false },
        { name: "reports", text: "Relatórios detalhados", value: p?.reports ?? false },
        { name: "customization", text: "Personalização de cores", value: p?.customization ?? true },
      ].map((i) => (
        <label className="checkbox" key={i.name}>
          <input aria-label={i.name} type="checkbox" name={i.name} defaultChecked={i.value} />
          {i.text}
        </label>
      ))}
      <ErrorBox error={op.error} />
      <Submit busy={op.isPending} />
    </form>
  );
}
function SubscriptionForm({
  sub: s,
  plans,
  onDone,
}: {
  sub: Subscription;
  plans: Plan[];
  onDone: () => void;
}) {
  const op = useOperation(client.admin.saveSubscription);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    try {
      await op.mutateAsync({
        companyId: s.companyId,
        planId: String(f.get("plan")),
        price: Math.round(Number(f.get("price")) * 100),
        dueDate: String(f.get("due")),
        status: String(f.get("status")) as "active",
        note: String(f.get("note")),
      });
      onDone();
    } catch {
      /* inline */
    }
  }
  return (
    <form onSubmit={submit}>
      <Field label="Plano">
        <select aria-label="Plano" name="plan" defaultValue={s.planId}>
          {plans.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </Field>
      <div className="form-grid">
        <Field label="Mensalidade da empresa (R$)">
          <input
            aria-label="Mensalidade da empresa (R$)"
            type="number"
            name="price"
            min="0"
            step=".01"
            defaultValue={s.price / 100}
            required
          />
        </Field>
        <Field label="Próximo vencimento">
          <input
            aria-label="Próximo vencimento"
            name="due"
            type="date"
            required
            defaultValue={s.dueDate}
          />
        </Field>
      </div>
      <Field label="Situação">
        <select aria-label="Situação" name="status" defaultValue={s.status}>
          <option value="trial">Em teste</option>
          <option value="active">Ativa</option>
          <option value="suspended">Suspensa</option>
          <option value="cancelled">Cancelada</option>
        </select>
      </Field>
      <Field label="Observações / promoção">
        <textarea
          aria-label="Observações / promoção"
          name="note"
          defaultValue={s.note}
          maxLength={2000}
        />
      </Field>
      <div className="notice">
        A alteração é efetiva no servidor. Reativar a assinatura não reativa automaticamente uma
        empresa suspensa; ajuste também a empresa.
      </div>
      <ErrorBox error={op.error} />
      <Submit busy={op.isPending} />
    </form>
  );
}
function PaymentForm({ sub: s, onDone }: { sub: Subscription; onDone: () => void }) {
  const op = useOperation(client.admin.recordPayment);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    if (!window.confirm("Você verificou este pagamento fora da plataforma?")) return;
    try {
      await op.mutateAsync({
        companyId: s.companyId,
        amount: Math.round(Number(f.get("amount")) * 100),
        reference: String(f.get("reference")),
        paidAt: String(f.get("paidAt")),
      });
      onDone();
    } catch {
      /* inline */
    }
  }
  return (
    <form onSubmit={submit}>
      <div className="notice">
        Registro administrativo manual. Não representa confirmação por um provedor e não altera o
        vencimento; atualize a assinatura separadamente.
      </div>
      <Field label="Valor recebido (R$)">
        <input
          aria-label="Valor recebido (R$)"
          type="number"
          name="amount"
          min=".01"
          step=".01"
          defaultValue={s.price / 100}
          required
        />
      </Field>
      <Field label="Referência / comprovante">
        <input
          aria-label="Referência / comprovante"
          name="reference"
          minLength={3}
          maxLength={200}
          required
          placeholder="Identificador do comprovante verificado"
        />
      </Field>
      <Field label="Data do recebimento">
        <input
          aria-label="Data do recebimento"
          name="paidAt"
          type="date"
          required
          defaultValue={new Date().toISOString().slice(0, 10)}
        />
      </Field>
      <ErrorBox error={op.error} />
      <Submit busy={op.isPending} label="Registrar pagamento verificado" />
    </form>
  );
}
function PlatformSettings({ data: d }: { data: Data }) {
  const op = useOperation(client.admin.settings);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    try {
      await op.mutateAsync({
        billingContact: String(f.get("contact")),
        billingInstructions: String(f.get("instructions")),
      });
    } catch {
      /* inline */
    }
  }
  return (
    <div className="panel settings-panel">
      <h3>Regularização e atendimento</h3>
      <form onSubmit={submit}>
        <Field label="Contato para cobrança">
          <input
            aria-label="Contato para cobrança"
            name="contact"
            defaultValue={d.settings.find((s) => s.key === "billingContact")?.value}
            placeholder="E-mail ou telefone de atendimento"
            maxLength={200}
          />
        </Field>
        <Field label="Instruções para pagamento manual">
          <textarea
            aria-label="Instruções para pagamento manual"
            name="instructions"
            defaultValue={d.settings.find((s) => s.key === "billingInstructions")?.value}
            maxLength={2000}
            placeholder="Descreva o processo de pagamento e confirmação."
          />
        </Field>
        <ErrorBox error={op.error} />
        {op.isSuccess && <div className="notice success">Configurações salvas.</div>}
        <Submit busy={op.isPending} />
      </form>
      <div className="notice">
        Provedor recorrente não configurado. Nenhuma cobrança automática é feita nesta versão.
      </div>
    </div>
  );
}
function AuditHistory({ data: d }: { data: Data }) {
  return (
    <div className="panel">
      <div className="panel-head">
        <h3>Histórico administrativo</h3>
        <span>Últimas 100 operações</span>
      </div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Data</th>
              <th>Operação</th>
              <th>Responsável</th>
              <th>Detalhes</th>
            </tr>
          </thead>
          <tbody>
            {d.audit.map((a) => (
              <tr key={a.id}>
                <td aria-label="Informações e ações">{date(a.createdAt)}</td>
                <td aria-label="Informações e ações">{a.action}</td>
                <td aria-label="Informações e ações">
                  {d.users.find((u) => u.id === a.actorId)?.name ?? "Administrador"}
                </td>
                <td aria-label="Informações e ações">{a.details || a.targetId}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!d.audit.length && (
          <Empty title="Histórico vazio" text="As alterações importantes são registradas aqui." />
        )}
      </div>
    </div>
  );
}
function PaymentHistory({ data: d }: { data: Data }) {
  return (
    <div className="panel">
      <div className="panel-head">
        <h3>Pagamentos verificados manualmente</h3>
      </div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Data</th>
              <th>Empresa</th>
              <th>Valor</th>
              <th>Referência</th>
            </tr>
          </thead>
          <tbody>
            {d.payments.map((p) => (
              <tr key={p.id}>
                <td aria-label="Informações e ações">{date(p.paidAt)}</td>
                <td aria-label="Informações e ações">
                  {d.companies.find((c) => c.id === p.companyId)?.name}
                </td>
                <td aria-label="Informações e ações">{money(p.amount)}</td>
                <td aria-label="Informações e ações">{p.reference}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!d.payments.length && (
          <Empty
            title="Nenhum pagamento registrado"
            text="Registre somente após verificar o comprovante."
          />
        )}
      </div>
    </div>
  );
}
