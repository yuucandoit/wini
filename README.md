# WINI AI — Autonomous Investment Analyst & Comparative Stock Screener
### *Inclusive & Accessible Edition (Ramah Tunanetra & Tunarungu — WCAG 2.2 AAA)*

WINI AI adalah asisten analis investasi saham Bursa Efek Indonesia (IDX) yang otonom, cerdas, dan dirancang khusus dengan standar aksesibilitas inklusif tingkat tinggi bagi penyandang disabilitas (*dual-sensory accessibility*).

Sistem ini mengintegrasikan **Sectors Financial API v2**, **Mesin Skor Kesehatan Finansial Deterministik (Python Math)**, **OpenRouter LLM**, **Web Audio API Sonification (Grafik Suara Tunanetra)**, serta antarmuka suara dan takarir visual waktu-nyata berbasis **Next.js & Tailwind CSS**.

---

## 📋 Daftar Isi
1. [Cara Menjalankan Kode (How to Run)](#-cara-menjalankan-kode-how-to-run)
   - [Opsi A: Docker Compose (Paling Cepat)](#opsi-a-docker-compose-paling-cepat)
   - [Opsi B: Manual Development Mode](#opsi-b-manual-development-mode)
2. [Panduan Pengguna (How to Use as a User)](#-panduan-pengguna-how-to-use-as-a-user)
   - [1. Cara Mengaktifkan Suara / Mikrofon](#1-cara-mengaktifkan-suara--mikrofon)
   - [2. Contoh Perintah Suara yang Bisa Langsung Dicoba](#2-contoh-perintah-suara-yang-bisa-langsung-dicoba)
   - [3. Membaca & Mendengarkan Grafik Suara (Audio Sonification)](#3-membaca--mendengarkan-grafik-suara-audio-sonification)
   - [4. Simulasi Portofolio & Saran Rebalancing](#4-simulasi-portofolio--saran-rebalancing)
   - [5. Mengatur Kecepatan Suara Asisten (TTS Rate)](#5-mengatur-kecepatan-suara-asisten-tts-rate)
   - [6. Navigasi Suara di Halaman Hasil](#6-navigasi-suara-di-halaman-hasil)
3. [Fitur-Fitur Utama Aplikasi](#-fitur-fitur-utama-aplikasi)
4. [Arsitektur & Keamanan Token / Kuota API](#-arsitektur--keamanan-token--kuota-api)
5. [Pengujian Otomatis](#-pengujian-otomatis)

---

## 🚀 Cara Menjalankan Kode (How to Run)

### Kebutuhan Awal
- Git
- Python 3.10+ (untuk backend)
- Node.js 18+ & npm (untuk frontend)
- *Atau* Docker & Docker Desktop

### 1. Salin Konfigurasi Environment
Salin template `.env.example` ke `.env`:
```bash
cp .env.example .env
```
Pastikan file `.env` di direktori utama berisi API key yang valid:
```env
SECTORS_API_KEY=your_sectors_api_key_here
OPENROUTER_API_KEY=your_openrouter_api_key_here
USE_MOCK_DATA=false
```

---

### Opsi A: Docker Compose (Paling Cepat)

Jalankan perintah berikut di direktori utama proyek:
```bash
docker compose up --build
```
Setelah proses selesai:
- **Frontend Aplikasi**: Buka [http://localhost:3000](http://localhost:3000)
- **Backend API Docs (Swagger UI)**: Buka [http://localhost:8000/docs](http://localhost:8000/docs)
- **Health Check**: [http://localhost:8000/health](http://localhost:8000/health)

Untuk mematikan:
```bash
docker compose down
```

---

### Opsi B: Manual Development Mode

#### 1. Jalankan Backend (FastAPI)
```bash
# Buat dan aktifkan virtual environment
python3 -m venv .venv
source .venv/bin/activate

# Pasang dependensi
pip install -r requirements.txt

# Jalankan server backend (port 8000)
uvicorn backend.main:app --reload --port 8000
```

#### 2. Jalankan Frontend (Next.js)
Buka terminal baru:
```bash
cd frontend

# Pasang dependensi
npm install

# Jalankan server development (port 3000)
npm run dev
```
Buka browser dan akses **[http://localhost:3000](http://localhost:3000)**.

---

## 🎧 Panduan Pengguna (How to Use as a User)

WINI AI dirancang dengan prinsip **Dual-Sensory**: semua fungsi dapat diakses 100% menggunakan **suara dan pendengaran** (ramah tunanetra), atau 100% menggunakan **visual dan teks** (ramah tunarungu).

### 1. Cara Mengaktifkan Suara / Mikrofon
Pengguna tunanetra tidak perlu mencari atau membidik letak tombol mikrofon di layar:
- **Pencet sembarang tombol keyboard 2 kali berturut-turut** (misal tombol `Spasi` 2x atau tombol `Enter` 2x), **ATAU**
- **Klik / ketuk layar 2 kali di mana saja**.
- **Indikator**: 
  - Telinga Anda akan mendengar nada harmonik pembuka (*chime*).
  - Asisten akan bersuara: *"Mikrofon sudah aktif. Silakan sebutkan saham atau pertanyaan Anda."*
  - Di layar, tombol mikrofon akan menyala **hijau neon** dengan efek gelombang riak (*ripple*) dan badge `● REC`.
  - Visualisator spektrum suara 8 bar akan bergerak real-time mengikuti volume suara Anda.

---

### 2. Contoh Perintah Suara yang Bisa Langsung Dicoba

Setelah mikrofon aktif, Anda bisa berbicara secara santai dalam bahasa Indonesia alami:

#### A. Analisis Saham Tunggal / Komparasi
- *"Analisis kesehatan saham BBCA"*
- *"Bandingkan fundamental saham TLKM dan ISAT"*
- *"Bagaimana kondisi keuangan Bank Mandiri dibanding BRI?"*

#### B. 🗓️ Analisis Tren Historis 4 Kuartal (Baru!)
- *"Bagaimana tren kesehatan ADRO dalam 4 kuartal terakhir?"*
- *"Tampilkan perkembangan keuangan BBRI kuartal ke kuartal"*

#### C. 📦 Simulasi Portofolio Cerdas (Baru!)
- *"Kalau saya taruh 10 juta di BBCA, TLKM, dan ASII masing-masing sama rata, seberapa sehat portofolio saya?"*
- *"Simulasikan modal 50 juta untuk portofolio BBRI, BMRI, dan BBNI"*

#### D. 🏭 Rekomendasi Sektoral (Baru!)
- *"Cari top 5 saham perbankan yang paling sehat"*
- *"Rekomendasi saham sektor energi terbaik"*
- *"Top saham telekomunikasi di BEI"*

#### E. 📖 Kamus Jargon Saham Suara (Baru!)
- *"Apa itu DER?"*
- *"Jelaskan apa maksudnya PER"*
- *"Apa arti dividend yield?"*
- *"Apa itu ROE dan kenapa penting?"*
> Asisten akan menjelaskan definisi ringkas lengkap dengan **analogi kehidupan sehari-hari** (misal: membandingkan utang perusahaan dengan uang tabungan pribadi).

---

### 3. Membaca & Mendengarkan Grafik Suara (Audio Sonification)

Pada hasil **Tren Historis Kuartalan**:
1. **Tombol "🎵 Grafik Suara"**:
   - Menghasilkan nada sonifikasi Web Audio API dalam 1,5 detik.
   - **Tinggi nada (*pitch*)** mengikuti skor kuartal:
     - Nada meluncur naik (rendah ke tinggi) = tren **MEMBAIK** ↗️
     - Nada meluncur turun (tinggi ke rendah) = tren **MEMBURUK** ↘️
     - Nada datar = tren **STAGNAN** ➡️
2. **Eksplorasi Kuartal (Q1–Q4)**:
   - Tekan tombol kuartal `Q1`, `Q2`, `Q3`, atau `Q4`.
   - Nada spesifik kuartal tersebut akan berbunyi dan asisten membacakan detail skor, DER, dan ROE-nya.
3. **Tabel Data Semantik**:
   - Pengguna pembaca layar (*screen reader* NVDA/TalkBack) dapat menelusuri data kuartalan sel demi sel.
4. **Peringatan Dini Pelemahan**:
   - Jika terdeteksi penurunan fundamental tajam (>8 poin) atau utang melonjak, sistem otomatis membunyikan peringatan vokal dan memunculkan kartu *Early Warning*.

---

### 4. Simulasi Portofolio & Saran Rebalancing

Pada hasil **Simulasi Portofolio**:
- Sistem secara otomatis menghitung:
  1. Alokasi nominal rupiah per emiten (misal: Rp 3.333.333 per saham dari modal 10 juta).
  2. **Skor Terbobot Portofolio (*Weighted Score*)**: Menggabungkan seluruh saham sesuai porsinya.
  3. **Saham Paling Berisiko (*Weakest Link*)**: Disertai alasan konkret (misal utang tinggi atau ROE rendah).
  4. **Saham Jangkar (*Anchor*)**: Saham terkuat penopang stabilitas.
- Klik **"💡 Tampilkan Saran Rebalancing"**:
  - Menampilkan tabel perbandingan porsi awal vs saran porsi baru.
  - Menampilkan proyeksi kenaikan skor portofolio (misal dari skor 78 naik ke 82).

---

### 5. Mengatur Kecepatan Suara Asisten (TTS Rate)

Di pojok kanan atas bilah navigasi terdapat kontrol kecepatan suara:
- Pilihan: **[1×] [1.25×] [1.5×] [2×]**
- Sangat berguna bagi pengguna tunanetra yang terbiasa mendengarkan informasi dengan tempo cepat (1.5× – 2×) untuk menghemat waktu.
- Pilihan kecepatan tersimpan otomatis di browser (*localStorage*).

---

### 6. Navigasi Suara di Halaman Hasil

Setelah hasil analisis selesai dibacakan, **mikrofon otomatis tetap siaga**. Anda bisa langsung berbicara tanpa menekan tombol apa pun:
- Ucapkan *"Ulangi"* ➔ Asisten membacakan ulang ringkasan.
- Ucapkan *"Berapa utangnya?"* ➔ Asisten membacakan skor rasio utang (DER/DAR).
- Ucapkan *"Rebalancing"* ➔ Asisten membacakan rekomendasi alokasi portofolio.
- Ucapkan *"Tren kuartal"* ➔ Asisten membacakan ringkasan tren 4 kuartal.
- Ucapkan *"Apa itu PER?"* ➔ Membuka kartu kamus jargon.
- Ucapkan *"Bandingkan dengan BBRI"* ➔ Memulai analisis komparasi baru.
- Ucapkan *"Kembali"* atau tekan tombol `Escape` ➔ Kembali ke dasbor awal.

---

## 🌟 Fitur-Fitur Utama Aplikasi

| Kategori | Fitur | Keterangan |
|---|---|---|
| **Aksesibilitas** | Pemicu Ganda (Double-Trigger) | Tekan sembarang tombol 2x atau klik layar 2x untuk buka/tutup mic |
| **Aksesibilitas** | Audio Sonification | Grafik suara bernada untuk membaca kurva data tren tanpa melihat layar |
| **Aksesibilitas** | Audio Earcons Melodi Status | 4 nada khas: Mayor ceria (Sangat Sehat), Triad (Sehat), Minor (Waspada), Turun kromatik (Berisiko Tinggi) |
| **Aksesibilitas** | Spektrum Suara Real-Time | 8 bar equalizer Web Audio API yang bereaksi terhadap volume suara pengguna |
| **Aksesibilitas** | Filter Derau & Kejelasan | *Confidence threshold* 60% untuk mengabaikan gumaman/suara tidak jelas |
| **Aksesibilitas** | Pengatur Kecepatan Suara | Pilihan 1×, 1.25×, 1.5×, 2× tersimpan di memori lokal |
| **Finansial** | Skor Kesehatan Deterministik | Formula 100 poin transparan (DER 30%, ROE 25%, ROA 20%, DAR 15%, PER 10%) |
| **Finansial** | 4 Kategori Status | `SANGAT SEHAT` (≥85), `SEHAT` (70–84), `WASPADA` (50–69), `BERISIKO TINGGI` (<50) |
| **Finansial** | Evaluasi Dividen | Bonus hingga +10 poin untuk emiten dengan *dividend yield* tinggi dan konsisten |
| **Finansial** | Penyaring Sektoral | Mengenali 22 kata kunci sektor IDX (perbankan, energi, teknologi, konsumer, dll.) |
| **Finansial** | Analisis Tren Kuartalan | Deteksi arah tren (`MEMBAIK`, `MEMBURUK`, `STAGNAN`) dan peringatan dini pelemahan |
| **Finansial** | Simulasi Portofolio | Perhitungan bobot modal nominal, deteksi emiten paling lemah, dan saran *rebalancing* |
| **Edukasi** | Kamus Jargon Suara | Penjelasan istilah pasar modal dengan analogi sederhana ramah pemula |

---

## 🏛️ Arsitektur & Keamanan Token / Kuota API

- **Split-TTL In-Memory Cache (`backend/cache.py`)**:
  - Data fundamental disimpan selama **1 jam**.
  - Berita pasar disimpan selama **10 menit**.
  - Menghemat kredit Sectors API (batas kuota 500 kredit).
- **Graceful Fallback & Fixtures**:
  - Jika `USE_MOCK_DATA=true` atau API eksternal sedang limit/offline, sistem otomatis menggunakan fixture data lokal tanpa memutus interaksi pengguna.
- **Deteksi Ticker Dinamis**:
  - Kode saham IDX diekstrak secara otomatis dari percakapan tanpa *hardcoding* daftar saham.
- **Pembersih Teks Audio (`frontend/src/lib/speechUtils.ts`)**:
  - Simbol markdown (`**bold**`, `###`, emoji) dibersihkan sebelum diteruskan ke Text-to-Speech agar artikulasi asisten terdengar jernih dan alami.

---

## 🧪 Pengujian Otomatis

### Uji Sintaks & Modul Backend (Python):
```bash
.venv/bin/python -m py_compile backend/scoring.py backend/services/sectors_service.py backend/agent/agent_core.py backend/main.py
```

### Uji Fungsional Tren & Portofolio:
```bash
.venv/bin/python -c "
from backend.scoring import calculate_quarterly_trend, simulate_portfolio, HealthScoreResult

# Uji tren
q_data = [{'quarter': 'Q1 2024', 'der_mrq': 0.5, 'roe_ttm': 0.1}, {'quarter': 'Q2 2024', 'der_mrq': 0.38, 'roe_ttm': 0.12}]
print('Trend:', calculate_quarterly_trend('ADRO', 'Adaro', q_data)['direction'])

# Uji portofolio
scores = {'BBCA': HealthScoreResult(88, 'SANGAT SEHAT', {}, 1.0, {}), 'TLKM': HealthScoreResult(75, 'SEHAT', {}, 1.0, {})}
print('Portofolio:', simulate_portfolio(scores, {'BBCA':'BCA', 'TLKM':'Telkom'}, 10_000_000)['weighted_score'])
"
```

### Uji Tipe Data Frontend (TypeScript):
```bash
cd frontend && npx tsc --noEmit
```
Hasil validasi: **0 errors**.

---

### Lisensi & Kepatuhan
Dikembangkan untuk Solusi Finansial Inklusif IDX. Semua rekomendasi finansial disertai *Compliance Investment Disclaimer* otomatis sesuai regulasi pasar modal.
