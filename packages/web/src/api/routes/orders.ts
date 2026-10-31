import { z } from "zod";
import { eq, and, sql } from "drizzle-orm";
import { ORPCError } from "@orpc/server";
import { base } from "../__core/app";
import { merchant } from "../middleware/access";
import { db } from "../database";
import * as s from "../database/schema";
export const statusNames: Record<string, string> = {
  received: "Pedido recebido",
  confirmed: "Pedido confirmado",
  preparing: "Em preparação",
  ready: "Pronto para retirada",
  out: "Saiu para entrega",
  completed: "Concluído",
  cancelled: "Cancelado",
};
const checkoutInput = z.object({
  slug: z.string(),
  requestId: z.uuid(),
  customerName: z.string().min(2).max(100),
  phone: z.string().regex(/^[0-9+ ()-]{10,20}$/),
  address: z.string().max(500),
  fulfillment: z.enum(["delivery", "pickup"]),
  payment: z.enum(["Pix", "Dinheiro", "Cartão na entrega"]),
  notes: z.string().max(1000),
  items: z
    .array(
      z.object({
        productId: z.string(),
        quantity: z.number().int().min(1).max(50),
        variationId: z.string().optional(),
        extraIds: z.array(z.string()).max(30),
        notes: z.string().max(500),
      }),
    )
    .min(1)
    .max(50),
});
async function publicStore(slug: string) {
  const [company] = await db.select().from(s.companies).where(eq(s.companies.slug, slug));
  if (!company) throw new ORPCError("NOT_FOUND", { message: "Cardápio não encontrado." });
  const [sub] = await db
    .select()
    .from(s.subscriptions)
    .where(eq(s.subscriptions.companyId, company.id));
  const blocked =
    company.status !== "active" ||
    !sub ||
    ["suspended", "cancelled"].includes(sub.status) ||
    sub.dueDate < new Date().toISOString().slice(0, 10);
  if (blocked && !company.publicWhenSuspended)
    throw new ORPCError("FORBIDDEN", {
      message: "Este cardápio está temporariamente indisponível.",
    });
  const [plan] = sub ? await db.select().from(s.plans).where(eq(s.plans.id, sub.planId)) : [];
  return { company, blocked, plan };
}
export const orders = {
  menu: base.input(z.object({ slug: z.string() })).handler(async ({ input }) => {
    const { company, blocked, plan } = await publicStore(input.slug);
    const [products, categories, variations, extras] = await Promise.all([
      db.select().from(s.products).where(eq(s.products.companyId, company.id)),
      db.select().from(s.categories).where(eq(s.categories.companyId, company.id)),
      db.select().from(s.variations).where(eq(s.variations.companyId, company.id)),
      db.select().from(s.extras).where(eq(s.extras.companyId, company.id)),
    ]);
    return {
      company: {
        id: company.id,
        name: company.name,
        slug: company.slug,
        description: company.description,
        logo: company.logo,
        cover: company.cover,
        whatsapp: company.whatsapp,
        address: company.address,
        hours: company.hours,
        color: company.color,
        deliveryFee: company.deliveryFee,
        minimum: company.minimum,
        pickup: company.pickup,
        delivery: company.delivery,
        payments: company.payments,
        checkoutMode: company.checkoutMode,
        tracking: company.tracking,
        demo: company.demo,
      },
      blocked,
      premium: plan?.premium ?? false,
      products: products.map((p) => ({ ...p, modelUrl: plan?.premium ? p.modelUrl : "" })),
      categories,
      variations,
      extras,
    };
  }),
  visit: base.input(z.object({ slug: z.string() })).handler(async ({ input }) => {
    const { company } = await publicStore(input.slug);
    await db
      .update(s.companies)
      .set({ views: sql`${s.companies.views}+1` })
      .where(eq(s.companies.id, company.id));
    return { ok: true };
  }),
  checkout: base.input(checkoutInput).handler(async ({ input }) => {
    const { company, blocked } = await publicStore(input.slug);
    if (blocked)
      throw new ORPCError("FORBIDDEN", {
        message: "Pedidos desativados até regularização da loja.",
      });
    if (!company.payments.includes(input.payment))
      throw new ORPCError("BAD_REQUEST", { message: "Forma de pagamento indisponível." });
    if (input.fulfillment === "delivery" && (!company.delivery || input.address.trim().length < 10))
      throw new ORPCError("BAD_REQUEST", {
        message: "Informe um endereço completo ou escolha retirada.",
      });
    if (input.fulfillment === "pickup" && !company.pickup)
      throw new ORPCError("BAD_REQUEST", { message: "Retirada não disponível." });
    const existing = await db.select().from(s.orders).where(eq(s.orders.id, input.requestId));
    if (existing.length)
      throw new ORPCError("CONFLICT", {
        message: "Pedido já enviado. Confira seu acompanhamento.",
      });
    const recent = await db
      .select({ id: s.orders.id })
      .from(s.orders)
      .where(
        and(
          eq(s.orders.companyId, company.id),
          eq(s.orders.phone, input.phone),
          sql`${s.orders.createdAt}>${new Date(Date.now() - 60000).toISOString()}`,
        ),
      );
    if (recent.length >= 3)
      throw new ORPCError("TOO_MANY_REQUESTS", {
        message: "Aguarde um minuto antes de enviar outro pedido.",
      });
    const token = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("hex");
    const result = await db.transaction(async (tx) => {
      const allProducts = await tx
        .select()
        .from(s.products)
        .where(eq(s.products.companyId, company.id));
      const allVariations = await tx
        .select()
        .from(s.variations)
        .where(eq(s.variations.companyId, company.id));
      const allExtras = await tx.select().from(s.extras).where(eq(s.extras.companyId, company.id));
      const stockNeeded = new Map<string, number>();
      const items = input.items.map((i) => {
        const p = allProducts.find((p) => p.id === i.productId);
        if (!p || !p.available)
          throw new ORPCError("BAD_REQUEST", { message: "Um produto não está mais disponível." });
        const options = allVariations.filter((v) => v.productId === p.id),
          variation = options.find((v) => v.id === i.variationId);
        if (options.length && !variation)
          throw new ORPCError("BAD_REQUEST", {
            message: `Escolha uma variação válida para ${p.name}.`,
          });
        if (i.variationId && !variation) throw new ORPCError("BAD_REQUEST");
        if (new Set(i.extraIds).size !== i.extraIds.length) throw new ORPCError("BAD_REQUEST");
        const selected = i.extraIds.map((id) => {
          const e = allExtras.find((e) => e.id === id && e.productId === p.id);
          if (!e) throw new ORPCError("BAD_REQUEST", { message: "Adicional inválido." });
          return { name: e.name, price: e.price };
        });
        const unitPrice = (variation?.price ?? p.price) + selected.reduce((a, e) => a + e.price, 0);
        stockNeeded.set(p.id, (stockNeeded.get(p.id) ?? 0) + i.quantity);
        return {
          id: crypto.randomUUID(),
          companyId: company.id,
          orderId: input.requestId,
          productId: p.id,
          name: p.name,
          quantity: i.quantity,
          unitPrice,
          variation: variation?.name ?? "",
          extras: selected,
          notes: i.notes,
        };
      });
      for (const [pid, quantity] of stockNeeded) {
        const p = allProducts.find((p) => p.id === pid)!;
        if (p.stock !== null) {
          const updated = await tx
            .update(s.products)
            .set({ stock: sql`${s.products.stock}-${quantity}` })
            .where(
              and(
                eq(s.products.id, pid),
                eq(s.products.companyId, company.id),
                sql`${s.products.stock}>=${quantity}`,
              ),
            )
            .returning();
          if (!updated.length)
            throw new ORPCError("CONFLICT", { message: `Estoque insuficiente: ${p.name}.` });
        }
      }
      const subtotal = items.reduce((a, i) => a + i.unitPrice * i.quantity, 0),
        deliveryFee = input.fulfillment === "delivery" ? company.deliveryFee : 0,
        total = subtotal + deliveryFee;
      if (subtotal < company.minimum)
        throw new ORPCError("BAD_REQUEST", {
          message: `Pedido mínimo: R$ ${(company.minimum / 100).toFixed(2)}.`,
        });
      const [{ count }] = await tx
        .select({ count: sql<number>`count(*)` })
        .from(s.orders)
        .where(eq(s.orders.companyId, company.id));
      const now = new Date().toISOString(),
        number = count + 1;
      await tx.insert(s.orders).values({
        id: input.requestId,
        companyId: company.id,
        token,
        number,
        customerName: input.customerName,
        phone: input.phone,
        address: input.fulfillment === "delivery" ? input.address : "",
        fulfillment: input.fulfillment,
        payment: input.payment,
        notes: input.notes,
        subtotal,
        deliveryFee,
        total,
        createdAt: now,
        history: [{ status: "received", at: now }],
      });
      await tx.insert(s.orderItems).values(items);
      return { number, total, items };
    });
    const text = `*Pedido #${result.number} — ${company.name}*\n${result.items.map((i) => `${i.quantity}x ${i.name}${i.variation ? ` (${i.variation})` : ""}${i.extras.length ? ` + ${i.extras.map((e) => e.name).join(", ")}` : ""}${i.notes ? ` — ${i.notes}` : ""}`).join("\n")}\nTotal: R$ ${(result.total / 100).toFixed(2)}\nCliente: ${input.customerName}\nTelefone: ${input.phone}\n${input.fulfillment === "delivery" ? input.address : "Retirada no balcão"}\nPagamento: ${input.payment} (a confirmar)\n${input.notes}`;
    return {
      token,
      number: result.number,
      total: result.total,
      tracking: company.tracking,
      demo: company.demo,
      whatsappUrl:
        company.checkoutMode === "whatsapp"
          ? `https://wa.me/${company.whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent(text)}`
          : null,
    };
  }),
  track: base.input(z.object({ token: z.string().length(64) })).handler(async ({ input }) => {
    const [order] = await db.select().from(s.orders).where(eq(s.orders.token, input.token));
    if (!order) throw new ORPCError("NOT_FOUND");
    const [company] = await db
      .select()
      .from(s.companies)
      .where(eq(s.companies.id, order.companyId));
    if (!company.tracking)
      throw new ORPCError("FORBIDDEN", { message: "Acompanhamento desativado pela loja." });
    return {
      number: order.number,
      status: order.status,
      history: order.history,
      total: order.total,
      paymentStatus: order.paymentStatus,
      companyName: company.name,
      slug: company.slug,
      demo: company.demo,
    };
  }),
  updateStatus: merchant
    .input(
      z.object({
        id: z.string(),
        status: z.enum([
          "received",
          "confirmed",
          "preparing",
          "ready",
          "out",
          "completed",
          "cancelled",
        ]),
      }),
    )
    .handler(async ({ context, input }) => {
      await db.transaction(async (tx) => {
        const [order] = await tx
          .select()
          .from(s.orders)
          .where(and(eq(s.orders.id, input.id), eq(s.orders.companyId, context.company.id)));
        if (!order) throw new ORPCError("NOT_FOUND");
        const allowed: Record<string, string[]> = {
          received: ["confirmed", "cancelled"],
          confirmed: ["preparing", "cancelled"],
          preparing: [order.fulfillment === "delivery" ? "out" : "ready", "cancelled"],
          ready: ["completed", "cancelled"],
          out: ["completed", "cancelled"],
          completed: [],
          cancelled: [],
        };
        if (!allowed[order.status].includes(input.status))
          throw new ORPCError("BAD_REQUEST", { message: "Transição de status não permitida." });
        await tx
          .update(s.orders)
          .set({
            status: input.status,
            history: [...order.history, { status: input.status, at: new Date().toISOString() }],
          })
          .where(and(eq(s.orders.id, input.id), eq(s.orders.companyId, context.company.id)));
        if (input.status === "cancelled") {
          const items = await tx
            .select()
            .from(s.orderItems)
            .where(eq(s.orderItems.orderId, order.id));
          for (const i of items)
            await tx
              .update(s.products)
              .set({ stock: sql`${s.products.stock}+${i.quantity}` })
              .where(
                and(
                  eq(s.products.id, i.productId),
                  eq(s.products.companyId, context.company.id),
                  sql`${s.products.stock} is not null`,
                ),
              );
        }
      });
      return { ok: true };
    }),
};
export const orderRoutes = orders;
