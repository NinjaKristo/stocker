"""Tests for explainable Backplay peer-screen generation."""

import pytest

from app.services.backplay.similarity import generate_peer_screens


def stock(symbol, **overrides):
    return {
        "symbol": symbol,
        "company_name": symbol,
        "rs_rating": 90,
        "composite_score": 88,
        "adr_percent": 3.0,
        "beta": 1.1,
        "stage": 2,
        "se_setup_score": 80,
        "se_distance_to_pivot_pct": 2,
        "eps_growth_qq": 35,
        "sales_growth_qq": 25,
        "eps_rating": 91,
        "market_cap_usd": 50_000_000_000,
        "ibd_industry_group": "Computer Software",
        "ibd_group_rank": 12,
        "gics_sector": "Technology",
        "gics_industry": "Software",
        **overrides,
    }


def test_generates_three_ranked_explainable_peer_screens():
    rows = [
        stock("TARGET"),
        stock("TWIN", rs_rating=89, composite_score=87),
        stock(
            "DISTANT",
            rs_rating=20,
            composite_score=25,
            adr_percent=12,
            stage=4,
            eps_growth_qq=-50,
            sales_growth_qq=-40,
            ibd_industry_group="Banks",
            gics_sector="Financials",
            gics_industry="Banks",
        ),
    ]

    result = generate_peer_screens(rows, "target", limit=5)

    assert result["symbol"] == "TARGET"
    assert [screen["id"] for screen in result["strategies"]] == [
        "technical_twins",
        "growth_peers",
        "group_leaders",
    ]
    for screen in result["strategies"]:
        assert screen["candidates"][0]["symbol"] == "TWIN"
        assert len(screen["candidates"][0]["evidence"]) <= 3
    assert result["strategies"][0]["candidates"][0]["similarity"] > result["strategies"][0]["candidates"][1]["similarity"]
    assert [candidate["symbol"] for candidate in result["strategies"][2]["candidates"]] == ["TWIN"]


def test_handles_sparse_rows_without_treating_missing_values_as_matches():
    result = generate_peer_screens(
        [stock("TARGET"), {"symbol": "SPARSE", "rs_rating": 90}],
        "TARGET",
    )
    assert all(not screen["candidates"] for screen in result["strategies"])


def test_excludes_target_and_respects_limit():
    rows = [stock("TARGET")] + [stock(f"S{i}", rs_rating=90 - i) for i in range(8)]
    result = generate_peer_screens(rows, "TARGET", limit=3)
    assert all(len(screen["candidates"]) == 3 for screen in result["strategies"])
    assert all(
        candidate["symbol"] != "TARGET"
        for screen in result["strategies"]
        for candidate in screen["candidates"]
    )


def test_unknown_target_is_rejected():
    with pytest.raises(ValueError, match="not present"):
        generate_peer_screens([stock("OTHER")], "MISSING")


def test_market_cap_evidence_uses_dollars_not_logarithmic_scoring_value():
    result = generate_peer_screens(
        [
            {"symbol": "TARGET", "market_cap_usd": 50_000_000_000, "rs_rating": 90},
            {"symbol": "PEER", "market_cap_usd": 50_000_000_000, "rs_rating": 89},
        ],
        "TARGET",
    )
    evidence = result["strategies"][1]["candidates"][0]["evidence"]
    assert any("5e+10" in detail for detail in evidence)
