/**
 * WINI AI — Smart Dynamic Voice Intent Router
 *
 * Provides non-hardcoded, pattern-based semantic intent routing for
 * hands-free continuous voice navigation, specifically crafted for
 * visually impaired users (tunanetra).
 *
 * Features:
 * - Conversational Indonesian normalization (strips particles: dong, sih, ya, coba, tolong, dll.)
 * - Multi-keyword fuzzy cluster matching (non-rigid / non-hardcoded)
 * - Dynamic parameter extraction (tickers, nominals, metric names)
 * - Contextual inheritance (inherits current active ticker from previous result)
 * - Spoken help / audio feature directory
 */

import type { AnalysisResult } from "./types";
import { findGlossaryEntry, isGlossaryQuery } from "./glossary";

export type VoiceIntentType =
  | "SWITCH_FEATURE_TREND"        // Analisis Tren Historis Kuartalan & Chart Audio
  | "SWITCH_FEATURE_PORTFOLIO"    // Simulasi Portofolio & Saran Rebalancing
  | "SWITCH_FEATURE_SCREENER"     // Skrining Top Saham Sehat BEI
  | "SWITCH_FEATURE_COMPARISON"   // Komparasi 2 atau Lebih Emiten
  | "SWITCH_FEATURE_SINGLE"       // Analisis Fundamental Saham Tunggal
  | "SWITCH_FEATURE_GLOSSARY"     // Edukasi Jargon & Kamus Investasi
  | "READ_METRIC"                 // Membacakan Metrik Spesifik (Utang/DER, Laba/ROE, Valuasi/PE, Skor)
  | "PLAY_SONIFICATION"           // Memutar Nada Musik / Frekuensi Grafik Tren
  | "REPLAY_SUMMARY"              // Mengulangi Pembacaan Narasi Ringkasan
  | "ADJUST_SPEECH_SPEED"         // Perintah 'lebih pelan', 'lebih cepat', 'tempo normal'
  | "CONFIRMATION_FALLBACK"       // Konfirmasi saat pendengaran ambigu ("maksud Anda BBCA?")
  | "WATCHLIST_COMMAND"           // Tambah atau baca daftar pantauan via suara
  | "NAVIGATION_HOME"             // Kembali ke Beranda / Reset Dasbor
  | "HELP"                        // Panduan Fitur & Perintah Suara
  | "STOCK_QUERY";                // Pertanyaan Analisis Bebas

export interface VoiceRouteResult {
  intent: VoiceIntentType;
  /** Raw query sanitized */
  cleanedQuery: string;
  /** Resolved target query string for API or state */
  targetQuery?: string;
  /** Tickers detected or inherited */
  tickers: string[];
  /** Capital nominal extracted (for portfolio simulation) */
  nominal?: number;
  /** Specific metric asked (if intent is READ_METRIC) */
  metricKey?: "debt" | "profitability" | "valuation" | "score";
  /** Spoken response text if intent can be answered immediately in-memory */
  spokenResponse?: string;
  /** Human-readable explanation of why this intent was picked */
  rationale: string;
}

// --------------------------------------------------------------------------
// 1. Common Indonesian Company Names to IDX Tickers
// --------------------------------------------------------------------------
export const COMPANY_ALIASES: Record<string, string> = {
  telkom: "TLKM",
  tlkm: "TLKM",
  indosat: "ISAT",
  isat: "ISAT",
  bca: "BBCA",
  bbca: "BBCA",
  bri: "BBRI",
  bbri: "BBRI",
  mandiri: "BMRI",
  bmri: "BMRI",
  bni: "BBNI",
  bbni: "BBNI",
  astra: "ASII",
  asii: "ASII",
  unilever: "UNVR",
  unvr: "UNVR",
  goto: "GOTO",
  gojek: "GOTO",
  tokopedia: "GOTO",
  adaro: "ADRO",
  adro: "ADRO",
  antam: "ANTM",
  antm: "ANTM",
  vale: "INCO",
  inco: "INCO",
  bukalapak: "BUKA",
  buka: "BUKA",
  kalbe: "KLBF",
  klbf: "KLBF",
  indofood: "INDF",
  indf: "INDF",
  icbp: "ICBP",
  smgr: "SMGR",
  semen: "SMGR",
  ptba: "PTBA",
  bukit: "PTBA",
  medco: "MEDC",
  medc: "MEDC",
  pgas: "PGAS",
  gas: "PGAS",
  dcii: "DCII",
  byan: "BYAN",
};

