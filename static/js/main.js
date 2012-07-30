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
        $(".filter-value", html).text()
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
            query.push(filter.type + "=" + filter.value);
        });
        return query.join("&");
    };
};

// TODO: Move everything into App's scope
var App = {
    active_filters: new ActiveFilters(),
};

var fetch_tweets = function(callbacks) {
    query = App.active_filters.build_query();
    $.get("/search", query, function(data) {
        $.each(callbacks, function(idx, cb) {
            cb.apply(this, [data]);
        });
    });
};

// Add a new filter to the list
var add_filter = function(filter) {
    if (App.active_filters.add(filter)) {
        $(filter.toHTML()).hide().appendTo("#filter-list").fadeIn();
        return true;
    };
    return false;
};

// Remove an active filter
var remove_filter = function(filter, el) {
    if (App.active_filters.remove(filter)) {
        $(el).fadeOut(function() {
            $(this).remove();
        });
        return true;
    };
    return false;
};

// Fetch Tweets based on the active filters
var update_tweets = function(data) {

    $("#tweet-container h2").html("Most Recent " + data.tweets.length + " Tweets of " + data.hits);
    var html = "";
    $("#tweet-list").fadeOut(function() {
        $(this).html("");
        var tpl = $("#tweet-item-tpl");
        var tweet_list = this;
        $.each(data.tweets, function(idx, tweet) {
            $(tweet_list).append($(tpl).tmpl({"tweet": tweet}));
        });
        $(this).fadeIn();
    });

    $("#facet-list").fadeOut(function() {
        var facet_tpl = $("#facet-tpl");
        var facet_item_tpl = $("#facet-item-tpl");
        $(this).html("");
        var facet_list = this;
        $.each(data.facets.facet_fields, function(facet_name, facet_items) {
            var facet_items_html = [];
            for (i = 0; i < facet_items.length; i += 2) {
                facet_items_html.push($(facet_item_tpl).tmpl({"val": facet_items[i], "num": facet_items[i+1]}).html());
            };
            $(facet_list).append($(facet_tpl).tmpl({"name": facet_name, "facet_items": facet_items_html.join("")}));
        });
        $(this).fadeIn();
    });
};

var redraw = function() {
    fetch_tweets([
        update_tweets,
        update_language_pie,
    ]);
};

var update_language_pie = function(data) {

    if (!data) {
        var data = [
            { label: "S1", data: 25 },
            { label: "S2", data: 50 },
            { label: "S3", data: 25 },
        ];
    } else {
        var langs = data.facets.facet_fields.iso_language_code;
        var flot_data = [];
        for (var i = 0; i < langs.length; i += 2) {
            flot_data.push({
                label: langs[i].toUpperCase(),
                data: (langs[i+1]/data.hits) * 100,
            });
        };
    };

    // Need to calculate "Other" language % since the facets are limited to the
    // top 10. That or always return all facets and limit in the UI.

    $.plot($("#language-pie"), flot_data, {
        series: { pie: { show: true } },
        legend: { show: false },
    });
};

$(document).ready(function() {

    $("#tweet-list").on("click", ".tweet-item .from_user", function(e) {
        var filter = new Filter("Username", $(this).text());
        if (add_filter(filter)) {
            redraw();
        };
    });

    $("#tweet-list").on("click", ".tweet-item .iso_language_code", function(e) {
        var filter = new Filter("Language", $(this).text());
        if (add_filter(filter)) {
            redraw();
        };
    });

    $("#filter-list").on("click", ".filter-remove", function(e) {
        var filter = Filter.fromHTML($(this).parent());
        if (remove_filter(filter, $(this).parent())) {
            redraw();
        };
    });

    redraw();
    update_language_pie();
});
