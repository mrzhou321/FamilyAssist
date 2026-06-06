param(
  [ValidateSet("deterministic", "provider")]
  [string]$Mode = "deterministic",
  [ValidateSet("ollama", "deepseek", "qwen")]
  [string]$Provider = "ollama",
  [string]$GenerationModel = "",
  [string]$CloudBaseUrl = "",
  [string]$CloudApiKey = "",
  [switch]$AllowCloud,
  [double]$MinimumPassRate = 0.8,
  [string]$OutputPath = ""
)

$ErrorActionPreference = "Stop"
$root = (Resolve-Path "$PSScriptRoot\..").Path
$python = Join-Path $root "backend\.venv\Scripts\python.exe"
if (-not (Test-Path $python)) {
  $python = "python"
}

if ($Mode -eq "provider" -and $Provider -ne "ollama" -and -not $AllowCloud) {
  throw "Cloud provider sampling sends notes to a third-party API. Pass -AllowCloud after confirming the data egress risk."
}

$env:FA_PROJECT_ROOT = $root
$env:FA_LLM_SAMPLE_MODE = $Mode
$env:FA_LLM_SAMPLE_PROVIDER = $Provider
$env:FA_LLM_SAMPLE_MODEL = $GenerationModel
$env:FA_LLM_SAMPLE_CLOUD_BASE_URL = $CloudBaseUrl
$env:FA_LLM_SAMPLE_CLOUD_API_KEY = $CloudApiKey
$env:FA_LLM_SAMPLE_MINIMUM = [string]$MinimumPassRate
if ($OutputPath) {
  $env:FA_LLM_SAMPLE_OUTPUT = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($OutputPath)
} else {
  $env:FA_LLM_SAMPLE_OUTPUT = ""
}

$sampleRunner = New-TemporaryFile
@'
import asyncio
import json
import os
import sys
from datetime import UTC, datetime

root = os.environ["FA_PROJECT_ROOT"]
sys.path.insert(0, os.path.join(root, "backend"))

from app.llm_extractor import build_extracted_candidate
from app.memory_dedupe import build_review_candidate_from_text
from app.schemas import SystemSettings


CASES = [
    {"note": "\u7238\u7238\u4e0d\u5403\u9999\u83dc", "member_id": 1, "domain": "diet", "type": "fact", "contains": ["\u9999\u83dc"]},
    {"note": "\u5988\u5988\u5bf9\u82b1\u751f\u8fc7\u654f", "member_id": 2, "domain": "diet", "type": "fact", "contains": ["\u82b1\u751f", "\u8fc7\u654f"]},
    {"note": "\u7237\u7237\u6015\u51b7\uff0c\u51fa\u95e8\u8981\u7a7f\u5916\u5957", "member_id": 1, "domain": "dressing", "type": "fact", "contains": ["\u6015\u51b7", "\u5916\u5957"]},
    {"note": "\u5976\u5976\u6700\u8fd1\u819d\u76d6\u75bc\uff0c\u4eca\u5929\u4e0d\u8981\u8dd1\u6b65", "member_id": 2, "domain": "exercise", "type": "episode", "contains": ["\u819d\u76d6", "\u8dd1\u6b65"]},
    {"note": "\u5b69\u5b50\u559c\u6b22\u996d\u540e\u6563\u6b65", "member_id": 3, "domain": "exercise", "type": "fact", "contains": ["\u6563\u6b65"]},
    {"note": "\u5168\u5bb6\u5c11\u7cd6\uff0c\u665a\u9910\u522b\u592a\u751c", "member_id": None, "domain": "diet", "type": "episode", "contains": ["\u5c11\u7cd6", "\u665a\u9910"]},
    {"note": "\u5988\u5988\u4e0d\u559c\u6b22\u559d\u592a\u70eb\u7684\u6c64", "member_id": 2, "domain": "diet", "type": "fact", "contains": ["\u6c64"]},
    {"note": "\u7238\u7238\u4eca\u5929\u8fd0\u52a8\u540e\u8170\u4e0d\u8212\u670d", "member_id": 1, "domain": "exercise", "type": "episode", "contains": ["\u8fd0\u52a8", "\u8170"]},
    {"note": "\u7237\u7237\u6015\u70ed\uff0c\u590f\u5929\u5c11\u7a7f\u539a\u8863\u670d", "member_id": 1, "domain": "dressing", "type": "fact", "contains": ["\u6015\u70ed", "\u539a\u8863\u670d"]},
    {"note": "\u59b9\u59b9\u4e0d\u5403\u82ab\u837d", "member_id": 3, "domain": "diet", "type": "fact", "contains": ["\u82ab\u837d"]},
    {"note": "\u5976\u5976\u665a\u996d\u60f3\u559d\u6e05\u6de1\u7684\u6c64", "member_id": 2, "domain": "diet", "type": "episode", "contains": ["\u6e05\u6de1", "\u6c64"]},
    {"note": "\u7238\u7238\u6015\u957f\u65f6\u95f4\u8d70\u8def\u819d\u76d6\u9178", "member_id": 1, "domain": "exercise", "type": "fact", "contains": ["\u8d70\u8def", "\u819d\u76d6"]},
    {"note": "\u5988\u5988\u5fcc\u53e3\u6d77\u9c9c", "member_id": 2, "domain": "diet", "type": "fact", "contains": ["\u6d77\u9c9c"]},
    {"note": "\u5b9d\u5b9d\u4eca\u5929\u54b3\u55fd\uff0c\u8fd0\u52a8\u5148\u6682\u505c", "member_id": 3, "domain": "exercise", "type": "episode", "contains": ["\u54b3\u55fd", "\u8fd0\u52a8"]},
    {"note": "\u7237\u7237\u51ac\u5929\u8981\u4fdd\u6696\uff0c\u56f4\u5dfe\u4e0d\u80fd\u5fd8", "member_id": 1, "domain": "dressing", "type": "episode", "contains": ["\u4fdd\u6696", "\u56f4\u5dfe"]},
    {"note": "\u5976\u5976\u4e0d\u7231\u5403\u8fa3", "member_id": 2, "domain": "diet", "type": "fact", "contains": ["\u8fa3"]},
    {"note": "\u7238\u7238\u559c\u6b22\u996d\u540e\u6162\u8d70", "member_id": 1, "domain": "exercise", "type": "fact", "contains": ["\u6162\u8d70"]},
    {"note": "\u5988\u5988\u4eca\u5929\u80c3\u4e0d\u8212\u670d\uff0c\u665a\u9910\u5403\u7ca5", "member_id": 2, "domain": "diet", "type": "episode", "contains": ["\u80c3", "\u7ca5"]},
    {"note": "\u5168\u5bb6\u51fa\u95e8\u7a7f\u96e8\u8863\uff0c\u522b\u7740\u51c9", "member_id": None, "domain": "dressing", "type": "episode", "contains": ["\u96e8\u8863"]},
    {"note": "\u59d0\u59d0\u8ba8\u538c\u9999\u83dc\u5473", "member_id": 3, "domain": "diet", "type": "fact", "contains": ["\u9999\u83dc"]},
]


