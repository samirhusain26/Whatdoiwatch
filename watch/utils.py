from datetime import date, timedelta
import requests
from django.conf import settings


def get_date_range(category: str):
    today = date.today()
    if category == "this_month":
        start = today.replace(day=1)
        end = (start + timedelta(days=32)).replace(day=1) - timedelta(days=1)
    elif category == "this_year":
        start = date(today.year, 1, 1)
        end = date(today.year, 12, 31)
    elif category == "this_decade":
        start = date(2020, 1, 1)
        end = today
    elif category == "last_decade":
        start = date(2010, 1, 1)
        end = date(2019, 12, 31)
    elif category == "this_century":
        start = date(2000, 1, 1)
        end = today
    elif category == "old":
        start = date(1980, 1, 1)
        end = date(1999, 12, 31)
    elif category == "ancient":
        start = date(0, 1, 1)
        end = date(1979, 12, 31)
    else:
        start = date(0, 1, 1)
        end = today
    return start.isoformat(), end.isoformat()


def get_watchmode_data(tmdb_id: int):
    api_key = getattr(settings, "WATCHMODE_API_KEY", "")
    if not api_key:
        return None
    try:
        search = requests.get(
            "https://api.watchmode.com/v1/search/",
            params={"apiKey": api_key, "search_field": "tmdb_id", "search_value": tmdb_id},
        ).json()
        results = search.get("title_results")
        if not results:
            return None
        wm_id = results[0]["id"]
        details = requests.get(
            f"https://api.watchmode.com/v1/title/{wm_id}/details/",
            params={"apiKey": api_key},
        ).json()
        sources = requests.get(
            f"https://api.watchmode.com/v1/title/{wm_id}/sources/",
            params={"apiKey": api_key},
        ).json()
        streaming = [s["name"] for s in sources if s.get("type") == "sub"]
        return {"imdb_rating": details.get("imdb_rating"), "sources": streaming}
    except Exception:
        return None
