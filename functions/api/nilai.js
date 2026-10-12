export async function onRequest(context){
  const db = context.env.AP_LMS_DB;
  await db.prepare(`CREATE TABLE IF NOT EXISTS nilai (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT, nama TEXT, kelas TEXT, mapel TEXT, bab TEXT, paket_id INTEGER, paket_nama TEXT, jenis TEXT, skor INTEGER, benar INTEGER, total INTEGER, jawaban TEXT, waktu TEXT)`).run();
  // Migrasi kolom baru (aman kalau sudah ada, di-ignore)
  try{ await db.prepare(`ALTER TABLE nilai ADD COLUMN wa TEXT`).run(); }catch(e){}
  try{ await db.prepare(`ALTER TABLE nilai ADD COLUMN started_at TEXT`).run(); }catch(e){}
  try{ await db.prepare(`ALTER TABLE nilai ADD COLUMN finished_at TEXT`).run(); }catch(e){}
  try{ await db.prepare(`ALTER TABLE nilai ADD COLUMN durasi_detik INTEGER`).run(); }catch(e){}

  if(context.request.method==='GET'){
    const url = new URL(context.request.url);
    const paket_id = url.searchParams.get('paket_id');
    if(paket_id){
      const res = await db.prepare(`SELECT * FROM nilai WHERE paket_id=? ORDER BY skor DESC, id DESC LIMIT 50`).bind(paket_id).all();
      return new Response(JSON.stringify(res.results), {headers:{'Content-Type':'application/json'}});
    }
    const all = await db.prepare(`SELECT * FROM nilai ORDER BY id DESC LIMIT 100`).all();
    return new Response(JSON.stringify(all.results), {headers:{'Content-Type':'application/json'}});
  }

  if(context.request.method==='POST'){
    const body = await context.request.json();

    // FIX: Hapus nilai (dari admin Tab 5)
    if(body.action === 'delete' && body.id){
      await db.prepare(`DELETE FROM nilai WHERE id=?`).bind(body.id).run();
      return new Response(JSON.stringify({ok:true}), {headers:{'Content-Type':'application/json'}});
    }

    const {username,nama,kelas,mapel,bab,paket_id,paket_nama,jenis,skor,benar,total,jawaban,wa,started_at,finished_at} = body;

    // FIX BUG 5: Simpan waktu sebagai ISO String (2026-10-12T07:30:00.000Z)
    // Ini format yang pasti bisa dibaca new Date() di semua browser / HP.
    // Di admin.html, tampilkan dengan toLocaleString('id-ID', {timeZone:'Asia/Jakarta'})
    const nowISO = new Date().toISOString();
    const finishISO = finished_at || nowISO;
    const startISO = started_at || null;

    let durasi = null;
    if(startISO){
      try{ durasi = Math.round((new Date(finishISO) - new Date(startISO)) / 1000); }catch(e){}
    }

    await db.prepare(`INSERT INTO nilai (username,nama,kelas,mapel,bab,paket_id,paket_nama,jenis,skor,benar,total,jawaban,waktu,wa,started_at,finished_at,durasi_detik) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .bind(username,nama,kelas,mapel,bab,paket_id,paket_nama,jenis,skor,benar,total,JSON.stringify(jawaban||[]), nowISO, wa||'', startISO, finishISO, durasi).run();
    return new Response(JSON.stringify({ok:true}), {headers:{'Content-Type':'application/json'}});
  }
}
