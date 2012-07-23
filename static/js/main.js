$(document).ready(function() {
    function Filter(type, value) {
        this.type = type;
        this.value = value;
    };

    var retrieve_tweets = function() {
        console.log('load_tweets called');
        $.get('/filter', function(data) {
            // TODO
        });
    };

    var update_tweets = function(tweets) {
        // TODO
    };

    add_filter = function(filter) {
        // TODO: Need to prevent the same filter from being added twice
        $("#filter-list").append($("#filter-tpl").tmpl({"filter": filter}));
    };

    remove_filter = function(filter) {
        // TODO
    };

    $("#tweet-list .tweet-container .from_user").click(function(e) {
        var filter = new Filter("Username", $(this).text());
        add_filter(filter)
        update_tweets();
    });
});
