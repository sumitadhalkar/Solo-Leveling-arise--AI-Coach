"""Confidence-score computation for the background meta-snapshot worker."""
from app.workers.snapshot import _compute_confidence


def test_confidence_zero_for_empty_data():
    assert _compute_confidence({}) == 0.0


def test_confidence_full_score():
    data = {
        "authoritative": {"patch": "2.5.0", "new_hunters": ["A"], "active_banners": ["B"]},
        "meta_reference": {"tier_ss": ["C"], "upcoming_banners": ["D"]},
    }
    assert _compute_confidence(data) == 1.0


def test_confidence_partial_score_patch_only():
    data = {"authoritative": {"patch": "2.5.0"}, "meta_reference": {}}
    assert _compute_confidence(data) == 0.30


def test_confidence_below_threshold_triggers_search_fallback():
    """The pipeline treats confidence < 0.5 as 'search anyway' — verify the
    boundary value used there actually produces a sub-0.5 score here."""
    data = {"authoritative": {"patch": "2.5.0", "active_banners": ["B"]}, "meta_reference": {}}
    assert _compute_confidence(data) == 0.40 < 0.5
