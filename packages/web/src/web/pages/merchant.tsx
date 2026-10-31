import { useState, useEffect, useRef } from "react";
import { Link, useLocation, Redirect } from "wouter";
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  Copy,
  Download,
  QrCode,
  ExternalLink,
  Package,
  ShoppingBag,
  TrendingUp,
  Eye,
  Upload,
  Volume2,
} from "lucide-react";
import QRCode from "qrcode";
import { useMerchant, useProfile, useOperation } from "../queries/platform";
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
type Data = Awaited<ReturnType<typeof client.catalog.overview>>;
type Product = Data["products"][number];
type Category = Data["categories"][number];
type Order = Data["orders"][number];
export default function MerchantPage() {
  const profile = useProfile();
  if (profile.isLoading) return <Loading />;
  if (profile.isError) return <Redirect to="/login" />;
  if (profile.data?.membership?.mustChange) return <ChangePassword />;
  if (profile.data?.membership?.role === "admin") return <Redirect to="/dono" />;
  if (!profile.data?.membership?.companyId) return <Redirect to="/configurar" />;
  return <MerchantDashboard />;
}
function MerchantDashboard() {
  const q = useMerchant(),
    [location] = useLocation(),
    [search, setSearch] = useState(""),
    [categoryFilter, setCategoryFilter] = useState("all"),
    [orderFilter, setOrderFilter] = useState("open"),
    [dialog, setDialog] = useState<string | null>(null),
    [product, setProduct] = useState<Product | null>(null),
    [category, setCategory] = useState<Category | null>(null),
    [order, setOrder] = useState<Order | null>(null),
    [toast, setToast] = useState(""),
    [sound, setSound] = useState(false);
  const delProduct = useOperation(client.catalog.deleteProduct),
    delCategory = useOperation(client.catalog.deleteCategory),
    status = useOperation(client.orders.updateStatus);
  const seen = useRef<number | null>(null);
  const audio = useRef<AudioContext | null>(null);
  useEffect(() => {
    if (q.data) {
      const n = q.data.orders.length;
      if (sound && seen.current !== null && n > seen.current && audio.current) {
        const oscillator = audio.current.createOscillator(),
          gain = audio.current.createGain();
        oscillator.connect(gain);
        gain.connect(audio.current.destination);
        gain.gain.value = 0.08;
        oscillator.frequency.value = 660;
        oscillator.start();
        oscillator.stop(audio.current.currentTime + 0.25);
      }
      seen.current = n;
    }
  }, [q.data, sound]);
  if (q.isLoading)
    return (
      <DashboardShell owner={false} name="Minha loja">
        <Loading />
      </DashboardShell>
    );
  if (q.isError || !q.data)
    return (
      <DashboardShell owner={false} name="Minha loja">
        <ErrorBox error={q.error} />
      </DashboardShell>
    );
  const d = q.data,
    c = d.company,
    section = location.replace("/painel", "") || "overview",
    publicUrl = `${window.location.origin}/loja/${c.slug}`,
    today = new Date().toISOString().slice(0, 10),
    dayOrders = d.orders.filter((o) => o.createdAt.startsWith(today)),
    validOrders = d.orders.filter((o) => o.status !== "cancelled"),
    revenue = validOrders.reduce((a, o) => a + o.total, 0),
    pending = d.orders.filter((o) => !["completed", "cancelled"].includes(o.status));
  const products = d.products.filter(
    (p) =>
      (p.name + " " + p.description).toLowerCase().includes(search.toLowerCase()) &&
      (categoryFilter === "all" || p.categoryId === categoryFilter),
  );
  async function removeProduct(p: Product) {
    if (!window.confirm(`Excluir ${p.name}? O histórico de pedidos será preservado.`)) return;
    try {
      await delProduct.mutateAsync({ id: p.id });
      setToast("Produto excluído.");
    } catch {
      /* inline */
    }
  }
  async function removeCategory(cat: Category) {
    if (!window.confirm(`Excluir a categoria ${cat.name}?`)) return;
    try {
      await delCategory.mutateAsync({ id: cat.id });
      setToast("Categoria excluída.");
    } catch {
      /* inline */
    }
  }
  async function updateOrder(o: Order, next: string) {
    if (
      next === "cancelled" &&
      !window.confirm("Cancelar este pedido e devolver os itens ao estoque?")
    )
      return;
    try {
      await status.mutateAsync({ id: o.id, status: next as "confirmed" });
      setToast("Status atualizado.");
      setOrder(null);
    } catch {
      /* inline */
    }
  }
  const nextStatus = (o: Order) =>
    (
      ({
        received: "confirmed",
        confirmed: "preparing",
        preparing: o.fulfillment === "delivery" ? "out" : "ready",
        ready: "completed",
        out: "completed",
      }) as Record<string, string>
    )[o.status];
  const orderTable = (list: Order[]) => (
    <div className="panel">
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Pedido</th>
              <th>Cliente</th>
              <th>Recebimento</th>
              <th>Total</th>
              <th>Status</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {list.map((o) => (
              <tr key={o.id}>
                <td aria-label="Informações e ações">
                  <strong>#{o.number}</strong>
                  <small>
                    {date(o.createdAt)} •{" "}
                    {new Date(o.createdAt).toLocaleTimeString("pt-BR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </small>
                </td>
                <td aria-label="Informações e ações">
                  {o.customerName}
                  <small>{o.phone}</small>
                </td>
                <td aria-label="Informações e ações">
                  {o.fulfillment === "delivery" ? "Entrega" : "Retirada"}
                  <small>{o.payment} • a confirmar</small>
                </td>
                <td aria-label="Informações e ações">{money(o.total)}</td>
                <td aria-label="Informações e ações">
                  <Badge status={o.status} />
                </td>
                <td aria-label="Informações e ações">
                  <div className="table-actions">
                    <button
                      onClick={() => {
                        setOrder(o);
                        setDialog("order");
                      }}
                    >
                      Ver pedido
                    </button>
                    {nextStatus(o) && (
                      <button
                        disabled={status.isPending}
                        onClick={() => void updateOrder(o, nextStatus(o))}
                      >
                        Avançar status
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!list.length && (
          <Empty
            title="Nenhum pedido por aqui"
            text="Compartilhe seu cardápio. Os novos pedidos aparecem aqui automaticamente."
          />
        )}
      </div>
    </div>
  );
  return (
    <DashboardShell owner={false} name={c.name} slug={c.slug}>
      {toast && <output className="notice success">{toast}</output>}
      <ErrorBox error={delProduct.error} />
      <ErrorBox error={delCategory.error} />
      <ErrorBox error={status.error} />
      {d.blocked && (
        <div className="notice error">
          <strong>Seu acesso operacional está restrito.</strong>
          <p>
            A loja ou assinatura está suspensa, cancelada ou vencida. Seus dados estão preservados.
            Consulte a assinatura para regularizar.
          </p>
          <Link to="/painel/assinatura" className="btn outline small">
            Regularizar assinatura
          </Link>
        </div>
      )}
      {d.blocked && section !== "/assinatura" ? (
        <SubscriptionView data={d} />
      ) : (
        <>
          {section === "overview" && (
            <>
              <PageHeading
                eyebrow="BEM-VINDO AO SEU NEGÓCIO"
                title={`Tudo pronto, ${c.name}.`}
                text="Seu cardápio, seus pedidos e sua gestão em um só lugar."
              >
                <button className="btn red" onClick={() => setDialog("qr")}>
                  <QrCode size={18} /> Compartilhar cardápio
                </button>
              </PageHeading>
              {d.products.some((p) => p.demo) && (
                <div className="notice">
                  <strong>Seu cardápio veio com exemplos editáveis.</strong> Revise as fotos, preços
                  e descrições antes de compartilhar com clientes.{" "}
                  <Link to="/painel/produtos">Personalizar produtos →</Link>
                </div>
              )}
              <Stats
                items={[
                  {
                    label: "Pedidos hoje",
                    value: dayOrders.length,
                    note: `${pending.length} em andamento`,
                    icon: <ShoppingBag size={19} />,
                  },
                  {
                    label: "Valor dos pedidos",
                    value: money(revenue),
                    note: "Não representa pagamentos recebidos",
                    icon: <TrendingUp size={19} />,
                  },
                  {
                    label: "Produtos cadastrados",
                    value: d.products.length,
                    note: `Limite do plano: ${d.plan.productLimit}`,
                    icon: <Package size={19} />,
                  },
                  {
                    label: "Aberturas do cardápio",
                    value: c.views,
                    note: "Não são visitantes únicos",
                    icon: <Eye size={19} />,
                  },
                ]}
              />
              <div className="dashboard-columns">
                <div className="panel">
                  <div className="panel-head">
                    <h3>Pedidos nos últimos 7 dias</h3>
                  </div>
                  <Bars
                    items={Array.from({ length: 7 }, (_, i) => {
                      const dt = new Date();
                      dt.setDate(dt.getDate() - (6 - i));
                      return {
                        label: dt.toLocaleDateString("pt-BR", { weekday: "short" }),
                        value: d.orders.filter((o) =>
                          o.createdAt.startsWith(dt.toISOString().slice(0, 10)),
                        ).length,
                      };
                    })}
                  />
                </div>
                <div className="panel quick-actions">
                  <h3>Seu cardápio está na mesa.</h3>
                  <p>Abra como cliente ou compartilhe o link com quem está com fome.</p>
                  <Link to={`/loja/${c.slug}`} className="btn yellow" target="_blank">
                    Ver meu cardápio <ExternalLink size={16} />
                  </Link>
                  <button
                    className="btn outline"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(publicUrl);
                        setToast("Link público copiado.");
                      } catch {
                        setToast(
                          "Não foi possível copiar. Use Compartilhar cardápio para ver o link.",
                        );
                      }
                    }}
                  >
                    <Copy size={16} /> Copiar link
                  </button>
                </div>
              </div>
              <div className="section-title">
                <h2>Pedidos em andamento</h2>
                <Link to="/painel/pedidos">Ver todos →</Link>
              </div>
              {orderTable(pending.slice(0, 8))}
            </>
          )}
          {section === "/produtos" && (
            <>
              <PageHeading
                eyebrow="SEU SABOR EM DESTAQUE"
                title="Produtos"
                text={`${d.products.length} de ${d.plan.productLimit} produtos no seu plano.`}
              >
                <button
                  className="btn red"
                  onClick={() => {
                    setProduct(null);
                    setDialog("product");
                  }}
                >
                  <Plus size={18} /> Novo produto
                </button>
              </PageHeading>
              <div className="panel">
                <div className="table-toolbar">
                  <div className="search-box">
                    <Search size={17} />
                    <input
                      aria-label="Pesquisar produtos"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Pesquisar produto…"
                    />
                  </div>
                  <select
                    aria-label="Filtrar resultados"
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                  >
                    <option value="all">Todas as categorias</option>
                    {d.categories.map((c) => (
                      <option value={c.id} key={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Produto</th>
                        <th>Categoria</th>
                        <th>Preço</th>
                        <th>Disponibilidade</th>
                        <th>Estoque</th>
                        <th>Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {products.map((p) => (
                        <tr key={p.id}>
                          <td aria-label="Informações e ações">
                            <div className="table-product">
                              <img src={p.images[0] || "/images/food.jpg"} alt="" />
                              <div>
                                <strong>{p.name}</strong>
                                {p.demo && <small className="red-text">Demonstrativo</small>}
                              </div>
                            </div>
                          </td>
                          <td aria-label="Informações e ações">
                            {d.categories.find((c) => c.id === p.categoryId)?.name}
                          </td>
                          <td aria-label="Informações e ações">{money(p.price)}</td>
                          <td aria-label="Informações e ações">
                            <Badge status={p.available && p.stock !== 0 ? "active" : "suspended"} />
                          </td>
                          <td aria-label="Informações e ações">{p.stock ?? "Sem controle"}</td>
                          <td aria-label="Informações e ações">
                            <div className="table-actions">
                              <button
                                onClick={() => {
                                  setProduct(p);
                                  setDialog("product");
                                }}
                                aria-label={`Editar ${p.name}`}
                              >
                                <Pencil size={16} />
                              </button>
                              <button
                                disabled={delProduct.isPending}
                                onClick={() => void removeProduct(p)}
                                aria-label={`Excluir ${p.name}`}
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!products.length && (
                    <Empty
                      title="Seu próximo favorito começa aqui"
                      text="Cadastre um produto ou ajuste os filtros."
                    />
                  )}
                </div>
              </div>
            </>
          )}
          {section === "/categorias" && (
            <>
              <PageHeading
                eyebrow="UM CARDÁPIO ORGANIZADO"
                title="Categorias"
                text="Ajude seus clientes a encontrar o que procuram."
              >
                <button
                  className="btn red"
                  onClick={() => {
                    setCategory(null);
                    setDialog("category");
                  }}
                >
                  <Plus size={18} /> Nova categoria
                </button>
              </PageHeading>
              <div className="panel">
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Ordem</th>
                        <th>Categoria</th>
                        <th>Produtos</th>
                        <th>Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...d.categories]
                        .sort((a, b) => a.position - b.position)
                        .map((cat) => (
                          <tr key={cat.id}>
                            <td aria-label="Informações e ações">{cat.position}</td>
                            <td aria-label="Informações e ações">
                              <strong>{cat.name}</strong>
                            </td>
                            <td aria-label="Informações e ações">
                              {d.products.filter((p) => p.categoryId === cat.id).length}
                            </td>
                            <td aria-label="Informações e ações">
                              <div className="table-actions">
                                <button
                                  onClick={() => {
                                    setCategory(cat);
                                    setDialog("category");
                                  }}
                                >
                                  <Pencil size={16} /> Editar
                                </button>
                                <button
                                  disabled={delCategory.isPending}
                                  onClick={() => void removeCategory(cat)}
                                >
                                  <Trash2 size={16} /> Excluir
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                  {!d.categories.length && (
                    <Empty
                      title="Nenhuma categoria"
                      text="Crie uma categoria para começar a cadastrar produtos."
                    />
                  )}
                </div>
              </div>
            </>
          )}
          {section === "/pedidos" && (
            <>
              <PageHeading
                eyebrow="DA ESCOLHA À ENTREGA"
                title="Pedidos"
                text="Atualizações consultadas automaticamente a cada 10 segundos."
              >
                <button
                  className={`btn ${sound ? "yellow" : "outline"}`}
                  onClick={() => {
                    if (!sound) {
                      audio.current ??= new AudioContext();
                      void audio.current.resume();
                    }
                    setSound(!sound);
                  }}
                >
                  <Volume2 size={17} />
                  {sound ? "Som ativado" : "Ativar som"}
                </button>
              </PageHeading>
              <div className="category-tabs order-tabs">
                {[
                  { id: "open", label: `Em andamento (${pending.length})` },
                  { id: "all", label: "Todos" },
                  { id: "completed", label: "Concluídos" },
                  { id: "cancelled", label: "Cancelados" },
                ].map((f) => (
                  <button
                    key={f.id}
                    className={orderFilter === f.id ? "active" : ""}
                    onClick={() => setOrderFilter(f.id)}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
              {orderTable(
                d.orders.filter((o) =>
                  orderFilter === "all" || orderFilter === "open"
                    ? !["completed", "cancelled"].includes(o.status) || orderFilter === "all"
                    : o.status === orderFilter,
                ),
              )}
            </>
          )}
          {section === "/personalizacao" && (
            <>
              <PageHeading
                eyebrow="SUA MARCA. SUA IDENTIDADE."
                title="Minha loja"
                text="Personalize a experiência, a entrega e os pagamentos disponíveis."
              >
                <button className="btn outline" onClick={() => setDialog("qr")}>
                  <QrCode size={17} /> QR Code e link
                </button>
              </PageHeading>
              <CompanyForm data={d} />
            </>
          )}
          {section === "/relatorios" && (
            <>
              <PageHeading
                eyebrow="CONHEÇA SEUS FAVORITOS"
                title="Relatórios"
                text="Vendas registradas não equivalem a pagamentos confirmados."
              />
              {!d.plan.reports ? (
                <div className="notice">
                  Seu plano não inclui relatórios detalhados. Solicite um upgrade ao administrador
                  para habilitar o recurso.
                </div>
              ) : (
                <>
                  <Stats
                    items={[
                      { label: "Pedidos registrados", value: d.orders.length },
                      { label: "Valor não cancelado", value: money(revenue) },
                      {
                        label: "Ticket médio",
                        value: money(
                          validOrders.length ? Math.round(revenue / validOrders.length) : 0,
                        ),
                      },
                      {
                        label: "Pedidos concluídos",
                        value: d.orders.filter((o) => o.status === "completed").length,
                      },
                    ]}
                  />
                  <div className="dashboard-columns">
                    <div className="panel">
                      <div className="panel-head">
                        <h3>Produtos mais pedidos</h3>
                      </div>
                      <Bars
                        items={d.products
                          .map((p) => ({
                            label: p.name,
                            value: d.items
                              .filter(
                                (i) =>
                                  i.productId === p.id &&
                                  validOrders.some((o) => o.id === i.orderId),
                              )
                              .reduce((a, i) => a + i.quantity, 0),
                          }))
                          .sort((a, b) => b.value - a.value)
                          .slice(0, 10)}
                      />
                    </div>
                    <div className="panel">
                      <div className="panel-head">
                        <h3>Histórico de vendas</h3>
                      </div>
                      <p className="panel-note">
                        Baixe os pedidos atualmente carregados (até 500 mais recentes), com status e
                        totais calculados pelo servidor.
                      </p>
                      <button className="btn outline" onClick={() => downloadOrders(d.orders)}>
                        <Download size={17} /> Baixar relatório CSV
                      </button>
                    </div>
                  </div>
                  {orderTable(d.orders.slice(0, 20))}
                </>
              )}
            </>
          )}
          {section === "/assinatura" && (
            <>
              <PageHeading
                eyebrow="CONTINUE SERVINDO BOAS EXPERIÊNCIAS"
                title="Minha assinatura"
                text="Consulte seu plano, vencimento e histórico de pagamentos."
              />
              <SubscriptionView data={d} />
            </>
          )}
        </>
      )}
      {dialog === "product" && (
        <Modal title={product ? "Editar produto" : "Novo produto"} onClose={() => setDialog(null)}>
          <ProductForm
            data={d}
            product={product}
            onDone={() => {
              setDialog(null);
              setToast("Produto salvo.");
            }}
          />
        </Modal>
      )}
      {dialog === "category" && (
        <Modal
          title={category ? "Editar categoria" : "Nova categoria"}
          onClose={() => setDialog(null)}
        >
          <CategoryForm
            category={category}
            onDone={() => {
              setDialog(null);
              setToast("Categoria salva.");
            }}
          />
        </Modal>
      )}
      {dialog === "qr" && (
        <Modal title="Seu cardápio, em qualquer lugar" onClose={() => setDialog(null)}>
          <QrView url={publicUrl} name={c.name} />
        </Modal>
      )}
      {dialog === "order" && order && (
        <Modal title={`Pedido #${order.number}`} onClose={() => setDialog(null)}>
          <Badge status={order.status} />
          <div className="summary-list">
            <div>
              Cliente <b>{order.customerName}</b>
            </div>
            <div>
              Telefone <b>{order.phone}</b>
            </div>
            <div>
              Recebimento <b>{order.fulfillment === "delivery" ? "Entrega" : "Retirada"}</b>
            </div>
            {order.address && (
              <div>
                Endereço <b>{order.address}</b>
              </div>
            )}
            <div>
              Pagamento <b>{order.payment} • pendente</b>
            </div>
          </div>
          {d.items
            .filter((i) => i.orderId === order.id)
            .map((i) => (
              <div className="order-detail-item" key={i.id}>
                <strong>
                  {i.quantity}x {i.name}
                </strong>
                <b>{money(i.unitPrice * i.quantity)}</b>
                <small>
                  {[i.variation, ...i.extras.map((e) => e.name)].filter(Boolean).join(" • ")}
                </small>
                {i.notes && <p>{i.notes}</p>}
              </div>
            ))}
          {order.notes && <div className="notice">{order.notes}</div>}
          <div className="totals">
            <div>
              Subtotal <b>{money(order.subtotal)}</b>
            </div>
            <div>
              Entrega <b>{money(order.deliveryFee)}</b>
            </div>
            <div className="grand-total">
              Total <b>{money(order.total)}</b>
            </div>
          </div>
          <div className="detail-links">
            {nextStatus(order) && (
              <button
                className="btn red"
                disabled={status.isPending}
                onClick={() => void updateOrder(order, nextStatus(order))}
              >
                Avançar para{" "}
                {
                  (
                    {
                      confirmed: "confirmado",
                      preparing: "em preparação",
                      ready: "pronto para retirada",
                      out: "saiu para entrega",
                      completed: "concluído",
                    } as Record<string, string>
                  )[nextStatus(order)]
                }
              </button>
            )}
            {!["completed", "cancelled"].includes(order.status) && (
              <button
                className="btn outline"
                disabled={status.isPending}
                onClick={() => void updateOrder(order, "cancelled")}
              >
                Cancelar pedido
              </button>
            )}
          </div>
        </Modal>
      )}
    </DashboardShell>
  );
}
async function uploadFile(file: File) {
  const contentType = file.name.endsWith(".glb")
    ? "model/gltf-binary"
    : (file.type as "image/jpeg" | "image/png" | "image/webp");
  const presigned = await client.upload.presign({
    filename: file.name,
    contentType,
    size: file.size,
  });
  const r = await fetch(presigned.url, {
    method: "PUT",
    body: file,
    headers: { "Content-Type": contentType, "x-amz-acl": "public-read" },
  });
  if (!r.ok) throw new Error("Falha no envio do arquivo. Tente novamente.");
  const result = await client.upload.complete({ key: presigned.key, contentType });
  return result.url;
}
function UploadField({
  label,
  value,
  onChange,
  model = false,
  fileOnly = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  model?: boolean;
  fileOnly?: boolean;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function upload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      onChange(await uploadFile(file));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha no envio.");
    } finally {
      setBusy(false);
      e.target.value = "";
    }
  }
  return (
    <div className="upload-field">
      {!fileOnly && (
        <Field label={label}>
          <input
            aria-label={label}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={model ? "URL HTTPS do arquivo GLB" : "URL HTTPS da imagem"}
          />
        </Field>
      )}
      <label className="upload-button">
        <Upload size={16} />
        {busy ? "Enviando…" : "Enviar arquivo"}
        <input
          aria-label={`Enviar arquivo: ${label}`}
          type="file"
          disabled={busy}
          accept={model ? ".glb" : "image/jpeg,image/png,image/webp"}
          onChange={(e) => void upload(e)}
        />
      </label>
      <small>Até 20 MB • {model ? "GLB real" : "JPG, PNG ou WebP"}</small>
      <ErrorBox error={error} />
    </div>
  );
}
function ProductForm({
  data: d,
  product: p,
  onDone,
}: {
  data: Data;
  product: Product | null;
  onDone: () => void;
}) {
  const op = useOperation(client.catalog.saveProduct),
    [images, setImages] = useState(p?.images.join("\n") ?? ""),
    [model, setModel] = useState(p?.modelUrl ?? ""),
    [variations, setVariations] = useState(
      d.variations
        .filter((v) => v.productId === p?.id)
        .map((v) => ({ name: v.name, price: v.price / 100 })),
    ),
    [extras, setExtras] = useState(
      d.extras
        .filter((v) => v.productId === p?.id)
        .map((v) => ({ name: v.name, price: v.price / 100 })),
    );
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    try {
      await op.mutateAsync({
        id: p?.id,
        name: String(f.get("name")),
        categoryId: String(f.get("category")),
        description: String(f.get("description")),
        ingredients: String(f.get("ingredients")),
        price: Math.round(Number(f.get("price")) * 100),
        images: images
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean),
        modelUrl: model,
        available: f.get("available") === "on",
        stock: f.get("stock") === "" ? null : Number(f.get("stock")),
        demo: f.get("demo") === "on",
        featured: f.get("featured") === "on",
        variations: variations.map((v) => ({ ...v, price: Math.round(v.price * 100) })),
        extras: extras.map((v) => ({ ...v, price: Math.round(v.price * 100) })),
      });
      onDone();
    } catch {
      /* inline */
    }
  }
  if (!d.categories.length)
    return <div className="notice">Crie uma categoria antes de cadastrar produtos.</div>;
  return (
    <form onSubmit={submit}>
      <div className="form-grid">
        <Field label="Nome do produto">
          <input
            aria-label="Nome do produto"
            name="name"
            defaultValue={p?.name}
            minLength={2}
            maxLength={150}
            required
          />
        </Field>
        <Field label="Categoria">
          <select aria-label="Categoria" name="category" defaultValue={p?.categoryId}>
            {d.categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Preço base (R$)">
          <input
            aria-label="Preço base (R$)"
            name="price"
            type="number"
            min="0"
            max="10000"
            step=".01"
            required
            defaultValue={(p?.price ?? 0) / 100}
          />
        </Field>
        <Field label="Estoque (vazio = sem controle)">
          <input
            aria-label="Estoque (vazio = sem controle)"
            name="stock"
            type="number"
            min="0"
            max="100000"
            defaultValue={p?.stock ?? ""}
          />
        </Field>
      </div>
      <Field label="Descrição">
        <textarea
          aria-label="Descrição"
          name="description"
          defaultValue={p?.description}
          maxLength={2000}
        />
      </Field>
      <Field label="Ingredientes">
        <textarea
          aria-label="Ingredientes"
          name="ingredients"
          defaultValue={p?.ingredients}
          maxLength={1000}
        />
      </Field>
      <Field label="Galeria de fotos (uma URL por linha, até 8)">
        <textarea
          aria-label="Galeria de fotos (uma URL por linha, até 8)"
          value={images}
          onChange={(e) => setImages(e.target.value)}
          rows={3}
        />
      </Field>
      <UploadField
        label="Adicionar foto à galeria"
        fileOnly
        value=""
        onChange={(v) => {
          if (v.trim()) setImages((prev) => [prev, v].filter(Boolean).join("\n"));
        }}
      />
      {d.plan.premium && (
        <UploadField label="Modelo 3D real (opcional)" model value={model} onChange={setModel} />
      )}
      <OptionEditor
        title="Tamanhos / sabores"
        text="Cada opção tem um preço final, substituindo o preço base."
        values={variations}
        onChange={setVariations}
      />
      <OptionEditor
        title="Adicionais e complementos"
        text="Os preços são somados ao produto escolhido."
        values={extras}
        onChange={setExtras}
      />
      <div className="form-checks">
        <label className="checkbox">
          <input
            aria-label="Disponível"
            name="available"
            type="checkbox"
            defaultChecked={p?.available ?? true}
          />{" "}
          Disponível
        </label>
        <label className="checkbox">
          <input
            aria-label="Destaque da casa"
            name="featured"
            type="checkbox"
            defaultChecked={p?.featured ?? false}
          />{" "}
          Destaque da casa
        </label>
        <label className="checkbox">
          <input
            aria-label="Produto demonstrativo"
            name="demo"
            type="checkbox"
            defaultChecked={p?.demo ?? false}
          />{" "}
          Produto demonstrativo
        </label>
      </div>
      <ErrorBox error={op.error} />
      <Submit busy={op.isPending} label="Salvar produto" />
    </form>
  );
}
function OptionEditor({
  title,
  text,
  values,
  onChange,
}: {
  title: string;
  text: string;
  values: { name: string; price: number }[];
  onChange: (v: { name: string; price: number }[]) => void;
}) {
  return (
    <div className="option-editor">
      <h3>{title}</h3>
      <small>{text}</small>
      {values.map((v, i) => (
        <div className="option-row" key={i}>
          <input
            required
            value={v.name}
            onChange={(e) =>
              onChange(values.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))
            }
            placeholder="Nome"
            aria-label={`${title}: nome ${i + 1}`}
            maxLength={80}
          />
          <input
            required
            type="number"
            step=".01"
            min="0"
            max="10000"
            value={v.price}
            onChange={(e) =>
              onChange(
                values.map((x, j) => (j === i ? { ...x, price: Number(e.target.value) } : x)),
              )
            }
            aria-label={`${title}: preço ${i + 1}`}
          />
          <button
            type="button"
            className="icon-btn"
            onClick={() => onChange(values.filter((_, j) => j !== i))}
            aria-label="Remover opção"
          >
            <Trash2 size={16} />
          </button>
        </div>
      ))}
      <button
        className="btn outline small"
        type="button"
        disabled={values.length >= 30}
        onClick={() => onChange([...values, { name: "", price: 0 }])}
      >
        <Plus size={15} /> Adicionar opção
      </button>
    </div>
  );
}
function CategoryForm({ category: c, onDone }: { category: Category | null; onDone: () => void }) {
  const op = useOperation(client.catalog.saveCategory);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    try {
      await op.mutateAsync({
        id: c?.id,
        name: String(f.get("name")),
        position: Number(f.get("position")),
      });
      onDone();
    } catch {
      /* inline */
    }
  }
  return (
    <form onSubmit={submit}>
      <Field label="Nome da categoria">
        <input
          aria-label="Nome da categoria"
          name="name"
          minLength={2}
          maxLength={100}
          required
          defaultValue={c?.name}
        />
      </Field>
      <Field label="Ordem no cardápio">
        <input
          aria-label="Ordem no cardápio"
          name="position"
          type="number"
          min="0"
          max="1000"
          required
          defaultValue={c?.position ?? 0}
        />
      </Field>
      <ErrorBox error={op.error} />
      <Submit busy={op.isPending} />
    </form>
  );
}
function CompanyForm({ data: d }: { data: Data }) {
  const c = d.company,
    op = useOperation(client.catalog.saveCompany),
    [logo, setLogo] = useState(c.logo),
    [cover, setCover] = useState(c.cover);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    try {
      await op.mutateAsync({
        name: String(f.get("name")),
        description: String(f.get("description")),
        logo,
        cover,
        whatsapp: String(f.get("whatsapp")),
        address: String(f.get("address")),
        hours: String(f.get("hours")),
        color: String(f.get("color")),
        deliveryFee: Math.round(Number(f.get("fee")) * 100),
        minimum: Math.round(Number(f.get("minimum")) * 100),
        pickup: f.get("pickup") === "on",
        delivery: f.get("delivery") === "on",
        payments: f.getAll("payments") as ("Pix" | "Dinheiro" | "Cartão na entrega")[],
        checkoutMode: String(f.get("mode")) as "platform",
        tracking: f.get("tracking") === "on",
      });
    } catch {
      /* inline */
    }
  }
  return (
    <div className="panel settings-panel">
      <form onSubmit={submit}>
        <h3>Identidade do estabelecimento</h3>
        <Field label="Nome">
          <input
            aria-label="Nome"
            name="name"
            required
            minLength={2}
            maxLength={100}
            defaultValue={c.name}
          />
        </Field>
        <Field label="Descrição">
          <textarea
            aria-label="Descrição"
            name="description"
            defaultValue={c.description}
            maxLength={1000}
          />
        </Field>
        <div className="form-grid">
          <UploadField label="Logotipo" value={logo} onChange={setLogo} />
          <UploadField label="Foto de capa" value={cover} onChange={setCover} />
        </div>
        <Field label="Cor principal">
          <input
            aria-label="Cor principal"
            name="color"
            type="color"
            defaultValue={c.color}
            disabled={!d.plan.customization}
          />
          {!d.plan.customization && <input type="hidden" name="color" value={c.color} />}
        </Field>
        <h3>Contato e funcionamento</h3>
        <div className="form-grid">
          <Field label="WhatsApp com código do país e DDD">
            <input
              aria-label="WhatsApp com código do país e DDD"
              name="whatsapp"
              defaultValue={c.whatsapp}
              maxLength={20}
              placeholder="5511999999999"
            />
          </Field>
          <Field label="Horários (informação exibida no cardápio)">
            <input
              aria-label="Horários (informação exibida no cardápio)"
              name="hours"
              defaultValue={c.hours}
              maxLength={500}
              placeholder="Segunda a sábado • 18h às 23h"
            />
          </Field>
        </div>
        <Field label="Endereço">
          <input aria-label="Endereço" name="address" defaultValue={c.address} maxLength={500} />
        </Field>
        <h3>Entrega e pedidos</h3>
        <div className="form-grid">
          <Field label="Taxa fixa de entrega (R$)">
            <input
              aria-label="Taxa fixa de entrega (R$)"
              type="number"
              name="fee"
              min="0"
              max="1000"
              step=".01"
              defaultValue={c.deliveryFee / 100}
              required
            />
          </Field>
          <Field label="Pedido mínimo (R$)">
            <input
              aria-label="Pedido mínimo (R$)"
              type="number"
              name="minimum"
              min="0"
              max="10000"
              step=".01"
              defaultValue={c.minimum / 100}
              required
            />
          </Field>
        </div>
        <div className="form-checks">
          <label className="checkbox">
            <input
              aria-label="Entrega"
              name="delivery"
              type="checkbox"
              defaultChecked={c.delivery}
            />{" "}
            Entrega
          </label>
          <label className="checkbox">
            <input
              aria-label="Retirada no balcão"
              name="pickup"
              type="checkbox"
              defaultChecked={c.pickup}
            />{" "}
            Retirada no balcão
          </label>
          <label className="checkbox">
            <input
              aria-label="Acompanhamento de status"
              name="tracking"
              type="checkbox"
              defaultChecked={c.tracking}
            />{" "}
            Acompanhamento de status
          </label>
        </div>
        <Field label="Finalização do pedido">
          <select aria-label="Finalização do pedido" name="mode" defaultValue={c.checkoutMode}>
            <option value="platform">Dentro da plataforma</option>
            <option value="whatsapp">Registrar e enviar pelo WhatsApp</option>
          </select>
        </Field>
        <h3>Formas de pagamento aceitas</h3>
        {["Pix", "Dinheiro", "Cartão na entrega"].map((p) => (
          <label className="checkbox" key={p}>
            <input
              aria-label={p}
              name="payments"
              type="checkbox"
              value={p}
              defaultChecked={c.payments.includes(p)}
            />
            {p}
          </label>
        ))}
        <div className="notice">
          Pagamento diretamente com a loja. Nenhuma transação é confirmada automaticamente. Horários
          são informativos; esta versão não bloqueia pedidos por horário ou região de entrega.
        </div>
        <ErrorBox error={op.error} />
        {op.isSuccess && <div className="notice success">Informações da loja salvas.</div>}
        <Submit busy={op.isPending} />
      </form>
    </div>
  );
}
function SubscriptionView({ data: d }: { data: Data }) {
  return (
    <>
      <div className="panel subscription-card">
        <div>
          <span className="eyebrow">SEU PLANO ATUAL</span>
          <h2>{d.plan.name}</h2>
          <Badge status={d.subscription.status} />
          <p>{money(d.subscription.price)} / mês</p>
        </div>
        <div className="summary-list">
          <div>
            Próximo vencimento <b>{date(d.subscription.dueDate)}</b>
          </div>
          <div>
            Produtos <b>Até {d.plan.productLimit}</b>
          </div>
          <div>
            Categorias <b>Até {d.plan.categoryLimit}</b>
          </div>
          <div>
            Visualização 3D <b>{d.plan.premium ? "Disponível com GLB enviado" : "Não incluída"}</b>
          </div>
          <div>
            Relatórios <b>{d.plan.reports ? "Detalhados" : "Básicos"}</b>
          </div>
        </div>
      </div>
      <div className="panel settings-panel">
        <h3>Regularize sua assinatura</h3>
        <p>
          A cobrança é administrada manualmente pelo proprietário da plataforma. Para pagar,
          solicitar upgrade ou reativação, utilize o contato informado abaixo.
        </p>
        <div className="notice">
          <strong>
            {d.settings.find((s) => s.key === "billingContact")?.value ||
              "Contato de cobrança ainda não configurado."}
          </strong>
          <p>
            {d.settings.find((s) => s.key === "billingInstructions")?.value ||
              "Solicite orientações ao administrador que cadastrou seu estabelecimento."}
          </p>
        </div>
        {d.subscription.note && <p>{d.subscription.note}</p>}
        <small>Não há débito automático nem aprovação de pagamento sem verificação.</small>
      </div>
      <div className="panel">
        <div className="panel-head">
          <h3>Pagamentos registrados pelo administrador</h3>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Data</th>
                <th>Valor</th>
                <th>Referência</th>
              </tr>
            </thead>
            <tbody>
              {d.payments.map((p) => (
                <tr key={p.id}>
                  <td aria-label="Informações e ações">{date(p.paidAt)}</td>
                  <td aria-label="Informações e ações">{money(p.amount)}</td>
                  <td aria-label="Informações e ações">{p.reference}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!d.payments.length && (
            <Empty
              title="Nenhum pagamento registrado"
              text="Os pagamentos verificados pelo administrador serão exibidos aqui."
            />
          )}
        </div>
      </div>
    </>
  );
}
function QrView({ url, name }: { url: string; name: string }) {
  const [qr, setQr] = useState(""),
    [copied, setCopied] = useState(false);
  useEffect(() => {
    void QRCode.toDataURL(url, {
      width: 800,
      margin: 3,
      color: { dark: "#392322", light: "#ffffff" },
    }).then(setQr);
  }, [url]);
  return (
    <div className="qr-view">
      <p>
        Na mesa, na embalagem ou nas redes.
        <br />
        Seu cliente só precisa apontar a câmera.
      </p>
      {qr ? <img src={qr} alt={`QR Code do cardápio ${name}`} /> : <Loading />}
      <input readOnly value={url} aria-label="Link público" />
      <div className="detail-links">
        <button
          className="btn outline"
          onClick={async () => {
            await navigator.clipboard.writeText(url);
            setCopied(true);
          }}
        >
          <Copy size={16} />
          {copied ? "Copiado" : "Copiar link"}
        </button>
        {qr && (
          <a className="btn red" href={qr} download={`qr-cardapio-${name}.png`}>
            <Download size={17} /> Baixar QR Code
          </a>
        )}
      </div>
    </div>
  );
}
function downloadOrders(orders: Order[]) {
  const cell = (s: unknown) =>
    `"${String(s)
      .replace(/"/g, '""')
      .replace(/^[=+@-]/, "'")}"`;
  const csv =
    "﻿" +
    [
      ["Pedido", "Data", "Cliente", "Status", "Total R$", "Pagamento"],
      ...orders.map((o) => [
        o.number,
        o.createdAt,
        o.customerName,
        o.status,
        (o.total / 100).toFixed(2),
        o.payment,
      ]),
    ]
      .map((r) => r.map(cell).join(";"))
      .join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = "historico-pedidos.csv";
  a.click();
  URL.revokeObjectURL(url);
}
