import json

import pysolr
from django.http import HttpResponse, HttpResponseServerError
from django.shortcuts import render

import settings


def index(request):

    tweets = _retrieve_tweets()

    return render(request, 'index.html', {'tweets': tweets})


def filter(request):

    from pprint import pprint
    pprint(request)

    q = []
    """
    for f in request.GET.filters:
        q.append((f.type, 
    q = 
    """
    tweets = _retrieve_tweets(q)

    return json.loads(tweets.docs)


def _retrieve_tweets(query="*:*", n=50):

    solr = pysolr.Solr(settings.SOLR_CONNECTION['twit-demo']['URL'])

    # Fetch the newest N Tweets. Should try/except this too...
    return solr.search(query, sort="id desc", rows=n)
