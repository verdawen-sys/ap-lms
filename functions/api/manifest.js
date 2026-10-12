export async function onRequest(context){
  const db = context.env.AP_LMS_DB;
  const { request } = context;
  await db.prepare(`CREATE TABLE IF NOT EXISTS manifest (id INTEGER PRIMARY KEY, kelas TEXT, mapel TEXT, bab TEXT, UNIQUE(kelas,mapel,bab))`).run();

  const defaultKelas = ["SD4","SD5","SD6","SMP7","SMP8","SMP9","SMA10","SMA11","SMA12","TKA","TARUNA"];
  
  if(request.method==='GET'){
    const res = await db.prepare(`SELECT kelas,mapel,bab FROM manifest ORDER BY kelas,mapel,bab`).all();
    let data = res.results || [];
    // FIX 1: Selalu gabung defaultKelas + kelas yang ada di DB, agar dropdown Kelas tidak pernah hilang
    const kelasSet = [...new Set([...defaultKelas, ...data.map(d=>d.kelas)])];
    return new Response(JSON.stringify({kelas:kelasSet, items:data}), {headers:{'Content-Type':'application/json'}});
  }
  if(request.method==='POST'){
    const body = await request.json();
    const {kelas, mapel, bab, action} = body;
    if(!kelas || !mapel || !bab){
      return new Response(JSON.stringify({ok:false, msg:'Kelas/Mapel/Bab wajib diisi'}), {status:400, headers:{'Content-Type':'application/json'}});
    }
    if(action==='delete'){
      await db.prepare(`DELETE FROM manifest WHERE kelas=? AND mapel=? AND bab=?`).bind(kelas,mapel,bab).run();
      // CATATAN: Sengaja tidak hapus paket di sini. Kalau mau hapus paket,
      // hapus dari Tab 2 -> Daftar Paket, bukan dari daftar Manifest.
      // Agar tidak kehapus paket massal karena salah klik.
    } else {
      await db.prepare(`INSERT OR IGNORE INTO manifest (kelas,mapel,bab) VALUES (?,?,?)`).bind(kelas,mapel,bab).run();
    }
    return new Response(JSON.stringify({ok:true}), {headers:{'Content-Type':'application/json'}});
  }
}
