CREATE TABLE IF NOT EXISTS stimulus (
  id TEXT PRIMARY KEY,
  paket_id INTEGER NOT NULL,
  jenis TEXT NOT NULL CHECK (jenis IN ('gambar','audio','video','teks')),
  soal_dari INTEGER NOT NULL,
  soal_sampai INTEGER NOT NULL,
  keterangan TEXT DEFAULT '',
  file_url TEXT DEFAULT '',
  video_url TEXT DEFAULT '',
  video_tipe TEXT DEFAULT '',
  teks TEXT DEFAULT '',
  max_putar INTEGER DEFAULT 0 CHECK (max_putar IN (0,2,3)),
  created_at TEXT DEFAULT (datetime('now','localtime')),
  CHECK (soal_sampai >= soal_dari AND soal_dari >= 1)
);

CREATE INDEX IF NOT EXISTS idx_stimulus_paket ON stimulus(paket_id, soal_dari);
