export async function onRequest({ request, env, next }) {
  const USER = env.ADMIN_USER || "admin";
  const PASS = env.ADMIN_PASS || "BimbelAP2026!";

  const auth = request.headers.get("Authorization");
  if (!auth) {
    return new Response("Butuh Login", { status: 401, headers: { "WWW-Authenticate": 'Basic realm="Admin AP"' } });
  }
  const [u, p] = atob(auth.split(" ")[1]).split(":");
  if (u!== USER || p!== PASS) {
    return new Response("Salah", { status: 401, headers: { "WWW-Authenticate": 'Basic realm="Admin AP"' } });
  }
  return next();
}
