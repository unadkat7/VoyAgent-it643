import json

from pydantic import ValidationError

from ports.llm import LLMError, M


def system_prompt_with_schema(system: str, output_type: type[M]) -> str:
    schema = json.dumps(output_type.model_json_schema())
    return f"{system}\n\nReply with one JSON object only, matching this JSON Schema:\n{schema}"


def parse_output(output_type: type[M], raw: str | dict) -> M:
    try:
        if isinstance(raw, str):
            return output_type.model_validate_json(raw)
        return output_type.model_validate(raw)
    except ValidationError as error:
        raise LLMError(f"LLM reply did not match {output_type.__name__}: {error}") from error
