import { useState, useEffect } from "react";
import { useParams, Link } from "wouter";
import {
  Search,
  ShoppingBag,
  Plus,
  Minus,
  ArrowLeft,
  ArrowRight,
  X,
  MapPin,
  Clock,
  CheckCircle2,
  ZoomIn,
  Box,
} from "lucide-react";
import { useMenu, useOperation, useTracking } from "../queries/platform";
import { client } from "../lib/api";
import {
  money,
  Loading,
  ErrorBox,
  Modal,
  Field,
  Submit,
  Badge,
  date,
  Empty,
} from "../components/common";

type Menu = Awaited<ReturnType<typeof client.orders.menu>>;
type Product = Menu["products"][number];
type CartItem = {
  key: string;
  productId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  variationId?: string;
  variationName: string;
  extraIds: string[];
  extraNames: string[];
  notes: string;
  image: string;
};
export default function MenuPage() {
  const { slug = "" } = useParams<{ slug: string }>();
  const q = useMenu(slug);
  const [search, setSearch] = useState(""),
    [category, setCategory] = useState("all"),
    [selected, setSelected] = useState<Product | null>(null),
    [cart, setCart] = useState<CartItem[]>([]),
    [showCart, setShowCart] = useState(false);
  const checkout = useOperation(client.orders.checkout);
  const [receipt, setReceipt] = useState<Awaited<ReturnType<typeof client.orders.checkout>> | null>(
      null,
    ),
    [fulfillment, setFulfillment] = useState("pickup");
  useEffect(() => {
    void client.orders.visit({ slug }).catch(() => {});
  }, [slug]);
  useEffect(() => {
    if (q.data?.company.pickup !== undefined)
      setFulfillment(q.data.company.pickup ? "pickup" : "delivery");
  }, [q.data?.company.pickup]);
  if (q.isLoading) return <Loading />;
  if (q.isError || !q.data)
    return (
      <div className="setup-page">
        <ErrorBox error={q.error} />
        <Link to="/">Voltar ao início</Link>
      </div>
    );
  const d = q.data,
    c = d.company,
    subtotal = cart.reduce((a, i) => a + i.unitPrice * i.quantity, 0),
    fee = fulfillment === "delivery" ? c.deliveryFee : 0,
    count = cart.reduce((a, i) => a + i.quantity, 0);
  const categories = d.categories.sort((a, b) => a.position - b.position),
    products = d.products.filter(
      (p) =>
        (category === "all" || p.categoryId === category) &&
        (p.name + " " + p.description).toLowerCase().includes(search.toLowerCase()),
    );
  function add(item: CartItem) {
    setCart((prev) => [...prev, item]);
    setSelected(null);
  }
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    try {
      const result = await checkout.mutateAsync({
        slug,
        requestId: crypto.randomUUID(),
        customerName: String(f.get("name")),
        phone: String(f.get("phone")),
        address: String(f.get("address") ?? ""),
        fulfillment: fulfillment as "delivery" | "pickup",
        payment: String(f.get("payment")) as "Pix",
        notes: String(f.get("notes") ?? ""),
        items: cart.map((i) => ({
          productId: i.productId,
          quantity: i.quantity,
          variationId: i.variationId,
          extraIds: i.extraIds,
          notes: i.notes,
        })),
      });
      setReceipt(result);
      setCart([]);
      setShowCart(false);
    } catch {
      /* rendered */
    }
  }
  return (
    <div className="menu-page" style={{ "--store-color": c.color } as React.CSSProperties}>
      {c.demo && (
        <div className="demo-banner">
          CARDÁPIO DEMONSTRATIVO • PRODUTOS, PREÇOS E PEDIDOS ILUSTRATIVOS{" "}
          <Link to="/cadastro">
            Criar o meu <ArrowRight size={13} />
          </Link>
        </div>
      )}
      <div
        className="menu-cover"
        style={{
          backgroundImage: `linear-gradient(0deg,rgba(0,0,0,.55),rgba(0,0,0,.05)),url(${c.cover || "/images/combo.jpg"})`,
        }}
      >
        <Link to="/" className="menu-back">
          <ArrowLeft size={18} /> Cardápio Online
        </Link>
        <div>
          <span className="eyebrow">FEITO PARA ABRIR O APETITE</span>
          <h1>{c.name}</h1>
        </div>
      </div>
      <div className="menu-inner">
        <div className="store-intro">
          <div>
            {c.logo && <img className="store-logo" src={c.logo} alt={c.name} />}
            <h2>{c.name}</h2>
            <p>{c.description}</p>
            <div className="store-info">
              <span>
                <Clock size={15} />
                {c.hours || "Consulte os horários com a loja"}
              </span>
              <span>
                <MapPin size={15} />
                {c.address || "Endereço não informado"}
              </span>
            </div>
          </div>
          <div className="store-fees">
            <span>{c.delivery ? `Entrega ${money(c.deliveryFee)}` : "Somente retirada"}</span>
            {c.minimum > 0 && <small>Mínimo {money(c.minimum)}</small>}
            <small>Pagamento combinado com a loja</small>
          </div>
        </div>
        {d.blocked && (
          <div className="notice error">
            Pedidos temporariamente desativados. O cardápio permanece disponível para consulta.
          </div>
        )}
        <div className="menu-navigation">
          <div className="search-box">
            <Search size={18} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="O que vai matar sua fome?"
              aria-label="Pesquisar produtos"
            />
          </div>
          <div className="category-tabs">
            <button
              className={category === "all" ? "active" : ""}
              onClick={() => setCategory("all")}
            >
              Todos
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                className={category === cat.id ? "active" : ""}
                onClick={() => setCategory(cat.id)}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>
        <div className="menu-heading">
          <div>
            <span className="eyebrow">ESCOLHA SEU PRÓXIMO FAVORITO</span>
            <h2>
              {category === "all"
                ? "Nosso cardápio"
                : categories.find((c) => c.id === category)?.name}
            </h2>
          </div>
          <span>{products.length} produtos</span>
        </div>
        {!products.length ? (
          <Empty
            title="Nenhum produto por aqui"
            text="Experimente outra categoria ou termo de busca."
          />
        ) : (
          <div className="food-grid">
            {products.map((p) => (
              <button
                key={p.id}
                className={`food-card ${!p.available || p.stock === 0 ? "unavailable" : ""}`}
                onClick={() => setSelected(p)}
              >
                <div className="food-image">
                  <img src={p.images[0] || "/images/food.jpg"} alt={p.name} loading="lazy" />
                  {p.demo && <span className="demo-tag">EXEMPLO EDITÁVEL</span>}
                  {p.featured && <span className="food-featured">DA CASA</span>}
                </div>
                <div className="food-details">
                  <h3>{p.name}</h3>
                  <p>{p.description}</p>
                  <div>
                    <b>{money(p.price)}</b>
                    <span className="add-circle">
                      {p.available && p.stock !== 0 ? <Plus size={20} /> : <X size={20} />}
                    </span>
                  </div>
                  {(!p.available || p.stock === 0) && <small>Indisponível no momento</small>}
                </div>
              </button>
            ))}
          </div>
        )}
        <div className="menu-powered">
          Cardápio feito com <Link to="/">cardápio online.</Link>
        </div>
      </div>
      {count > 0 && (
        <button className="cart-bar" onClick={() => setShowCart(true)}>
          <span>
            <ShoppingBag size={20} />
            <b>{count}</b> Ver meu pedido
          </span>
          <strong>
            {money(subtotal)} <ArrowRight size={18} />
          </strong>
        </button>
      )}
      {selected && (
        <ProductModal product={selected} menu={d} onClose={() => setSelected(null)} onAdd={add} />
      )}
      {showCart && (
        <Modal title="Seu pedido" onClose={() => setShowCart(false)}>
          <div className="cart-items">
            {cart.map((i) => (
              <div key={i.key} className="cart-item">
                <img src={i.image} alt="" />
                <div>
                  <strong>{i.name}</strong>
                  <small>{[i.variationName, ...i.extraNames].filter(Boolean).join(" • ")}</small>
                  {i.notes && <small>{i.notes}</small>}
                  <b>{money(i.unitPrice * i.quantity)}</b>
                </div>
                <div className="quantity">
                  <button
                    aria-label="Diminuir"
                    onClick={() =>
                      setCart(
                        cart.flatMap((v) =>
                          v.key === i.key
                            ? v.quantity === 1
                              ? []
                              : [{ ...v, quantity: v.quantity - 1 }]
                            : [v],
                        ),
                      )
                    }
                  >
                    <Minus size={14} />
                  </button>
                  <span>{i.quantity}</span>
                  <button
                    aria-label="Aumentar"
                    disabled={i.quantity >= 50}
                    onClick={() =>
                      setCart(
                        cart.map((v) => (v.key === i.key ? { ...v, quantity: v.quantity + 1 } : v)),
                      )
                    }
                  >
                    <Plus size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
          {!cart.length ? (
            <Empty title="Seu carrinho está vazio" text="Escolha algo gostoso no cardápio." />
          ) : (
            <form onSubmit={submit}>
              <h3>Como você quer receber?</h3>
              <div className="toggle-group">
                {c.pickup && (
                  <button
                    type="button"
                    className={fulfillment === "pickup" ? "active" : ""}
                    onClick={() => setFulfillment("pickup")}
                  >
                    Retirada no balcão
                  </button>
                )}
                {c.delivery && (
                  <button
                    type="button"
                    className={fulfillment === "delivery" ? "active" : ""}
                    onClick={() => setFulfillment("delivery")}
                  >
                    Entrega
                  </button>
                )}
              </div>
              <div className="form-grid">
                <Field label="Seu nome">
                  <input aria-label="Seu nome" name="name" required minLength={2} maxLength={100} />
                </Field>
                <Field label="Telefone com DDD">
                  <input
                    aria-label="Telefone com DDD"
                    name="phone"
                    type="tel"
                    required
                    pattern="[0-9+ ()-]{10,20}"
                  />
                </Field>
              </div>
              {fulfillment === "delivery" && (
                <Field label="Endereço completo, número e referência">
                  <textarea
                    aria-label="Endereço completo, número e referência"
                    name="address"
                    required
                    minLength={10}
                    maxLength={500}
                  />
                </Field>
              )}
              <Field label="Forma de pagamento">
                <select aria-label="Forma de pagamento" name="payment">
                  {c.payments.map((p) => (
                    <option key={p}>{p}</option>
                  ))}
                </select>
              </Field>
              <Field label="Observações do pedido">
                <textarea
                  aria-label="Observações do pedido"
                  name="notes"
                  maxLength={1000}
                  placeholder="Algo que precisamos saber?"
                />
              </Field>
              <div className="totals">
                <div>
                  Subtotal <b>{money(subtotal)}</b>
                </div>
                <div>
                  Entrega <b>{money(fee)}</b>
                </div>
                <div className="grand-total">
                  Total <strong>{money(subtotal + fee)}</strong>
                </div>
              </div>
              <div className="notice">
                {c.demo
                  ? "Este é um pedido demonstrativo, sem preparo, entrega ou cobrança real."
                  : "Seu pedido será registrado. O pagamento será combinado com a loja; nenhum pagamento é aprovado automaticamente."}
              </div>
              <ErrorBox error={checkout.error} />
              <Submit
                busy={checkout.isPending}
                label={
                  c.checkoutMode === "whatsapp"
                    ? "Registrar e enviar pelo WhatsApp"
                    : "Confirmar pedido"
                }
              />
            </form>
          )}
        </Modal>
      )}
      {receipt && (
        <Modal
          title={receipt.demo ? "Pedido demonstrativo registrado" : "Pedido registrado!"}
          onClose={() => setReceipt(null)}
        >
          <div className="receipt">
            <CheckCircle2 size={58} />
            <h2>Pedido #{receipt.number}</h2>
            <p>
              {receipt.demo
                ? "Você testou o fluxo completo. Nenhum alimento será preparado ou cobrado."
                : "A loja recebeu seu pedido na plataforma. Aguarde a confirmação."}
            </p>
            <b>{money(receipt.total)}</b>
            {receipt.whatsappUrl && (
              <a className="btn yellow" href={receipt.whatsappUrl} target="_blank" rel="noreferrer">
                Enviar no WhatsApp <ArrowRight size={18} />
              </a>
            )}
            {receipt.tracking && (
              <Link className="btn red" to={`/pedido/${receipt.token}`}>
                Acompanhar meu pedido <ArrowRight size={18} />
              </Link>
            )}
            <small>Pagamento pendente de confirmação pela loja.</small>
          </div>
        </Modal>
      )}
    </div>
  );
}
function ProductModal({
  product: p,
  menu: d,
  onClose,
  onAdd,
}: {
  product: Product;
  menu: Menu;
  onClose: () => void;
  onAdd: (i: CartItem) => void;
}) {
  const vars = d.variations.filter((v) => v.productId === p.id),
    extras = d.extras.filter((v) => v.productId === p.id);
  const [vi, setVi] = useState(vars[0]?.id),
    [ei, setEi] = useState<string[]>([]),
    [qty, setQty] = useState(1),
    [notes, setNotes] = useState(""),
    [image, setImage] = useState(0),
    [three, setThree] = useState(false),
    [zoom, setZoom] = useState(false);
  useEffect(() => {
    if (three) void import("@google/model-viewer");
  }, [three]);
  const variation = vars.find((v) => v.id === vi),
    selectedExtras = extras.filter((e) => ei.includes(e.id)),
    unitPrice = (variation?.price ?? p.price) + selectedExtras.reduce((a, e) => a + e.price, 0);
  const available = p.available && p.stock !== 0 && !d.blocked;
  return (
    <Modal title="Visualize seu prato" onClose={onClose}>
      <div className="product-visual">
        {three && p.modelUrl ? (
          <model-viewer
            src={p.modelUrl}
            camera-controls
            ar
            ar-modes="webxr scene-viewer quick-look"
            shadow-intensity="1"
            alt={`Modelo 3D de ${p.name}`}
            style={{ width: "100%", height: "330px" }}
          />
        ) : (
          <button
            className={zoom ? "gallery-image zoomed" : "gallery-image"}
            onClick={() => setZoom(!zoom)}
            aria-label="Ampliar fotografia"
          >
            <img src={p.images[image] || "/images/food.jpg"} alt={p.name} />
            <ZoomIn size={22} />
          </button>
        )}
        <div className="gallery-controls">
          {p.images.map((url, i) => (
            <button
              key={url + i}
              className={image === i && !three ? "selected" : ""}
              onClick={() => {
                setImage(i);
                setThree(false);
              }}
            >
              <img src={url} alt={`Foto ${i + 1}`} />
            </button>
          ))}
          {p.modelUrl && d.premium && (
            <button className="three-button" onClick={() => setThree(!three)}>
              <Box size={22} />
              3D real
            </button>
          )}
        </div>
        <small>
          {three
            ? "Arraste para girar. Use pinça para aproximar. AR depende da compatibilidade do dispositivo."
            : "Galeria de fotografias • Toque para ampliar"}
        </small>
      </div>
      <h2>{p.name}</h2>
      <p>{p.description}</p>
      {p.ingredients && <small className="muted">Ingredientes: {p.ingredients}</small>}
      {p.demo && (
        <div className="notice">Produto demonstrativo. Imagem, descrição e preço ilustrativos.</div>
      )}
      {vars.length > 0 && (
        <Field label="Tamanho / sabor">
          <select aria-label="Tamanho / sabor" value={vi} onChange={(e) => setVi(e.target.value)}>
            {vars.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name} • {money(v.price)}
              </option>
            ))}
          </select>
        </Field>
      )}
      {extras.length > 0 && (
        <div className="extra-options">
          <h3>Deixe do seu jeito</h3>
          {extras.map((e) => (
            <label className="checkbox" key={e.id}>
              <input
                aria-label={e.name}
                type="checkbox"
                checked={ei.includes(e.id)}
                onChange={(ev) =>
                  setEi(ev.target.checked ? [...ei, e.id] : ei.filter((id) => id !== e.id))
                }
              />
              {e.name}
              <b>+ {money(e.price)}</b>
            </label>
          ))}
        </div>
      )}
      <Field label="Observação">
        <textarea
          aria-label="Observação"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          maxLength={500}
          placeholder="Ex.: sem cebola"
        />
      </Field>
      <div className="product-add">
        <div className="quantity">
          <button onClick={() => setQty(Math.max(1, qty - 1))} aria-label="Diminuir">
            <Minus size={16} />
          </button>
          <b>{qty}</b>
          <button
            onClick={() => setQty(Math.min(p.stock ?? 50, 50, qty + 1))}
            aria-label="Aumentar"
          >
            <Plus size={16} />
          </button>
        </div>
        <button
          className="btn red"
          disabled={!available}
          onClick={() =>
            onAdd({
              key: crypto.randomUUID(),
              productId: p.id,
              name: p.name,
              quantity: qty,
              unitPrice,
              variationId: vi,
              variationName: variation?.name ?? "",
              extraIds: ei,
              extraNames: selectedExtras.map((e) => e.name),
              notes,
              image: p.images[0] || "/images/food.jpg",
            })
          }
        >
          {available ? `Adicionar • ${money(unitPrice * qty)}` : "Indisponível"}
          <Plus size={18} />
        </button>
      </div>
    </Modal>
  );
}
export function Tracking() {
  const { token = "" } = useParams<{ token: string }>();
  const q = useTracking(token);
  return (
    <div className="setup-page">
      <Link className="back-link" to={q.data ? `/loja/${q.data.slug}` : "/"}>
        <ArrowLeft size={17} /> Voltar ao cardápio
      </Link>
      <section className="setup-card">
        {q.isLoading ? (
          <Loading />
        ) : q.isError ? (
          <ErrorBox error={q.error} />
        ) : (
          q.data && (
            <>
              <span className="eyebrow">{q.data.companyName}</span>
              <h1>Pedido #{q.data.number}</h1>
              {q.data.demo && (
                <div className="notice">
                  Acompanhamento demonstrativo. Sem preparo ou entrega real.
                </div>
              )}
              <Badge status={q.data.status} />
              <p>
                Total: <b>{money(q.data.total)}</b> • Pagamento a confirmar
              </p>
              <div className="timeline">
                {q.data.history.map((h, i) => (
                  <div key={i}>
                    <span />
                    <div>
                      <Badge status={h.status} />
                      <small>
                        {date(h.at)} às{" "}
                        {new Date(h.at).toLocaleTimeString("pt-BR", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </small>
                    </div>
                  </div>
                ))}
              </div>
              <small>Atualização automática a cada 10 segundos.</small>
            </>
          )
        )}
      </section>
    </div>
  );
}
