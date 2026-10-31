import { Link } from "wouter";
import {
  ArrowUpRight,
  ArrowRight,
  Check,
  QrCode,
  Smartphone,
  ShoppingBag,
  BarChart3,
  Palette,
  Box,
  ChevronDown,
  MousePointer2,
  Pizza,
  Coffee,
  Utensils,
  IceCreamBowl,
  ShieldCheck,
} from "lucide-react";
import { Header, Footer, money, Loading, ErrorBox } from "../components/common";
import { useOfferings } from "../queries/platform";

const features = [
  {
    icon: QrCode,
    title: "Do QR Code ao primeiro pedido.",
    text: "Um link, infinitas possibilidades. Seu cliente abre o cardápio sem instalar nada.",
  },
  {
    icon: ShoppingBag,
    title: "Tudo pronto para pedir.",
    text: "Carrinho, adicionais, entrega ou retirada. Pedidos organizados, sem confusão.",
  },
  {
    icon: Palette,
    title: "A cara do seu negócio.",
    text: "Seu logo, suas cores, seus produtos. Um cardápio que tem a sua identidade.",
  },
  {
    icon: BarChart3,
    title: "Mais controle. Menos trabalho.",
    text: "Atualize preços, acompanhe pedidos e descubra os favoritos dos seus clientes.",
  },
];
export default function Index() {
  const offers = useOfferings();
  return (
    <div className="landing">
      <div className="announcement">
        UM NOVO JEITO DE APRESENTAR, ENCANTAR E RECEBER PEDIDOS{" "}
        <span>
          100% online <ArrowUpRight size={12} />
        </span>
      </div>
      <Header />
      <main>
        <section className="hero wrap">
          <div className="hero-copy">
            <div className="eyebrow">
              <span /> O SEU NEGÓCIO MERECE MAIS
            </div>
            <h1>
              SEU CARDÁPIO.
              <br />
              MAIS BONITO.
              <br />
              <span>MAIS PEDIDOS.</span>
            </h1>
            <p>
              Transforme a fome em vontade de pedir.
              <br />
              Um cardápio digital irresistível, com a sua marca
              <br className="desktop-break" /> e tudo que seu cliente precisa na palma da mão.
            </p>
            <div className="hero-buttons">
              <Link to="/cadastro" className="btn yellow">
                Criar meu cardápio <ArrowUpRight size={20} />
              </Link>
              <Link to="/loja/burger-da-casa" className="btn outline">
                Ver demonstração <ArrowRight size={17} />
              </Link>
            </div>
            <div className="hero-trust">
              <span>
                <Check size={15} /> Teste antes de assinar
              </span>
              <span>
                <Check size={15} /> Sem instalar nada
              </span>
            </div>
          </div>
          <div className="hero-art">
            <div className="orbit orbit-one" />
            <div className="orbit orbit-two" />
            <span className="handwritten">
              O primeiro pedido
              <br />
              começa pelos olhos.
            </span>
            <svg className="hand-arrow" viewBox="0 0 110 80">
              <path
                d="M10 10Q70 2 82 55M65 45L82 58L92 38"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              />
            </svg>
            <img
              className="hero-food"
              src="/images/hero.png"
              alt="Hambúrguer artesanal e batatas crocantes"
            />
            <div className="premium-stamp">
              FEITO PARA
              <br />
              <strong>
                ABRIR O<br />
                APETITE
              </strong>
              <span>✦ DIGITAL ✦</span>
            </div>
            <Link to="/loja/burger-da-casa" className="phone-preview">
              <div className="phone-camera" />
              <div className="phone-top">
                <span>9:41</span>
                <span>••• ▰</span>
              </div>
              <div className="phone-food">
                <img src="/images/burger.jpg" alt="Prévia de um cardápio digital" />
                <span className="demo-tag">DEMONSTRAÇÃO</span>
              </div>
              <div className="phone-body">
                <small>BURGER DA CASA</small>
                <h3>
                  Uma boa escolha.
                  <br />
                  Um sabor incrível.
                </h3>
                <div className="phone-tabs">
                  <b>Favoritos</b>
                  <span>Combos</span>
                  <span>Bebidas</span>
                </div>
                <div className="phone-product">
                  <img src="/images/burger.jpg" alt="" />
                  <div>
                    <strong>Clássico da casa</strong>
                    <small>Artesanal, feito na hora.</small>
                    <b>R$ 24,90</b>
                  </div>
                  <span>+</span>
                </div>
                <div className="phone-cart">
                  <ShoppingBag size={13} /> Explorar cardápio <ArrowRight size={13} />
                </div>
              </div>
            </Link>
            <div className="floating-note">
              <span className="note-icon">
                <Smartphone size={21} />
              </span>
              <span>
                <strong>Seu cardápio, em qualquer lugar.</strong>
                <small>Um QR Code. Nenhum aplicativo.</small>
              </span>
            </div>
          </div>
        </section>
        <div className="ticker">
          <span>MENOS PAPEL</span>
          <span>✦</span>
          <span>MAIS SABOR</span>
          <span>✦</span>
          <span>SUA MARCA EM DESTAQUE</span>
          <span>✦</span>
          <span>MAIS POSSIBILIDADES</span>
          <span>✦</span>
          <span>MENOS PAPEL</span>
        </div>
        <section id="como-funciona" className="wrap section how">
          <div className="section-heading">
            <div>
              <span className="eyebrow">SIMPLES ASSIM</span>
              <h2>
                DA SUA COZINHA
                <br />
                PARA A TELA.
              </h2>
            </div>
            <p>
              Você cuida do sabor.
              <br />A gente cuida da apresentação.
            </p>
          </div>
          <div className="steps">
            {[
              {
                n: "01",
                icon: Utensils,
                title: "Monte seu cardápio",
                text: "Escolha um modelo do seu segmento. Adicione fotos, produtos e preços.",
              },
              {
                n: "02",
                icon: QrCode,
                title: "Compartilhe seu QR Code",
                text: "Na mesa, na embalagem ou nas redes. Seu cardápio está sempre à mão.",
              },
              {
                n: "03",
                icon: ShoppingBag,
                title: "Receba os pedidos",
                text: "Seu cliente escolhe. Você acompanha tudo no painel ou no WhatsApp.",
              },
            ].map((s) => (
              <article key={s.n}>
                <div className="step-top">
                  <span>{s.n}</span>
                  <s.icon size={32} />
                </div>
                <h3>{s.title}</h3>
                <p>{s.text}</p>
              </article>
            ))}
          </div>
        </section>
        <section className="showcase">
          <div className="showcase-photo">
            <img src="/images/combo.jpg" alt="Hambúrgueres e batatas em uma bandeja" />
            <div className="photo-caption">
              SABOR QUE SE VÊ.
              <br />
              VONTADE QUE SE SENTE.
            </div>
          </div>
          <div className="showcase-copy">
            <span className="eyebrow">NÃO É SÓ UM CARDÁPIO</span>
            <h2>
              É A SUA MELHOR
              <br />
              PRIMEIRA
              <br />
              IMPRESSÃO.
            </h2>
            <p>
              Fotografias grandes. Navegação simples. Uma experiência que valoriza cada prato e
              facilita cada escolha.
            </p>
            <Link to="/loja/burger-da-casa" className="btn yellow">
              Experimente como cliente <ArrowUpRight size={19} />
            </Link>
            <small>Cardápio demonstrativo • Produtos e preços ilustrativos</small>
          </div>
        </section>
        <section id="recursos" className="wrap section">
          <div className="center-heading">
            <span className="eyebrow">BONITO POR FORA. COMPLETO POR DENTRO.</span>
            <h2>
              TUDO NA MESA.
              <br />
              NADA COMPLICADO.
            </h2>
          </div>
          <div className="features">
            {features.map((f) => (
              <article key={f.title}>
                <div className="feature-icon">
                  <f.icon size={29} />
                </div>
                <h3>{f.title}</h3>
                <p>{f.text}</p>
              </article>
            ))}
          </div>
          <div className="premium-feature">
            <Box size={35} />
            <div>
              <span className="badge premium">RECURSO PREMIUM</span>
              <h3>Visualize seu prato. Antes de pedir.</h3>
              <p>
                Galerias ampliadas e modelos 3D interativos quando enviados pela loja. Sem modelo?
                Fotos reais, sem simulação.
              </p>
            </div>
            <Link to="/cadastro?plano=premium" className="text-link">
              Conhecer o Premium <ArrowUpRight size={18} />
            </Link>
          </div>
        </section>
        <section className="segments section">
          <div className="wrap">
            <span className="eyebrow">O SEU SABOR TEM LUGAR AQUI</span>
            <h2>
              PARA QUEM SERVE
              <br />
              BOAS EXPERIÊNCIAS.
            </h2>
            <div className="segment-list">
              {[
                { Icon: Utensils, name: "Restaurantes" },
                { Icon: ShoppingBag, name: "Hamburguerias" },
                { Icon: Pizza, name: "Pizzarias" },
                { Icon: IceCreamBowl, name: "Açaíterias" },
                { Icon: Coffee, name: "Cafeterias" },
              ].map(({ Icon, name }) => (
                <Link key={name} to="/cadastro">
                  <Icon size={33} />
                  <strong>{name}</strong>
                  <ArrowUpRight size={16} />
                </Link>
              ))}
            </div>
            <p>
              Padarias, docerias, bares, food trucks e muito mais. Modelos editáveis para diferentes
              segmentos.
            </p>
          </div>
        </section>
        <section id="planos" className="wrap section pricing">
          <div className="center-heading">
            <span className="eyebrow">UM PEQUENO INVESTIMENTO. UMA NOVA EXPERIÊNCIA.</span>
            <h2>
              O PLANO CERTO
              <br />
              PARA O SEU MOMENTO.
            </h2>
            <p>Mensalidade transparente. Sem comissão da plataforma sobre pedidos.</p>
          </div>
          {offers.isLoading ? (
            <Loading />
          ) : offers.isError ? (
            <ErrorBox error={offers.error} />
          ) : (
            <div className="plans">
              {offers.data?.plans.map((p, i) => (
                <article className={`plan ${i === 1 ? "recommended" : ""}`} key={p.id}>
                  {i === 1 && <div className="plan-banner">NOSSA RECOMENDAÇÃO</div>}
                  <span className="eyebrow">{p.name}</span>
                  <h3>
                    {money(p.price)}
                    <small>/mês</small>
                  </h3>
                  <p>
                    {i === 0
                      ? "O essencial para começar bem."
                      : i === 1
                        ? "Mais espaço para o seu negócio."
                        : "Uma experiência ainda mais completa."}
                  </p>
                  <Link
                    to={`/cadastro?plano=${p.id}`}
                    className={`btn ${i === 1 ? "yellow" : "outline"}`}
                  >
                    Escolher {p.name} <ArrowUpRight size={17} />
                  </Link>
                  <ul>
                    {[
                      `${p.productLimit} produtos e ${p.categoryLimit} categorias`,
                      "Cardápio com sua identidade",
                      "Pedidos e QR Code",
                      ...(p.reports ? ["Relatórios de vendas"] : []),
                      ...(p.premium ? ["Galerias e modelos 3D enviados"] : []),
                      `${p.trialDays} dias de teste`,
                    ].map((t) => (
                      <li key={t}>
                        <Check size={16} />
                        {t}
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          )}
          <div className="pricing-note">
            <ShieldCheck size={17} /> Cobrança mensal com confirmação manual. Pagamentos dos pedidos
            são combinados diretamente com a loja.
          </div>
        </section>
        <section className="wrap section faq">
          <div>
            <span className="eyebrow">SEM DÚVIDAS. SEM COMPLICAÇÃO.</span>
            <h2>
              PODE
              <br />
              PERGUNTAR.
            </h2>
            <p>
              A gente gosta de deixar
              <br />
              tudo às claras.
            </p>
          </div>
          <div className="faq-list">
            {[
              {
                q: "Preciso entender de tecnologia?",
                a: "Não. Você configura sua loja, edita os produtos e compartilha o link. Os modelos ajudam a começar, mas os exemplos devem ser revisados antes de publicar.",
              },
              {
                q: "Meu cliente precisa baixar um aplicativo?",
                a: "Não. Basta abrir o link ou apontar a câmera para o QR Code. O cardápio funciona no navegador do celular.",
              },
              {
                q: "Posso usar minha marca e minhas fotos?",
                a: "Sim. Personalize o nome, logotipo, cores, fotografias, preços e descrições pelo seu painel.",
              },
              {
                q: "Como recebo os pedidos e pagamentos?",
                a: "Os pedidos ficam registrados no painel. Você também pode configurar o envio ao WhatsApp. Pix, dinheiro e cartão na entrega são combinados com sua loja; a plataforma não confirma automaticamente esses pagamentos.",
              },
              {
                q: "Todos os pratos aparecem em 3D?",
                a: "Não. O plano Premium exibe um modelo 3D real apenas quando a loja envia um arquivo GLB compatível. Sem modelo, mostramos uma galeria de fotos.",
              },
              {
                q: "O que acontece se minha assinatura vencer?",
                a: "Seus dados são preservados. O acesso operacional é restringido até regularização. A visibilidade do cardápio durante a suspensão é definida pelo administrador.",
              },
            ].map((f) => (
              <details key={f.q}>
                <summary>
                  {f.q}
                  <ChevronDown size={18} />
                </summary>
                <p>{f.a}</p>
              </details>
            ))}
          </div>
        </section>
        <section className="last-cta">
          <span className="eyebrow">BORA COLOCAR SUA MARCA NA MESA?</span>
          <h2>
            SEU PRÓXIMO PEDIDO
            <br />
            COMEÇA AQUI.
          </h2>
          <Link to="/cadastro" className="btn yellow">
            Quero meu cardápio online <ArrowUpRight size={21} />
          </Link>
          <p>Sem papel. Sem aplicativo. Com muito mais personalidade.</p>
          <MousePointer2 className="cta-pointer" size={47} />
        </section>
      </main>
      <Footer />
    </div>
  );
}
