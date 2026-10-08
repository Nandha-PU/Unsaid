import hashlib
import json
import sys
from datetime import datetime, timezone
from typing import Any


def hash_text(text: str) -> str:
    """Generate SHA-256 hash of input text for auditable tracking without privacy leaks."""
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def log_audit(
    *,
    request_id: str,
    endpoint: str,
    provider: str,
    model: str,
    prompt_version: str,
    rubric_version: str,
    draft: str,
    latency_ms: float,
    status: str,
    scores: dict[str, int] | None = None,
    retries: int = 0,
    error_code: str | None = None,
    extra: dict[str, Any] | None = None,
) -> None:
    """
    Log a structured JSON line to stdout for observability and privacy audit compliance.
    RAW DRAFT IS NEVER LOGGED OR RETAINED.
    """
    record = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "request_id": request_id,
        "endpoint": endpoint,
        "provider": provider,
        "model": model,
        "prompt_version": prompt_version,
        "rubric_version": rubric_version,
        "input_sha256": hash_text(draft),
        "input_length": len(draft),
        "latency_ms": round(latency_ms, 2),
        "retries": retries,
        "status": status,
        "scores": scores,
        "error_code": error_code,
    }
    if extra:
        record.update(extra)

    # Print single structured JSON line directly to stdout
    sys.stdout.write(json.dumps(record) + "\n")
    sys.stdout.flush()
