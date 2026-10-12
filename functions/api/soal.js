export async function onRequest(context){
  const db = context.env.AP_LMS_DB;
  const r2 = context.env.AP_LMS_R2;

  await db.prepare(`CREATE TABLE IF NOT EXISTS soal (id INTEGER PRIMARY KEY AUTOINCREMENT, paket_id INTEGER, tipe TEXT, pertanyaan TEXT, opsi TEXT, kunci TEXT, pembahasan TEXT, gambar TEXT, urutan INTEGER)`).run();
  try{ await db.prepare(`ALTER TABLE soal ADD COLUMN opsi_gambar TEXT`).run(); }catch(e){}
  try{ await db.prepare(`ALTER TABLE soal ADD COLUMN pembahasan_gambar TEXT`).run(); }catch(e){}

  if(context.request.method==='GET'){
    const url = new URL(context.request.url);
    const paket_id = url.searchParams.get('paket_id');
    if(!paket_id) return new Response(JSON.stringify([]), {headers:{'Content-Type':'application/json'}});
    const res = await db.prepare(`SELECT * FROM soal WHERE paket_id=? ORDER BY id`).bind(paket_id).all();
    return new Response(JSON.stringify(res.results), {headers:{'Content-Type':'application/json'}});
  }

  if(context.request.method==='POST'){
    const ctype = context.request.headers.get('content-type') || '';

    // FIX BUG 6: Handle DELETE via JSON (dari tombol Hapus di admin.html)
    if(ctype.includes('application/json')){
      let body = {};
      try{ body = await context.request.json(); }catch(e){}
      if(body.action === 'delete' && body.id){
        await db.prepare(`DELETE FROM soal WHERE id=?`).bind(body.id).run();
        return new Response(JSON.stringify({ok:true}), {headers:{'Content-Type':'application/json'}});
      }
      return new Response(JSON.stringify({ok:false, msg:'Action tidak dikenal'}), {headers:{'Content-Type':'application/json'}});
    }

    // FormData = Tambah / Edit Soal
    const form = await context.request.formData();
    const id = form.get('id'); // FIX BUG 6: kalau ada id = UPDATE, kalau tidak ada = INSERT
    const paket_id = form.get('paket_id');
    const tipe = form.get('tipe');
    const pertanyaan = form.get('pertanyaan');
    const opsi = form.get('opsi');
    const kunci = form.get('kunci');
    const pembahasan = form.get('pembahasan');

    // Ambil data lama kalau mode EDIT, agar gambar lama tidak hilang
    let old = null;
    if(id){
      const r = await db.prepare(`SELECT * FROM soal WHERE id=?`).bind(id).first();
      if(r) old = r;
    }

    let gambarPath = old ? old.gambar || '' : '';
    const file = form.get('gambar_file');
    if(file && file.size>0){
      const ext = file.name.split('.').pop();
      const key = `soal/${paket_id}/${Date.now()}.${ext}`;
      await r2.put(key, file.stream(), {httpMetadata:{contentType:file.type}});
      gambarPath = key;
    }

    // Gambar Opsi A-E
    let opsiGambar = [null,null,null,null,null];
    try{ if(old && old.opsi_gambar) opsiGambar = JSON.parse(old.opsi_gambar); }catch(e){}
    for(let i=0;i<5;i++){
      let fg = form.get('gambar_opsi_'+i);
      if(fg && fg.size>0){
        let ext = fg.name.split('.').pop();
        let key = `soal/${paket_id}/opsi_${i}_${Date.now()}.${ext}`;
        await r2.put(key, fg.stream(), {httpMetadata:{contentType:fg.type}});
        opsiGambar[i] = key;
      }
    }

    // Gambar Pembahasan
    let pembahasanGambarPath = old ? old.pembahasan_gambar || '' : '';
    let fb = form.get('gambar_pembahasan');
    if(fb && fb.size>0){
      let ext = fb.name.split('.').pop();
      let key = `soal/${paket_id}/bhs_${Date.now()}.${ext}`;
      await r2.put(key, fb.stream(), {httpMetadata:{contentType:fb.type}});
      pembahasanGambarPath = key;
    }

    if(id){
      // UPDATE - tidak duplikat
      await db.prepare(`UPDATE soal SET paket_id=?, tipe=?, pertanyaan=?, opsi=?, kunci=?, pembahasan=?, gambar=?, opsi_gambar=?, pembahasan_gambar=? WHERE id=?`)
        .bind(paket_id, tipe, pertanyaan, opsi, kunci, pembahasan, gambarPath, JSON.stringify(opsiGambar), pembahasanGambarPath, id).run();
    } else {
      // INSERT - soal baru
      await db.prepare(`INSERT INTO soal (paket_id,tipe,pertanyaan,opsi,kunci,pembahasan,gambar,opsi_gambar,pembahasan_gambar,urutan) VALUES (?,?,?,?,?,?,?,?,?,?)`)
        .bind(paket_id,tipe,pertanyaan,opsi,kunci,pembahasan,gambarPath,JSON.stringify(opsiGambar),pembahasanGambarPath,0).run();
    }

    return new Response(JSON.stringify({ok:true}), {headers:{'Content-Type':'application/json'}});
  }
}
