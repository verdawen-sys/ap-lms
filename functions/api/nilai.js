export async function onRequest(context){
  const db = context.env.AP_LMS_DB;
  await db.prepare(`CREATE TABLE IF NOT EXISTS nilai (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT, nama TEXT, kelas TEXT, mapel TEXT, bab TEXT, paket_id INTEGER, paket_nama TEXT, jenis TEXT, skor INTEGER, benar INTEGER, total INTEGER, jawaban TEXT, waktu TEXT)`).run();

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
    const {username,nama,kelas,mapel,bab,paket_id,paket_nama,jenis,skor,benar,total,jawaban} = body;
    await db.prepare(`INSERT INTO nilai (username,nama,kelas,mapel,bab,paket_id,paket_nama,jenis,skor,benar,total,jawaban,waktu) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,datetime('now'))`).bind(username,nama,kelas,mapel,bab,paket_id,paket_nama,jenis,skor,benar,total,JSON.stringify(jawaban||[])).run();
    return new Response(JSON.stringify({ok:true}), {headers:{'Content-Type':'application/json'}});
  }
}
