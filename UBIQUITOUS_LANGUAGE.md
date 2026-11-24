# Ubiquitous Language

The words VoyAgent uses in the UI, the code, the tests and these docs. One word, one meaning. When code and this page disagree, the code is wrong or this page must change in the same commit.

Citations are `file:line` (`text expected on that line`) and are checked in CI by `scripts/check_doc_refs.py`.

## Terms

| Term | Definition | Aliases to avoid | Named in code at |
|---|---|---|---|
| **Traveler** | A person who goes on the Trip. Travelers speak in the Conversation. | Customer, Passenger, User (for a person travelling) | `ai-service/schemas/api.py:9` (`traveler`), `backend/src/models/trip.model.js:6` (`traveler`) |
| **User** | A VoyAgent account: email, password, session. Only for sign-in and ownership, never for a person travelling. | Member, Customer | `backend/src/models/user.model.js:59` (`User`), `backend/src/models/trip.model.js:15` (`userId`) |
| **Trip** | One planning attempt owned by a User: its Conversation, Trip Status and, once planned, its Trip Plan. | Journey, Vacation, Thread | `backend/src/models/trip.model.js:55` (`Trip`) |
| **Conversation** | The ordered turns between the Traveler and the assistant for one Trip. The Planning Engine reads all of it on every call. | Prompt history, Thread, Chat | `backend/src/models/trip.model.js:25` (`conversation`), `ai-service/schemas/api.py:8` (`ConversationTurn`) |
| **Trip Request** | What the Planning Engine understood from the Conversation: Origin, Destination, Duration, Budget, Party Size, Travel Style and optional details. | Requirements, Planner output | `ai-service/schemas/trip_request.py:20` (`TripRequest`) |
| **Origin** | The city the Travel Party starts from. Not a Destination. | Departure, Source, From | `ai-service/schemas/trip_request.py:23` (`origin`) |
| **Destination** | The main city or region the Trip goes to. | Place, To, Location | `ai-service/schemas/trip_request.py:24` (`destination`), `backend/src/models/trip.model.js:26` (`destination`) |
| **Duration** | Number of days of the Trip. A 3-day Trip books 3 nights, or 2 if the Traveler says so (3D/2N). | Length, Days count | `ai-service/schemas/trip_request.py:25` (`duration_days`) |
| **Travel Dates** | Check-in and check-out dates. Check-out is the day after the last day. | Schedule | `ai-service/domain/dates.py:8` (`TripDates`) |
| **Nights** | Check-out minus check-in. Hotel costs are counted per night. | Days (when nights are meant) | `ai-service/domain/dates.py:15` (`nights`) |
| **Travel Party** / **Party Size** | The group travelling together / how many Travelers are in it, the speaker included. | Travelers (as a number), Adults, Pax | `ai-service/schemas/trip_request.py:30` (`party_size`) |
| **Travel Style** | The kind of Trip wanted, e.g. budget, relaxed, luxury, adventure, family. A Preference, not a Constraint. | Trip type, Mode | `ai-service/schemas/trip_request.py:31` (`travel_style`) |
| **Budget** | Total money, in INR, the whole Travel Party wants to spend on the Trip. | Price, Cost (they mean other things) | `ai-service/schemas/trip_request.py:29` (`budget`) |
| **Budget Caps** | The shares of the Budget one item may use: Hotel 50% per night; Flight 35% per Traveler plus 15% grace. | Limits, Max price | `ai-service/domain/budget.py:13` (`BudgetCaps`) |
| **Clarification** | The assistant's question asking for the Destination, or asking to raise the Budget. Details the plan assumed are asked for after the plan, as its follow-up. | Follow-up, Critique | `ai-service/schemas/api.py:28` (`Clarification`), `backend/src/models/trip.model.js:27` (`clarification`) |
| **Recommendation** | A Hotel or Flight the Planning Engine suggests. Never a booking. | Option, Suggestion, Booking | `ai-service/schemas/recommendations.py:12` (`HotelRecommendation`), `ai-service/schemas/recommendations.py:27` (`FlightRecommendation`) |
| **Price Source** | Where a Recommendation's price came from: `live` (a Provider search) or `estimated` (the AI, using web search results when Tavily is set up). | Real/fake price | `ai-service/schemas/recommendations.py:9` (`PriceSource`) |
| **Travel Option** | One priced way there and back for the whole Travel Party: flight, train, bus or car. Train and bus fares are ranges read from web search; car cost is distance × a per-km rate per car. The owner picks which one counts in the Estimated Cost; the cheapest counts until then. | Transport, Mode | `ai-service/schemas/travel.py:49` (`TravelOption`), `ai-service/domain/travel_costs.py:20` (`travel_options`) |
| **Plan Edit** | A chat message about a planned Trip. The Planning Engine answers it, edits only the Itinerary, or re-plans with the changed Trip Request details. | Refine, Re-plan, Regenerate | `ai-service/schemas/edit.py:6` (`PlanEdit`), `ai-service/graph/editor.py:62` (`PlanEditor`) |
| **Draft / Final plan** | Whether a planned Trip can still be changed in the chat (Draft) or is locked (Final). Not the same as Trip Status `draft`, which means no plan yet. | Locked, Published | `backend/src/models/trip.model.js:37` (`finalized`), `backend/src/domain/trip.js:42` (`canEditPlan`) |
| **Estimated Cost** | A non-final price in INR: the first listed Hotel for all Nights and rooms, the counted Travel Option, the Activities, and a rough food and local travel amount per Traveler per day. | Price, Total cost, Actual cost | `ai-service/schemas/plan.py:20` (`EstimatedCost`), `ai-service/domain/feasibility.py:23` (`estimate_trip_cost`) |
| **Feasible** | A plan whose Estimated Cost fits the Budget. Says nothing about availability. | Valid, Possible | `ai-service/domain/feasibility.py:46` (`is_within_budget`) |
| **Itinerary** / **Itinerary Day** / **Activity** | The day-by-day plan / one day of it / one thing to do in a day. | Schedule, Agenda, Event | `ai-service/schemas/itinerary.py:24` (`Itinerary`), `ai-service/schemas/itinerary.py:17` (`ItineraryDay`), `ai-service/schemas/itinerary.py:7` (`Activity`) |
| **Trip Plan** | The finished result: summary, tips, Recommendations, Itinerary, Estimated Cost and Notes. | Final plan, Final output, Itinerary (for the whole) | `ai-service/schemas/plan.py:43` (`TripPlan`), `backend/src/models/trip.model.js:32` (`plan`) |
| **Note** | A plain sentence in the Trip Plan explaining something skipped or changed, e.g. "Flights were skipped". | Warning, Error | `ai-service/schemas/plan.py:54` (`notes`) |
| **Trip Status** | `draft` (still needs details), `planned` (has a Trip Plan; changed only through Plan Edits), `planning_failed` (the Planning Engine was unavailable; can be retried). | In progress, Completed, Error | `backend/src/domain/trip.js:3` (`TripStatus`) |
| **Planning Engine** | The ai-service component that turns a Conversation into a Clarification or a Trip Plan. | AI, Agent, Bot, LLM (for the whole engine) | `ai-service/graph/engine.py:16` (`PlanningEngine`) |
| **Provider** | An outside service VoyAgent depends on: Groq and Cloudflare (LLMs), SearchApi.io (Hotels and Flights), Wikipedia (Coordinates of famous landmarks, tried first) and OpenStreetMap Nominatim (all other Coordinates, and the Destination's area). | API, Vendor | `ai-service/adapters/groq_llm.py:11` (`GroqLLM`), `ai-service/adapters/searchapi.py:13` (`SearchApiSearch`), `ai-service/adapters/wikipedia_geocoder.py:79` (`WikipediaGeocoder`), `ai-service/adapters/nominatim.py:20` (`NominatimGeocoder`) |
| **Coordinates** | Latitude and longitude of the Destination, a Hotel or an Activity, found by a geocoder Provider after the plan is Feasible. Never written by the LLM. Missing when a place cannot be found. | Location (that is the place name text), GPS, Lat/long | `ai-service/schemas/geo.py:8` (`GeoPoint`), `ai-service/agents/locate.py:82` (`make_locate_node`) |
| **Trip Map** | The Map tab of a Trip Plan: one pin per place that has Coordinates, filterable by Itinerary Day. | Map view, Location map | `frontend/src/components/trip/TripMap.jsx:181` (`TripMap`) |
| **Airport Code** | The IATA code for a known city. Unknown places have none. | Airport id | `ai-service/domain/airports.py:54` (`airport_code`) |
| **Train Option** | A way to get there or back by train: one train, or two with a change at the same station. Numbers and times come only from the timetable, never the LLM. No fares; the Traveler checks fares on IRCTC. | Train recommendation, Rail booking | `ai-service/schemas/travel.py:19` (`TrainOption`), `ai-service/agents/rail.py:32` (`make_rail_node`) |
| **Railhead** | A busy station near a Destination that has none of its own (Haridwar for Badrinath). Train Options end there and a Road Leg goes the rest of the way. | Nearest station, Rail end | `ai-service/domain/rail.py:102` (`railheads`) |
| **Road Route** | The whole way from Origin to Destination by road, a travel option of its own next to flights and trains. Distance from a routing Provider; hours shown as a range. | Drive, Car option | `ai-service/schemas/travel.py:62` (`RoadRoute`), `ai-service/agents/road.py:11` (`make_road_node`) |
| **Road Leg** | The drive from a Railhead to the Destination. Same shape as a Road Route, but only the last part of the trip. | Last mile, Transfer | `ai-service/agents/rail.py:93` (`road_leg`) |
| **Event** | One recorded thing a visitor did (a page view, a sign-up, a Trip planned, feedback sent, or a whitelisted UI/TripMap interaction), with a network prefix, country, city and device. Kept 90 days. Never a plan item. | Log, Hit, Activity (that is an Itinerary item) | `backend/src/models/event.model.js:44` (`eventSchema`), `backend/src/models/event.model.js:3` (`EVENT_TYPES`) |
| **Visitor** | Whoever sent an Event, counted by a daily hash of IP and browser, so the IP itself is never stored. A Visitor may or may not have a User account. | Session, Client | `backend/src/services/telemetry.service.js:65` (`visitorHash`) |
| **Outside user** | A User whose email is not in `ADMIN_EMAILS`. Usage stats count only Outside users. | Real user, Customer | `backend/src/controllers/stats.controller.js:33` (`insiderIds`) |
| **Share link** | A public, read-only link to a `planned` Trip, created by its owner. Shows the Trip Plan, never the Conversation or the owner. | Public trip, Invite | `backend/src/models/trip.model.js:41` (`shareId`), `backend/src/domain/trip.js:47` (`canShare`) |

## Flagged ambiguities

1. **User vs Traveler.** Early code used "user" for both the account and the person travelling. **Winner:** *User* is only the account (sign-in, ownership: `userId`). *Traveler* is the person travelling and the speaker in the Conversation. The API says `role: "traveler"`, not `"user"`.
2. **Trip vs thread.** Early `trip.model.js` (`44aa1cb`) stored a `threadId` next to the Trip id for the same conversation, so one thing had two names. **Winner:** *Trip*. `threadId` was removed and the Trip id is sent to the Planning Engine as `trip_id`.
3. **"travelers" meant a person and a number.** Early domain code used `travelers: 2` as a count named like a person (`6ff456e`). **Winner:** *Party Size* (`party_size`) for the count and *Traveler* for a person.
4. **Departure vs Origin.** Early domain code said `departure` while the glossary said *Origin* (`6ff456e`). **Winner:** *Origin*. "Departure" stays only for a flight's departure airport or time.
5. **Clarification vs critique.** Asking for missing fields and asking to raise an over-budget Trip could have been split into "clarification" and "critique". **Winner:** *Clarification*, for any question back to the Traveler.
6. **Days vs nights.** Code risked mixing `duration_days` with nights when pricing hotels. **Winner:** *Duration* is days; *Nights* is check-out minus check-in, and Hotel cost always uses Nights.
7. **Budget vs Estimated Cost vs price.** "Budget" was sometimes used informally for a hotel's nightly price. **Winner:** *Budget* is only the Traveler's total; a Recommendation has a price with a *Price Source*; the total of a plan is its *Estimated Cost*.
8. **Completed vs Planned.** Early `trip.model.js` (`44aa1cb`) used `completed` to mean "plan ready", but in travel, completed means the Trip already happened. **Winner:** *planned*.
9. **Location vs Coordinates.** An Activity's and a Hotel's `location` is a place name the LLM writes ("Baga"), and the map feature initially called its lat/long points "Locations" too (`68051a4`). **Winner:** `location` stays the place name; the found lat/long is *Coordinates* (`coordinates`, `destination_coordinates`).
10. **Event vs Activity.** Usage tracking needed a word for "something a visitor did", and "activity" was the natural choice, but an *Activity* is already an Itinerary item. **Winner:** *Event* for usage records (`Event`, `recordEvent`). The admin page's "Recent activity" heading is UI copy only; code and docs say Event.
11. **Road Route vs Road Leg.** Both are drives with the same shape (`RoadRoute`), so they were easy to blur. **Winner:** *Road Route* is Origin to Destination by road on its own (`road_route`); *Road Leg* is only the Railhead-to-Destination part after a train (`road_leg`).

## Language rules

1. Never say *booked*, *confirmed* or *available* for a Recommendation. VoyAgent makes no Reservations.
2. Every amount has a currency. VoyAgent works in INR and says so.
3. An `estimated` price is always shown with the label *Estimated Cost*.
4. A new domain word goes in this table in the same commit as the code that introduces it.

## Terms from the first glossary that the product does not use

Reservation, Booking Status, Route, Leg, Point of Interest, Availability, Actual Cost, Constraint (as a type) and Local Time came from the first draft of this glossary. VoyAgent does not model them yet, so they were taken out of the table rather than left with no code behind them.
