var backgroundPage = chrome.extension.getBackgroundPage();

var popupGlobal = {
    //Determines lists of supported jQuery.timeago localizations, default localization is en
    supportedTimeAgoLocales : ["ru", "fr"],
    feeds : [],
    savedFeeds : []
}

function renderFeeds(){
    showLoader();
    backgroundPage.getFeeds(false, function (feeds, isLoggedIn) {
        $("#loading").hide();
        $("#feed-saved").hide();
        popupGlobal.feeds = feeds;
        if (isLoggedIn === false) {
            showLogin();
        } else {
            $("#popup-content").show();
            $("#website").text(chrome.i18n.getMessage("FeedlyWebsite"));

            if (feeds.length === 0) {
                $("#feed-empty").html(chrome.i18n.getMessage("NoUnreadArticles"));
                $("#all-read-section").hide();
            } else {
                $("#feed-empty").html("");
                var container = $("#feed").show().empty();
                $('#entryTemplate').tmpl(feeds).appendTo(container);
                $(".mark-read").attr("title", chrome.i18n.getMessage("MarkAsRead"));
                $("#mark-all-read").text(chrome.i18n.getMessage("MarkAllAsRead"));
                $("#all-read-section").show().find("*").show();
                $(".show-content").attr("title", chrome.i18n.getMessage("More"));
                container.find(".timeago").timeago();
                if(backgroundPage.appGlobal.options.abilitySaveFeeds){
                    container.find(".save-feed").show();
                }
            }
        }
    });
}

function renderSavedFeeds() {
    $("#mark-all-read").hide().siblings(".icon-ok").hide();
    $("#feed").hide();
    $("#loading").show();
    backgroundPage.getSavedFeeds(false, function (feeds, isLoggedIn) {
        $("#loading").hide();
        popupGlobal.savedFeeds = feeds;
        if (isLoggedIn === false) {
            showLogin();
        } else {
            $("#popup-content").show();
            if (feeds.length === 0) {
                $("#feed-empty").html(chrome.i18n.getMessage("NoSavedArticles"));
            } else {
                $("#feed-empty").html("");
                var container = $("#feed-saved").show().empty();
                $('#entryTemplate').tmpl(feeds).appendTo(container);
                container.find(".show-content").attr("title", chrome.i18n.getMessage("More"));
                container.find(".timeago").timeago();
                container.find(".mark-read").hide();
                container.find(".save-feed").show();
            }
        }
    });
}

function markAsRead(feedIds){
    for(var i = 0; i < feedIds.length; i++){
        var feed = $(".item[data-id='" + feedIds[i] + "']");
        feed.fadeOut().attr("data-is-read", "true");
    }
    //Show loader if all feeds were read
    if($("#feed").find(".item[data-is-read!='true']").size() === 0){
        showLoader();
    }
    backgroundPage.markAsRead(feedIds, function(isLoggedIn){
        if($("#feed").find(".item[data-is-read!='true']").size() === 0){
            renderFeeds();
        }
    });
}

function showLoader(){
    $("body").children("div").hide();
    $("#loading").show();
}

function showLogin(){
    $("body").children("div").hide();
    $("#login-btn").text(chrome.i18n.getMessage("Login"));
    $("#login").show();
}

$("#login").click(function () {
    backgroundPage.getAccessToken();
});

//using "mousedown" instead of "click" event to process middle button click.
$("#feed, #feed-saved").on("mousedown", "a", function (event) {
    var link = $(this);
    if(event.which === 1 || event.which === 2){
        var isActiveTab = !(event.ctrlKey || event.which === 2);
        chrome.tabs.create({url: link.data("link"), active : isActiveTab }, function (feedTab) {
            if (backgroundPage.appGlobal.options.markReadOnClick === true && link.hasClass("title") === true) {
                markAsRead([link.closest(".item").data("id")]);
            }
        });
    }
});

$("#popup-content").on("click", "#mark-all-read",function(event){
    var feedIds = [];
    $(".item").each(function(key, value){
        feedIds.push($(value).data("id"));
    });
    markAsRead(feedIds);
});

