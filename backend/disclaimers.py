"""Static compliance disclaimer appended to all analysis responses."""


INVESTMENT_DISCLAIMER = (
    "⚠️ Disclaimer Investasi: Analisis yang dihasilkan oleh WINI AI "
    "didasarkan pada data historis dan model kuantitatif. Ini BUKAN merupakan "
    "saran investasi. Selalu lakukan riset mandiri dan konsultasikan dengan "
    "penasihat keuangan berlisensi sebelum mengambil keputusan investasi. "
    "Kinerja masa lalu tidak menjamin hasil di masa depan."
)


def get_disclaimer() -> str:
    """Return the static investment disclaimer text."""
    return INVESTMENT_DISCLAIMER
