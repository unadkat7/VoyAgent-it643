import json

import httpx
import pytest
import respx

from adapters.groq_llm import GroqLLM
from ports.llm import LLMError
from schemas.plan import TripSummary

URL = "https://api.groq.com/openai/v1/chat/completions"


def completion(content: str) -> dict:
    return {"choices": [{"message": {"role": "assistant", "content": content}}]}


def make_llm() -> GroqLLM:
    return GroqLLM(api_key="groq-key", model="llama-test")


@respx.mock
def test_returns_the_parsed_output_type():
    respx.post(URL).respond(
        200, json=completion('{"summary": "Beach days", "important_tips": ["Carry cash"]}')
    )

    result = make_llm().generate(TripSummary, system="system", prompt="prompt")

    assert result == TripSummary(summary="Beach days", important_tips=["Carry cash"])


@respx.mock
def test_request_uses_bearer_key_json_mode_and_schema_in_system_prompt():
    route = respx.post(URL).respond(200, json=completion('{"summary": "ok"}'))

    make_llm().generate(TripSummary, system="Be brief.", prompt="Plan Goa")

    request = route.calls.last.request
    body = json.loads(request.content)
    assert request.headers["authorization"] == "Bearer groq-key"
    assert body["model"] == "llama-test"
    assert body["response_format"] == {"type": "json_object"}
    assert "Be brief." in body["messages"][0]["content"]
    assert '"summary"' in body["messages"][0]["content"]
    assert body["messages"][1] == {"role": "user", "content": "Plan Goa"}


@pytest.mark.parametrize(
    "response",
    [
        httpx.Response(429, json={"error": {"message": "rate limit"}}),
        httpx.Response(500),
        httpx.Response(200, json=completion("not json at all")),
        httpx.Response(200, json=completion('{"wrong_field": 1}')),
        httpx.Response(200, json={"unexpected": "shape"}),
    ],
    ids=["rate-limited", "server-error", "not-json", "wrong-schema", "wrong-envelope"],
)
@respx.mock
def test_provider_problems_become_llm_errors(response):
    respx.post(URL).mock(return_value=response)

    with pytest.raises(LLMError):
        make_llm().generate(TripSummary, system="s", prompt="p")


@respx.mock
def test_network_failure_becomes_llm_error():
    respx.post(URL).mock(side_effect=httpx.ConnectError("no route"))

    with pytest.raises(LLMError):
        make_llm().generate(TripSummary, system="s", prompt="p")
