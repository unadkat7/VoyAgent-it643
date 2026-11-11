import httpx

from adapters.json_output import parse_output, system_prompt_with_schema
from ports.llm import LLMError, M

GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
MAX_ATTEMPTS = 2
RETRY_STATUSES = frozenset({429, 500, 502, 503, 504})


class GroqLLM:
    """Primary LLM Provider: Groq's OpenAI-compatible chat API with JSON-schema output."""

    def __init__(self, *, api_key: str, model: str, timeout_seconds: float = 60.0):
        self._api_key = api_key
        self._model = model
        self._timeout = timeout_seconds

    def generate(self, output_type: type[M], *, system: str, prompt: str) -> M:
        body = {
            "model": self._model,
            "temperature": 0.2,
            "response_format": {
                "type": "json_schema",
                "json_schema": {
                    "name": output_type.__name__,
                    "schema": output_type.model_json_schema(),
                },
            },
            "messages": [
                {"role": "system", "content": system_prompt_with_schema(system, output_type)},
                {"role": "user", "content": prompt},
            ],
        }
        for attempt in range(1, MAX_ATTEMPTS + 1):
            try:
                response = httpx.post(
                    GROQ_URL,
                    json=body,
                    headers={"Authorization": f"Bearer {self._api_key}"},
                    timeout=self._timeout,
                )
            except httpx.HTTPError as error:
                raise LLMError(f"Groq request failed: {error}") from error

            if response.is_success:
                break
            if attempt == MAX_ATTEMPTS or not _is_transient(response):
                raise LLMError(f"Groq returned {response.status_code}: {_reason(response)}")

        try:
            content = response.json()["choices"][0]["message"]["content"]
        except (KeyError, IndexError, TypeError, ValueError) as error:
            raise LLMError(f"Groq sent an unexpected reply: {error}") from error
        return parse_output(output_type, content)


def _is_transient(response: httpx.Response) -> bool:
    # Groq answers 400 json_validate_failed when the model produced invalid JSON; a retry
    # usually succeeds. Other 4xx (bad key, bad request) will fail the same way again.
    if response.status_code in RETRY_STATUSES:
        return True
    return response.status_code == 400 and _error_field(response, "code") == "json_validate_failed"


def _reason(response: httpx.Response) -> str:
    return _error_field(response, "message") or response.reason_phrase


def _error_field(response: httpx.Response, field: str) -> str | None:
    try:
        return response.json()["error"][field]
    except (KeyError, TypeError, ValueError):
        return None