def value(item):
    return getattr(item, "value", item)


def content_matches(content, expected_terms):
    return any(term in content for term in expected_terms)


async def extract(case, note_id, settings, mode):
    if mode == "deterministic":
        return build_review_candidate_from_text(note_id, case["member_id"], case["note"])
    return await build_extracted_candidate(note_id, case["member_id"], case["note"], settings)


async def main():
    mode = os.environ.get("FA_LLM_SAMPLE_MODE", "deterministic")
    provider = os.environ.get("FA_LLM_SAMPLE_PROVIDER", "ollama")
    model = os.environ.get("FA_LLM_SAMPLE_MODEL") or "qwen2.5:3b"
    settings = SystemSettings(
        llm_provider=provider,
        generation_model=model,
        cloud_generation_model=model if provider != "ollama" else "",
        cloud_llm_base_url=os.environ.get("FA_LLM_SAMPLE_CLOUD_BASE_URL", ""),
        cloud_llm_api_key=os.environ.get("FA_LLM_SAMPLE_CLOUD_API_KEY", ""),
        cloud_llm_risk_acknowledged=provider != "ollama",
    )
    minimum = float(os.environ.get("FA_LLM_SAMPLE_MINIMUM", "0.8"))
    results = []

    for index, case in enumerate(CASES, start=1):
        candidate = await extract(case, index, settings, mode)
        drafts = candidate.candidates if candidate else []
        matched = None
        for draft in drafts:
            if (
                value(draft.domain) == case["domain"]
                and value(draft.type) == case["type"]
                and content_matches(draft.content, case["contains"])
            ):
                matched = draft
                break
        results.append(
            {
                "note": case["note"],
                "expected": {
                    "member_id": case["member_id"],
                    "domain": case["domain"],
                    "type": case["type"],
                    "contains_any": case["contains"],
                },
                "passed": matched is not None,
                "actual_candidates": [
                    {
                        "domain": value(draft.domain),
                        "type": value(draft.type),
                        "content": draft.content,
                        "confidence": draft.confidence,
                    }
                    for draft in drafts
                ],
            }
        )

    passed = sum(1 for item in results if item["passed"])
    total = len(results)
    pass_rate = passed / total
    report = {
        "generated_at": datetime.now(UTC).isoformat(),
        "mode": mode,
        "provider": provider,
        "generation_model": model,
        "minimum_pass_rate": minimum,
        "passed": passed,
        "total": total,
        "pass_rate": pass_rate,
        "cases": results,
    }

    output_path = os.environ.get("FA_LLM_SAMPLE_OUTPUT", "")
    if output_path:
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        with open(output_path, "w", encoding="utf-8") as handle:
            json.dump(report, handle, ensure_ascii=False, indent=2)

    print(json.dumps(report, ensure_ascii=False, indent=2))
    if pass_rate < minimum:
        print(f"llm_quality_sample_failed pass_rate={pass_rate:.2%} passed={passed} total={total} mode={mode}")
        return 1
    print(f"llm_quality_sample_ok pass_rate={pass_rate:.2%} passed={passed} total={total} mode={mode}")
    return 0


raise SystemExit(asyncio.run(main()))
'@ | Set-Content -LiteralPath $sampleRunner -Encoding UTF8

try {
  & $python $sampleRunner
  if ($LASTEXITCODE -ne 0) {
    throw "LLM quality sample failed with exit code $LASTEXITCODE"
  }
} finally {
  Remove-Item -LiteralPath $sampleRunner -Force -ErrorAction SilentlyContinue
}
