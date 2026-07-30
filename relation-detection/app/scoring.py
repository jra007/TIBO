from itertools import combinations

from rapidfuzz.distance import JaroWinkler

from .models import ColumnProfile, RelationCandidate

NAME_WEIGHT = 0.25
TYPE_WEIGHT = 0.15
CARDINALITY_WEIGHT = 0.20
CONTAINMENT_WEIGHT = 0.40


def name_similarity(a: str, b: str) -> float:
    return JaroWinkler.normalized_similarity(a.lower(), b.lower())


def type_compatible(a: ColumnProfile, b: ColumnProfile) -> bool:
    return a.dtype == b.dtype


def cardinality_score(a: ColumnProfile, b: ColumnProfile) -> float:
    """Favors pairs where at least one side looks like a candidate key (foreign-key-to-primary-key shape)."""
    ratio_a = a.unique_count / a.row_count if a.row_count else 0
    ratio_b = b.unique_count / b.row_count if b.row_count else 0
    return max(ratio_a, ratio_b)


def containment(a: ColumnProfile, b: ColumnProfile) -> float:
    set_a, set_b = set(a.sample_values), set(b.sample_values)
    if not set_a or not set_b:
        return 0.0
    smaller = min(len(set_a), len(set_b))
    return len(set_a & set_b) / smaller if smaller else 0.0


def score_pair(a: ColumnProfile, b: ColumnProfile) -> RelationCandidate:
    name_sim = name_similarity(a.column, b.column)
    compatible = type_compatible(a, b)
    card_score = cardinality_score(a, b)
    contain = containment(a, b)

    confidence = (
        NAME_WEIGHT * name_sim
        + TYPE_WEIGHT * (1.0 if compatible else 0.0)
        + CARDINALITY_WEIGHT * card_score
        + CONTAINMENT_WEIGHT * contain
    )

    return RelationCandidate(
        source_table=a.table,
        source_column=a.column,
        target_table=b.table,
        target_column=b.column,
        confidence_score=round(confidence, 4),
        name_similarity=round(name_sim, 4),
        type_compatible=compatible,
        cardinality_score=round(card_score, 4),
        containment=round(contain, 4),
    )


def detect_relations(columns: list[ColumnProfile]) -> list[RelationCandidate]:
    candidates = [
        score_pair(a, b)
        for a, b in combinations(columns, 2)
        if a.table != b.table
    ]
    return sorted(candidates, key=lambda c: c.confidence_score, reverse=True)
