import pytest

from domain.travel_costs import car_cost, cars_for, chosen_option, travel_options
from schemas.recommendations import FlightRecommendation
from schemas.travel import FareRange, TravelFares


def flight(price, over_budget=False):
    return FlightRecommendation(
        airline="IndiGo",
        departure_airport="AMD",
        arrival_airport="GOI",
        price_per_traveler=price,
        price_source="live",
        over_budget=over_budget,
    )


# Four Travelers share a car.
@pytest.mark.parametrize(("party", "cars"), [(1, 1), (4, 1), (5, 2), (8, 2), (9, 3)])
def test_cars_for_party(party, cars):
    assert cars_for(party) == cars


def test_car_cost_is_there_and_back_per_car():
    assert car_cost(100, 2) == 100 * 2 * 9  # one car
    assert car_cost(100, 5) == 100 * 2 * 9 * 2  # two cars


def test_every_way_to_travel_is_priced_for_the_party_cheapest_first():
    fares = TravelFares(
        train_sleeper=FareRange(low=600, high=800),
        train_ac3=FareRange(low=1_500, high=2_000),
        bus=FareRange(low=1_000, high=1_400),
    )

    options = travel_options(
        flights=[flight(12_000, over_budget=True), flight(13_000)],
        fares=fares,
        road_km=1_000,
        party_size=2,
    )

    by_mode = {o.mode: o for o in options}
    assert by_mode["flight"].total == 24_000
    assert by_mode["flight"].over_budget is True
    assert by_mode["flight"].source == "live"
    assert by_mode["train"].label == "Train · 3AC"
    assert (by_mode["train"].per_person_low, by_mode["train"].per_person_high) == (3_000, 4_000)
    assert by_mode["train"].total == 7_000  # midpoint 3,500 round trip x 2
    assert by_mode["bus"].total == 4_800
    assert by_mode["car"].total == 18_000
    assert [o.total for o in options] == sorted(o.total for o in options)


def test_no_data_means_no_options():
    assert travel_options(flights=[], fares=None, road_km=None, party_size=2) == []


def test_the_picked_mode_wins_and_the_cheapest_is_the_default():
    options = travel_options(flights=[flight(5_000)], fares=None, road_km=1_000, party_size=2)

    assert chosen_option(options, None).mode == "flight"  # 10,000 beats the 18,000 drive
    assert chosen_option(options, "car").mode == "car"
    assert chosen_option(options, "bus").mode == "flight"  # no bus option: back to the cheapest
    assert chosen_option([], "car") is None
