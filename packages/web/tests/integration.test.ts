import { test, expect } from "bun:test";
import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import { hashPassword } from "better-auth/crypto";
import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { eq, inArray } from "drizzle-orm";
import { db } from "../src/api/database";
import * as s from "../src/api/database/schema";
import type { AppRouterClient } from "../src/api";

const origin = Bun.env.QA_TEST_ORIGIN ?? "http://localhost:4200";
const rpc = (token = ""): AppRouterClient =>
  createORPCClient(
    new RPCLink({
      url: `${origin}/api/rpc`,
      headers: { Authorization: `Bearer ${token}` },
    }),
  );
async function authenticate(email: string, password: string, signup = false) {
  const response = await fetch(`${origin}/api/auth/${signup ? "sign-up" : "sign-in"}/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: origin },
    body: JSON.stringify({ email, password, name: "Teste automatizado" }),
  });
  expect(response.status).toBe(200);
  const token = response.headers.get("set-auth-token");
  expect(token).toBeTruthy();
  return { token: token!, client: rpc(token!) };
}

test("autenticação, isolamento, catálogo, pedidos, cobrança, recuperação e navegador", async () => {
  const suffix = crypto.randomUUID().slice(0, 8);
  const password = `Teste-${crypto.randomUUID()}!`;
  const emails = [
    `qa-a-${suffix}@example.com`,
    `qa-b-${suffix}@example.com`,
    `qa-admin-${suffix}@example.com`,
  ];
  const companyIds: string[] = [];
  const userIds: string[] = [];
  const uploadedKeys: string[] = [];
  const planId = `qa-${suffix}`;
  let adminToken = "";
  try {
    await expect(rpc().account.profile()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(rpc().catalog.overview()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    const offers = await rpc().account.offerings();
    expect(offers.plans.length).toBeGreaterThanOrEqual(3);
    const demo = await rpc().orders.menu({ slug: "burger-da-casa" });
    expect(demo.company.demo).toBe(true);
    expect(demo.products.length).toBeGreaterThan(0);

    const [reservedAdmin] = await db
      .select()
      .from(s.user)
      .where(eq(s.user.email, "brandonazevedo87@gmail.com"));
    const [reservedMembership] = await db
      .select()
      .from(s.memberships)
      .where(eq(s.memberships.userId, reservedAdmin.id));
    expect(reservedMembership.role).toBe("admin");
    // Never require the bootstrap password again after the owner changes it.
    if (reservedMembership.mustChange) {
      const actualAdmin = await authenticate(
        "brandonazevedo87@gmail.com",
        process.env.BRANDON_ADMIN_PASSWORD!,
      );
      const actualProfile = await actualAdmin.client.account.profile();
      expect(actualProfile.membership?.role).toBe("admin");
      if (actualProfile.membership?.mustChange) {
        await expect(actualAdmin.client.admin.overview()).rejects.toMatchObject({
          code: "FORBIDDEN",
        });
      }
      await fetch(`${origin}/api/auth/sign-out`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${actualAdmin.token}`,
          "Content-Type": "application/json",
          Origin: origin,
        },
        body: "{}",
      });
    }

    const a = await authenticate(emails[0], password, true);
    let b = await authenticate(emails[1], password, true);
    for (const auth of [a, b]) userIds.push((await auth.client.account.profile()).user.id);
    const aid = crypto.randomUUID();
    userIds.push(aid);
    await db
      .insert(s.user)
      .values({
        id: aid,
        email: emails[2],
        name: "QA proprietário",
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    await db
      .insert(s.account)
      .values({
        id: crypto.randomUUID(),
        userId: aid,
        accountId: aid,
        providerId: "credential",
        password: await hashPassword(password),
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    await db.insert(s.memberships).values({ userId: aid, role: "admin" });
    const admin = await authenticate(emails[2], password);
    adminToken = admin.token;
    await admin.client.admin.savePlan({
      id: planId,
      name: "QA limitado",
      price: 1000,
      productLimit: 1,
      categoryLimit: 3,
      userLimit: 1,
      trialDays: 7,
      premium: false,
      reports: false,
      customization: true,
      active: true,
    });
    for (const [i, auth] of [a, b].entries()) {
      const result = await auth.client.account.setup({
        name: `QA loja ${i}`,
        slug: `qa-${i}-${suffix}`,
        segment: "Personalizado",
        planId: i === 0 ? "premium" : planId,
        template: i === 1,
      });
      companyIds.push(result.companyId);
    }
    await expect(a.client.admin.overview()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      a.client.account.setup({
        name: "Duplicada",
        slug: `qa-dup-${suffix}`,
        segment: "Personalizado",
        planId: "premium",
        template: false,
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    const da = await a.client.catalog.overview(),
      dbb = await b.client.catalog.overview();
    expect(da.company.id).toBe(companyIds[0]);
    expect(dbb.company.id).toBe(companyIds[1]);
    expect(dbb.products.length).toBe(1);
    await b.client.catalog.deleteProduct({ id: dbb.products[0].id });
    await expect(
      b.client.catalog.saveCategory({ name: "Acima do limite", position: 3 }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      b.client.upload.presign({
        filename: "item.glb",
        contentType: "model/gltf-binary",
        size: 100,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    const photo = Bun.file(import.meta.dir + "/../public/images/burger.jpg");
    const presign = await a.client.upload.presign({
      filename: "qa.jpg",
      contentType: "image/jpeg",
      size: photo.size,
    });
    uploadedKeys.push(presign.key);
    const uploaded = await fetch(presign.url, {
      method: "PUT",
      body: photo,
      headers: { "Content-Type": "image/jpeg", "x-amz-acl": "public-read" },
    });
    expect(uploaded.ok).toBe(true);
    await expect(
      b.client.upload.complete({ key: presign.key, contentType: "image/jpeg" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    const completed = await a.client.upload.complete({
      key: presign.key,
      contentType: "image/jpeg",
    });
    expect((await fetch(completed.url)).ok).toBe(true);
    const product = {
      name: "Burger QA",
      description: "Teste",
      ingredients: "Pão",
      price: 2000,
      images: ["/images/burger.jpg"],
      modelUrl: "",
      available: true,
      stock: 3,
      demo: false,
      featured: true,
      variations: [{ name: "Duplo", price: 3000 }],
      extras: [{ name: "Queijo", price: 500 }],
    };
    const pa = await a.client.catalog.saveProduct({ ...product, categoryId: da.categories[0].id });
    const pb = await b.client.catalog.saveProduct({ ...product, categoryId: dbb.categories[0].id });
    await expect(
      b.client.catalog.saveProduct({ ...product, categoryId: dbb.categories[0].id }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      b.client.catalog.saveProduct({
        ...product,
        id: pb.id,
        modelUrl: "https://example.com/product.glb",
        categoryId: dbb.categories[0].id,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      b.client.catalog.saveProduct({ ...product, id: pa.id, categoryId: dbb.categories[0].id }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(b.client.catalog.deleteProduct({ id: pa.id })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(
      b.client.catalog.saveCategory({ id: da.categories[0].id, name: "Invasão", position: 1 }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      a.client.catalog.deleteCategory({ id: da.categories[0].id }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    const menu = await rpc().orders.menu({ slug: da.company.slug });
    const variationId = menu.variations.find((v) => v.productId === pa.id)!.id;
    const extraId = menu.extras.find((v) => v.productId === pa.id)!.id;
    const requestId = crypto.randomUUID();
    const checkout = {
      slug: da.company.slug,
      requestId,
      customerName: "Cliente QA",
      phone: "11900000001",
      address: "",
      fulfillment: "pickup" as const,
      payment: "Pix" as const,
      notes: "",
      items: [{ productId: pa.id, quantity: 2, variationId, extraIds: [extraId], notes: "" }],
    };
    await expect(
      rpc().orders.checkout({ ...checkout, items: [{ ...checkout.items[0], productId: pb.id }] }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    const receipt = await rpc().orders.checkout({
      ...checkout,
      total: 1,
      subtotal: 1,
    } as typeof checkout);
    expect(receipt.total).toBe(7000);
    expect((await a.client.catalog.overview()).products[0].stock).toBe(1);
    expect((await rpc().orders.track({ token: receipt.token })).status).toBe("received");
    await expect(rpc().orders.checkout(checkout)).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(
      rpc().orders.checkout({ ...checkout, requestId: crypto.randomUUID() }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(
      b.client.orders.updateStatus({ id: requestId, status: "confirmed" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      a.client.orders.updateStatus({ id: requestId, status: "completed" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await a.client.orders.updateStatus({ id: requestId, status: "confirmed" });
    await a.client.orders.updateStatus({ id: requestId, status: "cancelled" });
    expect((await a.client.catalog.overview()).products[0].stock).toBe(3);
    await expect(
      a.client.orders.updateStatus({ id: requestId, status: "cancelled" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect((await b.client.catalog.overview()).orders.length).toBe(0);
    await admin.client.admin.recordPayment({
      companyId: companyIds[0],
      amount: 14990,
      reference: "QA pagamento verificado",
      paidAt: new Date().toISOString().slice(0, 10),
    });
    expect((await a.client.catalog.overview()).payments[0].amount).toBe(14990);
    await admin.client.admin.updateCompany({
      id: companyIds[0],
      name: "QA loja 0",
      status: "suspended",
      publicWhenSuspended: true,
    });
    expect((await a.client.catalog.overview()).blocked).toBe(true);
    expect((await rpc().orders.menu({ slug: da.company.slug })).blocked).toBe(true);
    await expect(a.client.catalog.deleteProduct({ id: pa.id })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(
      rpc().orders.checkout({ ...checkout, requestId: crypto.randomUUID() }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await admin.client.admin.updateCompany({
      id: companyIds[0],
      name: "QA loja 0",
      status: "active",
      publicWhenSuspended: false,
    });
    await admin.client.admin.saveSubscription({
      companyId: companyIds[1],
      planId,
      price: 1000,
      dueDate: "2020-01-01",
      status: "active",
      note: "",
    });
    expect((await b.client.catalog.overview()).blocked).toBe(true);
    await admin.client.admin.saveSubscription({
      companyId: companyIds[1],
      planId,
      price: 1000,
      dueDate: "2099-12-31",
      status: "active",
      note: "",
    });
    await db
      .update(s.memberships)
      .set({ mustChange: true })
      .where(eq(s.memberships.userId, userIds[1]));
    await expect(b.client.catalog.overview()).rejects.toMatchObject({ code: "FORBIDDEN" });
    const changed = await b.client.account.changePassword({
      currentPassword: password,
      newPassword: `Troca-${crypto.randomUUID()}!`,
    });
    if (changed.token) b = { token: changed.token, client: rpc(changed.token) };
    expect((await b.client.account.profile()).membership?.mustChange).toBe(false);
    const reset = await admin.client.admin.resetLink({ companyId: companyIds[1] });
    const newPassword = `Nova-${crypto.randomUUID()}!`;
    await rpc().account.resetPassword({ token: reset.token, password: newPassword });
    await expect(
      rpc().account.resetPassword({ token: reset.token, password: newPassword }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(b.client.account.profile()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    const resetSession = await authenticate(emails[1], newPassword);
    expect((await resetSession.client.account.profile()).user.id).toBe(userIds[1]);

    // Browser checks use the temporary merchant; credentials never enter logs or artifacts.
    await db.update(s.memberships).set({ mustChange: true }).where(eq(s.memberships.userId, aid));
    const browserProcess = Bun.spawn(["python3", "tests/browser.py"], {
      cwd: import.meta.dir + "/../../..",
      env: {
        ...Bun.env,
        QA_EMAIL: emails[0],
        QA_PASSWORD: password,
        QA_SLUG: da.company.slug,
        QA_ADMIN_TOKEN: adminToken,
        QA_ADMIN_PASSWORD: password,
      },
      stdout: "inherit",
      stderr: "inherit",
    });
    expect(await browserProcess.exited).toBe(0);
    console.log(
      "Verificados: autorização, tenants, limites, preços, estoque, status, suspensão, expiração, pagamento manual, recuperação e UI.",
    );
  } finally {
    // Only remove fixtures belonging to this test run, never real business data.
    const storage = new S3Client({
      region: "auto",
      endpoint: Bun.env.S3_ENDPOINT,
      credentials: {
        accessKeyId: Bun.env.S3_ACCESS_KEY_ID!,
        secretAccessKey: Bun.env.S3_SECRET_ACCESS_KEY!,
      },
    });
    const users = await db.select().from(s.user).where(inArray(s.user.email, emails));
    const ids = users.map((u) => u.id);
    const companies = ids.length
      ? await db.select().from(s.companies).where(inArray(s.companies.ownerId, ids))
      : [];
    const cids = companies.map((c) => c.id);
    const storedFiles = cids.length
      ? await db.select().from(s.files).where(inArray(s.files.companyId, cids))
      : [];
    for (const key of new Set([...uploadedKeys, ...storedFiles.map((f) => f.key)]))
      await storage.send(new DeleteObjectCommand({ Bucket: Bun.env.S3_BUCKET, Key: key }));
    await db.transaction(async (tx) => {
      if (cids.length) {
        for (const table of [
          s.orderItems,
          s.orders,
          s.variations,
          s.extras,
          s.products,
          s.categories,
          s.files,
          s.payments,
          s.subscriptions,
        ])
          await tx.delete(table).where(inArray(table.companyId, cids));
      }
      if (ids.length) {
        await tx.delete(s.resets).where(inArray(s.resets.userId, ids));
        await tx.delete(s.memberships).where(inArray(s.memberships.userId, ids));
        await tx.delete(s.audit).where(inArray(s.audit.actorId, ids));
      }
      if (cids.length) await tx.delete(s.companies).where(inArray(s.companies.id, cids));
      if (ids.length) await tx.delete(s.user).where(inArray(s.user.id, ids));
      await tx.delete(s.plans).where(eq(s.plans.id, planId));
    });
  }
}, 180000);
