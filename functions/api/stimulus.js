// functions/api/stimulus.js - VERSI TANPA R2 (GRATIS)
export async function onRequest(context){
  const { request, env } = context;
  const url = new URL(request.url);
  const DB = env.AP_LMS_DB; // Sesuai binding Kakak yang sudah ada

  if(request.method==='GET'){
    const paket_id = url.searchParams.get('paket_id');
    const rows = await DB.prepare('SELECT * FROM stimulus WHERE paket_id=? ORDER BY soal_dari ASC').bind(paket_id).all();
    return Response.json(rows.results || []);
  }

  if(request.method==='POST'){
    const body = await request.json();
    const paket_id = body.paket_id;
    const jenis = body.jenis;
    const dari = parseInt(body.soal_dari), sampai = parseInt(body.soal_sampai);

    // VALIDASI TUMPANG TINDIH
    const lama = await DB.prepare('SELECT * FROM stimulus WHERE paket_id=?').bind(paket_id).all();
    for(let s of (lama.results||[])){
      if(dari <= s.soal_sampai && sampai >= s.soal_dari){
        return Response.json({ok:false, msg:`Tumpang tindih dengan stimulus ${s.jenis} soal ${s.soal_dari}-${s.soal_sampai}.`},{status:400});
      }
    }
    const id = 'stim_' + Date.now();
    let file_url = '', video_url = '', teks = '', max_putar = 0;

    if(jenis === 'gambar'){
      // Gambar disimpan sebagai Base64 string di file_url
      file_url = body.file_base64 || '';
      if(!file_url) return Response.json({ok:false, msg:'Gambar wajib'},{status:400});
      if(file_url.length > 1400000) return Response.json({ok:false, msg:'Gambar terlalu besar, max ~1MB. Kecilkan dulu.'},{status:400});
    } else if(jenis === 'audio'){
      // Audio hanya link, tidak upload
      video_url = body.audio_url || '';
      if(!video_url) return Response.json({ok:false, msg:'Link Audio wajib'},{status:400});
      max_putar = parseInt(body.max_putar || 0);
    } else if(jenis === 'video'){
      video_url = body.video_url || '';
      if(!video_url) return Response.json({ok:false, msg:'Link video wajib'},{status:400});
    } else if(jenis === 'teks'){
      teks = body.teks || '';
    }

    await DB.prepare('INSERT INTO stimulus (id,paket_id,jenis,soal_dari,soal_sampai,keterangan,file_url,video_url,video_tipe,teks,max_putar) VALUES (?,?,?,?,?,?,?,?,?,?,?)')
      .bind(id,paket_id,jenis,dari,sampai,body.keterangan||'',file_url,video_url,body.video_tipe||'',teks,max_putar).run();
    return Response.json({ok:true, id});
  }

  if(request.method==='DELETE'){
    const id = url.searchParams.get('id');
    await DB.prepare('DELETE FROM stimulus WHERE id=?').bind(id).run();
    return Response.json({ok:true});
  }
  return Response.json({ok:false, msg:'Method tidak didukung'},{status:405});
}
