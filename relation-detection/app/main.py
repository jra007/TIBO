from fastapi import FastAPI

from .models import ScoreRequest, ScoreResponse
from .scoring import detect_relations

app = FastAPI(title="TIBO relation-detection")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/score", response_model=ScoreResponse)
def score(request: ScoreRequest) -> ScoreResponse:
    return ScoreResponse(candidates=detect_relations(request.columns))
