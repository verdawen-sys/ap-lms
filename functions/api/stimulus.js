// functions/api/stimulus.js - API Stimulus (Gambar / Audio / Video / Teks)
// D1 binding: DB (database AP_LMS_DB)

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function cekOverlap(db, paket_id, dari, sampai, kecualiId) {
  // 1 soal tidak boleh punya 2 stimulus
  let q = "SELECT id, soal_dari, soal_sampai FROM stimulus WHERE paket_id = ? AND NOT (soal_sampai < ? OR soal_dari > ?)";
  let params = [paket_id, dari, sampai];
  if (kecualiId) { q += " AND id != ?"; params.push(kecualiId); }
  return db.prepare(q).bind(...params).first();
}

export async function onRequest(context) {
  const { request, env } = context;
  const db = env.DB;
  if (!db) return json({ ok: false, msg: "D1 binding DB belum terpasang" }, 500);

  const url = new URL(request.url);

  // ---------- GET: daftar stimulus per paket ----------
  if (request.method === "GET") {
    const paket_id = url.searchParams.get("paket_id");
    if (!paket_id) return json({ ok: false, msg: "paket_id wajib" }, 400);
    const res = await db.prepare(
      "SELECT * FROM stimulus WHERE paket_id = ? ORDER BY soal_dari ASC"
    ).bind(Number(paket_id)).all();
    return json(res.results || []);
  }

  // ---------- POST / PUT / DELETE ----------
  let body = {};
  try { body = await request.json(); } catch (e) { body = {}; }

  const action = body.action || (request.method === "DELETE" ? "delete" : request.method === "PUT" ? "update" : "create");

  // ----- DELETE -----
  if (action === "delete") {
    const id = Number(body.id);
    if (!id) return json({ ok: false, msg: "id wajib" }, 400);
    await db.prepare("DELETE FROM stimulus WHERE id = ?").bind(id).run();
    return json({ ok: true });
  }

  // ----- VALIDASI CREATE / UPDATE -----
  const paket_id = Number(body.paket_id);
  const jenis = String(body.jenis || "");
  const soal_dari = Number(body.soal_dari);
  const soal_sampai = Number(body.soal_sampai);

  if (!paket_id) return json({ ok: false, msg: "paket_id wajib" }, 400);
  if (!["gambar", "audio", "video", "teks"].includes(jenis))
    return json({ ok: false, msg: "jenis tidak valid" }, 400);
  if (!soal_dari || !soal_sampai || soal_dari < 1 || soal_sampai < soal_dari)
    return json({ ok: false, msg: "Range soal tidak valid" }, 400);

  // ----- UPDATE -----
  if (action === "update") {
    const id = Number(body.id);
    if (!id) return json({ ok: false, msg: "id wajib untuk update" }, 400);
    const tabrakan = await cekOverlap(db, paket_id, soal_dari, soal_sampai, id);
    if (tabrakan) return json({ ok: false, msg: `Range bertabrakan dengan stimulus soal ${tabrakan.soal_dari}-${tabrakan.soal_sampai}` }, 400);
    await db.prepare(
      "UPDATE stimulus SET paket_id=?, jenis=?, soal_dari=?, soal_sampai=?, keterangan=?, file_url=?, video_url=?, video_tipe=?, teks=?, max_putar=? WHERE id=?"
    ).bind(
      paket_id, jenis, soal_dari, soal_sampai,
      body.keterangan || "", body.file_url || "", body.video_url || "",
      body.video_tipe || "", body.teks || "", Number(body.max_putar || 0), id
    ).run();
    return json({ ok: true, id });
  }

  // ----- CREATE -----
  const tabrakan = await cekOverlap(db, paket_id, soal_dari, soal_sampai, null);
  if (tabrakan) return json({ ok: false, msg: `Range bertabrakan dengan stimulus soal ${tabrakan.soal_dari}-${tabrakan.soal_sampai}` }, 400);

  const res = await db.prepare(
    "INSERT INTO stimulus (paket_id, jenis, soal_dari, soal_sampai, keterangan, file_url, video_url, video_tipe, teks, max_putar) VALUES (?,?,?,?,?,?,?,?,?,?)"
  ).bind(
    paket_id, jenis, soal_dari, soal_sampai,
    body.keterangan || "", body.file_url || "", body.video_url || "",
    body.video_tipe || "", body.teks || "", Number(body.max_putar || 0)
  ).run();
  return json({ ok: true, id: res.meta.last_row_id });
}
