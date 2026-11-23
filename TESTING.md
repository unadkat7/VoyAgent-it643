# Testing

Terms follow [UBIQUITOUS_LANGUAGE.md](UBIQUITOUS_LANGUAGE.md), and the five product rules are the ones in [DESIGN.md](DESIGN.md). Each rule's test was written before its implementation (red commit, then green commit — for example `126bc19` → `1bc0180`, `9f4c17e` → `d647d01`). Citations use `file:line` (`text on that line`), and CI verifies every one with `scripts/check_doc_refs.py`.

## Rule table

| Rule | Test `file:line` | If untested — what stops you |
|---|---|---|
| 1. No plan without the required fields | `ai-service/tests/domain/test_requirements.py:24` (`test_each_required_field_is_reported_when_absent`), `ai-service/tests/test_planning_engine.py:98` (`test_missing_fields_are_decided_by_the_rule_not_the_llm`) | Nothing now. `find_missing_fields` is pure, and the LLM sits behind `ai-service/ports/llm.py:12` (`LLMPort`), filled with `FakeLLM` in `ai-service/graph/engine.py:11` (`PlanningEngine`). If the LLM decided missing fields, testing would require a paid, non-deterministic Provider call. |
| 2. Budget Caps | `ai-service/tests/domain/test_budget.py:11` (`test_hotel_cap_on_and_off_points`), `ai-service/tests/domain/test_budget.py:30` (`test_flight_cap_on_and_off_points_include_grace`), `ai-service/tests/test_planning_engine.py:110` (`test_complete_request_is_planned_with_recommendations_inside_the_caps`) | Nothing now. The caps are pure arithmetic tested on their on-points and off-points, and search sits behind `ai-service/ports/search.py:32` (`HotelSearchPort`) and `ai-service/ports/search.py:36` (`FlightSearchPort`). If filtering lived inside the search adapter next to HTTP, there would be no seam to test it without the network. |
| 3. Planned only when a stay fits the Budget | `ai-service/tests/test_planning_engine.py:177` (`test_when_no_hotel_fits_the_nightly_cap_traveler_is_asked_to_raise_budget`), `ai-service/tests/domain/test_feasibility.py:18` (`test_plan_is_feasible_only_when_total_fits_budget`) | Nothing for the "no stay fits" path. The second check — that the Estimated Cost fits the Budget — is unit-tested only. Through the Planning Engine it cannot fail today because the Budget Caps sum to less than 100% of the Budget (see "Structure and coverage" below). |
| 4. No silent Destination swap | `ai-service/tests/domain/test_airports.py:26` (`test_unknown_place_has_no_airport_instead_of_a_fallback`), `ai-service/tests/test_planning_engine.py:194` (`test_destination_without_known_airport_skips_flights_instead_of_guessing`) | Nothing now. `airport_code` is a pure lookup, and the engine test passes an empty `SequenceSearch` for flights so any unintended flight search fails the test immediately. If airport resolution lived inside the live flight adapter, a silent fallback could only be caught by spending a live search. |
| 5. Only the owner can use a Trip | `backend/tests/domain/trip.test.js:47` (`is true only for the account`), `backend/tests/api/trips.test.js:171` (`forbids another account`), `backend/tests/api/trips.test.js:91` (`refuses to re-plan a planned Trip`) | Nothing now. Ownership and status rules need a database and a signed-in User session. `backend/tests/setup.js:9` (`MongoMemoryServer.create`) supplies an isolated in-memory MongoDB, `supertest` carries the session cookie, and the Planning Engine HTTP call is stubbed at `backend/tests/api/trips.test.js:31` (`function aiAnswers`). |

**How many of the five rules are tested:** 5 of 5, each one directly at the domain level and end-to-end through the Planning Engine or backend HTTP API. Rule 3's total-cost guard is the one partial case: it is unit-tested only.

