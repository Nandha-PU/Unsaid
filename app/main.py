import logging
import threading
import time
import uuid
from pathlib import Path
from fastapi import FastAPI, Depends, Request, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.exceptions import RequestValidationError
from pydantic import BaseModel, field_validator

from app.config import Settings, settings
from app.llm import LLMClient, build_client
from app.pipeline import Pipeline, PipelineError
from app.safety import evaluate_safety
from app.schemas import (
    DiagnoseRequest,
    DiagnoseResponse,
    RewriteRequest,
    RewriteResponse,
    ErrorResponse,
    ErrorDetail,
    ContextRequest,
    ContextResponse,
    SceneData,
)
from app.audit import log_audit

logger = logging.getLogger("say_it_right")

app = FastAPI(
    title="Say It Right",
    version="0.1.0",
    description="Auditable AI Communication Coach for University Students and Professionals",
)

# Security Headers Middleware
@app.middleware("http")
async def security_headers_middleware(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    return response

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)

# Dependency Providers
def get_settings() -> Settings:
    return settings


def get_llm(cfg: Settings = Depends(get_settings)) -> LLMClient:
    return build_client(cfg)


def get_pipeline(
    cfg: Settings = Depends(get_settings), llm: LLMClient = Depends(get_llm)
) -> Pipeline:
    return Pipeline(cfg, llm)


# Thread-safe in-memory sliding window rate limiter with auto-eviction
_ip_requests: dict[str, list[float]] = {}
_rate_limit_lock = threading.Lock()


def check_rate_limit(request: Request, cfg: Settings = Depends(get_settings)):
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        client_ip = forwarded.split(",")[0].strip()
    else:
        client_ip = request.client.host if request.client else "unknown"

    now = time.time()
    window = 60.0  # 1 minute

    with _rate_limit_lock:
        # Periodic pruning to prevent memory leaks
        if len(_ip_requests) > 1000:
            stale_ips = [
                ip for ip, reqs in _ip_requests.items()
                if not reqs or now - reqs[-1] >= window
            ]
            for ip in stale_ips:
                _ip_requests.pop(ip, None)

        timestamps = [t for t in _ip_requests.get(client_ip, []) if now - t < window]
        if len(timestamps) >= cfg.rate_limit_per_min:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Rate limit exceeded. Please wait a minute before analyzing another draft.",
            )
        timestamps.append(now)
        _ip_requests[client_ip] = timestamps


# Custom Exception Handlers
@app.exception_handler(PipelineError)
async def pipeline_error_handler(request: Request, exc: PipelineError):
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": {"code": exc.code, "message": exc.message}},
    )


@app.exception_handler(RequestValidationError)
async def validation_error_handler(request: Request, exc: RequestValidationError):
    first_err = exc.errors()[0] if exc.errors() else {}
    msg = first_err.get("msg", "Invalid request body.")
    loc = " -> ".join(str(l) for l in first_err.get("loc", []))
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"error": {"code": "invalid_input", "message": f"{loc}: {msg}"}},
    )


@app.exception_handler(HTTPException)
async def http_error_handler(request: Request, exc: HTTPException):
    code = "rate_limited" if exc.status_code == 429 else "http_error"
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": {"code": code, "message": str(exc.detail)}},
    )


class SetModelRequest(BaseModel):
    model: str

    @field_validator("model")
    @classmethod
    def validate_model_name(cls, v: str) -> str:
        clean = v.strip()
        allowed = {"gemini-3.1-flash-lite", "gemini-3.5-flash", "gemini-3.6-flash", "gemini-3.8-flash", "fake"}
        if clean in allowed or "gemini" in clean.lower():
            return clean
        return "gemini-3.1-flash-lite"


@app.get("/health")
def health(cfg: Settings = Depends(get_settings)):
    return {
        "status": "ok",
        "provider": cfg.llm_provider,
        "model": cfg.llm_model,
        "environment": cfg.environment,
    }


