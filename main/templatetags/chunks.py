"""Template tag to split an iterable into chunks of specified size.

Source: http://djangosnippets.org/snippets/1106/
"""

from django import template

register = template.Library()

@register.filter(name='chunks')
def chunks(iterable, chunk_size):
    """Split an iterable into chunks of specified size."""

    if not hasattr(iterable, '__iter__'):
        # can't use "return" and "yield" in the same function
        yield iterable
    else:
        i = 0
        chunk = []
        for item in iterable:
            chunk.append(item)
            i += 1
            if not i % chunk_size:
                yield chunk
                chunk = []
        if chunk:
            # some items will remain which haven't been yielded yet,
            # unless len(iterable) is divisible by chunk_size
            yield chunk


