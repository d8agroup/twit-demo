Array.prototype.chunk = function(chunk_size) {
    if (!this.length) {
        return [];
    };
    return [this.slice(0, chunk_size)].concat(this.slice(chunk_size).chunk(chunk_size));
};

var Filter = function Filter(type, value) {
    this.type = type;
    this.value = value;

    this.toHTML = function() {
        Filter.template = Filter.template || $("#filter-tpl");
        return $(Filter.template).tmpl({"filter": this});
    };
};

Filter.template = null;

Filter.fromHTML = function(html) {
    return new Filter(
        $(".filter-type", html).text().toLowerCase(),
        $(".filter-value", html).text().trim()
    );
};

var ActiveFilters = function() {
    this.filters = [];
    this.add = function(filter) {
        if (this.exists(filter) === false) {
            this.filters.push(filter);
            return true;
        };
        return false;
    };
    this.remove = function(filter) {
        var idx = this.exists(filter);
        if (idx !== false) {
            this.filters.splice(idx, 1);
            return true;
        };
        return false;
    };
    this.exists = function(filter) {
        var i = false;
        $.each(this.filters, function(idx, active_filter) {
            if (active_filter.type.toLowerCase() == filter.type.toLowerCase()) {
                i = idx;
                return false;
            };
        });
        return i;
    };
    this.build_query = function() {
        var query = [];
        $.each(this.filters, function(idx, filter) {
            if (filter.type == "iso_language_code") {
                filter.value = filter.value.toLowerCase();
            };
            query.push(filter.type + "=" + filter.value);
        });
        return query.join("&");
    };
};

var App = {
    active_filters: new ActiveFilters(),

    // Retrieve Tweets from the server
    fetch_tweets: function(callbacks) {
        query = this.active_filters.build_query();
        $.get("/search", query, function(data) {
            $.each(callbacks, function(idx, cb) {
                cb.call(this, data);
            });
        });
    },

    // Add a new filter
    add_filter: function(filter) {
        if (this.active_filters.add(filter)) {
            $(filter.toHTML()).hide().appendTo("#filter-list").fadeIn();
            this.draw();
        };
    },

    // Remove an active filter
    remove_filter: function(filter, el) {
        if (this.active_filters.remove(filter)) {
            $(el).fadeOut(function() {
                $(this).remove();
            });
            this.draw();
        };
    },

    // Fetch Tweets based on the active filters
    update_tweets: function(data) {

        $("#tweet-container h2").html("Most Recent " + data.tweets.length + " Tweets of " + data.hits);
        $("#tweet-list").fadeOut(function() {
            var tpl = $("#tweet-item-tpl");
            var tweet_list = this;
            $(this).html("");
            $.each(data.tweets, function(idx, tweet) {
                $(tweet_list).append($(tpl).tmpl({"tweet": tweet}));
            });
            $(this).fadeIn();
        });

        $("#facet-list").fadeOut(function() {
            var facet_tpl = $("#facet-tpl");
            var facet_list = this;
            $(this).html("");
            $.each(data.facets.facet_fields, function(facet_name, facet_items) {
                var chunked_items = [];
                $.each(facet_items.chunk(2), function(idx, val) {
                    chunked_items.push({"value": val[0], "count": val[1]});
                });
                $(facet_list).append($(facet_tpl).tmpl({"name": facet_name, "facet_items": chunked_items}));
            });
            $(this).fadeIn();
        });
    },

    draw: function() {
        this.fetch_tweets([
            this.update_tweets,
            this.update_language_pie,
        ]);
    },

    update_language_pie: function(data) {

        if (!data) {
            var data = [
                { label: "S1", data: 25 },
                { label: "S2", data: 50 },
                { label: "S3", data: 25 },
            ];
        } else {
            var langs = data.facets.facet_fields.iso_language_code;
            var flot_data = [];
            $.each(langs.chunk(2), function(idx, val) {
                flot_data.push({
                    label: val[0].toUpperCase(),
                    data: (val[1]/data.hits) * 100,
                });
            });
        };

        // Need to calculate "Other" language % since the facets are limited to the
        // top 10. That or always return all facets and limit in the UI.

        $.plot($("#language-pie"), flot_data, {
            series: { pie: { show: true } },
            legend: { show: false },
        });
    },
};

$(document).ready(function() {

    App.draw();

    $("#tweet-list, #facet-list").on("click", ".filterable", function(e) {
        var filter = new Filter(
            $(this).attr("class").split(" ")[0],
            $(this).text().trim()
        );
        App.add_filter(filter);
    });

    $("#filter-list").on("click", ".filter-remove", function(e) {
        var filter = Filter.fromHTML($(this).parent());
        App.remove_filter(filter, $(this).parent());
    });
});