$("#feed").on("click", ".mark-read", function (event) {
    var feed = $(this).closest(".item");
    markAsRead([feed.data("id")]);
});

$("#feedly").on("click", "#btn-feeds-saved", function(){
    renderSavedFeeds();
});

$("#feedly").on("click", "#btn-feeds", function(){
    renderFeeds();
});

$("#popup-content").on("click", ".show-content", function(){
    var $this = $(this);
    var feed = $this.closest(".item");
    var contentContainer = feed.find(".content");
    var feedId = feed.data("id");
    if(contentContainer.html() === ""){
        var content;
        var feeds = $("#feed").is(":visible") ? popupGlobal.feeds : popupGlobal.savedFeeds;

        for(var i = 0; i < feeds.length; i++){
            if(feeds[i].id === feedId){
                content = feeds[i].content
            }
        }
        if(content){
            contentContainer.html(content);
            //For open new tab without closing popup
            contentContainer.find("a").each(function(key, value){
                var link = $(value);
                link.data("link", link.attr("href"));
                link.attr("href", "javascript:void(0)");
            });
        }
    }
    contentContainer.slideToggle(function () {
        $this.css("background-position", contentContainer.is(":visible") ? "-288px -120px" :"-313px -119px");
        if (contentContainer.is(":visible") && contentContainer.text().length > 350){
            $(".item").css("width",  "700px");
            $("#feedly").css("width",  "700px");
            $(".article-title").css("width", "660px");
        } else{
            $(".item").css("width",  "350px");
            $("#feedly").css("width",  "350px");
            $(".article-title").css("width", "310px");
        }
    });
});

/* Manually feeds update */
$("#feedly").on("click", "#update-feeds", function(){
    $(".icon-refresh").css("background", "url(/images/loading16.gif)");
    if($("#feed").is(":visible")){
        backgroundPage.getFeeds(true, function(feeds, isLoggedIn){
            console.log(feeds);
            if(isLoggedIn){
                //Backward loop for chronological sequence
                for(var i = feeds.length - 1; i >= 0; i--){
                    if($("#feed .item[data-id='" + feeds[i].id + "']").size() === 0){
                        $('#entryTemplate').tmpl(feeds[i]).fadeIn().prependTo('#feed').find(".timeago").timeago();
                        popupGlobal.feeds.push(feeds[i]);
                    }
                }
            }else{
                showLogin();
            }
            $(".icon-refresh").css("background", "");
        });
    } else {
        backgroundPage.getSavedFeeds(true, function(feeds, isLoggedIn){
            console.log(feeds);
            if(isLoggedIn){
                //Backward loop for chronological sequence
                var container = $("#feed-saved");
                for(var i = feeds.length - 1; i >= 0; i--){
                    if($("#feed-saved .item[data-id='" + feeds[i].id + "']").size() === 0){
                        $('#entryTemplate').tmpl(feeds[i]).fadeIn().prependTo(container).find(".timeago").timeago();
                        popupGlobal.savedFeeds.push(feeds[i]);
                        container.find(".mark-read").hide();
                    }
                }
            }else{
                showLogin();
            }
            $(".icon-refresh").css("background", "");
        });
    }
});

/* Save or unsave feed */
$("#popup-content").on("click", ".save-feed", function(){
    var $this = $(this);
    var feed = $this.closest(".item");
    var feedId = feed.data("id");
    var saveItem = !$this.data("saved");
    console.log(typeof $this.data("saved"));
    backgroundPage.toggleSavedFeed(feedId, saveItem);
    $this.text(saveItem);
    $this.data("saved", saveItem);
});

$(document).ready(function(){
    if(backgroundPage.appGlobal.options.abilitySaveFeeds){
        $("#feedly").children("button").show();
    }

    //If we support this localization of timeago, then insert script with it
    if (popupGlobal.supportedTimeAgoLocales.indexOf(window.navigator.language) !== -1) {
        //Trying load localization for jQuery.timeago
        $.getScript("/scripts/timeago/locales/jquery.timeago." + window.navigator.language + ".js", function () {
            renderFeeds();
        });
    }else{
        renderFeeds();
    }
});