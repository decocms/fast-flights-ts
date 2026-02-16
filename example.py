from pprint import pprint

from fast_flights import FlightQuery, Passengers, create_query, get_flights

query = create_query(
    flights=[
        FlightQuery(
            date="2026-02-16",
            from_airport="MYJ",
            to_airport="TPE",
        ),
    ],
    seat="economy",
    trip="one-way",
    passengers=Passengers(adults=1),
    language="zh-TW",
)
res = get_flights(query)
pprint(res)
