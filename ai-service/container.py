from pathlib import Path

from adapters.cached_search import CachedSearch
from adapters.cloudflare_llm import CloudflareLLM
from adapters.estimate_search import EstimateSearch
from adapters.fallback_geocoder import FallbackGeocoder
from adapters.fallback_llm import FallbackLLM
from adapters.fallback_search import FallbackSearch
from adapters.fallback_web_search import FallbackWebSearch
from adapters.groq_llm import GroqLLM
from adapters.gtfs_timetable import GtfsTimetable
from adapters.no_geocoder import NoGeocoder
from adapters.nominatim import NominatimGeocoder
from adapters.osrm import OsrmRouter
from adapters.searchapi import SearchApiSearch
from adapters.serpapi import SerpApiSearch
from adapters.serpapi_client import SerpApiClient
from adapters.serpapi_places import SerpApiPlaces
from adapters.serpapi_web import SerpApiWebSearch
from adapters.tavily import TavilyWebSearch
from adapters.web_fares import WebFares
from adapters.wikipedia_geocoder import WikipediaGeocoder
from graph.engine import PlanningEngine
from ports.llm import LLMPort
from ports.web_search import WebSearchPort
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
    return providers[0] if len(providers) == 1 else FallbackLLM(providers[0], providers[1])


def build_web_search(settings: Settings, serpapi: SerpApiClient | None) -> WebSearchPort | None:
    tavily = TavilyWebSearch(api_key=settings.tavily_api_key) if settings.tavily_api_key else None
    serp = SerpApiWebSearch(serpapi) if serpapi else None
    if tavily and serp:
        return FallbackWebSearch(tavily, serp)
    return tavily or serp


def build_engine(settings: Settings) -> PlanningEngine:
    """Composition root: the only place that knows which Providers are plugged in."""
    llm = build_llm(settings)
    # One SerpAPI client, so every feature shares the same monthly quota guard.
    serpapi = SerpApiClient(api_key=settings.serpapi_key) if settings.serpapi_key else None
    web = build_web_search(settings, serpapi)
    search = EstimateSearch(llm, web)
    if serpapi:
        search = FallbackSearch(SerpApiSearch(serpapi), search)
    if settings.searchapi_key:
        search = FallbackSearch(SearchApiSearch(api_key=settings.searchapi_key), search)
    cached = CachedSearch(search, ttl_seconds=settings.search_cache_ttl_seconds)
    fares = WebFares(web, llm) if web else None
    if not settings.geocoder_enabled:
        return PlanningEngine(
            llm=llm,
            hotel_search=cached,
            flight_search=cached,
            geocoder=NoGeocoder(),
            fares=fares,
        )

    # One Nominatim client, so the map pins and the place finder share its rate limit.
    nominatim = NominatimGeocoder(base_url=settings.nominatim_url)
    timetable_path = Path(settings.timetable_path)
    if not timetable_path.is_absolute():
        timetable_path = Path(__file__).resolve().parent / timetable_path
    return PlanningEngine(
        llm=llm,
        hotel_search=cached,
        flight_search=cached,
        geocoder=FallbackGeocoder(WikipediaGeocoder(), nominatim),
        timetable=GtfsTimetable(timetable_path),
        places=nominatim,
        router=OsrmRouter(base_url=settings.osrm_url),
        fares=fares,
        place_details=SerpApiPlaces(serpapi) if serpapi else None,
        place_details_per_trip=settings.serpapi_place_lookups_per_trip,
    )
