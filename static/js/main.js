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
                filter.value = App.get_language_code(filter.value);
            };
            query.push(filter.type + "=" + filter.value);
        });
        return query.join("&");
    };
};

var App = {
    active_filters: new ActiveFilters(),

    /*
     * These are from Twitter's supported languages API endpoint:
     * https://api.twitter.com/1/help/languages.json
     *
     * Notes:
     * vi -> Vietnamese is not in the above endpoint but is returned in
     * search results.
     * 'id' is specified for Indonesian  by the above endpoint but does not
     * appear in search results while 'in' does.
     * I believe there are several more languages that are not officially
     * supported via the languages endpoint but are returned in search results.
     */
    language_mapping: {
        ar: "Arabic", da: "Danish", de: "German", en: "English", es: "Spanish",
        fa: "Farsi", fi: "Finnish", fil: "Filipino", fr: "French", he: "Hewbrew",
        hi: "Hindi", hu: "Hungarian", in: "Indonesian", id: "Indonesian",
        it: "Italian", ja: "Japnese", ko: "Korean", msa: "Malay", nl: "Dutch",
        no: "Norwegian", pl: "Polish", pt: "Portuguese", ru: "Russian", sv: "Swedish",
        th: "Thai", tr: "Turkish", ur: "Urdu", vi: "Vietnamese",
        zh_cn: "Simplified Chinese", zh_tw: "Traditional Chinese"
    },

    facet_mapping: {
        iso_language_code: "Top Languages",
        from_user: "Top Users"
    },

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
    remove_filter: function(filter, redraw) {
        var redraw = (typeof redraw === "undefined") ? true : redraw;
        if (this.active_filters.remove(filter)) {
            var filter_list = $("#filter-list .filter");
            $.each(filter_list, function(idx, active_filter) {
                if (Filter.fromHTML(active_filter).type.toLowerCase() == filter.type.toLowerCase()) {
                    $(active_filter).fadeOut(function() {
                        $(this).remove();
                    });
                };
            });
            if (redraw) {
                this.draw();
            };
        };
    },

    // Fetch Tweets based on the active filters
    update_tweets: function(data) {
        var heading = "Most Recent " + data.tweets.length + " Tweets of " + data.hits;
        if (App.active_filters.filters.length) {
            heading = heading + " [filtered]";
        };
        $("#tweet-container h2").fadeOut(function () {
                $(this).html(heading).fadeIn();
        });
        $("#tweet-list").fadeOut(function() {
            var tpl = $("#tweet-item-tpl");
            var tweet_list = this;
            $(this).html("");
            // Set some options for the linkify plugin.
            var link_options = {
                user: {
                    regex: /((?:^|[^a-zA-Z0-9_!#$%&*@＠]|RT:?))([@＠])([a-zA-Z0-9_]{1,20})(\/[a-zA-Z][a-zA-Z0-9_-]{0,24})?/g,
                    template: ' @<span class="from_user filterable">$3$4</span>'
                },
                link: {
                    regex: /(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/ig,
                    template: '<a href="$1" target="_blank">$1</a>'
                },
                hash: {
                    regex: /(^|\s)#(\w+)/g,
                    template: ' #<span class="text filterable">$2</span>'
                },
            };
            $.each(data.tweets, function(idx, tweet) {
                tweet.text = $.linkify(tweet.text, link_options);
                tweet.created_at = moment(tweet.created_at).format("LT D MMM YY");
                tweet.source_url = "http://twitter.com/" + tweet.from_user + "/status/" + tweet.id;
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
                    label: App.get_language(val[0]),
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

    get_language: function(code) {
        return this.language_mapping[code.replace("-", "_").toLowerCase()] || code
    },

    get_language_code: function(language) {
        var return_code = language;
        $.each(this.language_mapping, function(code, name) {
            if (language.toLowerCase() == name.toLowerCase()) {
                return_code = code;
                return false;
            };
        });
        return return_code;
    },
};

$(document).ready(function() {

    App.draw();

    $("#tweet-list, #facet-list").on("click", ".filterable", function(e) {
        var filter = new Filter(
            $(this).attr("class").split(" ")[0], $(this).text().trim()
        );
        App.add_filter(filter);
        if (filter.type == "text") {
            $("#search-query").val(filter.value);
        };
    });

    $("#search-form").on("submit", function(e) {
        e.preventDefault();
        var el = $("#search-query", this);
        var filter = new Filter("text", $(el).val());
        App.remove_filter(new Filter("text"), false);
        App.add_filter(filter);
    });

    $("#filter-list").on("click", ".filter-remove", function(e) {
        var filter = Filter.fromHTML($(this).parent());
        App.remove_filter(filter);
        if (filter.type == "text") {
            $("#search-query").val("");
        };
    });
});
