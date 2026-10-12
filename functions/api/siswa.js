export async function onRequest(context){
  const db = context.env.AP_LMS_DB;
  const {request} = context;
  await db.prepare(`CREATE TABLE IF NOT EXISTS siswa (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE, password TEXT, nama TEXT, wa TEXT, paket_aktif TEXT, last_login TEXT)`).run();
  await db.prepare(`CREATE TABLE IF NOT EXISTS paket (id INTEGER PRIMARY KEY AUTOINCREMENT, kelas TEXT, mapel TEXT, bab TEXT, jenis TEXT, nama TEXT, waktu INTEGER, pembahasan TEXT, kode_akses TEXT, motivasi TEXT, kkm INTEGER)`).run();
  // FIX: Pastikan tabel manifest ada sebelum dipakai di add_paket
  await db.prepare(`CREATE TABLE IF NOT EXISTS manifest (id INTEGER PRIMARY KEY AUTOINCREMENT, kelas TEXT, mapel TEXT, bab TEXT, UNIQUE(kelas, mapel, bab))`).run();

  if(request.method==='GET'){
    const url = new URL(request.url);
    const action = url.searchParams.get('action');
    if(action==='list'){
      const res = await db.prepare(`SELECT * FROM siswa ORDER BY id DESC`).all();
      return new Response(JSON.stringify(res.results), {headers:{'Content-Type':'application/json'}});
    }
    if(action==='paket_list'){
      const res = await db.prepare(`SELECT * FROM paket ORDER BY id DESC`).all();
      return new Response(JSON.stringify(res.results), {headers:{'Content-Type':'application/json'}});
    }
    return new Response('ok');
  }
  if(request.method==='POST'){
    const body = await request.json();
    const {action, username, password, nama, wa, paket_aktif, id} = body;
    if(action==='login'){
      const row = await db.prepare(`SELECT * FROM siswa WHERE username=? AND password=?`).bind(username,password).first();
      if(!row) return new Response(JSON.stringify({ok:false, msg:'Username/password salah'}), {status:401, headers:{'Content-Type':'application/json'}});
      // FIX: Simpan last_login sebagai ISO, bukan datetime('now') agar tidak Invalid Date di admin
      await db.prepare(`UPDATE siswa SET last_login=? WHERE id=?`).bind(new Date().toISOString(), row.id).run();
      return new Response(JSON.stringify({ok:true, siswa:row}), {headers:{'Content-Type':'application/json'}});
    }
    if(action==='add'){
      try{
        await db.prepare(`INSERT INTO siswa (username,password,nama,wa,paket_aktif) VALUES (?,?,?,?,?)`).bind(username,password,nama,wa,JSON.stringify(paket_aktif||[])).run();
        return new Response(JSON.stringify({ok:true}), {headers:{'Content-Type':'application/json'}});
      }catch(e){ return new Response(JSON.stringify({ok:false,msg:e.message}), {status:400, headers:{'Content-Type':'application/json'}}); }
    }
    if(action==='edit'){
      await db.prepare(`UPDATE siswa SET username=?, password=?, nama=?, wa=?, paket_aktif=? WHERE id=?`).bind(username,password,nama,wa,JSON.stringify(paket_aktif||[]), id).run();
      return new Response(JSON.stringify({ok:true}), {headers:{'Content-Type':'application/json'}});
    }
    if(action==='delete'){
      await db.prepare(`DELETE FROM siswa WHERE id=?`).bind(id).run();
      return new Response(JSON.stringify({ok:true}), {headers:{'Content-Type':'application/json'}});
    }
    if(action==='add_paket'){
      const {kelas,mapel,bab,jenis,nama,waktu,pembahasan,kode_akses,motivasi,kkm} = body;
      const res = await db.prepare(`INSERT INTO paket (kelas,mapel,bab,jenis,nama,waktu,pembahasan,kode_akses,motivasi,kkm) VALUES (?,?,?,?,?,?,?,?,?,?)`).bind(kelas,mapel,bab,jenis,nama,waktu||0,pembahasan||'langsung',kode_akses||'',motivasi||'',kkm||75).run();
      await db.prepare(`INSERT OR IGNORE INTO manifest (kelas,mapel,bab) VALUES (?,?,?)`).bind(kelas,mapel,bab).run();
      return new Response(JSON.stringify({ok:true, id:res.meta.last_row_id}), {headers:{'Content-Type':'application/json'}});
    }
    // FIX BUG 7: Tambah edit_paket yang selama ini tidak ada
    if(action==='edit_paket'){
      const {kelas,mapel,bab,jenis,nama,waktu,pembahasan,kode_akses,motivasi,kkm} = body;
      await db.prepare(`UPDATE paket SET kelas=?, mapel=?, bab=?, jenis=?, nama=?, waktu=?, pembahasan=?, kode_akses=?, motivasi=?, kkm=? WHERE id=?`)
        .bind(kelas,mapel,bab,jenis,nama,waktu||0,pembahasan||'langsung',kode_akses||'',motivasi||'',kkm||75, id).run();
      await db.prepare(`INSERT OR IGNORE INTO manifest (kelas,mapel,bab) VALUES (?,?,?)`).bind(kelas,mapel,bab).run();
      return new Response(JSON.stringify({ok:true}), {headers:{'Content-Type':'application/json'}});
    }
    if(action==='delete_paket'){
      await db.prepare(`DELETE FROM paket WHERE id=?`).bind(id).run();
      await db.prepare(`DELETE FROM soal WHERE paket_id=?`).bind(id).run();
      // FIX BUG 3a: Hapus juga nilai paket ini agar tidak jadi paket hantu di Rekap
      await db.prepare(`DELETE FROM nilai WHERE paket_id=?`).bind(id).run();
      // FIX BUG 3b: Bersihkan paket_id dari paket_aktif semua siswa
      try{
        const allSiswa = await db.prepare(`SELECT id, paket_aktif FROM siswa`).all();
        for(const s of (allSiswa.results||[])){
          try{
            let arr = JSON.parse(s.paket_aktif||'[]');
            if(!Array.isArray(arr)) continue;
            let baru = arr.filter(x => String(x) !== String(id));
            if(baru.length !== arr.length){
              await db.prepare(`UPDATE siswa SET paket_aktif=? WHERE id=?`).bind(JSON.stringify(baru), s.id).run();
            }
          }catch(e){}
        }
      }catch(e){}
      return new Response(JSON.stringify({ok:true}), {headers:{'Content-Type':'application/json'}});
    }
  }
}
