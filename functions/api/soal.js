const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type,Authorization' };
const json = (d, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { 'Content-Type': 'application/json', ...CORS } });

export async function onRequest({ request, env }) {
  if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });
  try {
    const db = env.DB;
    if (!db) return json({ ok: false, msg: 'DB belum ter-bind' }, 500);
    
    // Buat tabel dengan kolom baru + lama biar kompatibel
    await db.prepare(`CREATE TABLE IF NOT EXISTS soal(
      id INTEGER PRIMARY KEY AUTOINCREMENT, 
      paket_id TEXT, tipe TEXT, pertanyaan TEXT, opsi TEXT, kunci TEXT, pembahasan TEXT, 
      gambar TEXT, 
      gambar_opsi TEXT, gambar_pembahasan TEXT,
      opsi_gambar TEXT, pembahasan_gambar TEXT
    )`).run();

    if (request.method === 'GET') {
      const url = new URL(request.url);
      const paket_id = url.searchParams.get('paket_id') || '';
      const r = await db.prepare(`SELECT * FROM soal WHERE paket_id=? ORDER BY id`).bind(paket_id).all();
      // Mapping biar siswa yang baca opsi_gambar / gambar_opsi dua-duanya bisa
      const results = (r.results||[]).map(row=>{
        return {
          ...row,
          // siswa sekarang baca opsi_gambar & pembahasan_gambar, tapi kita kasih alias
          opsi_gambar: row.opsi_gambar || row.gambar_opsi || '[]',
          pembahasan_gambar: row.pembahasan_gambar || row.gambar_pembahasan || '',
          gambar_opsi: row.gambar_opsi || row.opsi_gambar || '[]',
          gambar_pembahasan: row.gambar_pembahasan || row.pembahasan_gambar || ''
        };
      });
      return json(results);
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
        if (file.size > 2 * 1024 * 1024) throw new Error('Gambar max 2MB, kompres dulu di admin');
        if (!file.type.startsWith('image/')) return '';
        const buf = await file.arrayBuffer();
        let bin = '';
        const bytes = new Uint8Array(buf);
        for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
        return `data:${file.type};base64,${btoa(bin)}`;
      };

      const id = form.get('id') || '';
      const paket_id = form.get('paket_id') || '';
      const tipe = form.get('tipe') || 'pg_tunggal';
      const pertanyaan = form.get('pertanyaan') || '';
      const opsi = form.get('opsi') || '[]';
      const kunci = form.get('kunci') || '[]';
      const pembahasan = form.get('pembahasan') || '';
      
      // --- LOGIKA BARU: terima JSON kompres dari admin (gratis) ---
      let opsiGambarArr = [];
      let pembahasanGambarArr = [];

      // 1. Cek apakah admin kirim JSON (versi baru kompres)
      let opsiJson = form.get('opsi_gambar');
      if(opsiJson){
        try{ opsiGambarArr = JSON.parse(opsiJson); }catch{ opsiGambarArr = []; }
      }
      let pembahasanJson = form.get('pembahasan_gambar');
      if(pembahasanJson){
        try{ pembahasanGambarArr = JSON.parse(pembahasanJson); }catch{ pembahasanGambarArr = []; }
      }

      // 2. Fallback ke file lama (kalau masih pakai upload file)
      if(opsiGambarArr.length===0){
        for (let i = 0; i < 5; i++) {
          let f = form.get('gambar_opsi_' + i);
          if(f && f.size>0) opsiGambarArr.push(await toBase64(f));
          else opsiGambarArr.push("");
        }
      }
      if(pembahasanGambarArr.length===0){
        let f = form.get('gambar_pembahasan');
        if(f && f.size>0){
          pembahasanGambarArr = [await toBase64(f)];
        } else {
          // cek juga field gambar_pembahasan file lama
          let f2 = form.get('gambar_pembahasan');
          if(f2) pembahasanGambarArr = [];
        }
      }

      const gambar = await toBase64(form.get('gambar_file'));
      
      // Simpan sebagai JSON string
      const strOpsiGambar = JSON.stringify(opsiGambarArr);
      const strPembahasanGambar = JSON.stringify(pembahasanGambarArr);

      if (id) {
        const lama = await db.prepare(`SELECT gambar, gambar_opsi, gambar_pembahasan, opsi_gambar, pembahasan_gambar FROM soal WHERE id=?`).bind(id).first();
        let finalGambar = gambar || (lama?.gambar || '');
        let finalOpsiGambar = strOpsiGambar;
        // kalau admin tidak upload baru, pakai lama
        if(finalOpsiGambar==='[]' || finalOpsiGambar==='["","","","",""]'){
          finalOpsiGambar = lama?.gambar_opsi || lama?.opsi_gambar || '[]';
        }
        let finalPembahasanGambar = strPembahasanGambar;
        if(finalPembahasanGambar==='[]' || finalPembahasanGambar===''){
          finalPembahasanGambar = lama?.gambar_pembahasan || lama?.pembahasan_gambar || '[]';
        }

        await db.prepare(`UPDATE soal SET paket_id=?, tipe=?, pertanyaan=?, opsi=?, kunci=?, pembahasan=?, gambar=?, gambar_opsi=?, gambar_pembahasan=?, opsi_gambar=?, pembahasan_gambar=? WHERE id=?`)
          .bind(paket_id, tipe, pertanyaan, opsi, kunci, pembahasan, finalGambar, finalOpsiGambar, finalPembahasanGambar, finalOpsiGambar, finalPembahasanGambar, id).run();
      } else {
        await db.prepare(`INSERT INTO soal(paket_id,tipe,pertanyaan,opsi,kunci,pembahasan,gambar,gambar_opsi,gambar_pembahasan,opsi_gambar,pembahasan_gambar) VALUES(?,?,?,?,?,?,?,?,?,?,?)`)
          .bind(paket_id, tipe, pertanyaan, opsi, kunci, pembahasan, gambar, strOpsiGambar, strPembahasanGambar, strOpsiGambar, strPembahasanGambar).run();
      }
      return json({ ok: true, mode: 'BASE64 MULTI GRATIS' });
    }
    return json({ ok: false, msg: 'Method tidak didukung' }, 405);
  } catch (e) { return json({ ok: false, msg: e.message }, 500); }
}
