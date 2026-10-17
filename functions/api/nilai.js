const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type,Authorization' };
const json = (d, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { 'Content-Type': 'application/json', ...CORS } });

export async function onRequest({ request, env }) {
  if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });
  try {
    const db = env.DB;
    if (!db) return json({ ok: false, msg: 'DB belum ter-bind' }, 500);
    await db.prepare(`CREATE TABLE IF NOT EXISTS nilai(id INTEGER PRIMARY KEY AUTOINCREMENT, siswa_id TEXT, username TEXT, nama TEXT, paket_id TEXT, paket_nama TEXT, kelas TEXT, mapel TEXT, bab TEXT, jenis TEXT, nilai INTEGER, benar INTEGER, total INTEGER, tanggal TEXT, durasi INTEGER, jawaban TEXT, detail TEXT)`).run();
    if (request.method === 'GET') {
      const url = new URL(request.url);
      const paket_id = url.searchParams.get('paket_id');
      const username = url.searchParams.get('username');
      let q = `SELECT * FROM nilai`;
      const cond = [];
      const vals = [];
      if (paket_id) { cond.push('paket_id=?'); vals.push(paket_id); }
      if (username) { cond.push('username=?'); vals.push(username); }
      if (cond.length) q += ' WHERE ' + cond.join(' AND ');
      q += ' ORDER BY id DESC';
      const r = await db.prepare(q).bind(...vals).all();
      return json(r.results || []);
    }
    if (request.method === 'POST') {
      const b = await request.json().catch(() => ({}));
      if (b.action === 'delete') {
        await db.prepare(`DELETE FROM nilai WHERE id=?`).bind(b.id).run();
        return json({ ok: true });
      }
      const tanggal = b.tanggal || new Date().toISOString();
      await db.prepare(`INSERT INTO nilai(siswa_id,username,nama,paket_id,paket_nama,kelas,mapel,bab,jenis,nilai,benar,total,tanggal,durasi,jawaban,detail) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
        .bind(b.siswa_id || '', b.username || '', b.nama || '', b.paket_id || '', b.paket_nama || '', b.kelas || '', b.mapel || '', b.bab || '', b.jenis || '', b.nilai || 0, b.benar || 0, b.total || 0, tanggal, b.durasi || 0, JSON.stringify(b.jawaban || {}), JSON.stringify(b.detail || [])).run();
      return json({ ok: true });
    }
    return json({ ok: false, msg: 'Method tidak didukung' }, 405);
  } catch (e) { return json({ ok: false, msg: e.message }, 500); }
}