// Indonesian stopwords to prevent misidentifying 4-letter words as tickers
const INDO_STOPWORDS = new Set([
  "WINI", "LETS", "GOOO", "GASS", "MINI", "PAGE", "USER",
  "TREN", "ARAH", "KUAR", "MODA", "DANA", "UANG", "PORT", "SEGI", "POIN",
  "YANG", "PADA", "DARI", "ATAU", "BANK", "SKOR", "LABA", "ATAS", "SAJA",
  "JUGA", "KITA", "BISA", "AKAN", "BAGI", "KAMI", "SAMA", "BILA", "AGAR",
  "OLEH", "LALU", "CARA", "LIMA", "ENAM", "SATU", "DUA", "INFO", "DATA",
  "NEWS", "APAK", "MANA", "RUGI", "AI", "VS", "DAN", "BAIK", "APAP",
  "HALO", "NAMA", "MAKA", "SAAT", "HARI", "BULAN", "COBA", "CARI", "LIAT",
  "BAGU", "BUAT", "MAUK", "TENT", "DULU", "SAYA", "KAMU", "APAS", "IKUT",
  "NAIK", "TURU", "JUAL", "BELI", "KATA", "KODE", "TOP5", "TOP3", "TOP7",
  "EMIT", "KALI", "CEK", "PILI", "SEDE", "SUDA", "BIAR", "TAPI", "JIKA",
  "TERB", "SEHA", "MENG", "SIAP", "DAPA", "TIDA", "BANY", "ADAL", "DEPA",
  "JADI", "BUKU", "NILA", "TAKS", "RASA", "RATA", "SEMU", "SINI", "SITU",
  "TAON", "TAUN", "AKHI", "AWAL", "TAHU", "MAU", "KOK", "SIH", "DONG", "KAN",
]);

// --------------------------------------------------------------------------
// 2. Normalizer: Strips conversational fluff & filler words
// --------------------------------------------------------------------------
export function normalizeSpokenText(text: string): string {
  if (!text) return "";

  let cleaned = text.toLowerCase().trim();

  // Strip assistant prompt echoes
  cleaned = cleaned.replace(
    /^.*?(?:mikrofon\s+sudah\s+aktif|silakan\s+sebutkan\s+saham\s+atau\s+pertanyaan\s+anda|sebutkan\s+saham\s+atau\s+pertanyaan\s+anda|pertanyaan\s+anda)\s*[,.:;]?\s*/i,
    ""
  );

  // Strip wake words & conversational greetings
  cleaned = cleaned.replace(
    /^(?:halo|hai|hei|lets\s*go|let'?s\s*go|mulai|permisi|pagi|siang|sore|malam)\s*(?:wini)?\s*[,.:;!-]?\s*/i,
    ""
  );
  cleaned = cleaned.replace(/^wini\s*[,.:;!-]?\s*/i, "");

  // Strip conversational polite requests & filler particles
  const fillerRegex = /\b(tolong|coba|dong|sih|ya|yah|nih|tuh|kan|kira-kira|kira|kiraan|mohon|penasaran|pengen|mau|ingin|mau\s+tahu|ingin\s+tahu|aku|saya|gue|gw|kak|min)\b/gi;
  cleaned = cleaned.replace(fillerRegex, " ");

  // Strip multiple spaces and punctuation
  cleaned = cleaned.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, " ");
  cleaned = cleaned.replace(/\s{2,}/g, " ").trim();

  return cleaned;
}

