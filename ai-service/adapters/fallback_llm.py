import logging

from ports.llm import LLMError, LLMPort, M

logger = logging.getLogger(__name__)


class FallbackLLM:
    """Try the primary Provider; on LLMError ask the fallback. Itself an LLMPort."""

    def __init__(self, primary: LLMPort, fallback: LLMPort):
        self._primary = primary
        self._fallback = fallback

    def generate(self, output_type: type[M], *, system: str, prompt: str) -> M:
        try:
            return self._primary.generate(output_type, system=system, prompt=prompt)
        except LLMError as primary_error:
            logger.warning("Primary LLM failed, using fallback: %s", primary_error)
            try:
                return self._fallback.generate(output_type, system=system, prompt=prompt)
            except LLMError as fallback_error:
                raise LLMError(
                    f"All LLM providers failed: {primary_error}; {fallback_error}"
                ) from fallback_error
