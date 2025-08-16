import requests
from django.conf import settings
from django.http import JsonResponse
from django.shortcuts import render
from .utils import get_date_range, get_watchmode_data


def index(request):
    return render(request, "watch/index.html")


def genres(request):
    api_key = settings.TMDB_API_KEY
    resp = requests.get(
        "https://api.themoviedb.org/3/genre/movie/list", params={"api_key": api_key}
    )
    return JsonResponse(resp.json().get("genres", []), safe=False)


def movies(request):
    genre = request.GET.get("genre")
    time = request.GET.get("time", "")
    api_key = settings.TMDB_API_KEY
    start, end = get_date_range(time)
    discover = requests.get(
        "https://api.themoviedb.org/3/discover/movie",
        params={
            "api_key": api_key,
            "with_genres": genre,
            "sort_by": "popularity.desc",
            "primary_release_date.gte": start,
            "primary_release_date.lte": end,
        },
    )
    movies = discover.json().get("results", [])[:5]
    results = []
    for m in movies:
        details = requests.get(
            f"https://api.themoviedb.org/3/movie/{m['id']}",
            params={"api_key": api_key, "append_to_response": "credits"},
        ).json()
        cast = [c["name"] for c in details.get("credits", {}).get("cast", [])[:5]]
        watch = get_watchmode_data(m["id"])
        results.append(
            {
                "id": m["id"],
                "title": m["title"],
                "overview": m.get("overview", ""),
                "release_date": m.get("release_date", ""),
                "poster": f"https://image.tmdb.org/t/p/w500{m['poster_path']}" if m.get("poster_path") else "",
                "cast": cast,
                "imdb_rating": watch.get("imdb_rating") if watch else None,
                "streaming_sources": watch.get("sources") if watch else [],
            }
        )
    return JsonResponse(results, safe=False)


def search(request):
    query = request.GET.get("query")
    if not query:
        return JsonResponse({"error": "Missing query"}, status=400)
    api_key = settings.TMDB_API_KEY
    resp = requests.get(
        "https://api.themoviedb.org/3/search/movie",
        params={"api_key": api_key, "query": query},
    )
    results = [
        {"id": m["id"], "title": m["title"], "release_date": m.get("release_date", "")}
        for m in resp.json().get("results", [])[:10]
    ]
    return JsonResponse(results, safe=False)


def recommendations(request):
    ids = request.GET.get("ids", "")
    genre = request.GET.get("genre")
    time = request.GET.get("time", "")
    api_key = settings.TMDB_API_KEY
    id_list = [i for i in ids.split(",") if i]
    start, end = get_date_range(time)
    results = []

    if id_list:
        candidates = []
        for movie_id in id_list:
            rec = requests.get(
                f"https://api.themoviedb.org/3/movie/{movie_id}/recommendations",
                params={"api_key": api_key},
            )
            candidates.extend(rec.json().get("results", []))
        unique = {m["id"]: m for m in candidates}.values()
        filtered = [
            m
            for m in unique
            if (not genre or int(genre) in m.get("genre_ids", []))
            and (not start or m.get("release_date", "") >= start)
            and (not end or m.get("release_date", "") <= end)
            and str(m["id"]) not in id_list
        ]
        top = filtered[:5]
    else:
        discover = requests.get(
            "https://api.themoviedb.org/3/discover/movie",
            params={
                "api_key": api_key,
                "with_genres": genre,
                "sort_by": "popularity.desc",
                "primary_release_date.gte": start,
                "primary_release_date.lte": end,
            },
        )
        top = discover.json().get("results", [])[:5]

    for m in top:
        details = requests.get(
            f"https://api.themoviedb.org/3/movie/{m['id']}",
            params={"api_key": api_key, "append_to_response": "credits"},
        ).json()
        cast = [c["name"] for c in details.get("credits", {}).get("cast", [])[:5]]
        watch = get_watchmode_data(m["id"])
        results.append(
            {
                "id": m["id"],
                "title": m["title"],
                "overview": m.get("overview", ""),
                "release_date": m.get("release_date", ""),
                "poster": f"https://image.tmdb.org/t/p/w500{m['poster_path']}" if m.get("poster_path") else "",
                "cast": cast,
                "imdb_rating": watch.get("imdb_rating") if watch else None,
                "streaming_sources": watch.get("sources") if watch else [],
            }
        )
    return JsonResponse(results, safe=False)
