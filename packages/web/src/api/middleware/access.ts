import { ORPCError } from "@orpc/server";
import { eq } from "drizzle-orm";
import { base } from "../__core/app";
import { auth } from "../auth";
import { db } from "../database";
import * as s from "../database/schema";
export const authed = base.use(async ({ context, next }) => {
  const session = await auth.api.getSession({ headers: context.headers });
  if (!session) throw new ORPCError("UNAUTHORIZED", { message: "Entre para continuar." });
  const [membership] = await db
    .select()
    .from(s.memberships)
    .where(eq(s.memberships.userId, session.user.id));
  return next({ context: { user: session.user, membership: membership ?? null } });
});
export const ready = authed.use(({ context, next }) => {
  if (context.membership?.mustChange)
    throw new ORPCError("FORBIDDEN", { message: "Troque a senha provisória para continuar." });
  return next();
});
export const admin = ready.use(({ context, next }) => {
  if (context.membership?.role !== "admin")
    throw new ORPCError("FORBIDDEN", {
      message: "Acesso exclusivo do proprietário da plataforma.",
    });
  return next();
});
export const merchantRead = ready.use(async ({ context, next }) => {
  if (!context.membership?.companyId || context.membership.role !== "merchant")
    throw new ORPCError("FORBIDDEN", { message: "Configure seu estabelecimento." });
  const [company] = await db
    .select()
    .from(s.companies)
    .where(eq(s.companies.id, context.membership.companyId));
  const [subscription] = await db
    .select()
    .from(s.subscriptions)
    .where(eq(s.subscriptions.companyId, context.membership.companyId));
  if (!company || !subscription) throw new ORPCError("NOT_FOUND");
  const [plan] = await db.select().from(s.plans).where(eq(s.plans.id, subscription.planId));
  const blocked =
    company.status !== "active" ||
    ["suspended", "cancelled"].includes(subscription.status) ||
    subscription.dueDate < new Date().toISOString().slice(0, 10);
  return next({ context: { company, subscription, plan, blocked } });
});
export const merchant = merchantRead.use(({ context, next }) => {
  if (context.blocked)
    throw new ORPCError("FORBIDDEN", {
      message: "Sua assinatura está suspensa ou vencida. Regularize na página de assinatura.",
    });
  return next();
});
export async function logAction(actorId: string, action: string, targetId: string, details = "") {
  await db
    .insert(s.audit)
    .values({
      id: crypto.randomUUID(),
      actorId,
      action,
      targetId,
      details,
      createdAt: new Date().toISOString(),
    });
}
