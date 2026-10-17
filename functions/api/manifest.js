const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type,Authorization' };
const json = (d, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { 'Content-Type': 'application/json', ...CORS } });
const defaultKelas = ["SD4","SD5","SD6","SMP7","SMP8","SMP9","SMA10","SMA11","SMA12","TKA","TARUNA"];

export async function onRequest({ request, env }) {
  if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });
  try {
    const db = env.DB;
    if (!db) return json({ ok: false, msg: 'DB belum ter-bind' }, 500);
    await db.prepare(`CREATE TABLE IF NOT EXISTS manifest(id INTEGER PRIMARY KEY AUTOINCREMENT, kelas TEXT, mapel TEXT, bab TEXT, UNIQUE(kelas,mapel,bab))`).run();
    if (request.method === 'GET') {
      const r = await db.prepare(`SELECT * FROM manifest ORDER BY kelas, mapel, bab`).all();
      const items = r.results || [];
      return json({ ok: true, kelas: defaultKelas, items });
    }
    if (request.method === 'POST') {
      const b = await request.json().catch(() => ({}));
      if (b.action === 'add') {
        await db.prepare(`INSERT OR IGNORE INTO manifest(kelas,mapel,bab) VALUES(?,?,?)`).bind(b.kelas, b.mapel, b.bab).run();
        return json({ ok: true });
      }
      if (b.action === 'delete') {
        await db.prepare(`DELETE FROM manifest WHERE id=?`).bind(b.id).run();
        return json({ ok: true });
      }
      return json({ ok: false, msg: 'Action tidak dikenal' }, 400);
    }
    return json({ ok: false, msg: 'Method tidak didukung' }, 405);
  } catch (e) { return json({ ok: false, msg: e.message }, 500); }
}