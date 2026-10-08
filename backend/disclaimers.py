"""Static compliance disclaimer appended to all analysis responses."""


INVESTMENT_DISCLAIMER = (
    "⚠️ Disclaimer Kepatuhan: Analisis yang dihasilkan oleh WINI AI "
    "adalah informasi edukatif berbasis data historis dan model kuantitatif. Ini BUKAN merupakan "
    "rekomendasi atau nasihat investasi. Selalu lakukan riset mandiri dan berkonsultasi dengan "
    "penasihat keuangan berizin OJK sebelum mengambil keputusan investasi. "
    "Kinerja masa lalu tidak menjamin hasil di masa depan."
)


def get_disclaimer() -> str:
    """Return the static investment disclaimer text."""
    return INVESTMENT_DISCLAIMER
