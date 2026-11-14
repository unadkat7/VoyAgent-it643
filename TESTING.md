# Testing

Rules are the five in [DESIGN.md](DESIGN.md). Each rule's test was written before its code (red commit, then green commit; see `git log`). Citations are `file:line` (`text on that line`) and are checked in CI.

## Rule table

| Rule | Test `file:line` | If untested, what stops you |
|---|---|---|
| 1. No plan without the required fields | `ai-service/tests/domain/test_requirements.py:24` (`test_each_required_field_is_reported_when_absent`), `ai-service/tests/test_planning_engine.py:93` (`test_missing_fields_are_decided_by_the_rule_not_the_llm`) | Nothing now. `find_missing_fields` is pure, and the LLM sits behind `LLMPort`. If the LLM decided missing fields, testing would require a paid, non-deterministic Provider call. |
| 2. Budget Caps | `ai-service/tests/domain/test_budget.py:11` (`test_hotel_cap_on_and_off_points`), `ai-service/tests/domain/test_budget.py:30` (`test_flight_cap_on_and_off_points_include_grace`), `ai-service/tests/test_planning_engine.py:105` (`test_complete_request_is_planned_with_recommendations_inside_the_caps`) | Nothing now. The caps are pure arithmetic, and search sits behind `HotelSearchPort` and `FlightSearchPort`. If filtering lived inside the search adapter next to HTTP, there would be no seam to test it without the network. |
| 3. Planned only when a stay fits the Budget | `ai-service/tests/test_planning_engine.py:157` (`test_when_no_hotel_fits_the_nightly_cap_traveler_is_asked_to_raise_budget`), `ai-service/tests/domain/test_feasibility.py:18` (`test_plan_is_feasible_only_when_total_fits_budget`) | Nothing for the "no stay fits" path. The `is_within_budget` guard is only unit-tested: through the Planning Engine it cannot fail today, because the caps sum to less than 100%. |
| 4. No silent Destination swap | `ai-service/tests/domain/test_airports.py:26` (`test_unknown_place_has_no_airport_instead_of_a_fallback`), `ai-service/tests/test_planning_engine.py:174` (`test_destination_without_known_airport_skips_flights_instead_of_guessing`) | Nothing now. `airport_code` is a pure lookup, and the engine test uses an empty search stub so any unintended flight search fails immediately. |
| 5. Only the owner can use a Trip | `backend/tests/api/trips.test.js:150` (`forbids another account`), `backend/tests/domain/trip.test.js:46` (`is true only for the account`), `backend/tests/api/trips.test.js:90` (`refuses to re-plan a planned Trip`) | Nothing now. It needs a database and a signed-in session; `mongodb-memory-server` and a supertest agent provide both. |

**How many of the five rules are tested:** 5 of 5, each at the rule level and through the running Planning Engine or HTTP API.

**One test we would call weak:** `ai-service/tests/adapters/test_groq_llm.py:34` (`test_request_uses_bearer_key_structured_output`). It checks the exact JSON body we send to Groq: field names, the schema's location and the message order. That is an implementation detail of the HTTP call, not behaviour a Traveler sees. A harmless refactor, such as moving the schema text out of the system prompt, would turn it red while the product still works. It stays only because it is the one place that pins our side of Groq's wire contract.

## Other honest gaps

- **The planner chat page** (`frontend/src/app/trip/new/page.js`) has no automated test. It was checked by hand in the browser: Clarification, resume from the dashboard, retry after `planning_failed`, and redirect to the Trip Plan.
- **`AgentProgressCard`** animates on timers, not on real progress from the backend, and is untested.
- **The quality of LLM output** (is the itinerary sensible?) is not tested. Tests use a `FakeLLM`; only manual smoke runs hit the real Providers.
- **The Cloudflare adapter** is tested only against stubbed HTTP. A live call has not succeeded yet because we still need a valid API token.

## Test doubles used

| Double | Kind | Why that kind |
|---|---|---|
| `ai-service/tests/fakes.py:13` (`FakeLLM`) | Fake | A working stand-in that answers each output type; the tests assert on the plan, never on calls made. |
| `ai-service/tests/fakes.py:24` (`BrokenLLM`) | Stub | Gives one canned answer: failure. |
| `ai-service/tests/fakes.py:34` (`SequenceSearch`) | Stub | Search is a query, so stub it. A stub with no answers left also proves "never called" (Rule 4) without counting calls. |
| `ai-service/tests/fakes.py:50` (`FakeClock`) | Fake | Lets the cache test move time forward. |
| `backend/tests/setup.js:9` (`MongoMemoryServer.create`) | Fake | A real MongoDB in memory: fast, isolated, no mocks of Mongoose. |
| `backend/tests/api/trips.test.js:30` (`function aiAnswers`) | Stub | An incoming answer from the Planning Engine, matched only when the internal key is sent. |
| `backend/tests/api/trips.test.js:69` (`sentToPlanner = body`) | Spy | Records what the backend sent, because "the whole Conversation is sent" is an outgoing interaction. |

## Running the tests

```bash
cd ai-service && uv run pytest     # 115 tests
cd backend && npm test             # 51 tests
cd frontend && npm test            # 23 tests
python scripts/check_doc_refs.py   # every file:line in these docs
```

CI runs all of these on every push (`.github/workflows/ci.yml`).
