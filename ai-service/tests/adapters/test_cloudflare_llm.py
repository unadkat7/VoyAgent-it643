import json

import httpx
import pytest
import respx

from adapters.cloudflare_llm import CloudflareLLM
from ports.llm import LLMError
from schemas.plan import TripSummary

MODEL = "@cf/meta/llama-test"
URL = f"https://api.cloudflare.com/client/v4/accounts/acct-123/ai/run/{MODEL}"


def make_llm() -> CloudflareLLM:
    return CloudflareLLM(account_id="acct-123", api_token="cf-token", model=MODEL)


@pytest.mark.parametrize(
    "response_value",
    [{"summary": "Hill views"}, '{"summary": "Hill views"}'],
    ids=["json-object", "json-string"],
)
@respx.mock
def test_returns_the_parsed_output_type(response_value):
    respx.post(URL).respond(200, json={"success": True, "result": {"response": response_value}})

    result = make_llm().generate(TripSummary, system="s", prompt="p")

    assert result.summary == "Hill views"


@respx.mock
def test_request_uses_bearer_token_and_json_schema():
    route = respx.post(URL).respond(
        200, json={"success": True, "result": {"response": {"summary": "ok"}}}
    )

    make_llm().generate(TripSummary, system="Be brief.", prompt="Plan Shimla")

    request = route.calls.last.request
    body = json.loads(request.content)
    assert request.headers["authorization"] == "Bearer cf-token"
    assert body["response_format"]["type"] == "json_schema"
    assert "summary" in body["response_format"]["json_schema"]["properties"]
    assert body["messages"][-1] == {"role": "user", "content": "Plan Shimla"}


@pytest.mark.parametrize(
    "response",
    [
        httpx.Response(401, json={"success": False, "errors": [{"message": "bad token"}]}),
        httpx.Response(200, json={"success": False, "errors": [{"message": "model busy"}]}),
        httpx.Response(200, json={"success": True, "result": {"response": "not json"}}),
        httpx.Response(200, json={"success": True, "result": {}}),
    ],
    ids=["unauthorized", "unsuccessful", "not-json", "no-response"],
)
@respx.mock
def test_provider_problems_become_llm_errors(response):
    respx.post(URL).mock(return_value=response)

    with pytest.raises(LLMError):
        make_llm().generate(TripSummary, system="s", prompt="p")
