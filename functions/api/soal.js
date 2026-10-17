const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type,Authorization' };
const json = (d, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { 'Content-Type': 'application/json', ...CORS } });

export async function onRequest({ request, env }) {
  if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });
  try {
    const db = env.DB;
    if (!db) return json({ ok: false, msg: 'DB belum ter-bind' }, 500);
    await db.prepare(`CREATE TABLE IF NOT EXISTS soal(id INTEGER PRIMARY KEY AUTOINCREMENT, paket_id TEXT, tipe TEXT, pertanyaan TEXT, opsi TEXT, kunci TEXT, pembahasan TEXT, gambar TEXT, gambar_opsi TEXT, gambar_pembahasan TEXT)`).run();

    if (request.method === 'GET') {
      const url = new URL(request.url);
      const paket_id = url.searchParams.get('paket_id') || '';
      const r = await db.prepare(`SELECT * FROM soal WHERE paket_id=? ORDER BY id`).bind(paket_id).all();
      return json({ ok: true, data: r.results || [] });
    }

    if (request.method === 'POST') {
      const ct = request.headers.get('content-type') || '';
      if (ct.includes('application/json')) {
        const b = await request.json().catch(() => ({}));
        if (b.action === 'delete') {
          await db.prepare(`DELETE FROM soal WHERE id=?`).bind(b.id).run();
          return json({ ok: true });
        }
        return json({ ok: false, msg: 'Action tidak dikenal' }, 400);
      }
      const form = await request.formData();
      const toBase64 = async (file) => {
        if (!file || typeof file.arrayBuffer !== 'function' || file.size === 0) return '';
        if (file.size > 2 * 1024 * 1024) throw new Error('Gambar max 2MB');
        if (!file.type.startsWith('image/')) throw new Error('File harus gambar');
        const buf = await file.arrayBuffer();
        let bin = '';
        const bytes = new Uint8Array(buf);
        for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
        return `data:${file.type};base64,${btoa(bin)}`;
      };
      const id = form.get('id') || '';
      const paket_id = form.get('paket_id') || '';
      const tipe = form.get('tipe') || 'pg_tunggal';
      // PENTING: disimpan MENTAH, tanpa replace/strip agar LaTeX dan harakat aman
      const pertanyaan = form.get('pertanyaan') || '';
      const opsi = form.get('opsi') || '[]';
      const kunci = form.get('kunci') || '[]';
      const pembahasan = form.get('pembahasan') || '';
      const gambar = await toBase64(form.get('gambar_file'));
      const gambar_pembahasan = await toBase64(form.get('gambar_pembahasan'));
      const gambar_opsi = [];
      for (let i = 0; i < 5; i++) gambar_opsi.push(await toBase64(form.get('gambar_opsi_' + i)));
      if (id) {
        const lama = await db.prepare(`SELECT gambar, gambar_opsi, gambar_pembahasan FROM soal WHERE id=?`).bind(id).first();
        await db.prepare(`UPDATE soal SET paket_id=?, tipe=?, pertanyaan=?, opsi=?, kunci=?, pembahasan=?, gambar=?, gambar_opsi=?, gambar_pembahasan=? WHERE id=?`)
          .bind(paket_id, tipe, pertanyaan, opsi, kunci, pembahasan, gambar || (lama?.gambar || ''), JSON.stringify(gambar_opsi), gambar_pembahasan || (lama?.gambar_pembahasan || ''), id).run();
      } else {
        await db.prepare(`INSERT INTO soal(paket_id,tipe,pertanyaan,opsi,kunci,pembahasan,gambar,gambar_opsi,gambar_pembahasan) VALUES(?,?,?,?,?,?,?,?,?)`)
          .bind(paket_id, tipe, pertanyaan, opsi, kunci, pembahasan, gambar, JSON.stringify(gambar_opsi), gambar_pembahasan).run();
      }
      return json({ ok: true, mode: 'BASE64' });
    }
    return json({ ok: false, msg: 'Method tidak didukung' }, 405);
  } catch (e) { return json({ ok: false, msg: e.message }, 500); }
}