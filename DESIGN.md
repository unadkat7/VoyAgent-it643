# Design

Terms follow [UBIQUITOUS_LANGUAGE.md](UBIQUITOUS_LANGUAGE.md). Citations are `file:line` (`text on that line`) and are checked in CI by `scripts/check_doc_refs.py`.

```
frontend (Next.js) --cookie--> backend (Express + MongoDB) --X-Internal-Key--> ai-service (FastAPI + LangGraph)
                                                                                 core: domain/ agents/ graph/
                                                                                 ports/  <-implemented by-  adapters/ (Groq, Cloudflare, SearchApi.io, Nominatim)
```

## Rules the product enforces

1. **Plan first, ask after.** Only the Destination is required; without it the Traveler gets a Clarification. Anything else left out gets a stated default (3 days, 2 Travelers, relaxed style, a Budget that matches the style), and a missing Origin leaves travel out. The Trip Plan lists what was assumed and asks for those details so the Trip can be refined. Code decides the defaults, not the LLM.
   `ai-service/domain/requirements.py:21` (`find_missing_fields`), `ai-service/domain/requirements.py:26` (`fill_defaults`), applied at `ai-service/agents/understand.py:41` (`find_missing_fields`).
2. **Budget Caps.** A Hotel is recommended only if one room-night costs at most 50% of the Budget divided by Nights and rooms (two Travelers share a room). A Flight fits if its fare is at most 35% of the Budget divided by Party Size, plus a 15% grace margin. Fitting fares come first; when none fits, the cheapest are still shown, flagged "Over your flight budget", so the Traveler can compare them with train, bus and car.
   `ai-service/domain/budget.py:34` (`allows_hotel`), `ai-service/domain/budget.py:37` (`allows_flight`), applied at `ai-service/agents/hotels.py:30` (`allows_hotel`) and `ai-service/agents/flights.py:56` (`allows_flight`).
