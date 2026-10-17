const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type,Authorization' };
const json = (d, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { 'Content-Type': 'application/json', ...CORS } });

export async function onRequest(context) {
  if (context.request.method === 'OPTIONS') return new Response(null, { headers: CORS });
  try {
    const db = context.env.DB;
    if (!db) return json({ ok: false, msg: 'DB belum ter-bind' }, 500);
    const { request } = context;
    await db.prepare(`CREATE TABLE IF NOT EXISTS siswa (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE, password TEXT, nama TEXT, wa TEXT, paket_aktif TEXT, last_login TEXT)`).run();
    await db.prepare(`CREATE TABLE IF NOT EXISTS paket (id INTEGER PRIMARY KEY AUTOINCREMENT, kelas TEXT, mapel TEXT, bab TEXT, jenis TEXT, nama TEXT, waktu INTEGER, pembahasan TEXT, kode_akses TEXT, motivasi TEXT, kkm INTEGER)`).run();
    await db.prepare(`CREATE TABLE IF NOT EXISTS manifest (id INTEGER PRIMARY KEY AUTOINCREMENT, kelas TEXT, mapel TEXT, bab TEXT, UNIQUE(kelas, mapel, bab))`).run();

    if (request.method === 'GET') {
      const url = new URL(request.url);
      const action = url.searchParams.get('action');
      if (action === 'list') {
        const res = await db.prepare(`SELECT * FROM siswa ORDER BY id DESC`).all();
        return json(res.results || []);
      }
      if (action === 'paket_list') {
        const res = await db.prepare(`SELECT * FROM paket ORDER BY id DESC`).all();
        return json(res.results || []);
      }
      return json({ ok: true, msg: 'siswa api aktif' });
    }

    if (request.method === 'POST') {
      const body = await request.json().catch(() => ({}));
      const { action, username, password, nama, wa, paket_aktif, id } = body;

      if (action === 'login') {
        const row = await db.prepare(`SELECT * FROM siswa WHERE username=? AND password=?`).bind(username, password).first();
        if (!row) return json({ ok: false, msg: 'Username/password salah' }, 401);
        await db.prepare(`UPDATE siswa SET last_login=? WHERE id=?`).bind(new Date().toISOString(), row.id).run();
        return json({ ok: true, siswa: row });
      }
      if (action === 'add') {
        try {
          await db.prepare(`INSERT INTO siswa (username,password,nama,wa,paket_aktif) VALUES (?,?,?,?,?)`).bind(username, password, nama, wa, JSON.stringify(paket_aktif || [])).run();
          return json({ ok: true });
        } catch (e) { return json({ ok: false, msg: e.message }, 400); }
      }
      if (action === 'edit') {
        await db.prepare(`UPDATE siswa SET username=?, password=?, nama=?, wa=?, paket_aktif=? WHERE id=?`).bind(username, password, nama, wa, JSON.stringify(paket_aktif || []), id).run();
        return json({ ok: true });
      }
      if (action === 'delete') {
        await db.prepare(`DELETE FROM siswa WHERE id=?`).bind(id).run();
        return json({ ok: true });
      }
      if (action === 'add_paket') {
        const { kelas, mapel, bab, jenis, nama: nm, waktu, pembahasan, kode_akses, motivasi, kkm } = body;
        const res = await db.prepare(`INSERT INTO paket (kelas,mapel,bab,jenis,nama,waktu,pembahasan,kode_akses,motivasi,kkm) VALUES (?,?,?,?,?,?,?,?,?,?)`).bind(kelas, mapel, bab, jenis, nm, waktu || 0, pembahasan || 'langsung', kode_akses || '', motivasi || '', kkm || 75).run();
        await db.prepare(`INSERT OR IGNORE INTO manifest (kelas,mapel,bab) VALUES (?,?,?)`).bind(kelas, mapel, bab).run();
        return json({ ok: true, id: res.meta.last_row_id });
      }
      if (action === 'edit_paket') {
        const { kelas, mapel, bab, jenis, nama: nm, waktu, pembahasan, kode_akses, motivasi, kkm } = body;
        await db.prepare(`UPDATE paket SET kelas=?, mapel=?, bab=?, jenis=?, nama=?, waktu=?, pembahasan=?, kode_akses=?, motivasi=?, kkm=? WHERE id=?`).bind(kelas, mapel, bab, jenis, nm, waktu || 0, pembahasan || 'langsung', kode_akses || '', motivasi || '', kkm || 75, id).run();
        await db.prepare(`INSERT OR IGNORE INTO manifest (kelas,mapel,bab) VALUES (?,?,?)`).bind(kelas, mapel, bab).run();
        return json({ ok: true });
      }
      if (action === 'delete_paket') {
        await db.prepare(`DELETE FROM paket WHERE id=?`).bind(id).run();
        try { await db.prepare(`DELETE FROM soal WHERE paket_id=?`).bind(id).run(); } catch (e) {}
        try { await db.prepare(`DELETE FROM nilai WHERE paket_id=?`).bind(id).run(); } catch (e) {}
        try {
          const allSiswa = await db.prepare(`SELECT id, paket_aktif FROM siswa`).all();
          for (const s of (allSiswa.results || [])) {
            try {
              let arr = JSON.parse(s.paket_aktif || '[]');
              if (!Array.isArray(arr)) continue;
              let baru = arr.filter(x => String(x) !== String(id));
              if (baru.length !== arr.length) {
                await db.prepare(`UPDATE siswa SET paket_aktif=? WHERE id=?`).bind(JSON.stringify(baru), s.id).run();
              }
            } catch (e) {}
          }
        } catch (e) {}
        return json({ ok: true });
      }
      return json({ ok: false, msg: 'Action tidak dikenal' }, 400);
    }
    return json({ ok: false, msg: 'Method tidak didukung' }, 405);
  } catch (e) {
    return json({ ok: false, msg: e.message }, 500);
  }
}