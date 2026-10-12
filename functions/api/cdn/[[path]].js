export async function onRequest(context){
  try{
    const r2 = context.env.AP_LMS_R2;
    const parts = context.params.path || [];
    const path = parts.join('/');

    if(!path || path.includes('..') || path.startsWith('/')){
      return new Response(JSON.stringify({ok:false, msg:'Not found'}), {status:404, headers:{'Content-Type':'application/json'}});
    }

    let key = path;
    try{ key = decodeURIComponent(path); }catch(e){}

    // FIX BUG 4: Kalau R2 tidak ada, jangan crash, return 404 JSON
    if(!r2){
      return new Response(JSON.stringify({ok:false, msg:'R2 tidak terpasang, gambar lama tidak bisa diambil. Upload ulang soal.'}), {status:404, headers:{'Content-Type':'application/json'}});
    }

    // FIX: Kalau key ternyata sudah DataURL (Base64), jangan cari di R2
    if(key.startsWith('data:')){
      return new Response(JSON.stringify({ok:false, msg:'Gambar Base64 harus ditampilkan langsung, bukan via CDN'}), {status:400, headers:{'Content-Type':'application/json'}});
    }

    const obj = await r2.get(key);
    if(!obj) return new Response(JSON.stringify({ok:false, msg:'Not found'}), {status:404, headers:{'Content-Type':'application/json'}});

    return new Response(obj.body, {
      headers:{
        'Content-Type': obj.httpMetadata?.contentType || 'image/jpeg',
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Content-Length': obj.size?.toString() || '',
        'ETag': obj.etag || '',
      }
    });
  }catch(e){
    return new Response(JSON.stringify({ok:false, msg: e.message}), {status:500, headers:{'Content-Type':'application/json'}});
  }
}
