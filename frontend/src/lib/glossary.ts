/**
 * WINI AI — Kamus Jargon Investasi Saham
 *
 * Lookup table of financial terms with:
 * - Plain Indonesian definitions
 * - Everyday analogy for accessibility (tunanetra / pemula)
 * - TTS-friendly text (no symbols, no markdown)
 */

export interface GlossaryEntry {
  term: string;
  /** Short plain-text definition in Indonesian */
  definition: string;
  /** Everyday analogy to help non-experts understand */
  analogy: string;
  /** Keywords that trigger this entry (lowercase) */
  keywords: string[];
}

export const GLOSSARY: GlossaryEntry[] = [
  {
    term: "DER (Debt to Equity Ratio)",
    definition:
      "Rasio utang terhadap modal sendiri. Menunjukkan seberapa besar perusahaan menggunakan utang dibandingkan uang milik sendiri untuk menjalankan bisnis.",
    analogy:
      "Bayangkan kamu punya uang tabungan 10 juta, lalu pinjam 15 juta dari bank. DER kamu adalah 1,5 — artinya utangmu lebih besar dari tabunganmu sendiri. Makin kecil DER, makin aman.",
    keywords: ["der", "debt to equity", "rasio utang", "utang modal", "leverage"],
  },
  {
    term: "ROE (Return on Equity)",
    definition:
      "Tingkat pengembalian atas modal sendiri. Mengukur seberapa efisien perusahaan menghasilkan keuntungan dari uang pemegang saham.",
    analogy:
      "Kamu menaruh 10 juta di deposito dan mendapat bunga 2 juta per tahun. ROE kamu 20 persen. Semakin tinggi ROE suatu perusahaan, semakin pintar perusahaan itu mengolah uang investor.",
    keywords: ["roe", "return on equity", "pengembalian ekuitas", "imbal ekuitas"],
  },
  {
    term: "ROA (Return on Assets)",
    definition:
      "Tingkat pengembalian atas total aset. Mengukur seberapa efisien perusahaan menggunakan seluruh asetnya untuk menghasilkan laba.",
    analogy:
      "Kamu punya warung senilai 50 juta (termasuk etalase, kulkas, stok). Kalau labamu 5 juta per tahun, ROA kamu 10 persen. Semakin tinggi ROA, semakin produktif aset perusahaan.",
    keywords: ["roa", "return on assets", "pengembalian aset", "imbal aset"],
  },
  {
    term: "DAR (Debt to Asset Ratio)",
    definition:
      "Proporsi total aset yang dibiayai oleh utang. Semakin rendah, semakin besar porsi aset yang dimiliki dengan modal sendiri.",
    analogy:
      "Kamu beli rumah seharga 500 juta, tapi 350 juta dari KPR bank. DAR kamu 70 persen — artinya 70 persen rumah itu masih milik bank. Idealnya DAR di bawah 50 persen.",
    keywords: ["dar", "debt to asset", "rasio utang aset", "liabilitas aset"],
  },
  {
    term: "PER / PE Ratio (Price to Earnings Ratio)",
    definition:
      "Perbandingan harga saham terhadap laba per saham. Menunjukkan berapa tahun yang dibutuhkan investor untuk balik modal dari laba perusahaan.",
    analogy:
      "Kalau PER saham adalah 15, artinya kamu butuh 15 tahun supaya laba perusahaan bisa 'membayar kembali' harga yang kamu bayar untuk beli sahamnya. PER rendah bisa berarti saham murah, PER tinggi bisa berarti investor berharap besar pada pertumbuhan.",
    keywords: ["per", "pe ratio", "price to earnings", "harga laba", "valuasi", "mahal murah saham"],
  },
  {
    term: "PBV / PB Ratio (Price to Book Value)",
    definition:
      "Perbandingan harga saham terhadap nilai buku perusahaan per saham. PBV di bawah 1 berarti saham diperdagangkan di bawah nilai aset bersihnya.",
    analogy:
      "Bayangkan kamu bisa beli toko senilai 100 juta hanya dengan harga 80 juta. Berarti PBV kurang dari 1 — kamu dapat aset lebih murah dari harga wajarnya. Namun perlu dicek kenapa bisa semurah itu.",
    keywords: ["pbv", "pb ratio", "price to book", "nilai buku", "book value"],
  },
  {
    term: "Dividend Yield (Imbal Hasil Dividen)",
    definition:
      "Persentase dividen yang dibagikan perusahaan terhadap harga sahamnya. Mengukur seberapa besar penghasilan tunai yang kamu terima dari investasi.",
    analogy:
      "Kalau saham harganya 1000 rupiah dan dividen per tahun 50 rupiah, dividend yield adalah 5 persen. Seperti bunga deposito, tapi datang dari keuntungan perusahaan yang kamu ikut miliki.",
    keywords: ["dividend", "dividen", "yield", "imbal hasil", "passive income", "kupon"],
  },
  {
    term: "Market Cap (Kapitalisasi Pasar)",
    definition:
      "Total nilai pasar seluruh saham perusahaan yang beredar. Dihitung dari harga saham dikali jumlah saham yang ada.",
    analogy:
      "Kalau harga saham BBCA adalah 9000 rupiah dan ada 100 juta lembar saham beredar, market cap BBCA adalah 900 miliar rupiah. Ini gambaran seberapa besar nilai total perusahaan di mata pasar.",
    keywords: ["market cap", "kapitalisasi", "nilai pasar", "ukuran perusahaan"],
  },
  {
    term: "Revenue Growth (Pertumbuhan Pendapatan)",
    definition:
      "Persentase pertumbuhan pendapatan perusahaan dibandingkan periode sebelumnya (biasanya tahun ke tahun atau kuartal ke kuartal).",
    analogy:
      "Warungmu tahun lalu omzetnya 100 juta, tahun ini 120 juta. Revenue growth kamu 20 persen. Perusahaan yang terus tumbuh pendapatannya lebih menjanjikan jangka panjang.",
    keywords: ["revenue growth", "pertumbuhan pendapatan", "omzet tumbuh", "yoy revenue"],
  },
  {
    term: "EPS (Earnings Per Share / Laba Per Saham)",
    definition:
      "Laba bersih perusahaan dibagi jumlah saham beredar. Menunjukkan berapa keuntungan yang 'menjadi milik' tiap lembar saham.",
    analogy:
      "Perusahaan untung 100 miliar dan punya 10 miliar lembar saham. EPS-nya adalah 10 rupiah per saham. Makin tinggi EPS, makin besar bagian keuntungan untuk setiap lembar sahammu.",
    keywords: ["eps", "earnings per share", "laba per saham", "profit per saham"],
  },
  {
    term: "Fundamental Analisis",
    definition:
      "Metode penilaian saham berdasarkan kondisi keuangan dan bisnis nyata perusahaan, bukan pergerakan harga pasar.",
    analogy:
      "Seperti kamu menilai sebuah toko bukan dari seberapa ramai pembelinya hari ini, tapi dari laporan keuangannya: apakah untung? apakah utangnya wajar? apakah asetnya tumbuh?",
    keywords: ["fundamental", "analisis fundamental", "laporan keuangan", "kondisi perusahaan"],
  },
  {
    term: "Likuiditas",
    definition:
      "Kemampuan perusahaan untuk memenuhi kewajiban jangka pendek menggunakan aset yang mudah dicairkan (seperti kas dan setara kas).",
    analogy:
      "Kamu punya aset berupa tanah senilai 1 miliar, tapi butuh bayar utang 50 juta minggu ini. Kalau tidak punya uang tunai, kamu tidak likuid meski kaya. Perusahaan yang likuid bisa bayar tagihan tepat waktu.",
    keywords: ["likuiditas", "liquid", "current ratio", "kas", "bayar utang"],
  },
  {
    term: "Solvabilitas",
    definition:
      "Kemampuan perusahaan untuk memenuhi semua kewajiban jangka panjang, tidak hanya kewajiban jangka pendek.",
    analogy:
      "Beda dengan likuiditas yang soal bayar tagihan bulan ini, solvabilitas soal apakah perusahaan mampu bertahan dan melunasi semua utangnya dalam jangka panjang — termasuk 5 sampai 10 tahun ke depan.",
    keywords: ["solvabilitas", "solvency", "kemampuan bayar utang", "jangka panjang"],
  },
];

