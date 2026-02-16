# original by @Manouchehri
# pr: #64

from primp import Client
from typing_extensions import Final, override

from ..fetcher import URL
from ..querying import Query
from .base import Integration, get_env

DEFAULT_API_URL = "https://api.brightdata.com/request"
DEFAULT_DATA_SERP_ZONE = "serp_api1"


class BrightData(Integration):
    __slots__: Final = ("api_url", "zone")

    api_url: str
    zone: str
    client: Client

    def __init__(
        self,
        *,
        api_key: str | None = None,
        api_url: str = DEFAULT_API_URL,
        zone: str = DEFAULT_DATA_SERP_ZONE,
    ):
        self.api_url = api_url or get_env("BRIGHT_DATA_API_URL")
        self.zone = zone
        self.client = Client(
            headers={
                "Authorization": "Bearer " + (api_key or get_env("BRIGHT_DATA_API_KEY"))
            }
        )

    @override
    def fetch_html(self, q: Query | str, /) -> str:
        if isinstance(q, str):
            res = self.client.post(
                self.api_url, json={"url": URL + "?q=" + q, "zone": self.zone}
            )
        else:
            res = self.client.post(
                self.api_url, json={"url": q.url(), "zone": self.zone}
            )

        return res.text
