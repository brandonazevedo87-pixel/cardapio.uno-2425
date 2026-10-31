import { z } from "zod";
import { eq, and, desc } from "drizzle-orm";
import { ORPCError } from "@orpc/server";
import { hashPassword } from "better-auth/crypto";
import { admin as adminAccess, logAction } from "../middleware/access";
import { db } from "../database";
import * as s from "../database/schema";
import { companySetup, createStore } from "./account";
const planInput = z.object({
  id: z.string(),
  name: z.string().min(2).max(50),
  price: z.number().int().min(0).max(10000000),
  productLimit: z.number().int().min(1).max(10000),
  categoryLimit: z.number().int().min(1).max(1000),
  userLimit: z.literal(1),
  trialDays: z.number().int().min(0).max(365),
  premium: z.boolean(),
  reports: z.boolean(),
  customization: z.boolean(),
  active: z.boolean(),
});
export const admin = {
  overview: adminAccess.handler(async () => {
    const [companies, subscriptions, plans, orders, users, audit, payments, settings] =
      await Promise.all([
        db.select().from(s.companies),
        db.select().from(s.subscriptions),
        db.select().from(s.plans),
        db
          .select({
            id: s.orders.id,
            companyId: s.orders.companyId,
            total: s.orders.total,
            status: s.orders.status,
            createdAt: s.orders.createdAt,
          })
          .from(s.orders),
        db.select({ id: s.user.id, name: s.user.name, email: s.user.email }).from(s.user),
        db.select().from(s.audit).orderBy(desc(s.audit.createdAt)).limit(100),
        db.select().from(s.payments).orderBy(desc(s.payments.paidAt)).limit(100),
        db.select().from(s.settings),
      ]);
    return { companies, subscriptions, plans, orders, users, audit, payments, settings };
  }),
  createCompany: adminAccess
    .input(
      companySetup.extend({
        email: z.email(),
        ownerName: z.string().min(2).max(100),
        password: z.string().min(12).max(128),
      }),
    )
    .handler(async ({ context, input }) => {
      if (
        (await db.select().from(s.user).where(eq(s.user.email, input.email.toLowerCase()))).length
      )
        throw new ORPCError("CONFLICT", {
          message: "E-mail já cadastrado. Use uma nova conta de empresário.",
        });
      const uid = crypto.randomUUID(),
        hash = await hashPassword(input.password);
      await db.transaction(async (tx) => {
        await tx.insert(s.user).values({
          id: uid,
          email: input.email.toLowerCase(),
          name: input.ownerName,
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
      });
      try {
        const result = await createStore(uid, input);
        await db
          .update(s.memberships)
          .set({ mustChange: true })
          .where(eq(s.memberships.userId, uid));
        await logAction(context.user.id, "Empresa criada", result.companyId, input.name);
        return result;
      } catch (e) {
        await db.delete(s.user).where(eq(s.user.id, uid));
        throw e;
      }
    }),
  updateCompany: adminAccess
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(2).max(100),
        status: z.enum(["active", "suspended", "cancelled"]),
        publicWhenSuspended: z.boolean(),
      }),
    )
    .handler(async ({ context, input }) => {
      const { id, ...data } = input;
      const result = await db
        .update(s.companies)
        .set(data)
        .where(and(eq(s.companies.id, id), eq(s.companies.demo, false)))
        .returning();
      if (!result.length)
        throw new ORPCError("NOT_FOUND", {
          message: "Empresa não encontrada ou demonstração protegida.",
        });
      await logAction(context.user.id, "Empresa atualizada", id, `${data.name} • ${data.status}`);
      return { ok: true };
    }),
  savePlan: adminAccess.input(planInput).handler(async ({ context, input }) => {
    await db.insert(s.plans).values(input).onConflictDoUpdate({ target: s.plans.id, set: input });
    await logAction(context.user.id, "Plano atualizado", input.id, input.name);
    return { ok: true };
  }),
  saveSubscription: adminAccess
    .input(
      z.object({
        companyId: z.string(),
        planId: z.string(),
        price: z.number().int().min(0).max(10000000),
        dueDate: z.iso.date(),
        status: z.enum(["trial", "active", "suspended", "cancelled"]),
        note: z.string().max(2000),
      }),
    )
    .handler(async ({ context, input }) => {
      if (!(await db.select().from(s.plans).where(eq(s.plans.id, input.planId))).length)
        throw new ORPCError("BAD_REQUEST");
      await db
        .update(s.subscriptions)
        .set(input)
        .where(eq(s.subscriptions.companyId, input.companyId));
      await logAction(
        context.user.id,
        "Assinatura atualizada",
        input.companyId,
        `${input.status} • ${input.dueDate}`,
      );
      return { ok: true };
    }),
  recordPayment: adminAccess
    .input(
      z.object({
        companyId: z.string(),
        amount: z.number().int().positive().max(10000000),
        reference: z.string().min(3).max(200),
        paidAt: z.iso.date(),
      }),
    )
    .handler(async ({ context, input }) => {
      await db.insert(s.payments).values({ id: crypto.randomUUID(), ...input });
      await logAction(
        context.user.id,
        "Pagamento manual registrado",
        input.companyId,
        input.reference,
      );
      return { ok: true };
    }),
  resetLink: adminAccess
    .input(z.object({ companyId: z.string() }))
    .handler(async ({ context, input }) => {
      const [company] = await db
        .select()
        .from(s.companies)
        .where(eq(s.companies.id, input.companyId));
      if (!company?.ownerId) throw new ORPCError("NOT_FOUND");
      const token = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("hex");
      const key = Buffer.from(
        await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token)),
      ).toString("hex");
      await db.delete(s.resets).where(eq(s.resets.userId, company.ownerId));
      await db.insert(s.resets).values({
        id: key,
        userId: company.ownerId,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      });
      await logAction(context.user.id, "Link de recuperação emitido", company.id);
      return { token, expiresInMinutes: 30 };
    }),
  settings: adminAccess
    .input(
      z.object({ billingContact: z.string().max(200), billingInstructions: z.string().max(2000) }),
    )
    .handler(async ({ context, input }) => {
      for (const [key, value] of Object.entries(input))
        await db
          .insert(s.settings)
          .values({ key, value })
          .onConflictDoUpdate({ target: s.settings.key, set: { value } });
      await logAction(context.user.id, "Configurações atualizadas", "platform");
      return { ok: true };
    }),
};
export const adminRoutes = admin;
