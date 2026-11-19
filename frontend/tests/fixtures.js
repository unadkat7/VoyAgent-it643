// A Trip plan shaped exactly like the Planning Engine's response.
export const PLAN = {
  summary: "Three easy beach days in North Goa.",
  important_tips: ["Carry sunscreen", "Rent a scooter for short hops"],
  request: { origin: "Ahmedabad", destination: "Goa", party_size: 2, budget: 40000 },
  check_in: "2026-12-10",
  check_out: "2026-12-13",
  nights: 3,
  hotels: [
    {
      name: "Sea Breeze Resort",
      location: "Calangute",
      price_per_night: 3200,
      currency: "INR",
      rating: 4.3,
      amenities: ["Pool"],
      booking_url: "https://hotels.example/sea-breeze",
      price_source: "live",
    },
    {
      name: "Palm Grove Stay",
      location: "Baga",
      price_per_night: 2500,
      currency: "INR",
      rating: null,
      amenities: [],
      booking_url: null,
      price_source: "estimated",
    },
  ],
  flights: [
    {
      airline: "IndiGo",
      flight_number: "6E 101",
      departure_airport: "Ahmedabad (AMD)",
      arrival_airport: "Goa (GOI)",
      departure_time: "07:00",
      arrival_time: "08:55",
      duration: "1h 55m",
      price_per_traveler: 5000,
      currency: "INR",
      stops: 0,
      price_source: "live",
    },
  ],
  itinerary: [
    {
      day: 1,
      title: "Beaches",
      activities: [
        {
          time: "Morning",
          title: "Baga Beach",
          description: "Swim",
          location: "Baga",
          estimated_cost: 0,
        },
      ],
    },
  ],
  estimated_cost: { hotel_total: 7500, flight_total: 10000, total: 17500, currency: "INR" },
  notes: ["Flight search is unavailable right now."],
};

const at = (lat, lng) => ({ lat, lng });

// The same plan after the locate step: some places found, some not.
export const LOCATED_PLAN = {
  ...PLAN,
  destination_coordinates: at(15.3, 74.1),
  hotels: [
    { ...PLAN.hotels[0], coordinates: at(15.54, 73.76) },
    { ...PLAN.hotels[1], coordinates: null },
  ],
  itinerary: [
    {
      day: 1,
      title: "Beaches",
      activities: [
        { time: "Morning", title: "Baga Beach", description: "Swim", location: "Baga", estimated_cost: 0, coordinates: at(15.55, 73.75) },
        { time: "Afternoon", title: "Lost Cove", description: "", location: "Somewhere", estimated_cost: 0, coordinates: null },
        { time: "Evening", title: "Tito's Lane", description: "Dinner", location: "Baga", estimated_cost: 800, coordinates: at(15.556, 73.752) },
      ],
    },
    {
      day: 2,
      title: "Forts",
      activities: [
        { time: "Morning", title: "Fort Aguada", description: "", location: "Candolim", estimated_cost: 50, coordinates: at(15.49, 73.77) },
      ],
    },
    {
      day: 3,
      title: "Rest",
      activities: [
        { time: "Morning", title: "Sleep in", description: "", location: "Hotel", estimated_cost: 0, coordinates: null },
      ],
    },
  ],
};
