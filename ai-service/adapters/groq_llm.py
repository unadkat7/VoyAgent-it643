import httpx

from adapters.json_output import parse_output, system_prompt_with_schema
from ports.llm import LLMError, M

GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"


class GroqLLM:
    """Primary LLM Provider: Groq's OpenAI-compatible chat API in JSON mode."""

    def __init__(self, *, api_key: str, model: str, timeout_seconds: float = 60.0):
        self._api_key = api_key
        self._model = model
        self._timeout = timeout_seconds

    def generate(self, output_type: type[M], *, system: str, prompt: str) -> M:
        body = {
            "model": self._model,
            "temperature": 0.2,
            "response_format": {"type": "json_object"},
            "messages": [
                {"role": "system", "content": system_prompt_with_schema(system, output_type)},
                {"role": "user", "content": prompt},
            ],
        }
        try:
            response = httpx.post(
                GROQ_URL,
                json=body,
                headers={"Authorization": f"Bearer {self._api_key}"},
                timeout=self._timeout,
            )
            response.raise_for_status()
            content = response.json()["choices"][0]["message"]["content"]
        except (httpx.HTTPError, KeyError, IndexError, TypeError, ValueError) as error:
            raise LLMError(f"Groq request failed: {error}") from error
        return parse_output(output_type, content)
