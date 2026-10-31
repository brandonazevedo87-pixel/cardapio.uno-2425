import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { bearer } from "better-auth/plugins";
import { APIError } from "better-auth/api";
import { db } from "./database";

export const auth = betterAuth({
  basePath: "/api/auth",
  baseURL: process.env.WEBSITE_URL,
  database: drizzleAdapter(db, { provider: "sqlite" }),
  secret: process.env.BETTER_AUTH_SECRET,
  emailAndPassword: { enabled: true, minPasswordLength: 12, maxPasswordLength: 128 },
  rateLimit: {
    enabled: true,
    window: 60,
    max: 30,
    customRules: {
      "/sign-in/email": { window: 60, max: 5 },
      "/sign-up/email": { window: 60, max: 3 },
    },
  },
  trustedOrigins: [
    ...(process.env.WEBSITE_URL ? [new URL(process.env.WEBSITE_URL).origin] : []),
    "https://4200-ixakj05smw5dvf6qlcm1z.e2b.app",
    "http://localhost:4200",
  ],
  session: { expiresIn: 60 * 60 * 24 * 7, updateAge: 60 * 60 * 12 },
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          if (user.email.toLowerCase() === "brandonazevedo87@gmail.com")
            throw new APIError("FORBIDDEN", { message: "E-mail reservado ao administrador." });
          return { data: { ...user, email: user.email.toLowerCase() } };
        },
      },
    },
  },
  plugins: [bearer()],
});
