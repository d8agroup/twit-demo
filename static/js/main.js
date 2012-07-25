$(document).ready(function() {

    function Filter(type, value) {
        this.type = type;
        this.value = value;

        this.toHTML = function() {
            return $(Filter.template).tmpl({"filter": this});
        };
    };

    // Class variable so it's evaluated once
    Filter.template = $("#filter-tpl");

    Filter.fromHTML = function(html) {
        return new Filter(
            $(".filter-type", html).text().toLowerCase(),
            $(".filter-value", html).text()
        );
    };

    // Fetch Tweets based on the active filters
    var update_tweets = function(tweets) {
        var query_fragments = [];

        // Very simple way to build the query, possible bug
        $.each($("#filter-list .filter"), function(idx, active_filter) {
            var filter = Filter.fromHTML(active_filter);
            query_fragments.push(filter.type + "=" + filter.value)
        });

        var query = query_fragments.join("&");

        $.get("/search", query, function(data) {
            $("#tweet-container h2").html("Tweets " + data.tweets.length + " of " + data.hits);
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
        });
    };

    // Add a new filter to the list
    add_filter = function(filter) {
        var current_filters = $("#filter-list");
        var dupe = false;

        // Ensure each filter is only added once
        $.each($(".filter", current_filters), function(idx, active_filter) {
            var active_filter = Filter.fromHTML(active_filter);
            if (active_filter.type.toLowerCase() == filter.type.toLowerCase()) {
                dupe = true;
                return false;
            }
        });

        if (dupe) { return; }

        $(current_filters).append(filter.toHTML());
    };

    $("#tweet-list").on("click", ".tweet-item .from_user", function(e) {
        var filter = new Filter("Username", $(this).text());
        add_filter(filter);
        update_tweets();
    });

    $("#tweet-list").on("click", ".tweet-item .iso_language_code", function(e) {
        var filter = new Filter("Language", $(this).text());
        add_filter(filter);
        update_tweets();
    });

    $("#filter-list").on("click", ".filter-remove", function(e) {
        $(this).parent().fadeOut(function() {
            $(this).remove();
            update_tweets();
        });
    });
});