@app.get("/models")
def get_models(cfg: Settings = Depends(get_settings)):
    models = ["gemini-3.1-flash-lite", "gemini-3.5-flash", "gemini-3.6-flash", "fake"]
    if cfg.llm_model not in models:
        models.insert(0, cfg.llm_model)
    return {
        "models": models,
        "active": cfg.llm_model,
        "provider": cfg.llm_provider,
    }


@app.post("/model")
def set_model_route(
    req: SetModelRequest,
    cfg: Settings = Depends(get_settings),
):
    target_model = req.model.strip()
    provider = "fake" if target_model == "fake" else "gemini"
    return {"status": "ok", "provider": provider, "model": target_model}


class SuggestSituationsRequest(BaseModel):
    recipient: str
    model: str | None = None


@app.post("/suggest-situations")
def suggest_situations_route(
    req: SuggestSituationsRequest,
    cfg: Settings = Depends(get_settings),
):
    recipient = (req.recipient or "").strip()
    if not recipient:
        return {"recipient": "", "situations": []}

    # Safety check on recipient input
    safety_status, _ = evaluate_safety(recipient)
    if safety_status == "refused":
        return {
            "recipient": "Colleague",
            "situations": [
                "Clarifying Professional Expectations",
                "Requesting Formal Meeting",
                "Aligning on Project Scope",
            ],
        }

    # Use request-scoped LLM client without global mutation
    active_llm = build_client(cfg, model=req.model)
    provider_name = getattr(active_llm, "provider", cfg.llm_provider)

    # If mock / offline
    if provider_name == "fake":
        return {
            "recipient": recipient,
            "situations": [
                f"Clarifying expectations with {recipient}",
                f"Requesting urgent feedback from {recipient}",
                f"Addressing an unresolved dispute",
                f"Setting a firm personal boundary",
                f"Negotiating terms or timeline",
                f"Delivering unexpected news politely",
            ],
        }

    prompt = (
        f"You are an expert communication coach. A user needs to write a delicate, high-stakes, or important message to this recipient: '{recipient}'.\n"
        f"Generate 5 to 6 realistic, specific, and common high-stakes communication situations or dilemmas someone would face when messaging this specific person.\n"
        f"Each situation MUST be a concise phrase of 2 to 6 words (e.g., 'Addressing Micromanagement', 'Requesting Extension', 'Disputing Deposit Deduction', 'Setting Personal Boundaries').\n"
        f"Return ONLY a JSON array of strings, for example:\n"
        f"[\"Situation 1\", \"Situation 2\", \"Situation 3\", \"Situation 4\", \"Situation 5\"]\n"
        f"Do not include any explanation or markdown formatting."
    )

    try:
        resp = active_llm.generate(
            system="You are an expert communication coach. You MUST respond with ONLY a valid, parseable JSON array of strings.",
            user=prompt,
            max_tokens=600,
            temperature=0.3,
        )
        raw = resp.text
        import json
        text = raw.strip()
        if text.startswith("```"):
            lines = text.splitlines()
            text = "\n".join([l for l in lines if not l.startswith("```")]).strip()
        situations = json.loads(text)
        if isinstance(situations, list) and len(situations) > 0:
            cleaned = [str(s).strip() for s in situations if str(s).strip()][:6]
            return {"recipient": recipient, "situations": cleaned}
    except Exception as e:
        logger.warning(f"Could not generate dynamic situations via LLM: {e}")

    return {
        "recipient": recipient,
        "situations": [
            "Setting a Firm Boundary",
            "Delivering Unexpected News",
            "Clarifying a Misunderstanding",
            "Requesting Timeline Adjustment",
            "Polite But Resolute Refusal",
            "Addressing Unfair Expectations",
        ],
    }


