# 🏆 WINI AI — Hackathon Track Submission: AI Agents & Assistants

> **Track**: AI Agents & Assistants  
> **Project**: WINI AI (*Autonomous Inclusive Investment Analyst & Voice-First Screener*)  
> **Target Audience**: 4+ Juta Penyandang Disabilitas Netra di Indonesia & Investor Pemula yang Memerlukan Asisten Finansial Otonom

---

## 🎯 1. Ringkasan Eksekutif & Pernyataan Kepatuhan Track

### Mengapa WINI AI adalah Representasi Sempurna dari Track "AI Agents & Assistants"?
Banyak peserta hackathon membuat *chatbot konvensional* (hanya pembungkus prompt LLM / ChatGPT wrapper yang menerima teks dan membalas teks). **WINI AI secara fundamental berbeda**:

WINI AI adalah **AI Agent Otonom Terpadu** yang memiliki **siklus kognitif penuh (*Cognitive Loop*)**:
1. **Persepsi Multimodal (*Perception*)**: Mendengarkan suara percakapan alami bahasa Indonesia secara *hands-free continuous*, membersihkan partikel bahasa daerah/slang, dan mengekstraksi entitas saham serta modal nominal.
2. **Perencanaan & Routing Intent (*Reasoning & Planning*)**: Membedah tujuan pengguna (*goal decomposition*) ke dalam 11 sub-intent tanpa *hardcoding*.
3. **Eksekusi Tool Otonom (*Autonomous Tool Use*)**: Memilih dan mengeksekusi serangkaian alat khusus (*Tool Registry*) secara terorkestrasi (Sectors API v2, Matematika Deterministik 100 Poin, Analisis Tren Kuartalan, Simulasi Rebalancing Portofolio, Sentimen Berita).
4. **Verifikasi & Guardrail Anti-Halusinasi (*Self-Correction & Guardrails*)**: Angka finansial **100% deterministik matematis** sehingga mustahil halusinasi.
5. **Aksi Multimodal (*Multi-Modal Action*)**: Menghasilkan sintesis vokal ramah pendengar, sonifikasi grafik audio Web Audio API (tinggi-rendah nada), takarir visual real-time, dan kartu data interaktif.
6. **Agensi Proaktif (*Proactive Agency*)**: Tidak pasif menunggu; asisten secara proaktif membunyikan peringatan dini risiko utang (*Early Warning Alert*) dan menyarankan penyeimbangan bobot modal.

---

## 🏛️ 2. Arsitektur AI Agent (The Agentic Architecture)

