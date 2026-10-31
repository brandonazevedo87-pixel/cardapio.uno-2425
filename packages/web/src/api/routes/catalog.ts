import { z } from "zod";
import { eq, and, desc } from "drizzle-orm";
import { ORPCError } from "@orpc/server";
import { merchant, merchantRead } from "../middleware/access";
import { db } from "../database";
import * as s from "../database/schema";
const mediaUrl = z
  .string()
  .max(2000)
  .refine(
    (v) => !v || v.startsWith("/images/") || v.startsWith("https://"),
    "Use uma URL HTTPS ou imagem enviada.",
  );
const option = z.object({
  name: z.string().min(1).max(80),
  price: z.number().int().min(0).max(1000000),
});
export const productInput = z.object({
  id: z.string().optional(),
  categoryId: z.string(),
  name: z.string().min(2).max(150),
  description: z.string().max(2000),
  ingredients: z.string().max(1000),
  price: z.number().int().min(0).max(1000000),
  images: z.array(mediaUrl).max(8),
  modelUrl: mediaUrl,
  available: z.boolean(),
  stock: z.number().int().min(0).max(100000).nullable(),
  demo: z.boolean(),
  featured: z.boolean(),
  variations: z.array(option).max(30),
  extras: z.array(option).max(30),
});
export const catalog = {
  overview: merchantRead.handler(async ({ context }) => {
    const companyId = context.company.id;
    if (context.blocked)
      return {
        company: context.company,
        subscription: context.subscription,
        plan: context.plan,
        blocked: true,
        products: [],
        categories: [],
        variations: [],
        extras: [],
        orders: [],
        items: [],
        payments: [],
        settings: await db.select().from(s.settings),
      };
    const [products, categories, variations, extras, orders, items, payments, settings] =
      await Promise.all([
        db.select().from(s.products).where(eq(s.products.companyId, companyId)),
        db.select().from(s.categories).where(eq(s.categories.companyId, companyId)),
        db.select().from(s.variations).where(eq(s.variations.companyId, companyId)),
        db.select().from(s.extras).where(eq(s.extras.companyId, companyId)),
        db
          .select()
          .from(s.orders)
          .where(eq(s.orders.companyId, companyId))
          .orderBy(desc(s.orders.createdAt))
          .limit(500),
        db.select().from(s.orderItems).where(eq(s.orderItems.companyId, companyId)),
        db.select().from(s.payments).where(eq(s.payments.companyId, companyId)),
        db.select().from(s.settings),
      ]);
    return {
      company: context.company,
      subscription: context.subscription,
      plan: context.plan,
      blocked: false,
      products,
      categories,
      variations,
      extras,
      orders,
      items,
      payments,
      settings,
    };
  }),
  saveProduct: merchant.input(productInput).handler(async ({ context, input }) => {
    const companyId = context.company.id;
    if (
      !(
        await db
          .select()
          .from(s.categories)
          .where(and(eq(s.categories.id, input.categoryId), eq(s.categories.companyId, companyId)))
      ).length
    )
      throw new ORPCError("BAD_REQUEST", { message: "Categoria inválida." });
    if (input.modelUrl && !context.plan.premium)
      throw new ORPCError("FORBIDDEN", {
        message: "Modelos 3D estão disponíveis no plano Premium.",
      });
    const { id, variations, extras, ...data } = input;
    const pid = id ?? crypto.randomUUID();
    await db.transaction(async (tx) => {
      if (id) {
        const existing = await tx
          .select()
          .from(s.products)
          .where(and(eq(s.products.id, id), eq(s.products.companyId, companyId)));
        if (!existing.length) throw new ORPCError("NOT_FOUND");
        await tx
          .update(s.products)
          .set(data)
          .where(and(eq(s.products.id, id), eq(s.products.companyId, companyId)));
      } else {
        const current = await tx
          .select({ id: s.products.id })
          .from(s.products)
          .where(eq(s.products.companyId, companyId));
        if (current.length >= context.plan.productLimit)
          throw new ORPCError("FORBIDDEN", { message: "Limite de produtos do plano atingido." });
        await tx.insert(s.products).values({ id: pid, companyId, ...data });
      }
      await tx
        .delete(s.variations)
        .where(and(eq(s.variations.productId, pid), eq(s.variations.companyId, companyId)));
      await tx
        .delete(s.extras)
        .where(and(eq(s.extras.productId, pid), eq(s.extras.companyId, companyId)));
      if (variations.length)
        await tx
          .insert(s.variations)
          .values(
            variations.map((v) => ({ id: crypto.randomUUID(), companyId, productId: pid, ...v })),
          );
      if (extras.length)
        await tx
          .insert(s.extras)
          .values(
            extras.map((v) => ({ id: crypto.randomUUID(), companyId, productId: pid, ...v })),
          );
    });
    return { id: pid };
  }),
  deleteProduct: merchant
    .input(z.object({ id: z.string() }))
    .handler(async ({ context, input }) => {
      await db.transaction(async (tx) => {
        await tx
          .delete(s.extras)
          .where(and(eq(s.extras.productId, input.id), eq(s.extras.companyId, context.company.id)));
        await tx
          .delete(s.variations)
          .where(
            and(
              eq(s.variations.productId, input.id),
              eq(s.variations.companyId, context.company.id),
            ),
          );
        const r = await tx
          .delete(s.products)
          .where(and(eq(s.products.id, input.id), eq(s.products.companyId, context.company.id)))
          .returning();
        if (!r.length) throw new ORPCError("NOT_FOUND");
      });
      return { ok: true };
    }),
  saveCategory: merchant
    .input(
      z.object({
        id: z.string().optional(),
        name: z.string().min(2).max(100),
        position: z.number().int().min(0).max(1000),
      }),
    )
    .handler(async ({ context, input }) => {
      const { id, ...data } = input;
      if (id) {
        const r = await db
          .update(s.categories)
          .set(data)
          .where(and(eq(s.categories.id, id), eq(s.categories.companyId, context.company.id)))
          .returning();
        if (!r.length) throw new ORPCError("NOT_FOUND");
      } else {
        const rows = await db
          .select()
          .from(s.categories)
          .where(eq(s.categories.companyId, context.company.id));
        if (rows.length >= context.plan.categoryLimit)
          throw new ORPCError("FORBIDDEN", { message: "Limite de categorias atingido." });
        await db
          .insert(s.categories)
          .values({ id: crypto.randomUUID(), companyId: context.company.id, ...data });
      }
      return { ok: true };
    }),
  deleteCategory: merchant
    .input(z.object({ id: z.string() }))
    .handler(async ({ context, input }) => {
      if (
        (
          await db
            .select()
            .from(s.products)
            .where(
              and(
                eq(s.products.categoryId, input.id),
                eq(s.products.companyId, context.company.id),
              ),
            )
        ).length
      )
        throw new ORPCError("CONFLICT", {
          message: "Mova ou exclua os produtos desta categoria primeiro.",
        });
      const r = await db
        .delete(s.categories)
        .where(and(eq(s.categories.id, input.id), eq(s.categories.companyId, context.company.id)))
        .returning();
      if (!r.length) throw new ORPCError("NOT_FOUND");
      return { ok: true };
    }),
  saveCompany: merchant
    .input(
      z.object({
        name: z.string().min(2).max(100),
        description: z.string().max(1000),
        logo: mediaUrl,
        cover: mediaUrl,
        whatsapp: z
          .string()
          .max(20)
          .regex(/^[0-9+ ()-]*$/),
        address: z.string().max(500),
        hours: z.string().max(500),
        color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
        deliveryFee: z.number().int().min(0).max(100000),
        minimum: z.number().int().min(0).max(1000000),
        pickup: z.boolean(),
        delivery: z.boolean(),
        payments: z.array(z.enum(["Pix", "Dinheiro", "Cartão na entrega"])).min(1),
        checkoutMode: z.enum(["platform", "whatsapp"]),
        tracking: z.boolean(),
      }),
    )
    .handler(async ({ context, input }) => {
      if (!context.plan.customization && input.color !== context.company.color)
        throw new ORPCError("FORBIDDEN");
      if (!input.pickup && !input.delivery)
        throw new ORPCError("BAD_REQUEST", { message: "Ative entrega ou retirada." });
      if (input.checkoutMode === "whatsapp" && input.whatsapp.replace(/\D/g, "").length < 10)
        throw new ORPCError("BAD_REQUEST", { message: "Informe o WhatsApp com DDD." });
      await db.update(s.companies).set(input).where(eq(s.companies.id, context.company.id));
      return { ok: true };
    }),
};
export const catalogRoutes = catalog;
