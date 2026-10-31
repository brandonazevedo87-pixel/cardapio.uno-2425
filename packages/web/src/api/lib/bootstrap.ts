import { eq } from "drizzle-orm";
import { hashPassword } from "better-auth/crypto";
import { db } from "../database";
import * as s from "../database/schema";

export const adminEmail = "brandonazevedo87@gmail.com";
export const segments: Record<string, string[]> = {
  Hamburgueria: ["Hambúrgueres", "Especiais", "Combos", "Porções", "Bebidas", "Sobremesas"],
  Pizzaria: [
    "Pizzas tradicionais",
    "Pizzas especiais",
    "Pizzas doces",
    "Bordas",
    "Bebidas",
    "Combos",
  ],
  Restaurante: [
    "Entradas",
    "Pratos executivos",
    "Carnes",
    "Aves",
    "Peixes",
    "Massas",
    "Saladas",
    "Sobremesas",
    "Bebidas",
  ],
  Lanchonete: ["Lanches", "Salgados", "Porções", "Bebidas"],
  Pastelaria: ["Pastéis salgados", "Pastéis doces", "Bebidas"],
  Açaíteria: ["Açaí", "Complementos", "Frutas", "Cremes", "Combos"],
  Sorveteria: ["Sorvetes", "Sundaes", "Milk-shakes"],
  Cafeteria: ["Cafés quentes", "Cafés gelados", "Cappuccinos", "Chás", "Salgados", "Bolos e doces"],
  Padaria: ["Pães", "Salgados", "Bolos", "Cafés"],
  "Doceria e confeitaria": ["Doces", "Bolos", "Tortas", "Bebidas"],
  Marmitaria: ["Marmitas", "Acompanhamentos", "Bebidas"],
  Churrascaria: ["Carnes", "Porções", "Acompanhamentos", "Bebidas"],
  "Restaurante japonês": ["Sushi", "Sashimi", "Temaki", "Pratos quentes", "Combos"],
  "Comida saudável": ["Saladas", "Bowls", "Pratos leves", "Sucos"],
  "Bar e petiscaria": ["Petiscos", "Porções", "Drinks", "Bebidas"],
  "Casa de sucos": ["Sucos naturais", "Vitaminas", "Lanches"],
  "Food truck": ["Lanches", "Combos", "Bebidas"],
  "Comida brasileira": [
    "Pratos brasileiros",
    "Feijoada",
    "Acompanhamentos",
    "Sobremesas",
    "Bebidas",
  ],
  Personalizado: ["Destaques", "Produtos", "Bebidas"],
};
export async function seedCatalog(
  tx: Pick<typeof db, "insert">,
  companyId: string,
  segment: string,
  withProducts: boolean,
  limits = { categoryLimit: 100, productLimit: 1000 },
) {
  const names = (segments[segment] ?? segments.Personalizado).slice(0, limits.categoryLimit);
  for (let i = 0; i < names.length; i++) {
    const categoryId = crypto.randomUUID();
    await tx
      .insert(s.categories)
      .values({ id: categoryId, companyId, name: names[i], position: i });
    if (withProducts && i < limits.productLimit) {
      const isBurger = segment === "Hamburgueria";
      const examples = isBurger
        ? [
            "Clássico da casa",
            "Duplo cheddar",
            "Combo artesanal",
            "Porção da casa",
            "Bebida gelada",
            "Doce da casa",
          ]
        : names.map((n) => `${n} — exemplo`);
      await tx.insert(s.products).values({
        id: crypto.randomUUID(),
        companyId,
        categoryId,
        name: examples[i],
        description:
          "Produto demonstrativo. Substitua a descrição, fotografia e preço antes de publicar seu cardápio.",
        ingredients: "Personalize os ingredientes",
        price: i === 4 ? 800 : 2490 + i * 500,
        images: [
          isBurger ? (i === 2 ? "/images/combo.jpg" : "/images/burger.jpg") : "/images/food.jpg",
        ],
        demo: true,
        featured: i < 3,
      });
    }
  }
}
export async function bootstrap() {
  const existing = await db.select().from(s.user).where(eq(s.user.email, adminEmail));
  if (!existing.length) {
    const password = process.env.BRANDON_ADMIN_PASSWORD;
    if (!password || password.length < 12)
      throw new Error("BRANDON_ADMIN_PASSWORD precisa ter pelo menos 12 caracteres.");
    const hash = await hashPassword(password),
      uid = crypto.randomUUID();
    await db.transaction(async (tx) => {
      await tx.insert(s.user).values({
        id: uid,
        email: adminEmail,
        name: "Brandon Azevedo",
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      await tx.insert(s.account).values({
        id: crypto.randomUUID(),
        userId: uid,
        accountId: uid,
        providerId: "credential",
        password: hash,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      await tx.insert(s.memberships).values({ userId: uid, role: "admin", mustChange: true });
    });
  }
  const existingPlans = await db.select().from(s.plans);
  if (!existingPlans.length)
    await db.insert(s.plans).values([
      {
        id: "inicial",
        name: "Inicial",
        price: 4990,
        productLimit: 50,
        categoryLimit: 10,
        userLimit: 1,
        trialDays: 7,
        premium: false,
        reports: false,
      },
      {
        id: "profissional",
        name: "Profissional",
        price: 8990,
        productLimit: 200,
        categoryLimit: 40,
        userLimit: 1,
        trialDays: 7,
        premium: false,
        reports: true,
      },
      {
        id: "premium",
        name: "Premium",
        price: 14990,
        productLimit: 1000,
        categoryLimit: 100,
        userLimit: 1,
        trialDays: 7,
        premium: true,
        reports: true,
      },
    ]);
  if (!(await db.select().from(s.companies).where(eq(s.companies.slug, "burger-da-casa"))).length) {
    await db.transaction(async (tx) => {
      const companyId = "demo-burger";
      await tx.insert(s.companies).values({
        id: companyId,
        slug: "burger-da-casa",
        name: "Burger da Casa",
        segment: "Hamburgueria",
        description: "Artesanal de verdade. Feito na hora, do seu jeito.",
        cover: "/images/combo.jpg",
        demo: true,
        createdAt: new Date().toISOString(),
        hours: "Todos os dias • 18h às 23h",
        address: "Endereço ilustrativo",
      });
      await tx.insert(s.subscriptions).values({
        id: crypto.randomUUID(),
        companyId,
        planId: "premium",
        price: 0,
        dueDate: "2099-12-31",
        status: "active",
      });
      await seedCatalog(tx, companyId, "Hamburgueria", true);
    });
  }
}
