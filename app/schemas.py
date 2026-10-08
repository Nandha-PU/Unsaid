from typing import Any
from pydantic import BaseModel, Field, field_validator


class DiagnoseRequest(BaseModel):
    draft: str = Field(
        ...,
        min_length=15,
        max_length=3000,
        description="The student's raw drafted message to evaluate.",
    )
    situation: str = Field(
        default="Requesting a deadline extension",
        min_length=2,
        max_length=200,
        description="Dynamic user-defined situation (e.g., 'Asking for extension', 'Grade query', 'Office hours request').",
    )
    recipient: str = Field(
        default="Professor",
        min_length=2,
        max_length=100,
        description="Dynamic user-defined recipient (e.g., 'Professor', 'TA', 'Department Chair', 'Advisor').",
    )

    scene: dict[str, Any] | None = Field(
        default=None,
        description="Optional confirmed scene model from /context step.",
    )
    model: str | None = Field(
        default=None,
        description="Optional model identifier override (e.g., gemini-3.5-flash, fake).",
    )

    @field_validator("draft")
    @classmethod
    def validate_draft_not_whitespace(cls, v: str) -> str:
        clean = v.strip()
        if len(clean) < 15:
            raise ValueError("Draft must be at least 15 non-whitespace characters.")
        return clean

    @field_validator("model")
    @classmethod
    def validate_model_name(cls, v: str | None) -> str | None:
        if not v:
            return None
        clean = v.strip()
        allowed = {
            "gemini-3.1-flash-lite",
            "gemini-3.5-flash",
            "gemini-3.6-flash",
            "gemini-3.8-flash",
            "fake",
        }
        if clean in allowed or "gemini" in clean.lower():
            return clean
        return "gemini-3.1-flash-lite"


class RewriteRequest(BaseModel):
    draft: str = Field(
        ...,
        min_length=15,
        max_length=3000,
        description="The student's message to rewrite.",
    )
    situation: str = Field(
        default="Requesting a deadline extension",
        min_length=2,
        max_length=200,
        description="Dynamic user-defined situation.",
    )
    recipient: str = Field(
        default="Professor",
        min_length=2,
        max_length=100,
        description="Dynamic user-defined recipient.",
    )
    scene: dict[str, Any] | None = Field(
        default=None,
        description="Optional confirmed scene model from /context step.",
    )
    model: str | None = Field(
        default=None,
        description="Optional model identifier override.",
    )

    @field_validator("draft")
    @classmethod
    def validate_draft_not_whitespace(cls, v: str) -> str:
        clean = v.strip()
        if len(clean) < 15:
            raise ValueError("Draft must be at least 15 non-whitespace characters.")
        return clean

    @field_validator("model")
    @classmethod
    def validate_model_name(cls, v: str | None) -> str | None:
        if not v:
            return None
        clean = v.strip()
        allowed = {
            "gemini-3.1-flash-lite",
            "gemini-3.5-flash",
            "gemini-3.6-flash",
            "gemini-3.8-flash",
            "fake",
        }
        if clean in allowed or "gemini" in clean.lower():
            return clean
        return "gemini-3.1-flash-lite"


class ScoreDetail(BaseModel):
    value: int = Field(..., ge=1, le=5, description="Score on a 1-5 scale.")
    target_min: int = Field(default=4, ge=1, le=5)
    target_max: int = Field(default=5, ge=1, le=5)


class DimensionDetail(BaseModel):
    id: str
    label: str
    description: str
    value: int
    target_min: int
    target_max: int


class Scores(BaseModel):
    clarity: ScoreDetail
    accountability: ScoreDetail
    warmth: ScoreDetail
    formality: ScoreDetail
    proportion: ScoreDetail


class Flag(BaseModel):
    text: str = Field(..., description="Verbatim phrase in the draft that raises concern.")
    reason: str = Field(..., description="Why a professor or recipient reads this negatively.")
    principle: str = Field(..., description="Short named communication principle.")
    nudge: str = Field(..., description="Concrete direction on how to fix.")
    dimension_id: str | None = Field(default=None, description="Linked dimension ID for score bar highlighting.")


class DiagnoseResponse(BaseModel):
    request_id: str
    prompt_version: str
    rubric_version: str
    verdict: str
    scores: Scores
    overall: int = Field(default=50, ge=0, le=100, description="Deterministic overall tone score 0-100.")
    dimensions: list[DimensionDetail] = Field(default_factory=list)
    flags: list[Flag] = Field(default_factory=list)


class SceneData(BaseModel):
    relationship: str = "superior"
    power: str = "recipient_higher"
    closeness: str = "distant"
    intent: str = "request"
    stakes: str = "medium"
    channel: str = "email"
    summary: str


class ContextRequest(BaseModel):
    draft: str = Field(..., min_length=1, max_length=3000)
    recipient: str | None = None
    situation: str | None = None
    goal: str | None = None


class ContextResponse(BaseModel):
    request_id: str
    prompt_version: str = "context.v1"
    status: str = "ok"  # ok | needs_clarification | sensitive | refused
    scene: SceneData | None = None
    clarifying_question: str | None = None
    message: str | None = None


class ChangeItem(BaseModel):
    from_text: str = Field(..., alias="from")
    to_text: str = Field(..., alias="to")
    reason: str
    principle: str

    model_config = {"populate_by_name": True}


class RewriteResponse(BaseModel):
    request_id: str
    prompt_version: str
    rubric_version: str
    rewrite: str
    changes: list[ChangeItem] = Field(default_factory=list)
    takeaway: str
    new_facts_introduced: list[str] = Field(
        default_factory=list,
        description="List of unverified assumptions introduced by AI, if any.",
    )


class ErrorDetail(BaseModel):
    code: str
    message: str


class ErrorResponse(BaseModel):
    error: ErrorDetail
