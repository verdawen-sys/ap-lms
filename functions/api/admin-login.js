// functions/api/admin-login.js
export async function onRequest(context) {
  if (context.request.method !== 'POST') {
    return Response.json({ ok: false, msg: 'Method tidak didukung' }, { status: 405 });
  }
  try {
    const body = await context.request.json();
    const USER = context.env.ADMIN_USER || "admin";
    const PASS = context.env.ADMIN_PASS || "BimbelAP2026!";
    if (body.username === USER && body.password === PASS) {
      return Response.json({ ok: true, token: "admin" });
    }
    return Response.json({ ok: false, msg: 'Username/password admin salah' }, { status: 401 });
  } catch (e) {
    return Response.json({ ok: false, msg: e.message }, { status: 500 });
  }
}
