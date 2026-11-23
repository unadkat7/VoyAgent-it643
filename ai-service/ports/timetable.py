from typing import Protocol

from domain.timetable import Timetable


class TimetableError(Exception):
    """The train timetable could not be read (missing or damaged data file)."""


class TimetablePort(Protocol):
    def load(self) -> Timetable: ...
