from typing import Literal

from pydantic import BaseModel

ColumnType = Literal["text", "date", "numeric", "boolean"]


class ColumnProfile(BaseModel):
    table: str
    column: str
    dtype: ColumnType
    row_count: int
    unique_count: int
    # Sampled distinct values, used for name-independent overlap scoring (Jaccard/containment).
    sample_values: list[str]


class ScoreRequest(BaseModel):
    columns: list[ColumnProfile]


class RelationCandidate(BaseModel):
    source_table: str
    source_column: str
    target_table: str
    target_column: str
    confidence_score: float
    name_similarity: float
    type_compatible: bool
    cardinality_score: float
    containment: float


class ScoreResponse(BaseModel):
    candidates: list[RelationCandidate]
