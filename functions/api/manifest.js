export async function onRequest(context){
  const db = context.env.AP_LMS_DB;
  const { request } = context;
  await db.prepare(`CREATE TABLE IF NOT EXISTS manifest (id INTEGER PRIMARY KEY, kelas TEXT, mapel TEXT, bab TEXT, UNIQUE(kelas,mapel,bab))`).run();
  
  if(request.method==='GET'){
    const res = await db.prepare(`SELECT kelas,mapel,bab FROM manifest ORDER BY kelas,mapel,bab`).all();
    let data = res.results || [];
    if(data.length===0){
      const defaultKelas = ["SD4","SD5","SD6","SMP7","SMP8","SMP9","SMA10","SMA11","SMA12","TKA","TARUNA"];
      return new Response(JSON.stringify({kelas:defaultKelas, items:[]}), {headers:{'Content-Type':'application/json'}});
    }
    const kelasSet = [...new Set(data.map(d=>d.kelas))];
    return new Response(JSON.stringify({kelas:kelasSet, items:data}), {headers:{'Content-Type':'application/json'}});
  }
  if(request.method==='POST'){
    const body = await request.json();
    const {kelas, mapel, bab, action} = body;
    if(action==='delete'){
      await db.prepare(`DELETE FROM manifest WHERE kelas=? AND mapel=? AND bab=?`).bind(kelas,mapel,bab).run();
    } else {
      await db.prepare(`INSERT OR IGNORE INTO manifest (kelas,mapel,bab) VALUES (?,?,?)`).bind(kelas,mapel,bab).run();
    }
    return new Response(JSON.stringify({ok:true}), {headers:{'Content-Type':'application/json'}});
  }
}