**One test we would call weak, and why:** `ai-service/tests/adapters/test_groq_llm.py:34` (`test_request_uses_bearer_key_structured_output_and_schema_in_system_prompt`). It has poor resistance to refactoring: it asserts on the exact wire JSON body, where the schema text sits in `messages[0]`, and message ordering. Those are implementation details of the HTTP adapter rather than observable behaviour a Traveler sees, so a harmless refactor (for example moving schema guidance out of the system prompt once Groq no longer needs it) triggers a false positive while the product still works. It stays only because it is the single check pinning our side of Groq's wire contract.

## Structure and coverage

- **Arrange–Act–Assert (AAA):** Tests follow AAA with minimal, boring inputs and one Act per test (exceptions are listed under "Smells found in our own suite" below).
- **Coverage vs. verification:** Coverage is useful only as a negative signal — low coverage flags untested logic, while high coverage proves nothing about assertion strength. Line-and-branch coverage of the ai-service core (`domain/`, `agents/`, `graph/`) is 95% (measured once with `pytest-cov`) and is intentionally **not** a CI gate.
- **What coverage honestly exposed:** `ai-service/agents/budget_check.py:29` (`if not is_within_budget(cost, request.budget):`) executes on every engine run, but its failing branch (lines 30–34) is never taken through the Planning Engine because 50% (Hotel) + 40.25% (Flight with grace) < 100%. The guard is covered directly by `ai-service/tests/domain/test_feasibility.py:18` (`test_plan_is_feasible_only_when_total_fits_budget`) and exists to protect against a future change to those share constants.

## How test cases were derived

Depth follows risk: money math, required-field gating, and User ownership are tested thoroughly; static display code is kept light.

- **Specification tests:** Derived from the five rules and HTTP contracts, independent of internal steps — e.g. `ai-service/tests/domain/test_requirements.py:24` (`test_each_required_field_is_reported_when_absent`), `ai-service/tests/test_planning_engine.py:110` (`test_complete_request_is_planned_with_recommendations_inside_the_caps`), and `backend/tests/api/trips.test.js:171` (`forbids another account`).
- **Boundary tests (partitions, on-points and off-points):**
  - Hotel cap `1000` (on-point) vs `1000.5` (off-point) at `ai-service/tests/domain/test_budget.py:11` (`test_hotel_cap_on_and_off_points`).
  - Flight cap with 15% grace `4025` (on-point) vs `4025.01` (off-point) at `ai-service/tests/domain/test_budget.py:30` (`test_flight_cap_on_and_off_points_include_grace`).
  - Feasibility `7_000` (on-point) vs `6_999` (off-point) at `ai-service/tests/domain/test_feasibility.py:18` (`test_plan_is_feasible_only_when_total_fits_budget`).
  - Required numeric fields: `0` and `-500` rejected at `ai-service/tests/domain/test_requirements.py:39` (`test_non_positive_numbers_count_as_missing`); `1` accepted at `ai-service/tests/domain/test_requirements.py:43` (`test_smallest_valid_numbers_are_accepted`).
  - Auth, rate limit, and feedback boundaries: 8-char vs 7-char password at `backend/tests/api/auth.test.js:34` (`shortest allowed password`), 10th vs 11th login attempt at `backend/tests/api/rateLimit.test.js:7` (`allows 10 attempts per window and blocks the 11th`), and ratings `0`, `6`, `3.5` at `backend/tests/api/feedback.test.js:17` (`rejects a rating`).
- **Structural tests:** Added for specific branches — every valid and invalid `TripStatus` transition in `backend/tests/domain/trip.test.js:12` (`it.each`), the missing `boundingbox` branch in `ai-service/tests/adapters/test_nominatim.py:51` (`test_area_without_bounding_box_has_zero_radius`), and the uncovered cost-guard branch noted above.
- **Property-based tests:** None today (`hypothesis` / `fast-check` are not used). The strongest candidate for one would be `BudgetCaps` + `is_within_budget`, checking across generated positive `budget`, `nights`, and `party_size` inputs that any Hotel and Flight within their caps always yield a Feasible plan without floating-point drift.

## External dependencies and test doubles

