import logging
from dataclasses import dataclass

import httpx
from openai import OpenAI

from .config import settings
from .db import SessionLocal
from .models import UsageLog

logger = logging.getLogger(__name__)

# GPT-4o-mini pricing (USD per 1M tokens)
PRICING = {
    "gpt-4o-mini":        {"input": 0.15,  "output": 0.60},
    "gpt-4o":             {"input": 5.00,  "output": 15.00},
    "gpt-3.5-turbo":      {"input": 0.50,  "output": 1.50},
}


@dataclass
class LLMResult:
    text: str
    input_tokens: int
    output_tokens: int
    cost_usd: float
    model: str


def _calc_cost(model: str, input_tokens: int, output_tokens: int) -> float:
    p = PRICING.get(model, {"input": 0.15, "output": 0.60})
    return (input_tokens * p["input"] + output_tokens * p["output"]) / 1_000_000


def _log_usage(user_id: int, operation: str, result: LLMResult) -> None:
    db = SessionLocal()
    try:
        db.add(UsageLog(
            user_id=user_id,
            operation=operation,
            model=result.model,
            input_tokens=result.input_tokens,
            output_tokens=result.output_tokens,
            cost_usd=result.cost_usd,
        ))
        db.commit()
    except Exception as e:
        logger.warning("Failed to log usage: %s", e)
    finally:
        db.close()


def call_llm(prompt: str, user_id: int, operation: str, max_tokens: int = 2000) -> str:
    """Call OpenAI if key configured, otherwise fall back to Ollama."""
    if settings.openai_api_key:
        return _call_openai(prompt, user_id, operation, max_tokens)
    return _call_ollama(prompt)


def _call_openai(prompt: str, user_id: int, operation: str, max_tokens: int) -> str:
    client = OpenAI(api_key=settings.openai_api_key)
    model = settings.openai_model

    response = client.chat.completions.create(
        model=model,
        messages=[{"role": "user", "content": prompt}],
        max_tokens=max_tokens,
        temperature=0.3,
    )

    text = response.choices[0].message.content or ""
    usage = response.usage
    input_tokens = usage.prompt_tokens if usage else 0
    output_tokens = usage.completion_tokens if usage else 0
    cost = _calc_cost(model, input_tokens, output_tokens)

    result = LLMResult(
        text=text,
        input_tokens=input_tokens,
        output_tokens=output_tokens,
        cost_usd=cost,
        model=model,
    )
    _log_usage(user_id, operation, result)
    return text


def _call_ollama(prompt: str) -> str:
    with httpx.Client(timeout=300) as client:
        resp = client.post(
            f"{settings.ollama_url}/api/generate",
            json={
                "model": settings.ollama_model,
                "prompt": prompt,
                "stream": False,
                "options": {"num_predict": 3000},
            },
        )
        resp.raise_for_status()
        return resp.json().get("response", "").strip()
