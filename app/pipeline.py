import json
import re
import uuid
from pathlib import Path
from typing import Any
import yaml

from app.config import Settings
from app.llm import LLMClient
from app.safety import evaluate_safety
from app.schemas import (
    DiagnoseResponse,
    RewriteResponse,
    Flag,
    ChangeItem,
    Scores,
    ScoreDetail,
    DimensionDetail,
)


class PipelineError(Exception):
    def __init__(self, code: str, message: str, status_code: int = 400):
        super().__init__(message)
        self.code = code
        self.message = message
        self.status_code = status_code


class Pipeline:
    """Core evaluation and rewriting pipeline."""

    def __init__(self, cfg: Settings, llm: LLMClient):
        self.cfg = cfg
        self.llm = llm
        self.rubric_data: dict[str, Any] = self._load_rubric()
        self.diagnose_prompt_tmpl: str = self._load_prompt(cfg.diagnose_prompt_file)
        self.rewrite_prompt_tmpl: str = self._load_prompt(cfg.rewrite_prompt_file)

    def _load_rubric(self) -> dict[str, Any]:
        path = self.cfg.rubric_dir / self.cfg.rubric_file
        if not path.exists():
            raise FileNotFoundError(f"Rubric file missing: {path}")
        with open(path, "r", encoding="utf-8") as f:
            return yaml.safe_load(f)

    def _load_prompt(self, filename: str) -> str:
        path = self.cfg.prompt_dir / filename
        if not path.exists():
            raise FileNotFoundError(f"Prompt file missing: {path}")
        with open(path, "r", encoding="utf-8") as f:
            return f.read()

    @staticmethod
    def _clean_json_text(text: str) -> str:
        """Strip markdown fences (```json ... ```) or leading/trailing chatter."""
        clean = text.strip()
        # Remove markdown code blocks if present
        fence_match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", clean)
        if fence_match:
            clean = fence_match.group(1).strip()
        # Find first { and last }
        start = clean.find("{")
        end = clean.rfind("}")
        if start != -1 and end != -1 and end >= start:
            clean = clean[start : end + 1]
        return clean

    @staticmethod
    def _check_safety(draft: str) -> None:
        """Centralized safety filter for threats, abuse, or acute crisis."""
        status, msg = evaluate_safety(draft)
        if status == "refused":
            raise PipelineError(
                code="refused",
                message=msg or "Draft contains threatening or abusive language, which violates communication policies.",
                status_code=400,
            )
        if status == "crisis":
            raise PipelineError(
                code="crisis_support",
                message=msg or "If you are in distress, support resources are available to help you.",
                status_code=400,
            )

    @staticmethod
    def _parse_score(val: Any, target_min: int, target_max: int) -> ScoreDetail:
        if isinstance(val, dict):
            raw = val.get("value", val.get("score", 3))
            t_min = val.get("target_min", target_min)
            t_max = val.get("target_max", target_max)
        elif isinstance(val, (int, float)):
            raw = val
            t_min, t_max = target_min, target_max
        else:
            raw, t_min, t_max = 3, target_min, target_max

        try:
            val_int = max(1, min(5, int(raw)))
        except (ValueError, TypeError):
            val_int = 3

        return ScoreDetail(value=val_int, target_min=t_min, target_max=t_max)

    def diagnose(
        self, *, draft: str, situation: str, recipient: str
    ) -> tuple[DiagnoseResponse, int]:
        """
        Evaluate a student's draft against the rubric.
        Returns (DiagnoseResponse, retry_count).
        """
        self._check_safety(draft)

        situations_dict = self.rubric_data.get("situations", {})
        sit_key = situation.lower().strip()
        sit_info = situations_dict.get(situation) or situations_dict.get(sit_key)
        if not sit_info:
            for k, v in situations_dict.items():
                if k.lower() in sit_key or (isinstance(v, dict) and v.get("name", "").lower() in sit_key):
                    sit_info = v
                    break
        if not sit_info:
            sit_info = {"name": situation, "description": situation}

        rubric_text = yaml.dump(self.rubric_data.get("dimensions", {}), sort_keys=False)

        # Sanitize XML delimiters in user values to prevent prompt injection
        safe_draft = draft.replace("</student_draft>", "[/student_draft]")
        safe_rec = recipient.replace("</recipient>", "").replace("<recipient>", "")
        safe_sit_name = sit_info.get("name", situation).replace("</situation>", "")
        safe_sit_desc = sit_info.get("description", situation).replace("</situation>", "")

        user_content = (
            self.diagnose_prompt_tmpl
            .replace("{recipient}", safe_rec)
            .replace("{situation_name}", safe_sit_name)
            .replace("{situation_desc}", safe_sit_desc)
            .replace("{rubric_content}", rubric_text)
            .replace("{draft}", safe_draft)
        )

        retries = 0
        prompt_used = user_content

        for attempt in range(2):
            resp = self.llm.generate(
                system="You are an expert academic evaluator. You MUST respond with ONLY a valid, parseable JSON object.",
                user=prompt_used,
                max_tokens=self.cfg.llm_max_tokens,
                temperature=self.cfg.llm_temperature,
            )

            try:
                cleaned = self._clean_json_text(resp.text)
                data = json.loads(cleaned)

                # Check if model returned an explicit refusal payload
                if isinstance(data, dict) and "error" in data and isinstance(data["error"], dict):
                    err = data["error"]
                    raise PipelineError(
                        code=err.get("code", "refused"),
                        message=err.get("message", "Request refused by evaluation model."),
                        status_code=400,
                    )

                # Build & validate schema with resilient parser
                scores_dict = data.get("scores", {}) if isinstance(data, dict) else {}
                scores = Scores(
                    clarity=self._parse_score(scores_dict.get("clarity"), 4, 5),
                    accountability=self._parse_score(scores_dict.get("accountability"), 4, 5),
                    warmth=self._parse_score(scores_dict.get("warmth"), 3, 5),
                    formality=self._parse_score(scores_dict.get("formality"), 3, 4),
                    proportion=self._parse_score(scores_dict.get("proportion"), 3, 4),
                )

                # Compute dynamic dimensions list and deterministic overall score
                rubric_dims = self.rubric_data.get("dimensions", {})
                dim_specs = [
                    ("clarity", "Clarity of the ask", scores.clarity),
                    ("accountability", "Owning your part", scores.accountability),
                    ("warmth", "Warmth and respect", scores.warmth),
                    ("formality", "Formality fit", scores.formality),
                    ("proportion", "Proportion", scores.proportion),
                ]
                dimensions_list: list[DimensionDetail] = []
                closenesses: list[float] = []
                for dim_id, default_lbl, detail in dim_specs:
                    r_info = rubric_dims.get(dim_id, {})
                    lbl = r_info.get("name", default_lbl)
                    desc = r_info.get("description", "Evaluation metric")
                    v = detail.value
                    t_min = detail.target_min
                    t_max = detail.target_max
                    if t_min <= v <= t_max:
                        closeness = 1.0
                    elif v < t_min:
                        closeness = max(0.0, 1.0 - (t_min - v) / 4.0)
                    else:
                        closeness = max(0.0, 1.0 - (v - t_max) / 4.0)
                    closenesses.append(closeness)
                    dimensions_list.append(
                        DimensionDetail(
                            id=dim_id,
                            label=lbl,
                            description=desc,
                            value=v,
                            target_min=t_min,
                            target_max=t_max,
                        )
                    )
                overall_score = round(100.0 * (sum(closenesses) / len(closenesses))) if closenesses else 50

                def _infer_dim_id(principle_str: str, reason_str: str) -> str:
                    combined = (principle_str + " " + reason_str).lower()
                    if any(k in combined for k in ["accountab", "own", "blam", "defens", "excuse"]):
                        return "accountability"
                    if any(k in combined for k in ["warm", "respect", "empath", "considerat"]):
                        return "warmth"
                    if any(k in combined for k in ["formal", "casual", "greet", "sign-off", "address"]):
                        return "formality"
                    if any(k in combined for k in ["proport", "brief", "apolog", "length", "grovel"]):
                        return "proportion"
                    return "clarity"

                # Validate and filter flags
                raw_flags = data.get("flags", []) if isinstance(data, dict) else []
                valid_flags: list[Flag] = []
                for rf in raw_flags:
                    if isinstance(rf, dict):
                        flag_text = str(rf.get("text", rf.get("phrase", ""))).strip()
                        if flag_text:
                            p_str = str(rf.get("principle", "Clarity"))
                            r_str = str(rf.get("reason", rf.get("why", "Tone requires adjustment.")))
                            d_id = rf.get("dimension_id") or _infer_dim_id(p_str, r_str)
                            valid_flags.append(
                                Flag(
                                    text=flag_text,
                                    reason=r_str,
                                    principle=p_str,
                                    nudge=str(rf.get("nudge", rf.get("suggestion", "Consider rephrasing with greater professionalism."))),
                                    dimension_id=d_id,
                                )
                            )

                req_id = str(uuid.uuid4())[:8]
                verdict_str = (
                    data.get("verdict", "Your draft could be refined for better professor perception.")
                    if isinstance(data, dict)
                    else "Your draft could be refined for better professor perception."
                )
                result = DiagnoseResponse(
                    request_id=req_id,
                    prompt_version=self.cfg.diagnose_prompt_file.replace(".md", ""),
                    rubric_version=str(self.rubric_data.get("version", "professor_ask.v1")),
                    verdict=verdict_str,
                    scores=scores,
                    overall=overall_score,
                    dimensions=dimensions_list,
                    flags=valid_flags,
                )
                return result, retries

            except (json.JSONDecodeError, ValueError, KeyError, TypeError) as e:
                retries += 1
                if attempt == 0:
                    prompt_used = (
                        f"{user_content}\n\n"
                        f"CRITICAL REMINDER: Your previous response was not valid JSON or was missing required fields. "
                        f"You MUST return ONLY a single, valid JSON object strictly matching the output schema above."
                    )
                else:
                    raise PipelineError(
                        code="invalid_model_output",
                        message="Model failed to return compliant JSON diagnostic structure.",
                        status_code=502,
                    )

        raise PipelineError(code="server", message="Unexpected diagnosis execution failure.", status_code=500)

    def rewrite(
        self, *, draft: str, situation: str, recipient: str
    ) -> tuple[RewriteResponse, int]:
        """
        Generate a professional, truthful rewrite with changes and honesty verification.
        Returns (RewriteResponse, retry_count).
        """
        self._check_safety(draft)

        situations_dict = self.rubric_data.get("situations", {})
        sit_key = situation.lower().strip()
        sit_info = situations_dict.get(situation) or situations_dict.get(sit_key)
        if not sit_info:
            for k, v in situations_dict.items():
                if k.lower() in sit_key or (isinstance(v, dict) and v.get("name", "").lower() in sit_key):
                    sit_info = v
                    break
        if not sit_info:
            sit_info = {"name": situation, "description": situation}

        # Sanitize XML delimiters in user values to prevent prompt injection
        safe_draft = draft.replace("</student_draft>", "[/student_draft]")
        safe_rec = recipient.replace("</recipient>", "").replace("<recipient>", "")
        safe_sit_name = sit_info.get("name", situation).replace("</situation>", "")

        user_content = (
            self.rewrite_prompt_tmpl
            .replace("{recipient}", safe_rec)
            .replace("{situation_name}", safe_sit_name)
            .replace("{draft}", safe_draft)
        )

        retries = 0
        prompt_used = user_content

        for attempt in range(2):
            resp = self.llm.generate(
                system="You are an expert academic writing coach. You MUST respond with ONLY a valid, parseable JSON object.",
                user=prompt_used,
                max_tokens=self.cfg.llm_max_tokens,
                temperature=self.cfg.llm_temperature,
            )

            try:
                cleaned = self._clean_json_text(resp.text)
                data = json.loads(cleaned)

                changes = []
                for ch in data.get("changes", []):
                    if isinstance(ch, dict):
                        changes.append(
                            ChangeItem(
                                from_text=ch.get("from", ""),
                                to_text=ch.get("to", ""),
                                reason=ch.get("reason", "Improves tone and clarity"),
                                principle=ch.get("principle", "Clarity"),
                            )
                        )

                raw_rw = (
                    data.get("rewrite")
                    or data.get("rewritten_draft")
                    or data.get("revised_draft")
                    or data.get("email")
                    or data.get("text")
                    or ""
                ).strip()
                if not raw_rw:
                    raise ValueError("Model output missing 'rewrite' field.")

                req_id = str(uuid.uuid4())[:8]
                result = RewriteResponse(
                    request_id=req_id,
                    prompt_version=self.cfg.rewrite_prompt_file.replace(".md", ""),
                    rubric_version=str(self.rubric_data.get("version", "professor_ask.v1")),
                    rewrite=raw_rw,
                    changes=changes,
                    takeaway=data.get("takeaway", "Be clear, concise, and accountable."),
                    new_facts_introduced=data.get("new_facts_introduced", []),
                )
                return result, retries

            except (json.JSONDecodeError, ValueError, KeyError) as e:
                retries += 1
                if attempt == 0:
                    prompt_used = (
                        f"{user_content}\n\n"
                        f"IMPORTANT: The previous output had JSON formatting or validation issues. "
                        "Ensure you return valid JSON containing the exact key 'rewrite' with the full rewritten email."
                    )
                else:
                    raise PipelineError(
                        code="invalid_model_output",
                        message="Model failed to return compliant rewrite JSON.",
                        status_code=502,
                    )

        raise PipelineError(code="server", message="Unexpected rewrite execution failure.", status_code=500)
