export async function onRequest(context){
  const r2 = context.env.AP_LMS_R2;
  // context.params.path = array, contoh: ["soal","123","xxx.jpg"]
  const parts = context.params.path || [];
  const path = parts.join('/');

  // FIX: Tolak path kosong & path traversal
  if(!path || path.includes('..') || path.startsWith('/')){
    return new Response('Not found', {status:404});
  }

  // FIX: Decode URL agar nama file dengan spasi / %20 bisa kebaca
  let key = path;
  try{ key = decodeURIComponent(path); }catch(e){}

  const obj = await r2.get(key);
  if(!obj) return new Response('Not found', {status:404});

  return new Response(obj.body, {
    headers:{
      'Content-Type': obj.httpMetadata?.contentType || 'image/jpeg',
      'Cache-Control': 'public, max-age=31536000, immutable',
      'Content-Length': obj.size?.toString() || '',
      'ETag': obj.etag || '',
    }
  });
}