/**
 * Find a glossary entry by user's natural language input.
 * Returns the best matching entry, or null if nothing found.
 */
export function findGlossaryEntry(userText: string): GlossaryEntry | null {
  const lower = userText.toLowerCase();
  // Score each entry by how many keywords match
  let best: GlossaryEntry | null = null;
  let bestScore = 0;

  for (const entry of GLOSSARY) {
    let score = 0;
    for (const kw of entry.keywords) {
      if (lower.includes(kw)) score++;
    }
    if (score > bestScore) {
      bestScore = score;
      best = entry;
    }
  }

  return bestScore > 0 ? best : null;
}

/**
 * Build a TTS-friendly explanation string for a glossary entry.
 */
export function buildGlossarySpeak(entry: GlossaryEntry): string {
  return (
    `${entry.term}. ` +
    `${entry.definition} ` +
    `Analogi sehari-hari: ${entry.analogy}`
  );
}

/**
 * Check if user query is asking for a glossary explanation.
 * Triggers on phrases like "apa itu", "jelaskan", "maksud", "artinya", "definisi"
 */
export function isGlossaryQuery(text: string): boolean {
  const lower = text.toLowerCase();
  const triggers = [
    "apa itu", "apa yang dimaksud", "jelaskan", "definisi",
    "artinya apa", "maksudnya", "apa arti", "pengertian",
    "explain", "what is",
  ];
  return triggers.some((t) => lower.includes(t));
}
