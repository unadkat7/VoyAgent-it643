import httpx

from adapters.json_output import parse_output, system_prompt_with_schema
from ports.llm import LLMError, M

CLOUDFLARE_URL = "https://api.cloudflare.com/client/v4/accounts/{account_id}/ai/run/{model}"


class CloudflareLLM:
    """Fallback LLM Provider: Cloudflare Workers AI with JSON-schema output."""

    def __init__(
        self, *, account_id: str, api_token: str, model: str, timeout_seconds: float = 60.0
    ):
        self._url = CLOUDFLARE_URL.format(account_id=account_id, model=model)
        self._api_token = api_token
        self._timeout = timeout_seconds

    def generate(self, output_type: type[M], *, system: str, prompt: str) -> M:
        body = {
            "messages": [
                {"role": "system", "content": system_prompt_with_schema(system, output_type)},
                {"role": "user", "content": prompt},
            ],
            "response_format": {
                "type": "json_schema",
                "json_schema": output_type.model_json_schema(),
            },
        }
        try:
            response = httpx.post(
                self._url,
                json=body,
                headers={"Authorization": f"Bearer {self._api_token}"},
                timeout=self._timeout,
            )
            response.raise_for_status()
            payload = response.json()
            if not payload.get("success"):
                raise LLMError(f"Cloudflare reported failure: {payload.get('errors')}")
            content = payload["result"]["response"]
        except (httpx.HTTPError, KeyError, TypeError, ValueError) as error:
            raise LLMError(f"Cloudflare request failed: {error}") from error
        return parse_output(output_type, content)
