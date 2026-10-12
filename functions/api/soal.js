export async function onRequest(context){
  const db = context.env.AP_LMS_DB;
  const r2 = context.env.AP_LMS_R2; // bisa undefined kalau R2 dihapus

  try{
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
      if(ctype.includes('application/json')){
        let body = {};
        try{ body = await context.request.json(); }catch(e){}
        if(body.action === 'delete' && body.id){
          await db.prepare(`DELETE FROM soal WHERE id=?`).bind(body.id).run();
          return new Response(JSON.stringify({ok:true}), {headers:{'Content-Type':'application/json'}});
        }
        return new Response(JSON.stringify({ok:false, msg:'Action tidak dikenal'}), {headers:{'Content-Type':'application/json'}});
      }

      // Helper: simpan file. Kalau R2 ada -> R2, kalau tidak ada -> Base64 DataURL di DB
      async function simpanFile(file, key){
        if(!file || file.size===0) return null;
        if(r2){
          await r2.put(key, file.stream(), {httpMetadata:{contentType:file.type}});
          return key;
        } else {
          // FIX BUG 4: Fallback tanpa R2
          const buf = await file.arrayBuffer();
          let bin = '';
          const bytes = new Uint8Array(buf);
          for(let i=0;i<bytes.length;i++) bin += String.fromCharCode(bytes[i]);
          const b64 = btoa(bin);
          return `data:${file.type};base64,${b64}`;
        }
      }

      const form = await context.request.formData();
      const id = form.get('id');
      const paket_id = form.get('paket_id');
      const tipe = form.get('tipe');
      const pertanyaan = form.get('pertanyaan');
      const opsi = form.get('opsi');
      const kunci = form.get('kunci');
      const pembahasan = form.get('pembahasan');

      let old = null;
      if(id){
        const r = await db.prepare(`SELECT * FROM soal WHERE id=?`).bind(id).first();
        if(r) old = r;
      }

      let gambarPath = old? old.gambar || '' : '';
      const file = form.get('gambar_file');
      if(file && file.size>0){
        const ext = (file.name.split('.').pop()||'jpg').replace(/[^a-zA-Z0-9]/g,'');
        const key = `soal/${paket_id}/${Date.now()}.${ext}`;
        const saved = await simpanFile(file, key);
        if(saved) gambarPath = saved;
      }

      let opsiGambar = [null,null,null,null,null];
      try{ if(old && old.opsi_gambar) opsiGambar = JSON.parse(old.opsi_gambar); }catch(e){}
      for(let i=0;i<5;i++){
        let fg = form.get('gambar_opsi_'+i);
        if(fg && fg.size>0){
          let ext = (fg.name.split('.').pop()||'jpg').replace(/[^a-zA-Z0-9]/g,'');
          let key = `soal/${paket_id}/opsi_${i}_${Date.now()}.${ext}`;
          const saved = await simpanFile(fg, key);
          if(saved) opsiGambar[i] = saved;
        }
      }

      let pembahasanGambarPath = old? old.pembahasan_gambar || '' : '';
      let fb = form.get('gambar_pembahasan');
      if(fb && fb.size>0){
        let ext = (fb.name.split('.').pop()||'jpg').replace(/[^a-zA-Z0-9]/g,'');
        let key = `soal/${paket_id}/bhs_${Date.now()}.${ext}`;
        const saved = await simpanFile(fb, key);
        if(saved) pembahasanGambarPath = saved;
      }

      if(id){
        await db.prepare(`UPDATE soal SET paket_id=?, tipe=?, pertanyaan=?, opsi=?, kunci=?, pembahasan=?, gambar=?, opsi_gambar=?, pembahasan_gambar=? WHERE id=?`)
         .bind(paket_id, tipe, pertanyaan, opsi, kunci, pembahasan, gambarPath, JSON.stringify(opsiGambar), pembahasanGambarPath, id).run();
      } else {
        await db.prepare(`INSERT INTO soal (paket_id,tipe,pertanyaan,opsi,kunci,pembahasan,gambar,opsi_gambar,pembahasan_gambar,urutan) VALUES (?,?,?,?,?,?,?,?,?,?)`)
         .bind(paket_id,tipe,pertanyaan,opsi,kunci,pembahasan,gambarPath,JSON.stringify(opsiGambar),pembahasanGambarPath,0).run();
      }
      return new Response(JSON.stringify({ok:true, mode: r2? 'R2' : 'BASE64'}), {headers:{'Content-Type':'application/json'}});
    }
  }catch(e){
    // FIX: Selalu return JSON, jangan pernah HTML
    return new Response(JSON.stringify({ok:false, msg: e.message}), {status:500, headers:{'Content-Type':'application/json'}});
  }
}
