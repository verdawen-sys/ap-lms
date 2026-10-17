// functions/api/stimulus.js
export async function onRequest(context){
  const { request, env } = context;
  const url = new URL(request.url);
  const DB = env.DB;
  const R2 = env.R2;

  if(request.method==='GET'){
    const paket_id = url.searchParams.get('paket_id');
    const rows = await DB.prepare('SELECT * FROM stimulus WHERE paket_id=? ORDER BY soal_dari ASC').bind(paket_id).all();
    return Response.json(rows.results || []);
  }

  if(request.method==='POST'){
    const fd = await request.formData();
    const paket_id = fd.get('paket_id');
    const jenis = fd.get('jenis');
    const dari = parseInt(fd.get('soal_dari')), sampai = parseInt(fd.get('soal_sampai'));
    // VALIDASI TUMPANG TINDIH LINTAS JENIS - server adalah sumber kebenaran
    const lama = await DB.prepare('SELECT * FROM stimulus WHERE paket_id=?').bind(paket_id).all();
    for(let s of (lama.results||[])){
      if(dari <= s.soal_sampai && sampai >= s.soal_dari){
        return Response.json({ok:false, msg:`Tumpang tindih dengan stimulus ${s.jenis} soal ${s.soal_dari}-${s.soal_sampai}. 1 soal hanya boleh 1 stimulus.`},{status:400});
      }
    }
    const id = 'stim_' + Date.now();
    let file_url='', video_url='', video_tipe='', teks='', max_putar=0;
    if(jenis==='gambar' || jenis==='audio'){
      const f = fd.get('file');
      if(!f) return Response.json({ok:false, msg:'File wajib'},{status:400});
      const max = jenis==='audio' ? 15*1024*1024 : 2*1024*1024;
      if(f.size > max) return Response.json({ok:false, msg: jenis==='audio'?'Audio max 15 MB':'Gambar max 2 MB'},{status:400});
      const ext = (f.name.split('.').pop()||'bin').toLowerCase();
      const key = `stimulus/${paket_id}/${id}.${ext}`;
      await R2.put(key, f.stream(), { httpMetadata:{ contentType: f.type }});
      file_url = key;
      max_putar = parseInt(fd.get('max_putar')||0);
    } else if(jenis==='video'){
      video_url = fd.get('video_url')||''; video_tipe = fd.get('video_tipe')||'youtube';
      if(!video_url) return Response.json({ok:false, msg:'Link video wajib'},{status:400});
    } else if(jenis==='teks'){
      teks = fd.get('teks')||'';
    }
    await DB.prepare('INSERT INTO stimulus (id,paket_id,jenis,soal_dari,soal_sampai,keterangan,file_url,video_url,video_tipe,teks,max_putar) VALUES (?,?,?,?,?,?,?,?,?,?,?)')
      .bind(id,paket_id,jenis,dari,sampai,fd.get('keterangan')||'',file_url,video_url,video_tipe,teks,max_putar).run();
    return Response.json({ok:true, id});
  }

  if(request.method==='DELETE'){
    const id = url.searchParams.get('id');
    const row = await DB.prepare('SELECT * FROM stimulus WHERE id=?').bind(id).first();
    if(row && row.file_url && R2) { try{ await R2.delete(row.file_url); }catch(e){} }
    await DB.prepare('DELETE FROM stimulus WHERE id=?').bind(id).run();
    return Response.json({ok:true});
  }
  return Response.json({ok:false, msg:'Method tidak didukung'},{status:405});
}