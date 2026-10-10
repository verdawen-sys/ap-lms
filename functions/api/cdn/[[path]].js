export async function onRequest(context){
  const r2 = context.env.AP_LMS_R2;
  const path = context.params.path.join('/');
  const obj = await r2.get(path);
  if(!obj) return new Response('Not found', {status:404});
  return new Response(obj.body, {
    headers:{
      'Content-Type': obj.httpMetadata?.contentType || 'image/jpeg',
      'Cache-Control': 'public, max-age=31536000'
    }
  });
}
