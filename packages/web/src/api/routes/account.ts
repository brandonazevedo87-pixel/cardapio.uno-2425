import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { ORPCError } from "@orpc/server";
import { hashPassword } from "better-auth/crypto";
import { base } from "../__core/app";
import { authed, ready } from "../middleware/access";
import { db } from "../database";
import * as s from "../database/schema";
import { auth } from "../auth";
import { seedCatalog, segments } from "../lib/bootstrap";
export const companySetup = z.object({
  name: z.string().min(2).max(100),
  slug: z
    .string()
    .min(3)
    .max(80)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  segment: z.enum(Object.keys(segments) as [string, ...string[]]),
  planId: z.string(),
  template: z.boolean().default(true),
});
export async function createStore(ownerId: string, input: z.infer<typeof companySetup>) {
  const [plan] = await db
    .select()
    .from(s.plans)
    .where(and(eq(s.plans.id, input.planId), eq(s.plans.active, true)));
  if (!plan) throw new ORPCError("BAD_REQUEST", { message: "Plano não disponível." });
  if ((await db.select().from(s.companies).where(eq(s.companies.slug, input.slug))).length)
    throw new ORPCError("CONFLICT", { message: "Este link já está em uso." });
  const companyId = crypto.randomUUID(),
    due = new Date();
  due.setUTCDate(due.getUTCDate() + plan.trialDays);
  await db.transaction(async (tx) => {
    await tx.insert(s.companies).values({
      id: companyId,
      ownerId,
      name: input.name,
      slug: input.slug,
      segment: input.segment,
      createdAt: new Date().toISOString(),
    });
    await tx.insert(s.memberships).values({ userId: ownerId, role: "merchant", companyId });
    await tx.insert(s.subscriptions).values({
      id: crypto.randomUUID(),
      companyId,
      planId: plan.id,
      price: plan.price,
      dueDate: due.toISOString().slice(0, 10),
      status: "trial",
    });
    await seedCatalog(tx, companyId, input.segment, input.template, plan);
  });
  return { companyId };
}
export const account = {
  profile: authed.handler(({ context }) => ({
    user: { id: context.user.id, name: context.user.name, email: context.user.email },
    membership: context.membership,
  })),
  setup: ready.input(companySetup).handler(async ({ context, input }) => {
    if (context.membership) throw new ORPCError("CONFLICT", { message: "Conta já configurada." });
    return createStore(context.user.id, input);
  }),
  changePassword: authed
    .input(z.object({ currentPassword: z.string(), newPassword: z.string().min(12).max(128) }))
    .handler(async ({ context, input }) => {
      if (input.currentPassword === input.newPassword)
        throw new ORPCError("BAD_REQUEST", {
          message: "Escolha uma senha diferente da provisória.",
        });
      const result = await auth.api.changePassword({
        headers: context.headers,
        body: { ...input, revokeOtherSessions: true },
      });
      await db
        .update(s.memberships)
        .set({ mustChange: false })
        .where(eq(s.memberships.userId, context.user.id));
      return { ok: true, token: result.token };
    }),
  resetPassword: base
    .input(z.object({ token: z.string().length(64), password: z.string().min(12).max(128) }))
    .handler(async ({ input }) => {
      const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input.token));
      const key = Buffer.from(digest).toString("hex");
      const [reset] = await db.select().from(s.resets).where(eq(s.resets.id, key));
      if (!reset || reset.expiresAt < new Date().toISOString())
        throw new ORPCError("BAD_REQUEST", { message: "Link inválido ou expirado." });
      const hash = await hashPassword(input.password);
      await db.transaction(async (tx) => {
        const deleted = await tx.delete(s.resets).where(eq(s.resets.id, key)).returning();
        if (!deleted.length)
          throw new ORPCError("BAD_REQUEST", { message: "Este link já foi utilizado." });
        await tx
          .update(s.account)
          .set({ password: hash, updatedAt: new Date() })
          .where(and(eq(s.account.userId, reset.userId), eq(s.account.providerId, "credential")));
        await tx.delete(s.session).where(eq(s.session.userId, reset.userId));
        await tx
          .update(s.memberships)
          .set({ mustChange: false })
          .where(eq(s.memberships.userId, reset.userId));
      });
      return { ok: true };
    }),
  offerings: base.handler(async () => ({
    plans: await db.select().from(s.plans).where(eq(s.plans.active, true)),
    segments: Object.keys(segments),
  })),
};
export const accountRoutes = account;
