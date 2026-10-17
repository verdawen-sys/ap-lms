export async function onRequest({ request, env, next }) {
  const url = new URL(request.url);
  // HANYA proteksi /admin - /api/* untuk siswa dibiarkan lewat
  if (!url.pathname.startsWith('/admin')) return next();
  const user = env.ADMIN_USER;
  const pass = env.ADMIN_PASS;
  if (!user || !pass) return new Response('Admin belum diset di Env', { status: 500 });
  const auth = request.headers.get('Authorization') || '';
  if (!auth.startsWith('Basic ')) {
    return new Response('Butuh Login', { status: 401, headers: { 'WWW-Authenticate': 'Basic realm="Admin"' } });
  }
  let decoded = '';
  try { decoded = atob(auth.slice(6)); } catch { return new Response('Auth tidak valid', { status: 401 }); }
  const idx = decoded.indexOf(':');
  const u = decoded.slice(0, idx);
  const p = decoded.slice(idx + 1);
  if (u !== user || p !== pass) {
    return new Response('Login salah', { status: 401, headers: { 'WWW-Authenticate': 'Basic realm="Admin"' } });
  }
  return next();
}