```
                     ┌─────────────────────────────────────────────────┐
                     │          PENGGUNA (DUAL-SENSORY INPUT)          │
                     │   Suara Alami / Keyboard / Layar Sentuh         │
                     └───────────────────────┬─────────────────────────┘
                                             │
                                             ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ 1. PERCEPTION & PREPROCESSING LAYER                                                    │
│    • Continuous Audio Listener (autoRestart, Anti-Bleed Voice Protection)              │
│    • Conversational Normalizer (Pembersih partikel: "dong", "sih", "coba", "tolong")   │
│    • Dynamic Entity Extractor (Alias Perusahaan -> Ticker IDX, Nominal Modal)          │
│    • Contextual Memory Inheritance (Mewarisi emiten aktif dari percakapan sebelumnya)  │
└────────────────────────────────────────────┬───────────────────────────────────────────┘
                                             │
                                             ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ 2. COGNITIVE AGENT BRAIN & INTENT PLANNER (backend/agent/agent_core.py)                 │
│    • Goal Formulation & Task Decomposition                                             │
│    • Session Multi-Turn History Tracking (backend/agent/memory.py)                     │
│    • Dynamic Execution Plan Generator                                                  │
└────────────────────────────────────────────┬───────────────────────────────────────────┘
                                             │
                     ┌───────────────────────┴───────────────────────┐
                     ▼                                               ▼
┌───────────────────────────────────────────┐   ┌───────────────────────────────────────────┐
│ 3. TOOL REGISTRY: DATA RETRIEVAL          │   │ 4. TOOL REGISTRY: QUANTITATIVE REASONING  │
│    • sectors_fundamentals                 │   │    • deterministic_health_scorer          │
│      (Sectors API v2 / Fixture Fallback)  │   │      (Formula 100-pt DER, ROE, ROA, DAR)  │
│    • market_intelligence_news             │   │    • historical_trend_analyzer            │
│      (News Sentiment Extraction)          │   │      (Analisis 4 Kuartal & Slope Deteksi) │
│    • Split-TTL In-Memory Cache (Quota-Safe│   │    • portfolio_rebalancer                 │
│      1h Financials / 10m News)            │   │      (Optimasi Modal & Weakest Link)      │
└───────────────────────────────────────────┘   └───────────────────────────────────────────┘
                     │                                               │
                     └───────────────────────┬───────────────────────┘
                                             │
                                             ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ 5. GUARDRAIL & COMPLIANCE VERIFICATION                                                 │
│    • Zero-Hallucination Math Enforcement (Data kuantitatif dikunci deterministik)     │
│    • Proportional Weight Redistribution (Jika rasio keuangan ada yang kosong/null)    │
│    • Regulatory Compliance Disclaimer Injection                                        │
└────────────────────────────────────────────┬───────────────────────────────────────────┘
                                             │
                                             ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ 6. MULTI-MODAL ACTION & SYNTHESIS (ACTUATORS)                                          │
│    • LLM Narrative Synthesizer (OpenRouter via context-compressed prompt optimizer)    │
│    • Web Audio API Sonification (Pitch frequency mapping grafik 4 kuartal)            │
│    • Responsive Speech Synthesis (Pengatur tempo suara 1x - 2x)                       │
│    • Real-time Waveform Equalizer & Live Subtitle Captions                             │
│    • Agent Execution Trace Viewer (Transparansi alur kerja agen bagi juri & pengguna) │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## ⚖️ 3. Perbandingan: Chatbot Biasa vs. WINI AI (AI Agent & Assistant)

| Parameter Evaluasi Hackathon | Chatbot Konvensional (LLM Wrapper) | WINI AI (Autonomous AI Agent & Assistant) |
| :--- | :--- | :--- |
| **Pola Eksekusi** | Single-prompt (Tanya -> Jawab teks statis). | **Multi-step Autonomous Pipeline** (Persepsi -> Perencanaan -> Pemanggilan Tools -> Validasi -> Aksi). |
| **Koneksi Alat Eksternal (*Tool Use*)** | Tidak ada, hanya mengandalkan memori internal LLM. | **Tool Registry Formal**: Sectors API v2, Deterministic Scorer, Trend Engine, Portfolio Rebalancer, Web Audio Synth. |
| **Kebenaran Data (*Ground Truth*)** | Rawan halusinasi rasio keuangan dan harga saham. | **Zero-Hallucination Guardrail**: Seluruh kalkulasi skor dan rasio dihitung deterministik matematis dengan Python. |
| **Memori & Konteks** | Statis per prompt, sering lupa konteks saham. | **Stateful Session Memory** dengan pewarisan entitas (*misal: tanya "berapa utangnya?" langsung tahu saham aktif*). |
| **Proaktivitas (*Agency*)** | Pasif (hanya menjawab saat ditanya). | **Proaktif**: Mendeteksi sinyal bahaya (*Early Warning*), merekomendasikan rebalancing, dan membunyikan alarm audio. |
| **Aksesibilitas & Inklusivitas** | Hanya visual teks di layar (eksklusif bagi yang melihat). | **Dual-Sensory (WCAG 2.2 AAA)**: Sonifikasi grafik audio nada, *hands-free always-on voice*, kontrol kecepatan suara. |
| **Transparansi Sistem** | *Black box* (user tidak tahu asal data). | **Agent Execution Trace**: Menampilkan durasi, status, dan ringkasan setiap tool yang dieksekusi agen secara real-time. |

---

## 🛠️ 4. Katalog Tool Otonom yang Dikelola Agen (`backend/agent/tools.py`)

1. `sectors_fundamentals` (`DATA_RETRIEVAL`):
   * Mengambil data neraca, laba-rugi, valuasi, rasio solvabilitas, dan dividen dari Sectors Financial API v2 dengan sistem *caching Split-TTL*.
2. `market_intelligence_news` (`DATA_RETRIEVAL`):
   * Mengumpulkan berita pasar terverifikasi dan mengevaluasi sentimen polaritas pasar modal.
3. `deterministic_health_scorer` (`QUANTITATIVE_ANALYSIS`):
   * Mengevaluasi 5 rasio fundamental utama (DER 30%, ROE 25%, ROA 20%, DAR 15%, PER 10%) dengan skala 100 poin transparan.
4. `historical_trend_analyzer` (`QUANTITATIVE_ANALYSIS`):
   * Melacak 4 kuartal berturut-turut, menghitung arah lintasan (`MEMBAIK`, `MEMBURUK`, `STAGNAN`), serta mendeteksi anomali pelemahan fundamental.
5. `portfolio_rebalancer` (`QUANTITATIVE_ANALYSIS`):
   * Mengambil input modal nominal (misal: Rp 10.000.000), mengidentifikasi mata rantai terlemah (*Weakest Link*), dan menyusun rekomendasi pembobotan ulang modal untuk mendongkrak skor portofolio.
6. `web_audio_sonifier` (`ACTUATOR`):
   * Mengubah kurva angka kuartal menjadi modulasi frekuensi suara (220 Hz – 880 Hz) sehingga tunanetra dapat *mendengar* bentuk grafik saham.
7. `llm_narrative_synthesizer` (`SYNTHESIS`):
   * Memadatkan data JSON kuantitatif menjadi narasi bahasa Indonesia yang mengalir, jernih, dan ramah pembaca suara (TTS).

---

## 🎤 5. Panduan Presentasi & Pitch Demo (3 Menit di Depan Juri)

### Menit 1: Masalah Nyata & Nilai Inklusi (The Problem & Vision)
> *"Bapak/Ibu Juri, di Indonesia ada lebih dari 4 juta penyandang tunanetra. Di pasar modal kita, hampir 100% aplikasi investasi hanya mengandalkan grafik visual dan tabel angka rumit. Investor disabilitas netra benar-benar terisolasi dari inklusi finansial.  
> Memperkenalkan **WINI AI**: Asisten Analis Investasi Saham Otonom Pertama di Indonesia yang dirancang khusus untuk disabilitas dengan navigasi suara selalu aktif (*Always-On*) dan grafik sonifikasi nada audio."*

### Menit 2: Live Demo Kemampuan Agensial (Agent Capabilities Live)
1. **Langkah 1 (Hands-Free Always-On):**
   * Ucapkan langsung: *"Halo WINI, bandingkan fundamental Bank BCA dan Bank BRI."*
   * Tunjukkan bahwa mikrofon otomatis mendengarkan tanpa perlu klik tombol, dan otomatis berhenti sesaat agar suara asisten tidak memantul (*Anti-Bleed*).
2. **Langkah 2 (Agent Execution Trace & Zero Hallucination):**
   * Tunjukkan kartu **"🤖 Agentic Execution Trace"**:
   * Jelaskan kepada juri: *"Lihat di layar, agen kami tidak sekadar memanggil LLM. Agen secara otonom memanggil 4 tool: Sectors Financial API, Mesin Matematika Deterministik 100 Poin, Analisis Sentimen Berita, dan Sintesis Vokal dalam waktu di bawah 1 detik dengan garansi 0% halusinasi angka."*
3. **Langkah 3 (Sonifikasi Audio Grafik):**
   * Ucapkan: *"Coba putar nada grafiknya."*
   * Dengarkan nada sonifikasi naik/turun di ruangan juri: *"Ini adalah cara investor tunanetra 'melihat' grafik tren kuartal tanpa layar."*
4. **Langkah 4 (Proactive Rebalancing):**
   * Ucapkan: *"Simulasikan modal 10 juta untuk portofolio ini."*
   * Tunjukkan bagaimana agen menghitung alokasi nominal dan secara proaktif menyarankan rebalancing modal.

### Menit 3: Keunggulan Arsitektur & Kesiapan Produksi (Technical Depth)
> *"Di balik layar, WINI AI dilengkapi manajemen sumber daya cerdas: Caching Split-TTL untuk menghemat kuota API, penanganan degradasi metrik proporsional jika data laporan keuangan tidak lengkap, fallback dual-mode (100% Mock Offline vs Live API), dan kepatuhan penuh standar aksesibilitas WCAG 2.2 AAA. WINI AI bukan sekadar proyek prototipe, ini adalah lompatan nyata bagi demokratisasi pasar modal Indonesia."*

---

## 📋 6. Checklist Pemenuhan Kriteria Juri

- [x] **Agent Autonomy & Intelligence**: Agen memiliki alur persepsi, memori percakapan, perencanaan dinamis, dan pengeksekusian multi-tool independen.
- [x] **Tool Use & Orchestration**: Terintegrasi dengan Sectors API v2, Web Audio API, Mesin Matematika Python, dan LLM Narrative Synthesis.
- [x] **Real-World Social Impact**: Mengatasi kesenjangan sosial nyata bagi 4M+ penyandang disabilitas di Indonesia.
- [x] **Zero-Hallucination Guardrails**: Data numerik dikawal formula deterministik matematis (anti-halusinasi finansial).
- [x] **User Experience & Accessibility**: Antarmuka Dual-Sensory ramah tunanetra dan tunarungu (WCAG 2.2 AAA) dengan Always-on Hands-free Voice.
- [x] **Code Quality & Reliability**: TypeScript 0-error build, arsitektur modular, unit testing, dan kesiapan deploy Docker Compose.