Doubles are chosen by interaction direction: **incoming interactions** (queries returning data to the code under test) use **stubs** or **fakes** and are verified by output or state, never by call counts; **outgoing interactions** (observable side effects or boundary contracts) use **spies** or **mocks**.

| Double | Kind | Interaction & why that kind |
|---|---|---|
| `ai-service/tests/fakes.py:14` (`FakeLLM`) | **Stub** (class named `FakeLLM`; acts as a minimal fake only when given a callable) | Incoming query: returns a canned Pydantic model per output type. Tests assert on the resulting Clarification or Trip Plan, never on LLM calls. |
| `ai-service/tests/fakes.py:25` (`BrokenLLM`) | **Stub** | Incoming query: always raises `LLMError` so outage handling is tested deterministically. |
| `ai-service/tests/fakes.py:35` (`SequenceSearch`) | **Stub** | Incoming query: pops prepared search results. Passing zero answers in Rule 4 also proves no flight search ran without adding mock assertions. |
| `ai-service/tests/fakes.py:51` (`FakeGeocoder`) | **Fake**, also read as a **Spy** in two tests | In-memory place map for incoming queries. Because Nominatim enforces 1 req/s, lookup count is an observable boundary constraint, so `ai-service/tests/test_locate.py:105` (`test_same_place_is_looked_up_once_and_destination_is_not_repeated`) and `ai-service/tests/test_locate.py:113` (`test_lookups_are_capped`) inspect its recorded `queries`. |
| `ai-service/tests/fakes.py:74` (`FakeClock`) | **Fake** | Lightweight working clock that advances time for cache TTL, Nominatim's 1 s spacing, and Wikipedia's cool-down without sleeping. |
| `backend/tests/setup.js:9` (`MongoMemoryServer.create`) | **Fake** | Real in-memory MongoDB. We deliberately do **not** mock Mongoose: mocking database calls tests the mock rather than real queries, schema validation, and isolation. |
| `backend/tests/api/trips.test.js:31` (`function aiAnswers`) | **Stub** (`nock`) | Incoming HTTP answer from the Planning Engine, matched only when `X-Internal-Key` is sent. |
| `backend/tests/api/trips.test.js:70` (`sentToPlanner = body`) | **Spy** (`nock`) | Outgoing interaction: captures the request body to verify the backend forwards the full Conversation and `trip_id`. |
| `frontend/tests/TripMap.test.jsx:8` (`vi.mock("leaflet"`) | **Stub** | Replaces Leaflet/react-leaflet with plain DOM nodes because jsdom cannot render canvas/tile maps; tests assert on rendered pins and day filtering. |

## Testability and seams

- **Pure domain core (no seam needed):** `ai-service/domain/`, `backend/src/domain/trip.js`, and `frontend/src/lib/tripView.js` have no I/O, globals, or framework imports. Every rule starts as a pure input → output function.
- **Seam and enabling point pairs:**
  - **ai-service Providers:** seams are `ai-service/ports/llm.py:12` (`LLMPort`), `ai-service/ports/search.py:32` (`HotelSearchPort`), `ai-service/ports/search.py:36` (`FlightSearchPort`), `ai-service/ports/geocoder.py:10` (`GeocoderPort`), plus injected `today` (`ai-service/graph/engine.py:21` (`today`)) and `clock`/`sleep` (`ai-service/adapters/cached_search.py:11` (`clock`), `ai-service/adapters/nominatim.py:24` (`clock`)). The enabling point is constructor injection: production plugs real Providers in `ai-service/container.py:34` (`build_engine`); tests plug doubles in `ai-service/tests/test_planning_engine.py:66` (`make_engine`) and `ai-service/tests/test_api.py:21` (`def client`).
  - **Backend HTTP & DB boundaries:** `backend/src/clients/aiPlanner.client.js:26` (`requestPlan`) isolates the Planning Engine wire format (enabling point: `nock` against `AI_SERVICE_URL` in `backend/tests/api/trips.test.js:31` (`function aiAnswers`)); Mongoose connects through `backend/tests/setup.js:9` (`MongoMemoryServer.create`).
