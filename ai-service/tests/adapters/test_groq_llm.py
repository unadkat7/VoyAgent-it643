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
def test_request_uses_bearer_key_structured_output_and_schema_in_system_prompt():
    route = respx.post(URL).respond(200, json=completion('{"summary": "ok"}'))

    make_llm().generate(TripSummary, system="Be brief.", prompt="Plan Goa")

    request = route.calls.last.request
    body = json.loads(request.content)
    assert request.headers["authorization"] == "Bearer groq-key"
    assert body["model"] == "llama-test"
    assert body["response_format"]["type"] == "json_schema"
    assert body["response_format"]["json_schema"]["name"] == "TripSummary"
    assert "summary" in body["response_format"]["json_schema"]["schema"]["properties"]
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


INVALID_JSON = httpx.Response(
    400, json={"error": {"code": "json_validate_failed", "message": "Failed to generate JSON"}}
)


@pytest.mark.parametrize(
    "first_failure",
    [INVALID_JSON, httpx.Response(429), httpx.Response(503)],
    ids=["invalid-json", "rate-limited", "unavailable"],
)
@respx.mock
def test_a_transient_failure_is_retried_once(first_failure):
    respx.post(URL).mock(
        side_effect=[first_failure, httpx.Response(200, json=completion('{"summary": "ok"}'))]
    )

    assert make_llm().generate(TripSummary, system="s", prompt="p").summary == "ok"


@respx.mock
def test_error_carries_the_providers_reason():
    respx.post(URL).mock(side_effect=[INVALID_JSON, INVALID_JSON])

    with pytest.raises(LLMError, match="Failed to generate JSON"):
        make_llm().generate(TripSummary, system="s", prompt="p")


@respx.mock
def test_a_rejected_key_is_not_retried():
    # A second answer is prepared; reaching it would mean the bad key was retried.
    respx.post(URL).mock(
        side_effect=[
            httpx.Response(401, json={"error": {"message": "Invalid API Key"}}),
            httpx.Response(200, json=completion('{"summary": "should not get here"}')),
        ]
    )

    with pytest.raises(LLMError, match="Invalid API Key"):
        make_llm().generate(TripSummary, system="s", prompt="p")


@respx.mock
def test_network_failure_becomes_llm_error():
    respx.post(URL).mock(side_effect=httpx.ConnectError("no route"))

    with pytest.raises(LLMError):
        make_llm().generate(TripSummary, system="s", prompt="p")
