from schemas.geo import GeoPoint


class NoGeocoder:
    """Used when geocoding is switched off: every place is unknown, so the map stays empty."""

    def locate(self, query: str) -> GeoPoint | None:
        return None
