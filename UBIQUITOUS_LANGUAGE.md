# Ubiquitous Language

## Purpose

This document defines the shared vocabulary used throughout VoyAgent. The same terms should be used consistently in requirements, conversations, user interfaces, source code, tests, API contracts, and documentation. If the meaning of a term changes, this document and the affected artifacts must be updated together.

## Core Domain Terms

| Term | Definition | Usage notes |
|---|---|---|
| **VoyAgent** | The travel-planning system that helps a traveler create and manage a personalized trip plan. | Use **VoyAgent** only for the product/system, not for an individual travel plan. |
| **Traveler** | A person whose preferences and constraints are used to plan a trip. | Prefer **Traveler** over *User* when describing domain behavior. A user of the system may plan for one or more travelers. |
| **Trip** | The top-level record representing planned travel from a start date through an end date. | A Trip contains destinations, travelers, preferences, constraints, and an itinerary. Do not use *Journey* or *Vacation* as interchangeable technical terms. |
| **Destination** | A city, region, or other geographic place included in a Trip. | A Trip may contain one or more Destinations in a defined visit order. |
| **Origin** | The place from which the Traveler begins the Trip. | The Origin is not automatically a Destination. |
| **Travel Party** | The group of Travelers participating in the same Trip. | Party size affects cost estimates, reservations, and suitability of recommendations. |
| **Travel Dates** | The Trip's inclusive start and end dates. | These dates define the time window in which itinerary items may be scheduled. |
| **Duration** | The length of a Trip or Activity. | Trip duration is derived from Travel Dates; activity duration is an estimated or confirmed time span. |
| **Preference** | A Traveler's stated desire that guides planning but does not have to be satisfied. | Examples: preferred cuisine, pace, interests, or accommodation style. A Preference is softer than a Constraint. |
| **Constraint** | A rule or limitation that a valid plan must satisfy. | Examples: fixed dates, accessibility needs, maximum budget, or unavailable times. Do not label optional wishes as Constraints. |
| **Budget** | The maximum planned spend for a Trip, optionally divided into categories. | Budget is not the same as Estimated Cost or Actual Cost. Currency must always be specified. |
| **Budget Category** | A classification used to allocate and track Trip spending. | Typical categories include transportation, accommodation, food, and activities. |
| **Itinerary** | The ordered, date-based plan for a Trip. | An Itinerary contains Itinerary Days and Itinerary Items. It is the plan as a whole, not a single recommendation. |
| **Itinerary Day** | The portion of an Itinerary associated with one calendar date in the Destination's local time. | Each Itinerary Day may contain zero or more ordered Itinerary Items. |
| **Itinerary Item** | A scheduled entry in an Itinerary, such as an Activity, transfer, meal, or accommodation event. | An item has a date/time or time window and may have a location, duration, cost, and status. |
| **Activity** | An experience or visit a Traveler may include in an Itinerary. | Examples: museum visit, walking tour, hike, or restaurant meal. An Activity becomes scheduled only when represented by an Itinerary Item. |
| **Recommendation** | A system-generated candidate that may help satisfy Trip Preferences and Constraints. | A Recommendation is not part of the Itinerary until the Traveler accepts or adds it. Avoid calling recommendations *bookings*. |
| **Accommodation** | A place where the Travel Party stays overnight. | A property recommendation and a confirmed accommodation reservation are different states. |
| **Transportation** | Movement between Origins, Destinations, or Activities. | Includes flights, trains, public transit, driving, walking, and other travel modes. |
| **Route** | An ordered path between two places using a Transportation mode. | A Route may include multiple Legs. |
| **Leg** | One continuous segment of a Route between two points. | Changing mode or service normally begins a new Leg. |
| **Point of Interest (POI)** | A place that may be relevant to a Traveler, such as an attraction, restaurant, station, or landmark. | A POI is not necessarily recommended or scheduled. |
| **Reservation** | A record that a travel service or place has been held or booked for the Travel Party. | A Reservation must not be described as **Confirmed** unless confirmation has been received from the provider. |
| **Provider** | An external organization or service supplying travel information or fulfilling a Reservation. | Examples include airlines, hotels, maps, and activity platforms. |
| **Availability** | Whether an offering can be reserved for the requested party, date, and time. | Availability may become stale and should be associated with the time it was checked. |
| **Estimated Cost** | A non-final projection of the price of a Trip, Itinerary Item, or Recommendation. | Always identify currency. Do not present an estimate as a confirmed price. |
| **Actual Cost** | The amount paid or incurred after a purchase or completed activity. | Actual Cost may differ from Estimated Cost. |
| **Local Time** | The civil time in the time zone of the relevant Destination. | Itinerary dates and times should be displayed in Local Time unless explicitly stated otherwise. |
| **Travel Pace** | The desired intensity and density of scheduled activities. | Suggested values are **Relaxed**, **Balanced**, and **Fast-paced**. |

