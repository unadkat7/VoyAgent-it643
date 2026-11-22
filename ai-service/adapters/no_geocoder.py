from schemas.geo import GeoPoint, Region


class NoGeocoder:
    """Used when geocoding is switched off: every place is unknown, so the map stays empty."""

    def locate(self, query: str, near: Region | None = None) -> GeoPoint | None:
        return None

    def locate_area(self, query: str) -> Region | None:
        return None
