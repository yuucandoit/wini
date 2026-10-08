"""Tes guardrail & edge case scoring. Jalankan: .venv/bin/python -m tests.test_guardrail_scoring
(atau pytest bila terpasang). Juga berfungsi sebagai skrip demo penolakan narasi."""

from backend.guardrail import verify_narrative, build_deterministic_narrative
from backend.scoring import calculate_health_score, is_financial_sector

TRUTH = {
    "health_scores": {
        "BBCA": {"score": 88, "status": "SANGAT SEHAT", "metrics_evaluated": {"der_mrq": 4.8, "roe_ttm": 0.213}},
    }
}


def test_guardrail_accepts_correct_narrative():
    r = verify_narrative("BBCA memperoleh skor 88 dari 100 dengan ROE 21,3 persen dan DER 4,8.", TRUTH)
    assert r["passed"], r


def test_guardrail_rejects_wrong_score():
    r = verify_narrative("BBCA memperoleh skor 97 dari 100 dengan status SANGAT SEHAT.", TRUTH)
    assert not r["passed"] and "97" in r["unverified"], r


def test_guardrail_rejects_invented_ratio():
    r = verify_narrative("ROE BBCA mencapai 35,7 persen.", TRUTH)
    assert not r["passed"], r


def test_deterministic_replacement_has_only_verified_numbers():
    text = build_deterministic_narrative(
        {"BBCA": {"score": 88, "status": "SANGAT SEHAT", "metrics_coverage": 1.0, "notes": []}}
    )
    assert verify_narrative(text, TRUTH)["passed"]


def test_negative_pe_and_equity_flagged():
    res = calculate_health_score({"der_mrq": -0.5, "roe_ttm": -0.1, "pe_ttm": -8.0})
    assert res.breakdown["pe_ttm"]["score"] == 0.0
    assert res.breakdown["der_mrq"]["score"] == 0.0
    assert any("merugi" in n for n in res.notes)
    assert any("Ekuitas" in n for n in res.notes)


def test_empty_data_is_explicit():
    res = calculate_health_score({})
    assert res.metrics_coverage == 0.0 and res.score == 0
    assert any("tidak tersedia" in n for n in res.notes)


def test_bank_not_penalised_like_non_financial():
    m = {"der_mrq": 5.4, "roe_ttm": 0.17, "roa_ttm": 0.026, "dar_mrq": 0.08, "pe_ttm": 8.0}
    generic = calculate_health_score(m)
    bank = calculate_health_score(m, sector="Financials")
    assert is_financial_sector("Keuangan") and not is_financial_sector("Energy")
    assert bank.breakdown["der_mrq"]["score"] == 30.0
    assert generic.breakdown["der_mrq"]["score"] == 5.0
    assert bank.score > generic.score


if __name__ == "__main__":
    bad = "BBCA memperoleh skor 97 dari 100 dengan ROE 35,7 persen."
    print("DEMO narasi salah:", bad)
    print("Hasil guardrail  :", verify_narrative(bad, TRUTH))
    for name, fn in list(globals().items()):
        if name.startswith("test_"):
            fn()
            print("OK", name)
