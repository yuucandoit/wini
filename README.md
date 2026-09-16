# WINI AI — Autonomous Investment Analyst & Comparative Stock Screener
### *Accessible & Inclusive Edition (Ramah Tunanetra & Tunarungu)*

WINI AI adalah platform analis investasi saham emiten Bursa Efek Indonesia (IDX) yang otonom, cerdas, dan dirancang khusus dengan standar aksesibilitas inklusif tingkat tinggi (WCAG 2.2 AAA). 

Sistem ini ditenagai oleh **Sectors Financial API v2** (arsitektur query terstruktur hemat kuota 1 kredit), **Mesin Skor Finansial Deterministik (Python Math)**, **OpenRouter LLM**, serta antarmuka suara dan takarir visual waktu-nyata berbasis **Next.js**.

---

## 🚀 Menjalankan via Docker (Paling Cepat)

Pastikan Docker Desktop sudah terpasang dan sedang berjalan.

### 1. Salin Konfigurasi Environment
Salin template `.env.example` ke `.env` dan masukkan API Key Anda:
```bash
cp .env.example .env
```
Isi konfigurasi pada file `.env`:
```env
SECTORS_API_KEY=your_sectors_api_key_here
OPENROUTER_API_KEY=your_openrouter_api_key_here
```

### 2. Jalankan dengan Docker Compose
Cukup jalankan satu perintah berikut di direktori utama:
```bash
docker compose up --build
```

Setelah proses *build* selesai:
- **Frontend**: Buka [http://localhost:3000](http://localhost:3000) di browser.
- **Backend API Docs**: Buka [http://localhost:8000/docs](http://localhost:8000/docs) (Swagger UI).
- **Backend Healthcheck**: [http://localhost:8000/health](http://localhost:8000/health).

Untuk menghentikan kontainer:
```bash
docker compose down
```

---

## 🛠️ Menjalankan Secara Manual (Development Mode)

### 1. Jalankan Backend (FastAPI)
```bash
# Buat dan aktifkan virtual environment
python3 -m venv .venv
source .venv/bin/activate

# Install dependensi
pip install -r requirements.txt

# Jalankan server FastAPI
uvicorn backend.main:app --reload --port 8000
```

### 2. Jalankan Frontend (Next.js)
Buka jendela terminal terpisah:
```bash
cd frontend

# Install dependensi
npm install

# Jalankan server Next.js
npm run dev
```
Buka [http://localhost:3000](http://localhost:3000) di browser.

---

## ♿ Fitur Aksesibilitas Khusus Tunanetra & Tunarungu

1. **Layar Sambutan Suara Otomatis**:
   - Begitu dibuka, asisten langsung menyapa dengan suara alami ramah:
     > *"Selamat datang di WINI AI. Untuk mengaktifkan mikrofon, silakan pencet keyboard dua kali tombol apa saja, atau klik di mana saja dua kali."*
2. **Pemicu Mikrofon Mudah (Double-Trigger)**:
   - **Pencet sembarang tombol keyboard 2x** berturut-turut, ATAU
   - **Klik / ketuk layar 2x** di mana saja.
   - Tidak perlu membidik atau mencari letak tombol mikrofon di layar.
3. **Konfirmasi Suara Otomatis**:
   - Asisten langsung membunyikan nada harmonik (*earcon chime*) dan berbicara:
     > *"Mikrofon sudah aktif. Silakan sebutkan saham atau pertanyaan Anda."*
4. **Takarir Waktu-Nyata & Visualizer (Tunarungu)**:
   - Kartu panduan tengah menampilkan teks langsung saat berbicara, disertai animasi spektrum gelombang suara (*live waveform equalizer*).
5. **Palet Kontras Tinggi & Pembaca Layar**:
   - Kontras warna tinggi (`#070d19`, `#0c162d`, `#06b6d4`), navigasi keyboard lengkap (`Tab`, `Enter`, `Spasi`), serta tag ARIA untuk NVDA, JAWS, dan VoiceOver.

---

## 🏛️ Arsitektur Backend (Optimized MVP)

- **Single-Source Screener (`backend/services/sectors_service.py`)**:
  Memanfaatkan `GET /v2/companies/` dengan parameter SQL terstruktur (`where=symbol in [...]`, `order_by=symbol`) sehingga hanya mengonsumsi **1 kredit API** per pencarian multi-emiten.
- **Scoring Finansial Deterministik (`backend/scoring.py`)**:
  Perhitungan murni Python (tanpa risiko halusinasi LLM) dengan skala 100 poin (DER, ROE, ROA, DAR, PE) serta *graceful degradation* jika ada data kuartalan yang tidak lengkap.
- **Split TTL Caching (`backend/cache.py`)**:
  Cache in-memory cerdas dengan masa simpan panjang untuk data finansial (1 jam) dan pendek untuk berita (10 menit), dilengkapi *stale fallback* jika API eksternal mengalami gangguan.
- **Token Optimizer & Disclaimers (`backend/optimizer.py`, `backend/disclaimers.py`)**:
  Kompresi payload otomatis untuk model OpenRouter gratis serta penempelan disclaimer kepatuhan investasi statis di setiap hasil analisis.
- **Orkestrator & Memori Sesi (`backend/agent/agent_core.py`, `backend/agent/memory.py`)**:
  Mengelola *pipeline* analisis paralel, sintesis narasi berbahasa Indonesia, dan riwayat percakapan interaktif.

---

## 🧪 Pengujian Otomatis

Uji endpoint backend dan kesesuaian kontrak:
```bash
.venv/bin/python -c "
from fastapi.testclient import TestClient
from backend.main import app
client = TestClient(app)
assert client.get('/health').status_code == 200
print('Health Check: OK')
"
```

Uji kesesuaian tipe data TypeScript frontend:
```bash
npm run --prefix frontend build
# atau
npx --prefix frontend tsc --noEmit
```
