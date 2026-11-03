from adapters.cached_search import CachedSearch
from adapters.cloudflare_llm import CloudflareLLM
from adapters.estimate_search import EstimateSearch
from adapters.fallback_llm import FallbackLLM
from adapters.fallback_search import FallbackSearch
from adapters.groq_llm import GroqLLM
from adapters.searchapi import SearchApiSearch
from graph.engine import PlanningEngine
from ports.llm import LLMPort
from settings import Settings


def build_llm(settings: Settings) -> LLMPort:
    providers: list[LLMPort] = []
    if settings.groq_api_key:
        providers.append(GroqLLM(api_key=settings.groq_api_key, model=settings.groq_model))
    if settings.cloudflare_account_id and settings.cloudflare_api_token:
        providers.append(
            CloudflareLLM(
                account_id=settings.cloudflare_account_id,
                api_token=settings.cloudflare_api_token,
                model=settings.cloudflare_model,
            )
        )
    if not providers:
        raise RuntimeError("Set GROQ_API_KEY or the CLOUDFLARE_* variables to plan Trips.")
    if len(providers) == 1:
        return providers[0]
    return FallbackLLM(providers[0], providers[1])


def build_engine(settings: Settings) -> PlanningEngine:
    """Composition root: the only place that knows which Providers are plugged in."""
    llm = build_llm(settings)
    search = EstimateSearch(llm)
    if settings.searchapi_key:
        search = FallbackSearch(SearchApiSearch(api_key=settings.searchapi_key), search)
    cached = CachedSearch(search, ttl_seconds=settings.search_cache_ttl_seconds)
    return PlanningEngine(llm=llm, hotel_search=cached, flight_search=cached)
