import argparse
import json
import sys
import time
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.config import Settings
from app.llm import build_client
from app.pipeline import Pipeline, PipelineError


def run_evals(provider: str | None = None, model: str | None = None, golden_path: str = "evals/golden.json"):
    cfg = Settings()
    if provider:
        cfg.llm_provider = provider
    if model:
        cfg.llm_model = model

    golden_file = Path(golden_path)
    if not golden_file.exists():
        print(f"Error: Golden file not found at {golden_file}")
        sys.exit(1)

    with open(golden_file, "r", encoding="utf-8") as f:
        samples = json.load(f)

    llm = build_client(cfg)
    pipeline = Pipeline(cfg, llm)

    print("=" * 70)
    print("SAY IT RIGHT - EVALUATION HARNESS")
    print(f"Provider:       {cfg.llm_provider}")
    print(f"Model:          {cfg.llm_model}")
    print(f"Prompt Version: {cfg.diagnose_prompt_file}")
    print(f"Rubric Version: {cfg.rubric_file}")
    print(f"Test Samples:   {len(samples)}")
    print("=" * 70)

    passed_count = 0
    total_latency = 0.0

    print(f"{'ID':<30} | {'Status':<8} | {'Latency':<8} | {'Flags':<5} | {'Verdict'}")
    print("-" * 70)

    for item in samples:
        draft_id = item["id"]
        draft_text = item["draft"]
        sit = item.get("situation", "extension")
        rec = item.get("recipient", "Professor")

        start = time.perf_counter()
        try:
            res, retries = pipeline.diagnose(draft=draft_text, situation=sit, recipient=rec)
            lat = (time.perf_counter() - start) * 1000
            total_latency += lat

            # Assert valid scores and flags
            assert res.scores.clarity.value in [1, 2, 3, 4, 5]
            assert res.scores.accountability.value in [1, 2, 3, 4, 5]

            status = "PASS"
            passed_count += 1
            verdict_trunc = (res.verdict[:35] + "...") if len(res.verdict) > 35 else res.verdict
            print(f"{draft_id:<30} | {status:<8} | {lat:>6.1f}ms | {len(res.flags):<5} | {verdict_trunc}")
        except Exception as e:
            lat = (time.perf_counter() - start) * 1000
            print(f"{draft_id:<30} | FAIL     | {lat:>6.1f}ms | 0     | Error: {e}")

    print("-" * 70)
    pass_rate = (passed_count / len(samples)) * 100
    avg_lat = total_latency / len(samples) if samples else 0
    print(f"SUMMARY: {passed_count}/{len(samples)} Passed ({pass_rate:.1f}%) | Avg Latency: {avg_lat:.1f}ms")
    print("=" * 70)

    if pass_rate < 100.0:
        sys.exit(1)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Run Say It Right regression evals.")
    parser.add_argument("--provider", type=str, help="LLM Provider (fake, anthropic, openai, etc.)")
    parser.add_argument("--model", type=str, help="Model name")
    parser.add_argument("--golden", type=str, default="evals/golden.json", help="Path to golden json dataset")
    args = parser.parse_args()
    run_evals(args.provider, args.model, args.golden)
