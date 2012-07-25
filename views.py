"""Views for the Twitter demo project."""

import json
import time

import pysolr
import pymongo
from django.http import HttpResponse
from django.shortcuts import render

import settings

#XXX: This is an ugly hack
FILTER_MAP = {
    "username": "from_user",
    "language": "iso_language_code",
}

_MONGO_CLIENT = None


def index(request):
    """Retreive the most recent 50 Tweets."""

    tweets = _retrieve_tweets()

    return render(request, "index.html", tweets)


def search(request):
    """Retrieve Tweets using the specified filters."""

    filters = []
    tweets = []

    for q_type, q_value in request.GET.iteritems():
        q_type = q_type.lower()
        if q_type not in FILTER_MAP.keys():
            continue
        q_type = FILTER_MAP[q_type]
        filters.append("+%s:%s" % (q_type, q_value))

    query = " ".join(filters)

    if query:
        tweets = _retrieve_tweets(query=query)
    else:
        tweets = _retrieve_tweets()

    return HttpResponse(json.dumps(tweets), "application/json")


def _retrieve_tweets(query="*:*", rows=50):
    """Fire off a request to Solr."""

    solr = pysolr.Solr(settings.SOLR_CONNECTION['twit-demo']['URL'])

    params = {
        "facet": "true",
        "facet.limit": 10,
        "facet.mincount": 1,
        "facet.field": ["from_user", "iso_language_code"],
    }

    _log_query(query, rows, params)

    # Fetch the newest N Tweets. Should try/except this too...
    results = solr.search(query, sort="id desc", rows=rows, **params)

    return {"tweets": results.docs, "hits": results.hits,
        "facets": results.facets}


def _log_query(query, rows, params):
    """Log the attributes of a Solr query to MongoDB."""
    global _MONGO_CLIENT

    if not _MONGO_CLIENT:
        _MONGO_CLIENT = pymongo.Connection(host="127.0.0.1", port=27017)

    # Have to swap out periods for hyphens
    params = dict((k.replace(".", "_"), v) for k, v in params.items())

    db = _MONGO_CLIENT.twit_demo
    db.query_logs.save(dict({
        "raw_query": query,
        "params": filter(None, query.split("+")),
        "rows": rows,
        "time": int(time.time()),
    }, **params))
