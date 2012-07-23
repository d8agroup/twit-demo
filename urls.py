from django.conf.urls import patterns, include, url


urlpatterns = patterns('',
    url(r'^/api/tweets$', 'views.filter'),
    url(r'^$', 'views.index'),
)