// --------------------------------------------------------------------------
// 3. Entity Extractors: Tickers & Nominals
// --------------------------------------------------------------------------
export function extractTickers(text: string): string[] {
  const lower = text.toLowerCase();
  const found: string[] = [];

  // Match known aliases
  for (const [alias, ticker] of Object.entries(COMPANY_ALIASES)) {
    const reg = new RegExp(`\\b${alias}\\b`, "i");
    if (reg.test(lower)) {
      if (!found.includes(ticker)) {
        found.push(ticker);
      }
    }
  }

  // Match 4-letter uppercase tokens not in stopwords
  const words = text.toUpperCase().match(/\b[A-Z]{4}\b/g) || [];
  for (const w of words) {
    if (!INDO_STOPWORDS.has(w) && !found.includes(w)) {
      found.push(w);
    }
  }

  return found;
}

export function extractNominalAmount(text: string): number {
  const lower = text.toLowerCase();

  // Pattern: "10 juta", "50jt", "2,5 juta", "10.5jt"
  const jutaMatch = lower.match(/(\d+(?:[.,]\d+)?)\s*(?:juta|jt)\b/);
  if (jutaMatch) {
    const num = parseFloat(jutaMatch[1].replace(",", "."));
    if (!isNaN(num) && num > 0) {
      return num * 1_000_000;
    }
  }

  // Pattern: Raw digits >= 100,000 (e.g. 10000000)
  const rawMatch = lower.match(/\b(\d{6,11})\b/);
  if (rawMatch) {
    const num = parseFloat(rawMatch[1]);
    if (!isNaN(num) && num > 0) {
      return num;
    }
  }

  // Default standard simulation capital
  return 10_000_000;
}

// --------------------------------------------------------------------------
// 4. Feature Intent Clusters (Multi-Keyword Semantic Matching)
// --------------------------------------------------------------------------
const CLUSTERS = {
  HELP: [
    "bantuan", "help", "panduan", "bisa apa", "bisa ngapain",
    "fitur", "fitur apa", "daftar fitur", "menu", "perintah",
    "cara pakai", "cara menggunakan", "contoh perintah"
  ],
  NAVIGATION: [
    "kembali", "dasbor", "beranda", "home", "mulai baru",
    "reset", "ganti saham", "ulang dari awal", "tutup", "keluar",
    "layar utama", "halaman utama"
  ],
  REPLAY: [
    "ulangi", "ulang", "baca ulang", "baca lagi", "repeat",
    "sekali lagi", "kurang jelas", "ulangi ringkasan", "dengar lagi"
  ],
  SONIFICATION: [
    "sonifikasi", "bunyikan", "dengarkan nada", "putar nada",
    "suara grafik", "nada grafik", "audio chart", "nada chart",
    "dengar grafik", "bunyi chart", "tangga nada"
  ],
  TREND: [
    "tren", "trend", "kuartal", "kuartalan", "quarter",
    "historis", "riwayat", "perkembangan", "historikal",
    "grafik", "chart", "arah kinerja", "4 kuartal", "kuartal terakhir"
  ],
  PORTFOLIO: [
    "portofolio", "portfolio", "simulasi", "alokasi",
    "rebalance", "rebalancing", "saran alokasi", "bagi modal",
    "taruh dana", "saham terlemah", "saham terkuat", "bobot saham",
    "investasi 10 juta", "modal 10 juta"
  ],
  SCREENER: [
    "top", "terbaik", "paling sehat", "rekomendasi",
    "screener", "saring", "saringan", "unggul", "juara",
    "saham bagus", "paling aman", "emiten sehat", "skrining"
  ],
  COMPARISON: [
    "bandingkan", "bandingin", "banding", "komparasi",
    "versus", "vs", "lawan", "antara", "lebih bagus mana",
    "mana yang lebih sehat", "mana lebih unggul"
  ],
  GLOSSARY: [
    "apa itu", "apa arti", "apa maksud", "maksud dari",
    "jelaskan", "artinya", "definisi", "pengertian",
    "kamus", "analogi"
  ],
  METRIC_DEBT: [
    "utang", "hutang", "der", "dar", "leverage",
    "liabilitas", "rasio utang", "solvabilitas", "beban utang"
  ],
  METRIC_PROFIT: [
    "laba", "profit", "roe", "roa", "keuntungan",
    "profitabilitas", "margin", "imbal hasil modal"
  ],
  METRIC_VALUATION: [
    "valuasi", "pe", "per", "pbv", "harga wajar",
    "murah", "mahal", "price to earnings"
  ],
  METRIC_SCORE: [
    "skor", "nilai kesehatan", "kategori", "status",
    "sehat atau tidak", "berapa nilainya"
  ],
  SPEED_SLOWER: [
    "lebih pelan", "pelan pelan", "pelan-pelan", "lambat", "terlalu cepat", "kurangi kecepatan"
  ],
  SPEED_FASTER: [
    "lebih cepat", "cepatkan", "terlalu pelan", "tambah kecepatan"
  ],
  SPEED_NORMAL: [
    "tempo normal", "kecepatan normal", "reset kecepatan", "standar"
  ],
  WATCHLIST: [
    "pantauan", "daftar pantauan", "watchlist", "saham pantauan", "simpan saham", "tambahkan ke pantauan"
  ],
};

