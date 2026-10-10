export async function onRequest(context){
  const db = context.env.AP_LMS_DB;
  const r2 = context.env.AP_LMS_R2;
  await db.prepare(`CREATE TABLE IF NOT EXISTS soal (id INTEGER PRIMARY KEY AUTOINCREMENT, paket_id INTEGER, tipe TEXT, pertanyaan TEXT, opsi TEXT, kunci TEXT, pembahasan TEXT, gambar TEXT, urutan INTEGER)`).run();
  
  if(context.request.method==='GET'){
    const url = new URL(context.request.url);
    const paket_id = url.searchParams.get('paket_id');
    if(!paket_id) return new Response(JSON.stringify([]), {headers:{'Content-Type':'application/json'}});
    const res = await db.prepare(`SELECT * FROM soal WHERE paket_id=? ORDER BY id`).bind(paket_id).all();
    return new Response(JSON.stringify(res.results), {headers:{'Content-Type':'application/json'}});
  }
  if(context.request.method==='POST'){
    const form = await context.request.formData();
    const paket_id = form.get('paket_id');
    const tipe = form.get('tipe');
    const pertanyaan = form.get('pertanyaan');
    const opsi = form.get('opsi');
    const kunci = form.get('kunci');
    const pembahasan = form.get('pembahasan');
    let gambarPath = '';
    const file = form.get('gambar_file');
    if(file && file.size>0){
      const ext = file.name.split('.').pop();
      const key = `soal/${paket_id}/${Date.now()}.${ext}`;
      await r2.put(key, file.stream(), {httpMetadata:{contentType:file.type}});
      gambarPath = key;
    }
    await db.prepare(`INSERT INTO soal (paket_id,tipe,pertanyaan,opsi,kunci,pembahasan,gambar,urutan) VALUES (?,?,?,?,?,?,?,?)`).bind(paket_id,tipe,pertanyaan,opsi,kunci,pembahasan,gambarPath,0).run();
    return new Response(JSON.stringify({ok:true}), {headers:{'Content-Type':'application/json'}});
  }
}