@app.get("/meta")
def meta_route():
    return {
        "relationship": [
            {"id": "superior", "label": "Someone senior to me (Manager / Professor / Department Chair)"},
            {"id": "client", "label": "External Client / Partner"},
            {"id": "ta", "label": "Teaching Assistant (TA)"},
            {"id": "advisor", "label": "Academic Advisor / Counselor"},
            {"id": "peer", "label": "A peer, colleague, or project partner"},
            {"id": "landlord", "label": "Landlord / Service Provider"},
        ],
        "power": [
            {"id": "recipient_higher", "label": "They have more power than me"},
            {"id": "equal", "label": "Equal power dynamic"},
            {"id": "sender_higher", "label": "I have more power"},
        ],
        "closeness": [
            {"id": "distant", "label": "We are not close / formal acquaintance"},
            {"id": "moderate", "label": "We interact occasionally"},
            {"id": "close", "label": "We know each other well"},
        ],
        "intent": [
            {"id": "request", "label": "Asking for something (deadline extension, extra help, raise)"},
            {"id": "query", "label": "Questioning or clarifying a grade, score, or decision"},
            {"id": "apology", "label": "Explaining a delay / apology"},
            {"id": "dispute", "label": "Politely disputing an assessment or policy issue"},
            {"id": "boundary", "label": "Setting a firm boundary or declining respectfully"},
        ],
        "stakes": [
            {"id": "low", "label": "Low stakes"},
            {"id": "medium", "label": "Medium stakes"},
            {"id": "high", "label": "High stakes (affects career, grade, or relationship standing)"},
        ],
        "channel": [
            {"id": "email", "label": "Formal Email"},
            {"id": "slack", "label": "Slack / Teams / Direct Message"},
            {"id": "lms", "label": "Canvas / Course Portal"},
        ],
    }


@app.post("/context", response_model=ContextResponse)
def context_route(req: ContextRequest):
    # Unified safety evaluation
    safety_status, safety_msg = evaluate_safety(req.draft)
    if safety_status == "refused":
        return ContextResponse(
            request_id=str(uuid.uuid4())[:8],
            prompt_version="context.v1",
            status="refused",
            message=safety_msg or "Your message contains abusive phrasing. Please rephrase respectfully to receive guidance.",
        )
    if safety_status == "crisis":
        return ContextResponse(
            request_id=str(uuid.uuid4())[:8],
            prompt_version="context.v1",
            status="sensitive",
            message=safety_msg or "You may be experiencing intense distress. Academic and personal stress is real, but your wellbeing comes first. Support resources are available to help you.",
        )

    draft_lower = req.draft.lower()
    rec_val = (req.recipient or "").strip()
    sit_val = (req.situation or "").strip()

    # Determine relationship
    rel = "superior"
    if "ta" in rec_val.lower() or "assistant" in rec_val.lower():
        rel = "ta"
    elif "advisor" in rec_val.lower() or "counselor" in rec_val.lower():
        rel = "advisor"
    elif "peer" in rec_val.lower() or "classmate" in rec_val.lower() or "colleague" in rec_val.lower():
        rel = "peer"
    elif "landlord" in rec_val.lower():
        rel = "landlord"
    elif "client" in rec_val.lower():
        rel = "client"

    # Determine intent
    intent = "request"
    if any(k in draft_lower or k in sit_val.lower() for k in ["grade", "mark", "score", "rubric", "test", "midterm", "final", "review", "salary"]):
        intent = "query"
    elif any(k in draft_lower or k in sit_val.lower() for k in ["late", "missed", "deadline passed", "apologize", "sorry"]):
        intent = "apology"
    elif any(k in draft_lower or k in sit_val.lower() for k in ["boundary", "no", "cannot", "decline", "unable", "overwhelmed"]):
        intent = "boundary"

    r_display = rec_val if rec_val else "your recipient"
    s_display = sit_val if sit_val else "an important request or inquiry"
    summary_text = f"Writing to {r_display} regarding {s_display}."

    return ContextResponse(
        request_id=str(uuid.uuid4())[:8],
        prompt_version="context.v1",
        status="ok",
        scene=SceneData(
            relationship=rel,
            power="recipient_higher" if rel not in ("peer",) else "equal",
            closeness="distant",
            intent=intent,
            stakes="high" if any(k in draft_lower for k in ["fail", "drop", "final", "graduation", "fired", "lease", "eviction"]) else "medium",
            channel="email",
            summary=summary_text,
        ),
    )