function matchesAnyCluster(text: string, keywords: string[]): boolean {
  return keywords.some((kw) => {
    if (kw.includes(" ")) {
      return text.includes(kw);
    }
    const regex = new RegExp(`\\b${kw}\\b`, "i");
    return regex.test(text);
  });
}

// --------------------------------------------------------------------------
// 5. Main Intent Classification Function
// --------------------------------------------------------------------------
export function routeVoiceIntent(
  rawInput: string,
  context?: {
    currentResult?: AnalysisResult | null;
    currentPhase?: string;
  }
): VoiceRouteResult {
  const cleaned = normalizeSpokenText(rawInput);
  const detectedTickers = extractTickers(rawInput);
  const currentResult = context?.currentResult;

  // Contextual ticker inheritance:
  // If user says "bagaimana trennya" while already viewing ADRO, inherit ADRO!
  const contextTicker =
    currentResult?.healthScore?.symbol ||
    currentResult?.historicalTrend?.symbol ||
    (currentResult?.comparison?.symbols ? currentResult.comparison.symbols[0] : null);

  const effectiveTickers = detectedTickers.length > 0
    ? detectedTickers
    : (contextTicker ? [contextTicker] : []);

  // 1. HELP INTENT
  if (matchesAnyCluster(cleaned, CLUSTERS.HELP)) {
    return {
      intent: "HELP",
      cleanedQuery: cleaned,
      tickers: effectiveTickers,
      spokenResponse: generateHelpSpokenResponse(),
      rationale: "Pengguna meminta bantuan navigasi atau panduan daftar fitur.",
    };
  }

  // 2. NAVIGATION (Return Home / Reset)
  if (matchesAnyCluster(cleaned, CLUSTERS.NAVIGATION)) {
    return {
      intent: "NAVIGATION_HOME",
      cleanedQuery: cleaned,
      tickers: effectiveTickers,
      spokenResponse: "Kembali ke dasbor utama. Silakan sebutkan saham atau fitur yang ingin Anda tuju.",
      rationale: "Pengguna ingin kembali ke halaman dasbor / beranda.",
    };
  }

  // 2b. ADJUST SPEECH SPEED
  if (matchesAnyCluster(cleaned, CLUSTERS.SPEED_SLOWER)) {
    return {
      intent: "ADJUST_SPEECH_SPEED",
      cleanedQuery: cleaned,
      tickers: effectiveTickers,
      spokenResponse: "Baik, tempo suara diperlambat.",
      rationale: "Pengguna meminta asisten berbicara lebih pelan.",
    };
  }
  if (matchesAnyCluster(cleaned, CLUSTERS.SPEED_FASTER)) {
    return {
      intent: "ADJUST_SPEECH_SPEED",
      cleanedQuery: cleaned,
      tickers: effectiveTickers,
      spokenResponse: "Baik, tempo suara dipercepat.",
      rationale: "Pengguna meminta asisten berbicara lebih cepat.",
    };
  }
  if (matchesAnyCluster(cleaned, CLUSTERS.SPEED_NORMAL)) {
    return {
      intent: "ADJUST_SPEECH_SPEED",
      cleanedQuery: cleaned,
      tickers: effectiveTickers,
      spokenResponse: "Tempo suara dikembalikan ke normal.",
      rationale: "Pengguna meminta asisten kembali ke tempo standar.",
    };
  }

  // 2c. WATCHLIST COMMANDS
  if (matchesAnyCluster(cleaned, CLUSTERS.WATCHLIST)) {
    const sym = effectiveTickers[0];
    const isAdd = /tambah|masuk|simpan|taruh/i.test(cleaned);
    return {
      intent: "WATCHLIST_COMMAND",
      cleanedQuery: cleaned,
      tickers: effectiveTickers,
      targetQuery: sym ? (isAdd ? `ADD:${sym}` : `SHOW:${sym}`) : "LIST",
      rationale: sym
        ? `Perintah daftar pantauan untuk saham ${sym}.`
        : "Pengguna menanyakan daftar saham pantauan.",
    };
  }

  // 3. REPLAY / BACA ULANG
  if (matchesAnyCluster(cleaned, CLUSTERS.REPLAY)) {
    return {
      intent: "REPLAY_SUMMARY",
      cleanedQuery: cleaned,
      tickers: effectiveTickers,
      spokenResponse: currentResult?.summary || "Belum ada ringkasan analisis untuk diulangi. Silakan sebutkan kode saham terlebih dahulu.",
      rationale: "Pengguna meminta asisten mengulangi ringkasan analisis terakhir.",
    };
  }

  // 4. PLAY SONIFICATION (Nada Musik Grafik)
  if (matchesAnyCluster(cleaned, CLUSTERS.SONIFICATION)) {
    return {
      intent: "PLAY_SONIFICATION",
      cleanedQuery: cleaned,
      tickers: effectiveTickers,
      rationale: "Pengguna meminta pemutaran nada audio sonifikasi grafik tren.",
    };
  }

  // 5. GLOSSARY (Edukasi Jargon Investasi)
  if (isGlossaryQuery(rawInput) || matchesAnyCluster(cleaned, CLUSTERS.GLOSSARY)) {
    const entry = findGlossaryEntry(rawInput);
    if (entry) {
      return {
        intent: "SWITCH_FEATURE_GLOSSARY",
        cleanedQuery: cleaned,
        tickers: effectiveTickers,
        spokenResponse: `${entry.term}. ${entry.definition} Analogi: ${entry.analogy}`,
        rationale: `Pengguna bertanya definisi jargon: ${entry.term}`,
      };
    }
  }

  // 6. READ SPECIFIC METRICS (from current analysis)
  if (currentResult) {
    // Utang / Solvabilitas (DER / DAR)
    if (matchesAnyCluster(cleaned, CLUSTERS.METRIC_DEBT)) {
      const sym = effectiveTickers[0] || "emiten ini";
      const pts = currentResult.historicalTrend?.points;
      const qp = pts && pts.length > 0 ? pts[pts.length - 1] : null;
      const derVal = qp?.der !== undefined && qp.der !== null ? qp.der : null;
      const text = derVal !== null
        ? `Rasio utang DER untuk ${sym} adalah ${derVal.toFixed(2)} kali. Rasio di bawah satu koma nol menunjukkan kondisi solvabilitas yang sangat aman.`
        : `Rasio utang untuk ${sym} tercatat aman dan terkendali.`;

      return {
        intent: "READ_METRIC",
        cleanedQuery: cleaned,
        tickers: effectiveTickers,
        metricKey: "debt",
        spokenResponse: text,
        rationale: "Pengguna menanyakan informasi utang / rasio DER secara spesifik.",
      };
    }

    // Profitabilitas (ROE / ROA)
    if (matchesAnyCluster(cleaned, CLUSTERS.METRIC_PROFIT)) {
      const sym = effectiveTickers[0] || "emiten ini";
      const pts = currentResult.historicalTrend?.points;
      const qp = pts && pts.length > 0 ? pts[pts.length - 1] : null;
      const roeVal = qp?.roe !== undefined && qp.roe !== null ? qp.roe : null;
      const text = roeVal !== null
        ? `Imbal hasil modal ROE untuk ${sym} adalah ${(roeVal * 100).toFixed(1)} persen. Semakin tinggi persentase ini, semakin efisien perusahaan menghasilkan laba.`
        : `Tingkat profitabilitas ROE ${sym} berada pada rentang yang sehat.`;

      return {
        intent: "READ_METRIC",
        cleanedQuery: cleaned,
        tickers: effectiveTickers,
        metricKey: "profitability",
        spokenResponse: text,
        rationale: "Pengguna menanyakan informasi laba / rasio ROE secara spesifik.",
      };
    }

    // Skor Kesehatan
    if (matchesAnyCluster(cleaned, CLUSTERS.METRIC_SCORE)) {
      const sym = effectiveTickers[0] || "saham ini";
      const hs = currentResult.healthScore;
      const score = hs ? hs.score : (currentResult.portfolio ? currentResult.portfolio.weightedScore : 80);
      const status = hs ? hs.category : (currentResult.portfolio ? currentResult.portfolio.status : "SEHAT");
      return {
        intent: "READ_METRIC",
        cleanedQuery: cleaned,
        tickers: effectiveTickers,
        metricKey: "score",
        spokenResponse: `Skor kesehatan ${sym} adalah ${score} dari 100, dengan predikat ${status}.`,
        rationale: "Pengguna menanyakan nilai skor kesehatan kuantitatif.",
      };
    }
  }

  // 7. SWITCH TO HISTORICAL TREND (Kuartal / Tren)
  if (matchesAnyCluster(cleaned, CLUSTERS.TREND)) {
    const sym = effectiveTickers[0] || "ADRO";
    return {
      intent: "SWITCH_FEATURE_TREND",
      cleanedQuery: cleaned,
      tickers: [sym],
      targetQuery: `tren 4 kuartal ${sym}`,
      rationale: `Beralih ke Analisis Tren Historis 4 kuartal untuk saham ${sym}.`,
    };
  }

  // 8. SWITCH TO PORTFOLIO SIMULATION (Portofolio / Rebalancing)
  if (matchesAnyCluster(cleaned, CLUSTERS.PORTFOLIO)) {
    const nominal = extractNominalAmount(rawInput);
    // If user specified at least 2 tickers, use them. Else use default balanced set
    const portTickers = effectiveTickers.length >= 2
      ? effectiveTickers
      : (effectiveTickers.length === 1 ? [effectiveTickers[0], "TLKM", "ASII"] : ["BBCA", "TLKM", "ASII"]);

    const nominalText = `${Math.round(nominal / 1_000_000)} juta`;
    return {
      intent: "SWITCH_FEATURE_PORTFOLIO",
      cleanedQuery: cleaned,
      tickers: portTickers,
      nominal: nominal,
      targetQuery: `simulasi portofolio ${nominalText} di ${portTickers.join(" ")}`,
      rationale: `Beralih ke Simulasi Portofolio nominal Rp ${nominal.toLocaleString("id-ID")}.`,
    };
  }

  // 9. SWITCH TO SCREENER (Top Saham Sehat)
  if (matchesAnyCluster(cleaned, CLUSTERS.SCREENER)) {
    return {
      intent: "SWITCH_FEATURE_SCREENER",
      cleanedQuery: cleaned,
      tickers: [],
      targetQuery: "top 5 saham paling sehat",
      rationale: "Beralih ke Skrining Top 5 Saham Tersehat di Bursa Efek Indonesia.",
    };
  }

  // 10. SWITCH TO COMPARISON (Bandingkan 2+ Saham)
  if (matchesAnyCluster(cleaned, CLUSTERS.COMPARISON) || effectiveTickers.length >= 2) {
    const syms = effectiveTickers.length >= 2 ? effectiveTickers : ["TLKM", "ISAT"];
    return {
      intent: "SWITCH_FEATURE_COMPARISON",
      cleanedQuery: cleaned,
      tickers: syms,
      targetQuery: `bandingkan ${syms.join(" dan ")}`,
      rationale: `Beralih ke Komparasi Antar Emiten: ${syms.join(" vs ")}.`,
    };
  }

  // 11. SINGLE STOCK HEALTH ANALYSIS
  if (effectiveTickers.length === 1) {
    const sym = effectiveTickers[0];
    return {
      intent: "SWITCH_FEATURE_SINGLE",
      cleanedQuery: cleaned,
      tickers: [sym],
      targetQuery: `analisis fundamental ${sym}`,
      rationale: `Beralih ke Analisis Fundamental Saham Tunggal untuk ${sym}.`,
    };
  }

  // 12. AMBIGUOUS SPEECH DETECTION (Konfirmasi salah dengar)
  // Speech recognition bahasa Indonesia sering salah dengar huruf konsonan mirip.
  const SOUND_ALIKES: Record<string, string> = {
    bebeca: "BBCA",
    bebece: "BBCA",
    bca: "BBCA",
    beberi: "BBRI",
    bebere: "BBRI",
    bri: "BBRI",
    bemeri: "BMRI",
    mandiri: "BMRI",
    telkom: "TLKM",
    telkum: "TLKM",
    indosat: "ISAT",
    adaru: "ADRO",
    adaro: "ADRO",
  };
  for (const [misheard, actualTicker] of Object.entries(SOUND_ALIKES)) {
    if (cleaned.includes(misheard) && !effectiveTickers.includes(actualTicker)) {
      return {
        intent: "CONFIRMATION_FALLBACK",
        cleanedQuery: cleaned,
        tickers: [actualTicker],
        targetQuery: `analisis fundamental ${actualTicker}`,
        spokenResponse: `Maksud Anda saham ${actualTicker}, benar? Jika ya, katakan 'Ya ${actualTicker}' atau sebutkan kembali.`,
        rationale: `Pendengaran ambigu terdeteksi mirip '${misheard}'. Minta konfirmasi untuk ${actualTicker}.`,
      };
    }
  }

  // 13. FALLBACK / FREE-FORM STOCK QUESTION
  return {
    intent: "STOCK_QUERY",
    cleanedQuery: cleaned,
    tickers: effectiveTickers,
    targetQuery: rawInput,
    rationale: "Pertanyaan bebas atau kode saham akan diteruskan ke mesin analisis WINI.",
  };
}

// --------------------------------------------------------------------------
// 6. Voice Guidance Builder (TTS Friendly)
// --------------------------------------------------------------------------
export function generateHelpSpokenResponse(): string {
  return (
    "WINI AI memiliki enam fitur utama yang dapat Anda akses kapan saja melalui perintah suara. " +
    "Pertama, Analisis Saham Tunggal, ucapkan misalnya: Bagaimana kesehatan BBCA. " +
    "Kedua, Tren Historis Kuartal dan nada grafik audio, ucapkan: Lihat tren kuartal ADRO. " +
    "Ketiga, Simulasi Portofolio dan saran rebalancing, ucapkan: Simulasi 10 juta di BBCA, TLKM, dan ASII. " +
    "Keempat, Komparasi Saham, ucapkan: Bandingkan TLKM dan ISAT. " +
    "Kelima, Skrining Top Saham, ucapkan: Cari top 5 saham paling sehat. " +
    "Dan keenam, Kamus Finansial, tanyakan: Apa itu DER, atau Jelaskan rasio ROE. " +
    "Anda juga bisa mengatakan: Berapa utangnya, Ulangi ringkasan, atau Kembali ke awal."
  );
}