3. **Planned only when a stay fits the Budget.** If Hotels were found but none fits the nightly cap, VoyAgent does not produce a plan. It asks the Traveler to raise the Budget, shorten the Trip or pick another Destination, and quotes the cheapest stay it found. The stay and the counted way to travel (the Traveler's pick, else the cheapest Travel Option) must also fit the Budget; food, local travel and Activities are shown in the Estimated Cost but are rough, so they never block a plan. A Budget the Traveler never gave is only a guess and never blocks a plan either.
   `ai-service/agents/budget_check.py:17` (`hotels_over_budget`), guard at `ai-service/agents/budget_check.py:58` (`is_within_budget`).
4. **No silent Destination swap.** A place with no known Airport Code never falls back to another city's airport. Flights are skipped and the Trip Plan carries a Note that says why.
   `ai-service/domain/airports.py:54` (`airport_code`), `ai-service/agents/flights.py:20` (`origin_code`).
5. **Only the owner can use a Trip.** Reading, continuing or deleting someone else's Trip gives 403, a missing Trip gives 404 and a malformed id gives 400. A `planned` Trip is never planned again from scratch (409); its owner changes it in the trip chat while the plan is a Draft, and a Final plan is locked until switched back.
   `backend/src/domain/trip.js:52` (`isOwnedBy`), `backend/src/services/trip.service.js:16` (`findOwnedTrip`).
6. **Trains and roads come from data, and a place is never guessed.** Train numbers and times come only from the timetable, and road distances only from the routing Provider; the LLM may describe them but not write them. A place name that matches two far-apart places of similar size and fame is not guessed: trains and roads are skipped with a Note asking for the state.
   `ai-service/agents/rail.py:32` (`make_rail_node`), `ai-service/domain/places.py:22` (`pick_place`), with the LLM told not to invent them at `ai-service/agents/compose.py:10` (`train times`).
7. **Plan only real places on Earth.** Ask for a reachable destination and flag trips over 30 days or nights or 20 travelers before searching. When stated days or budget fall below the regional floor, explain what would work.
8. **A Trip is an ordered list of stops.** Each city has its own dates, stays and itinerary days. Travel costs include the journey home and transfers between cities.

Five rejected place or off-topic inputs in the past hour pause planning and trip chat for that account. Missing details and feasibility questions do not count as rejections. The existing hourly planner limit still applies.

## Three design decisions

### 1. The LLM sits behind a port the core owns (DIP and the boundary)

- **Where:** `ai-service/ports/llm.py:12` (`LLMPort`), `ai-service/adapters/fallback_llm.py:8` (`FallbackLLM`), wired only in `ai-service/container.py:43` (`FallbackLLM`).
- **Before:** Calling a vendor SDK directly from each LangGraph agent couples high-level planning steps to one Provider, forces edits across every agent when the model or wire format changes, and requires live API keys to test planning rules.
- **Why it changed:** Our LLM setup changed repeatedly during development: we added Cloudflare Workers AI as a fallback behind Groq, switched Groq to schema-constrained JSON output with transient-failure retries (`c1dfda1`), and raised Cloudflare's default token limit so long Itineraries are not truncated (`3baf27b`). Every change stayed inside `adapters/`. Agents accept an `LLMPort` through constructor injection, so tests pass `FakeLLM` (`ai-service/tests/fakes.py:14` (`FakeLLM`)) with no network access.

### 2. Budget arithmetic moved out of the LLM and adapters into one pure module (SRP)

- **Where:** `ai-service/domain/budget.py:13` (`BudgetCaps`), used by `ai-service/agents/budget_check.py:10` (`budget_check`). The final LLM call only writes prose: `ai-service/agents/compose.py:66` (`TripSummary`).
- **Before:** Relying on the LLM to judge whether prices fit the Budget is non-deterministic, and pushing price caps down into the search adapter (`SearchApiSearch` in `7c02515`) split one money rule across two layers while hiding over-budget stays from Rule 3. Standard floating-point arithmetic also rejected exact boundary fares (such as a ₹4,025 fare against a ₹3,500 + 15% cap).
- **Why it changed:** Money rules must be deterministic, single-sourced, and testable on exact boundary values. Now one pure module owns the shares and uses `Fraction` (`ai-service/domain/budget.py:33` (`Fractions keep`)). Recommendations pass into the Trip Plan unchanged instead of being regenerated by the LLM.

### 3. Trip Status is an explicit state machine (types as design)

- **Where:** `backend/src/domain/trip.js:26` (`nextStatus`), used at `backend/src/services/trip.service.js:49` (`nextStatus`).
- **Before:** Early `backend/src/models/trip.model.js` (`44aa1cb`) allowed the raw strings `clarification_needed | completed | error`. The controller assigned them directly, `error` was never set, a completed Trip could be planned again, and the UI checked `status === "completed"` by hand. "Completed" also meant "plan ready", which clashes with the travel meaning (flagged in the glossary).
- **Why it changed:** Illegal states should be impossible to build, not checked everywhere. `TripStatus` is frozen. Moves are allowed only through a transition table where `planned` is terminal; a planned plan changes only through a Plan Edit, allowed while it is a Draft (`canEditPlan`). A Planning Engine outage is now recorded as `planning_failed` so the Traveler can retry the same Trip. All of it is pure code with no Express or Mongoose, tested in `backend/tests/domain/trip.test.js:24` (`a planned Trip never goes back to planning`).

## One boundary

**Where core logic stops:** inside `ai-service`, the core is `domain/`, `agents/` and `graph/`. `domain/` imports nothing from LangGraph, LangChain, HTTP clients or settings (`ai-service/domain/__init__.py:1` (`Pure trip rules`)). Agents and the graph depend only on the ports: `ai-service/ports/llm.py:12` (`LLMPort`), `ai-service/ports/search.py:32` (`HotelSearchPort`), `ai-service/ports/search.py:36` (`FlightSearchPort`), `ai-service/ports/geocoder.py:10` (`GeocoderPort`).

**Where the outside world begins:** `adapters/` (Groq, Cloudflare Workers AI, SearchApi.io, Wikipedia, Nominatim, plus the cache, fallback and estimate wrappers), `settings.py`, `container.py` and the FastAPI app. Source dependencies point inward: adapters import ports, and the core never imports an adapter. `container.py` is the only file that knows which Providers are plugged in (`ai-service/container.py:54` (`build_engine`)).

The Trip Map reused this boundary. Coordinates come from `GeocoderPort`; Wikipedia is tried first for landmarks, falling back to the free OpenStreetMap Nominatim adapter (`ai-service/adapters/nominatim.py:20` (`NominatimGeocoder`)), which keeps Nominatim's one-request-a-second limit and caches answers. The locate step runs after `budget_check`, so only Feasible plans spend lookups (`ai-service/graph/builder.py:104` (`"locate", "compose"`)). It never fails a plan: an outage leaves Coordinates empty and adds a Note. The LLM is never asked for Coordinates, because `coordinates` is hidden from the JSON Schema it sees (`ai-service/schemas/itinerary.py:14` (`SkipJsonSchema`)); invented lat/long would put pins kilometres away.

**What it protects us from:** volatile external Providers. During development we paired Groq with a Cloudflare Workers AI fallback, adjusted Groq and Cloudflare wire handling, added `EstimateSearch` behind SearchApi.io for when the free quota runs out, and placed Wikipedia in front of Nominatim for landmark accuracy. None of these changes touched a domain rule or a test of a rule.

**Cost:** one interface per Provider kind and one more level of indirection. A boundary is only worth its cost where the outside side is likely to change; here our Providers changed repeatedly, so it paid for itself. The backend uses the same idea for the Planning Engine: `backend/src/clients/aiPlanner.client.js:65` (`requestPlan`) is the only file that knows the ai-service wire format.

## Usage evidence (telemetry, admin page, Share links)

To show use by people outside the team, the backend records an Event for each page view, sign-up, login, planning step, Trip view, share, feedback and whitelisted UI/TripMap interaction. It's written by one function, `backend/src/services/telemetry.service.js:84` (`recordEvent`), called from the controllers. Admins read it on `/admin` (`frontend/src/components/admin/AdminDashboard.jsx:35` (`AdminPage`)).

- **Privacy by design:** we never store the full IP. An Event keeps the /24 (IPv4) or /48 (IPv6) prefix (`backend/src/services/telemetry.service.js:45` (`ipPrefix`)), the country and city that Vercel puts in request headers, the device from the user agent, an external referrer hostname (never paths or query strings), and a salted daily Visitor hash (`backend/src/services/telemetry.service.js:65` (`visitorHash`)). Events expire after 90 days. The admin user list masks emails (`backend/src/utils/maskEmail.js:2` (`maskEmail`)).
- **Tracking never breaks the product:** `recordEvent` catches and logs its own failures (`backend/src/services/telemetry.service.js:109` (`catch (error)`)). It's awaited rather than fire-and-forget, because a Vercel function can be frozen right after the response, which would lose the write.
- **Admins are not evidence:** stats leave out every `ADMIN_EMAILS` account (`backend/src/controllers/stats.controller.js:33` (`insiderIds`)). Admin emails also cannot sign up publicly (`backend/src/services/auth.service.js:9` (`adminEmails.includes`)); otherwise whoever registered the address first would become an admin. The admin account is created by `npm run seed:admin` from environment variables.
- **Share links** bring in new Visitors. Only a `planned` Trip can be shared (`backend/src/domain/trip.js:47` (`canShare`)). The public view returns only the Destination and the Trip Plan (`backend/src/services/trip.service.js:167` (`viewSharedTrip`)), and the owner page and share page render the same `frontend/src/components/trip/TripPlanView.jsx:50` (`TripPlanView`).

## AI use

**Tools and what they were used for**

- **Claude Code (Claude Opus 5.5)** was used to:
  - draft the port boundaries and the five product rules;
  - write each area's tests first and then the implementation;
  - run live smoke checks against Groq, Cloudflare Workers AI, SearchApi.io and Nominatim, plus end-to-end browser checks.

  Every change was made on a feature branch and reviewed by the area's owner before merging.
- **Groq (`openai/gpt-oss-120b`) and Cloudflare Workers AI** are runtime Providers inside the product. They extract the Trip Request and write the Itinerary, the summary and the estimates. They never decide a rule.

**One AI suggestion we rejected:** Claude suggested sending the Budget Caps to SearchApi.io as `price_max` / `max_price`, so that only affordable Hotels and Flights would come back. It was implemented in commit `7c02515`. We rejected it while writing the Planning Engine tests, for two reasons:
- If the Provider filters, an empty result cannot tell "everything is too expensive" from "there is nothing there".
- Rule 3 could then never trigger, because a 50% share plus a 40.25% share is always under 100% of the Budget.

The caps now apply in the core, after the search (commits `f29e15d` test, `36e3006` fix). Over-budget results stay visible, and the Traveler is told the cheapest price we found.