- **One missing seam we still have:** `backend/src/utils/generateToken.js:9` (`env.isProduction`) reads a module-level `env` singleton instead of taking `isProduction` as a parameter. That design flaw surfaces directly in `backend/tests/cookie.test.js:10` (`vi.doMock("../src/config/env.js"`), which has to mock the config module by file path and reset Vitest's module cache. Passing `isProduction` into `getAuthCookieOptions` would remove the mock entirely.

## Test code quality and determinism

### Smells found in our own suite

| `file:line` | Smell | Why it hurts & how to fix |
|---|---|---|
| `ai-service/tests/adapters/test_wikipedia_geocoder.py:74` (`test_fallback_geocoder_falls_back_when_primary_misses_or_errors`) | **Eager Test** | Two separate Acts (primary raises `GeocodeError`, primary returns `None`) in one test; a failure does not name which path broke. Split into two tests or parametrise over the primary double. |
| `backend/tests/api/trips.test.js:178` (`returns 404 for a Trip that does not exist and 400 for a malformed id`) | **Eager Test** | Combines two distinct HTTP error cases in one test; split into two `it` blocks. |
| `frontend/tests/TripBriefBuilder.test.jsx:7` (`tracks the 6 required fields`) | **Eager Test** | Runs multiple Act/Assert cycles (initial disabled state, typing fields, enabled state, submit callback) in a single test; separate readiness transitions from prompt submission. |
| `ai-service/tests/adapters/test_searchapi.py:78` (`test_hotels_are_mapped_to_live_recommendations_and_unpriced_ones_skipped`) | **Assertion Roulette** | Eleven consecutive bare field `assert`s instead of comparing against one expected `HotelRecommendation` object, which would give a single structured diff on failure. |
| `backend/tests/cookie.test.js:10` (`vi.doMock("../src/config/env.js"`) | **Leaking Implementation Details** (caused by a missing seam) | Coupled to the internal config module path; renaming `env.js` breaks the test while cookie behaviour is unchanged. Inject `isProduction` or assert on the `Set-Cookie` header of a real sign-up. |
| `frontend/tests/fixtures.js:2` (`export const PLAN`) | **General Fixture** (mild) | Shared 60-line fixture imported by small unit tests like `frontend/tests/tripView.test.js:103` (`combines Origin and Destination`), which only reads `request.origin`. Replace with tiny local builders like `hotel()` in `ai-service/tests/test_planning_engine.py`. |

### Avoiding Mystery Guest, Resource Optimism, and flakiness

- **No Mystery Guest:** Tests build all inputs inline or in small local helpers; nothing reads external spreadsheets, seeded databases, or untracked local files.
- **No real network (avoiding Resource Optimism):** Outbound HTTP is intercepted with `respx` in `ai-service` and blocked globally with `backend/tests/api/trips.test.js:38` (`nock.disableNetConnect`) in `backend`.
- **No wall clock:** Dates and TTLs use fixed `TODAY` and `FakeClock`.
- **No shared database state:** Each backend test file spins up its own `MongoMemoryServer`, and `backend/tests/setup.js:13` (`afterEach`) clears every collection between tests.
- **Two honest caveats:**
  1. `mongodb-memory-server` downloads a MongoDB binary on the very first run on a fresh machine, so that first backend run requires network access (mild first-run Resource Optimism).
  2. `backend/tests/api/rateLimit.test.js:7` (`allows 10 attempts per window and blocks the 11th`) sits in its own file only because the in-memory login limiter holds module-level mutable state and relies on Vitest's per-file module isolation.

## Usage evidence tests