@app.post(
    "/diagnose",
    response_model=DiagnoseResponse,
    dependencies=[Depends(check_rate_limit)],
    responses={400: {"model": ErrorResponse}, 429: {"model": ErrorResponse}},
)
def diagnose_route(
    req: DiagnoseRequest,
    cfg: Settings = Depends(get_settings),
):
    start = time.perf_counter()
    status_str = "success"
    err_code = None
    res = None
    retries = 0

    # Build request-scoped LLM client without mutating global settings
    active_llm = build_client(cfg, model=req.model)
    pipeline = Pipeline(cfg, active_llm)

    try:
        sit = req.situation
        rec = req.recipient
        if req.scene and isinstance(req.scene, dict):
            sit = req.scene.get("summary") or sit
            rec = req.scene.get("relationship") or rec
        res, retries = pipeline.diagnose(
            draft=req.draft, situation=sit, recipient=rec
        )
        return res
    except PipelineError as e:
        status_str = "error"
        err_code = e.code
        raise
    except Exception as e:
        status_str = "server_error"
        err_code = "server"
        logger.error(f"Unhandled error in /diagnose: {e}", exc_info=True)
        raise PipelineError(
            code="server",
            message="An unexpected server error occurred while processing your draft. Please try again.",
            status_code=500,
        )
    finally:
        latency = (time.perf_counter() - start) * 1000
        score_summary = None
        if res:
            score_summary = {
                "clarity": res.scores.clarity.value,
                "accountability": res.scores.accountability.value,
                "warmth": res.scores.warmth.value,
                "formality": res.scores.formality.value,
                "proportion": res.scores.proportion.value,
            }
        log_audit(
            request_id=res.request_id if res else "failed",
            endpoint="/diagnose",
            provider=getattr(active_llm, "provider", cfg.llm_provider),
            model=getattr(active_llm, "model", cfg.llm_model),
            prompt_version=cfg.diagnose_prompt_file,
            rubric_version=cfg.rubric_file,
            draft=req.draft,
            latency_ms=latency,
            status=status_str,
            scores=score_summary,
            retries=retries,
            error_code=err_code,
        )


@app.post(
    "/rewrite",
    response_model=RewriteResponse,
    dependencies=[Depends(check_rate_limit)],
    responses={400: {"model": ErrorResponse}, 429: {"model": ErrorResponse}},
)
def rewrite_route(
    req: RewriteRequest,
    cfg: Settings = Depends(get_settings),
):
    start = time.perf_counter()
    status_str = "success"
    err_code = None
    res = None
    retries = 0

    # Build request-scoped LLM client without mutating global settings
    active_llm = build_client(cfg, model=req.model)
    pipeline = Pipeline(cfg, active_llm)

    try:
        sit = req.situation
        rec = req.recipient
        if req.scene and isinstance(req.scene, dict):
            sit = req.scene.get("summary") or sit
            rec = req.scene.get("relationship") or rec
        res, retries = pipeline.rewrite(
            draft=req.draft, situation=sit, recipient=rec
        )
        return res
    except PipelineError as e:
        status_str = "error"
        err_code = e.code
        raise
    except Exception as e:
        status_str = "server_error"
        err_code = "server"
        logger.error(f"Unhandled error in /rewrite: {e}", exc_info=True)
        raise PipelineError(
            code="server",
            message="An unexpected server error occurred while generating your rewrite. Please try again.",
            status_code=500,
        )
    finally:
        latency = (time.perf_counter() - start) * 1000
        log_audit(
            request_id=res.request_id if res else "failed",
            endpoint="/rewrite",
            provider=getattr(active_llm, "provider", cfg.llm_provider),
            model=getattr(active_llm, "model", cfg.llm_model),
            prompt_version=cfg.rewrite_prompt_file,
            rubric_version=cfg.rubric_file,
            draft=req.draft,
            latency_ms=latency,
            status=status_str,
            retries=retries,
            error_code=err_code,
            extra={
                "new_facts_count": len(res.new_facts_introduced) if res else 0,
            },
        )


# Serve Static Assets & Frontend Shell
static_dir = Path("app/static")
static_dir.mkdir(parents=True, exist_ok=True)
app.mount("/", StaticFiles(directory=str(static_dir), html=True), name="static")
