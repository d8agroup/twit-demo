from django.db import models

class Tweet(models.Model):
    id = models.BigIntegerField()
    created_at = models.DateTimeField()
    from_user = models.CharField(128)
    from_user_name = models.CharField(128)
    to_user = models.CharField(128)
    geo = models.CharField(64)
    iso_language_code = models.CharField(2)
    profile_image_url = models.URLField()
    text = models.CharField(140)

    def __unicode__(self):
        return "%s: %s" % (self.from_user, self.text)
