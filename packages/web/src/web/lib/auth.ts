import { createAuthClient } from "better-auth/react";
export const getToken = () => localStorage.getItem("cardapio-session") ?? "";
export const captureToken = (ctx: { response: Response }) => {
  const token = ctx.response.headers.get("set-auth-token");
  if (token) localStorage.setItem("cardapio-session", token);
};
export const authClient = createAuthClient({
  baseURL: window.location.origin,
  basePath: "/api/auth",
  fetchOptions: { auth: { type: "Bearer", token: getToken } },
});
export async function logout() {
  await authClient.signOut();
  localStorage.removeItem("cardapio-session");
  window.location.assign("/login");
}
