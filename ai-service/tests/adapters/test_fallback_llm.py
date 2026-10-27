import pytest

from adapters.fallback_llm import FallbackLLM
from ports.llm import LLMError
from schemas.plan import TripSummary
from tests.fakes import BrokenLLM, FakeLLM

PRIMARY_ANSWER = TripSummary(summary="from Groq")
FALLBACK_ANSWER = TripSummary(summary="from Cloudflare")


def generate(llm):
    return llm.generate(TripSummary, system="system", prompt="prompt")


def test_primary_answer_is_used_when_primary_works():
    llm = FallbackLLM(FakeLLM({TripSummary: PRIMARY_ANSWER}), FakeLLM({TripSummary: FALLBACK_ANSWER}))

    assert generate(llm) == PRIMARY_ANSWER


def test_fallback_answers_when_primary_fails():
    llm = FallbackLLM(BrokenLLM("rate limited"), FakeLLM({TripSummary: FALLBACK_ANSWER}))

    assert generate(llm) == FALLBACK_ANSWER


def test_error_names_both_failures_when_every_provider_fails():
    llm = FallbackLLM(BrokenLLM("groq down"), BrokenLLM("cloudflare down"))

    with pytest.raises(LLMError, match="groq down.*cloudflare down"):
        generate(llm)