## Planning and Lifecycle Terms

| Term | Definition | Usage notes |
|---|---|---|
| **Trip Request** | The Traveler-provided input used to begin or revise planning. | It may include Destinations, dates, Budget, Preferences, Constraints, and Travel Party details. |
| **Draft Trip** | A Trip whose details or Itinerary are still being developed. | Draft content may be edited freely and must not imply confirmed availability. |
| **Generate Itinerary** | Create a proposed Itinerary from the current Trip Request. | Generation produces a draft; it does not create Reservations. |
| **Regenerate Itinerary** | Replace or revise all or part of an existing draft using updated inputs or feedback. | Preserve explicitly locked or accepted items when the product supports locking. |
| **Accept Recommendation** | Add a Recommendation to the Trip plan. | Acceptance schedules or selects an item; it does not necessarily reserve or purchase it. |
| **Conflict** | A condition in which two or more Itinerary Items overlap or cannot jointly satisfy a Constraint. | Excess travel time between consecutive items can also produce a Conflict. |
| **Feasible Itinerary** | An Itinerary that satisfies all known hard Constraints and has no known scheduling Conflicts. | Feasible does not mean optimal, available, or booked. |
| **Booking Status** | The current reservation state of a bookable item. | Use explicit values such as **Not booked**, **Pending**, **Confirmed**, **Cancelled**, or **Failed**. |
| **Trip Status** | The lifecycle state of a Trip. | Recommended values: **Draft**, **Planned**, **In progress**, **Completed**, and **Cancelled**. |

## Actors and System Boundaries

| Term | Definition |
|---|---|
| **Planner** | A user who creates or edits a Trip. The Planner may also be a Traveler. |
| **External Service** | A system outside VoyAgent that supplies data or performs an operation, such as geocoding, routing, weather lookup, or booking. |
| **Planning Engine** | The VoyAgent component that evaluates Trip inputs and produces or revises Recommendations and Itineraries. |

## Important Distinctions

- A **Preference** influences a plan; a **Constraint** must be satisfied.
- A **Recommendation** is a candidate; an **Itinerary Item** is scheduled in the plan; a **Reservation** represents a booking attempt or result.
- **Estimated Cost** is projected; **Actual Cost** is incurred.
- **Availability** is observed at a point in time; **Confirmed** is a Booking Status supported by provider confirmation.
- A **Destination** is part of the Trip; a **Point of Interest** is a place that may be considered within or near a Destination.
- A **Route** is the complete path between places; a **Leg** is one segment of that Route.

## Language Rules

1. Use the canonical terms and capitalization in this document in domain documentation and code concepts.
2. Use **Traveler** for domain behavior and reserve **User** for authentication, authorization, and account-management concerns.
3. Never use **booked**, **confirmed**, or **available** when the system has only generated a Recommendation.
4. Every monetary value must include a currency; never assume a currency from the Traveler's location.
5. Every scheduled date and time must have an associated time zone and should be presented in the relevant Destination's Local Time.
6. Distinguish hard Constraints from soft Preferences so the Planning Engine can explain trade-offs correctly.
7. When a new domain term is introduced in requirements or implementation, add it here with one precise meaning and remove or document ambiguous synonyms.

## Terms to Avoid

| Avoid | Use instead | Reason |
|---|---|---|
| Journey / Vacation | **Trip** | Keeps the top-level aggregate name consistent. |
| Customer / Passenger | **Traveler** | These words imply commercial or transport-specific relationships. |
| Suggestion / Option | **Recommendation** | Provides one canonical name for a proposed candidate. |
| Schedule (as a noun for the entire plan) | **Itinerary** | Avoids confusion with an individual item's scheduled time. |
| Price (when not confirmed) | **Estimated Cost** | Makes uncertainty explicit. |
| Booked (without provider confirmation) | **Pending** or **Not booked** | Prevents false confirmation. |

## Maintaining This Language

This is a living document. Changes to domain meaning should be reviewed with the related requirements, domain model, tests, API names, and user-facing copy. Where legacy names cannot be changed immediately, document the mapping here and use the canonical term for all new work.
