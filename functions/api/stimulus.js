const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type,Authorization' };
const json = (d, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { 'Content-Type': 'application/json', ...CORS } });

export async function onRequest({ request, env }) {
  if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });
  try {
    const db = env.DB;
    if (!db) return json({ ok: false, msg: 'DB belum ter-bind' }, 500);
    await db.prepare(`CREATE TABLE IF NOT EXISTS stimulus(id INTEGER PRIMARY KEY AUTOINCREMENT, paket_id TEXT, soal_dari INTEGER, soal_sampai INTEGER, jenis TEXT, teks TEXT, file_url TEXT, audio_url TEXT, video_url TEXT)`).run();
    if (request.method === 'GET') {
      const pid = new URL(request.url).searchParams.get('paket_id') || '';
      const r = await db.prepare(`SELECT * FROM stimulus WHERE paket_id=? ORDER BY soal_dari ASC`).bind(pid).all();
      return json({ ok: true, data: r.results || [] });
    }
    if (request.method === 'DELETE') {
      const id = new URL(request.url).searchParams.get('id');
      await db.prepare(`DELETE FROM stimulus WHERE id=?`).bind(id).run();
      return json({ ok: true });
    }
    if (request.method === 'POST') {
      const b = await request.json().catch(() => ({}));
      const jenis = b.jenis || 'teks';
      if (!['gambar', 'audio', 'video', 'teks'].includes(jenis)) return json({ ok: false, msg: 'Jenis tidak valid' }, 400);
      if (!b.paket_id) return json({ ok: false, msg: 'paket_id wajib' }, 400);
      const dari = Number(b.soal_dari);
      const sampai = Number(b.soal_sampai);
      if (!dari || !sampai || sampai < dari) return json({ ok: false, msg: 'Range soal tidak valid' }, 400);
      if (jenis === 'gambar' && (b.file_url || '').length > 1400000) return json({ ok: false, msg: 'Gambar stimulus max ~1MB' }, 400);
      const cek = await db.prepare(`SELECT COUNT(*) as c FROM stimulus WHERE paket_id=? AND NOT (soal_sampai < ? OR soal_dari > ?)`).bind(b.paket_id, dari, sampai).first();
      if (cek && cek.c > 0) return json({ ok: false, msg: 'Range tumpang tindih dengan stimulus lain' }, 400);
      // teks disimpan mentah, tanpa strip harakat
      await db.prepare(`INSERT INTO stimulus(paket_id,soal_dari,soal_sampai,jenis,teks,file_url,audio_url,video_url) VALUES(?,?,?,?,?,?,?,?)`)
        .bind(b.paket_id, dari, sampai, jenis, b.teks || '', b.file_url || '', b.audio_url || '', b.video_url || '').run();
      return json({ ok: true });
    }
    return json({ ok: false, msg: 'Method tidak didukung' }, 405);
  } catch (e) { return json({ ok: false, msg: e.message }, 500); }
}