- **Privacy:** `backend/tests/api/telemetry.test.js:20` (`keeps only the network part`) checks IPv4, IPv4-mapped and IPv6 prefixes. The signup Event test checks that the full IP appears nowhere in the stored Event.
- **Tracking never breaks a request:** `backend/tests/api/telemetry.test.js:65` (`does not fail the request`) makes `Event.create` fail and still expects a 201.
- **Input:** page-view paths must be site paths, at most 200 characters (`backend/tests/api/telemetry.test.js:97` (`rejects the path`)), and known bots are skipped.
- **Planning steps:** `backend/tests/api/trips.test.js:117` (`records each planning step as an Event`).
- **Admin stats:** `backend/tests/api/stats.test.js:20` (`cannot be created through public sign-up`) and `backend/tests/api/stats.test.js:78` (`lists outside users with masked emails`). Every stats route is checked for 401 and 403.
- **Share links:** `backend/tests/api/share.test.js:64` (`shows the plan to anyone`) checks that the conversation and owner are hidden and that views are counted. `backend/tests/api/share.test.js:47` (`refuses a Trip that is not planned yet`) covers the 409.

## Honest gaps (what automated tests do not cover)

- **Location of Visitors:** country and city come from Vercel's `x-vercel-ip-country` / `x-vercel-ip-city` headers. Tests set them by hand. Locally they are missing, so only the live site shows real locations.
- **Team members count as Outside users:** only `ADMIN_EMAILS` accounts are left out of the stats. If a team member signs up with their own email, their usage counts too. Team members use the admin account for demos.
- **Page views from browsers that block requests** (some ad blockers) are not recorded. Vercel Analytics is the second source for visitor counts.

- **The Trip planning page** (`frontend/src/app/trip/new/page.js`) has no automated test. It was checked by hand in the browser: receiving a Clarification, resuming a `draft` Trip from the dashboard, retrying after `planning_failed`, and redirecting to the Trip Plan.
- **`AgentProgressCard`** animates on client-side timers rather than live backend progress and is untested.
- **LLM output quality** (whether an Itinerary is realistic and well-paced) is not testable with stubs; only manual smoke runs hit real LLM Providers.
- **Live LLM fallback:** Stubbed HTTP tests did not catch that Cloudflare Workers AI defaults to a 256-token cap, which truncated a 3-day Itinerary mid-JSON during a manual fallback test with an invalid Groq key. The limit was raised and pinned by `ai-service/tests/adapters/test_cloudflare_llm.py:50` (`test_request_allows_a_full_itinerary_length_answer`).
- **Trip Map visuals:** `frontend/tests/TripMap.test.jsx:27` (`filters to one day`) verifies pin selection and filtering with Leaflet stubbed; actual tile loading, zooming, and popups were checked by hand in the browser.
- **Real geocoder accuracy:** `FakeGeocoder` verifies capping and region filtering (`ai-service/tests/test_locate.py:134` (`test_out_of_region_pin_far_from_destination_is_discarded`), `ai-service/tests/test_locate.py:152` (`test_large_destination_keeps_pins_across_its_whole_area`)), not whether a real Provider resolves an Indian landmark accurately.
  - A live Goa run missed 3 of 9 Activities (names like `"Palolem Beach, South Goa"`), leading to retry-by-name, and revealed that CARTO tiles now require a key, leading to OpenStreetMap tiles.
  - Later live runs showed Nominatim placing landmarks in the wrong city, leading to the Wikipedia-first geocoder and region check, verified live on Rajasthan, Goa, and Ujjain.
- **Live deployment:** First-party cookies and same-origin CORS are verified locally (`backend/tests/cookie.test.js:9` (`SameSite=Lax`), `backend/tests/health.test.js:22` (`same-origin request`)), but routing `/api` and keeping `ai-service` private on Vercel can only be confirmed on the live URL.
- **Multi-instance rate limits:** Login rate limiting is stored in process memory; single-process tests cannot catch per-instance counters across serverless copies on Vercel.

## Running the tests

```bash
cd ai-service && uv run pytest     # 149 tests
cd backend && npm test             # 96 tests
cd frontend && npm test            # 43 tests
python scripts/check_doc_refs.py   # checks every file:line citation in DESIGN.md, TESTING.md, UBIQUITOUS_LANGUAGE.md
```

All four commands run on every push and pull request in `.github/workflows/ci.yml`.
