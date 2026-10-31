import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
export * from "./auth-schema";
const id = () => text("id").primaryKey();
export const plans = sqliteTable("plans", {
  id: id(),
  name: text("name").notNull(),
  price: integer("price").notNull(),
  productLimit: integer("product_limit").notNull(),
  categoryLimit: integer("category_limit").notNull().default(50),
  userLimit: integer("user_limit").notNull().default(1),
  trialDays: integer("trial_days").notNull().default(7),
  premium: integer("premium", { mode: "boolean" }).notNull().default(false),
  reports: integer("reports", { mode: "boolean" }).notNull().default(false),
  customization: integer("customization", { mode: "boolean" }).notNull().default(true),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
});
export const companies = sqliteTable(
  "companies",
  {
    id: id(),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    ownerId: text("owner_id").unique(),
    segment: text("segment").notNull(),
    description: text("description").notNull().default(""),
    logo: text("logo").notNull().default(""),
    cover: text("cover").notNull().default(""),
    whatsapp: text("whatsapp").notNull().default(""),
    address: text("address").notNull().default(""),
    hours: text("hours").notNull().default(""),
    color: text("color").notNull().default("#c82d2f"),
    deliveryFee: integer("delivery_fee").notNull().default(500),
    minimum: integer("minimum").notNull().default(0),
    pickup: integer("pickup", { mode: "boolean" }).notNull().default(true),
    delivery: integer("delivery", { mode: "boolean" }).notNull().default(true),
    payments: text("payments", { mode: "json" })
      .$type<string[]>()
      .notNull()
      .default(["Pix", "Dinheiro", "Cartão na entrega"]),
    checkoutMode: text("checkout_mode").notNull().default("platform"),
    tracking: integer("tracking", { mode: "boolean" }).notNull().default(true),
    status: text("status").notNull().default("active"),
    publicWhenSuspended: integer("public_when_suspended", { mode: "boolean" })
      .notNull()
      .default(false),
    demo: integer("demo", { mode: "boolean" }).notNull().default(false),
    views: integer("views").notNull().default(0),
    createdAt: text("created_at").notNull(),
  },
  (t) => [index("company_owner_idx").on(t.ownerId)],
);
export const memberships = sqliteTable("memberships", {
  userId: text("user_id").primaryKey(),
  role: text("role").notNull().default("merchant"),
  companyId: text("company_id").references(() => companies.id),
  mustChange: integer("must_change", { mode: "boolean" }).notNull().default(false),
});
export const subscriptions = sqliteTable("subscriptions", {
  id: id(),
  companyId: text("company_id")
    .notNull()
    .unique()
    .references(() => companies.id),
  planId: text("plan_id")
    .notNull()
    .references(() => plans.id),
  price: integer("price").notNull(),
  dueDate: text("due_date").notNull(),
  status: text("status").notNull().default("trial"),
  note: text("note").notNull().default(""),
});
export const categories = sqliteTable(
  "categories",
  {
    id: id(),
    companyId: text("company_id")
      .notNull()
      .references(() => companies.id),
    name: text("name").notNull(),
    position: integer("position").notNull().default(0),
  },
  (t) => [index("category_company_idx").on(t.companyId)],
);
export const products = sqliteTable(
  "products",
  {
    id: id(),
    companyId: text("company_id")
      .notNull()
      .references(() => companies.id),
    categoryId: text("category_id")
      .notNull()
      .references(() => categories.id),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    ingredients: text("ingredients").notNull().default(""),
    price: integer("price").notNull(),
    images: text("images", { mode: "json" }).$type<string[]>().notNull().default([]),
    modelUrl: text("model_url").notNull().default(""),
    available: integer("available", { mode: "boolean" }).notNull().default(true),
    stock: integer("stock"),
    demo: integer("demo", { mode: "boolean" }).notNull().default(false),
    featured: integer("featured", { mode: "boolean" }).notNull().default(false),
  },
  (t) => [index("product_company_idx").on(t.companyId)],
);
export const variations = sqliteTable("variations", {
  id: id(),
  companyId: text("company_id")
    .notNull()
    .references(() => companies.id),
  productId: text("product_id")
    .notNull()
    .references(() => products.id),
  name: text("name").notNull(),
  price: integer("price").notNull(),
});
export const extras = sqliteTable("extras", {
  id: id(),
  companyId: text("company_id")
    .notNull()
    .references(() => companies.id),
  productId: text("product_id")
    .notNull()
    .references(() => products.id),
  name: text("name").notNull(),
  price: integer("price").notNull(),
});
export const orders = sqliteTable(
  "orders",
  {
    id: id(),
    number: integer("number").notNull(),
    companyId: text("company_id")
      .notNull()
      .references(() => companies.id),
    token: text("token").notNull().unique(),
    customerName: text("customer_name").notNull(),
    phone: text("phone").notNull(),
    address: text("address").notNull().default(""),
    fulfillment: text("fulfillment").notNull(),
    payment: text("payment").notNull(),
    paymentStatus: text("payment_status").notNull().default("pending"),
    notes: text("notes").notNull().default(""),
    subtotal: integer("subtotal").notNull(),
    deliveryFee: integer("delivery_fee").notNull(),
    total: integer("total").notNull(),
    status: text("status").notNull().default("received"),
    history: text("history", { mode: "json" }).$type<{ status: string; at: string }[]>().notNull(),
    createdAt: text("created_at").notNull(),
  },
  (t) => [index("order_company_idx").on(t.companyId, t.createdAt)],
);
export const orderItems = sqliteTable("order_items", {
  id: id(),
  companyId: text("company_id")
    .notNull()
    .references(() => companies.id),
  orderId: text("order_id")
    .notNull()
    .references(() => orders.id),
  productId: text("product_id").notNull(),
  name: text("name").notNull(),
  quantity: integer("quantity").notNull(),
  unitPrice: integer("unit_price").notNull(),
  variation: text("variation").notNull().default(""),
  extras: text("extras", { mode: "json" })
    .$type<{ name: string; price: number }[]>()
    .notNull()
    .default([]),
  notes: text("notes").notNull().default(""),
});
export const files = sqliteTable("files", {
  id: id(),
  companyId: text("company_id")
    .notNull()
    .references(() => companies.id),
  key: text("key").notNull(),
  url: text("url").notNull(),
  type: text("type").notNull(),
  createdAt: text("created_at").notNull(),
});
export const payments = sqliteTable("payments", {
  id: id(),
  companyId: text("company_id")
    .notNull()
    .references(() => companies.id),
  amount: integer("amount").notNull(),
  reference: text("reference").notNull(),
  paidAt: text("paid_at").notNull(),
  method: text("method").notNull().default("manual"),
});
export const audit = sqliteTable("audit", {
  id: id(),
  actorId: text("actor_id").notNull(),
  action: text("action").notNull(),
  targetId: text("target_id").notNull(),
  details: text("details").notNull().default(""),
  createdAt: text("created_at").notNull(),
});
export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});
export const resets = sqliteTable("password_resets", {
  id: id(),
  userId: text("user_id").notNull(),
  expiresAt: text("expires_at").notNull(),
});
