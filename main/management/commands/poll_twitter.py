"""Django custom command to periodically query Twitter's search API for given
terms and add the Tweets to a Solr index. Additionally, we also ensure
that the index is bounded to a certain number of documents, essentially
treating the index as a bounded FIFO. This assumes the "id" field in the Solr
schema is an increasing numeric value.
"""

import json
import math
import logging

import tweepy
import pysolr
from django.core.management.base import BaseCommand

import settings


class Command(BaseCommand):
    """Django custom command to periodically query Twitter's search API for
    given terms and add them to a Solr index.
    """

    fields = ("created_at", "id", "from_user", "from_user_name", "geo",
        "iso_language_code", "profile_image_url", "text", "to_user")
    max_index_size = 100000
    delete_chunk_size = 500

    def __init__(self):
        """Set up the necessary API clients."""

        # This can raise an exception; intentionally uncaught
        self.solr = pysolr.Solr(settings.SOLR_CONNECTION['twit-demo']['URL'])
        self.twitter = tweepy.API()
        self.log = logging.getLogger(__name__)

        super(Command, self).__init__()

    def handle(self, *args, **options):
        """Using Twitter's search API, grab the latest Tweets for given terms
        and add them to the Solr index.
        """

        query = " OR ".join(settings.SEARCH_TERMS)

        self.log.info("Polling Twitter for query '%s'" % query)

        # Cursor is the last Tweet ID we've seen for this query
        cursor = self._retrieve_cursor()
        tweets = self._retrieve_tweets(query, since_id=cursor)
        self._truncate_index(len(tweets))
        self._index_tweets(tweets)

    def _retrieve_cursor(self):
        """Retrieve the max Tweet ID for this query using the Solr index."""

        results = self.solr.search("*:*", fl="id", sort="id desc", rows=1)

        if not results.docs:
            self.log.warn("No Tweets found in index, starting fresh.")
            return

        num_docs = results.docs[0]['id']

        self.log.info("Max Tweet ID from Solr index: %d." % num_docs)

        return num_docs

    def _retrieve_tweets(self, query, since_id=None):
        """Retrieve the latest Tweets for the given query. Optionally can
        specify the last seen Tweet ID.
        """

        tweets = []
        page = 1
        max_results = 100

        # XXX: API routinely returns 96-99 results leading me to believe that
        # are missing some Tweets.
        while True:
            self.log.info("Fetching page %d." % page)
            try:
                new_tweets = self.twitter.search(q=query, page=page,
                    rpp=max_results, since_id=since_id, result_type="recent")
            except tweepy.error.TweepError as te:
                self.log.error("Error retrieving tweets: %s" % te)
                break

            self.log.info("Got %d results." % len(new_tweets))
            tweets += new_tweets
            page += 1

            if len(new_tweets) < max_results:
                break

        max_id = max([t.id for t in tweets] or [since_id])
        self.log.info("Max Tweet ID from Twitter API: %s" % max_id)

        return tweets

    def _truncate_index(self, num):
        """Query Solr to determine the number of documents currently in the
        index and delete the necessary documents to keep the index bounded at
        the specified size.
        """

        params = {
            'q': '*:*',
            'wt': 'json',
            'qt': '/admin/luke',
            'rows': 0,
        }

        self.log.info("Querying index to determine size.")

        result = json.loads(self.solr._select(params))
        num_docs = result['response']['numFound']
        overage = num_docs + num - self.max_index_size

        self.log.info("Index contains %d total documents." % num_docs)

        if overage < 1:
            return

        # Fetch the oldest N Tweets, which will be deleted
        results = self.solr.search("*:*", fl="id", sort="id asc", rows=overage)

        # Delete in chunks
        for i in xrange(0, len(results.docs), self.delete_chunk_size):
            chunk = results.docs[i:i + self.delete_chunk_size]
            query = "id:(%s)" % " OR ".join([str(c['id']) for c in chunk])

            try:
                self.solr.delete(q=query)
            except pysolr.SolrError as se:
                self.log.error("Error deleting tweets: %s" % se)

            self.log.info("Deleted %d documents, chunk %d/%d" %
                (min(self.delete_chunk_size, overage),
                (i / self.delete_chunk_size) + 1,
                math.ceil(float(overage) / self.delete_chunk_size)))

        self.log.info("Deleted %d total documents to maintain %d limit." %
            (overage, self.max_index_size))

    def _index_tweets(self, tweets):
        """Index the recently retrieved Tweets in Solr."""

        if not tweets:
            return

        def munge(key, value):
            """Munge any of the values before inserting into Solr."""

            if key == "geo" and value:
                value = ",".join([str(c) for c in value['coordinates']])

            return value

        tweets = [
            dict((k, munge(k, v)) for k, v in t.__dict__.iteritems()
            if k in self.fields)
            for t in tweets]

        self.log.info("Adding %d tweets to Solr index." % len(tweets))

        try:
            self.solr.add(tweets)
        except pysolr.SolrError as se:
            self.log.error("Error indexing tweets: %s" % se)
