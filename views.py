import json

import pysolr
from django.http import HttpResponse, HttpResponseServerError
from django.shortcuts import render

import settings

#XXX: This is an ugly hack
FILTER_MAP = {
    "username": "from_user",
    "language": "iso_language_code",
}


def index(request):
    """Retreive the most recent 50 Tweets."""

    tweets = _retrieve_tweets()

    return render(request, "index.html", tweets)


def filter(request):
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


def _retrieve_tweets(query="*:*", n=50):
    """Fire off a request to Solr."""

    solr = pysolr.Solr(settings.SOLR_CONNECTION['twit-demo']['URL'])

    params = {
        "facet": "true",
        "facet.limit": 10,
        "facet.mincount": 1,
        "facet.field": ["from_user", "iso_language_code"]
    }

    # TODO: Log these queries to MongoDB
    # pymongo.update()

    # Fetch the newest N Tweets. Should try/except this too...
    results = solr.search(query, sort="id desc", rows=n, **params)

    return {"tweets": results.docs, "hits": results.hits, "facets": results.facets}
