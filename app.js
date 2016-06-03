"use strict";
(function () {
    var pauseKeyHeld = false;
    var scrollPaused = false;

    /*
    
    Auth
    
    */

    function Auth() {
        this.username;
        this.token;
        var hash = window.location.hash;

        this.apiRequest = function (endpoint, data, callback) {
            if (!data) {
                data = {};
            }
            data.client_id = Auth.clientId;
            $.ajax({
                url: 'https://api.twitch.tv/' + endpoint,
                success: callback,
                dataType: "jsonp",
                data: data
            });
        }

        this.hashMatch = function (regex) {
            var match = hash.match(regex);
            return match ? match[1] : null;
        }

        this.authorized = function () {
            $('#auth').addClass('hidden');
            $('#app').removeClass('hidden');
            chat.init();
        }

        this.authorize = function () {
            var self = this;
            if (!(this.token = localStorage.getItem('token'))) {
                if (this.token = this.hashMatch(/access_token=(\w+)/)) {
                    if (localStorage.getItem('auth-persist') === "on") {
                        localStorage.setItem('token', this.token);
                    }
                }
                else return false;
            }

            var query;
            if (query = this.hashMatch(/state=([^&]*)/)) {
                window.history.pushState(null, null, decodeURIComponent(query));
            }
            else {
                window.history.pushState(null, null, window.location.search.length > 0 ? window.location.search : "?");
            }

            this.apiRequest('kraken/', { oauth_token: this.token }, function (data) {
                self.tokenCheckCallback(data);
            });

            return true;
        }

        this.tokenCheckCallback = function (data) {
            if (data.token.valid && data.token.authorization.scopes.indexOf('chat_login') >= 0) {
                this.username = data.token.user_name;
                this.authorized();
            }
            else {
                localStorage.removeItem('token');
                this.redirectToTwitchAuth();
            }
        }

        this.redirectToTwitchAuth = function () {
            window.location = "https://api.twitch.tv/kraken/oauth2/authorize?response_type=token&client_id="
                + Auth.clientId + "&redirect_uri="
                + encodeURIComponent(window.location.href.substring(0, window.location.href.lastIndexOf('/') + 1)) +
                "&scope=chat_login&state=" + encodeURIComponent(window.location.search.length > 0 ? window.location.search : "?");
        }
    }

    /*

    Starts here

    */

    Auth.clientId = "lx7k0zjg3m6pr504r4gyvnel0e2qtl0";

    var auth = new Auth();
    var chat = new Chat();

    auth.authorize();

    document.getElementById('auth-img').onclick = function () {
        if (document.getElementById('auth-persist').checked)
            localStorage.setItem('auth-persist', "on");
        auth.redirectToTwitchAuth();
    }

    $(document).keydown(
            function (evt) {
                var code = evt.keyCode || evt.which;
                if (code == 17) {
                    pauseKeyHeld = true;
                }
            }
        );
    $(document).keyup(
        function (evt) {
            var code = evt.keyCode || evt.which;
            if (code == 17) {
                pauseKeyHeld = false;
                var element = $('#app-messages');
                element.animate({ "scrollTop": element[0].scrollHeight }, 200);
                scrollPaused = false;
            }
        }
    );
    document.onmousewheel = function (evt) {
        if (evt.wheelDeltaY > 0) {
            scrollPaused = true;
        }
    }
    window.onblur = function () {
        pauseKeyHeld = false;
    }

    window.addEventListener('storage', function (e) {
        console.log(e);
        switch (e.key) {
            case "custom-theme":
                loadStylesheet(e.newValue);
                break;
            case "auth-persist":
                if (e.newValue === "on") {
                    localStorage.setItem('token', auth.token);
                }
                else {
                    localStorage.removeItem('token');
                }
                break;
        }
    });

    function loadStylesheet(stylesheetUrl) {
        if (stylesheetUrl === null)
            return;

        $('#custom-styles').remove();
        var stylelink = document.createElement('link');
        stylelink.setAttribute('rel', 'stylesheet');
        stylelink.setAttribute('type', 'text/css');
        stylelink.setAttribute('href', stylesheetUrl);
        stylelink.setAttribute('id', 'custom-styles');
        document.getElementsByTagName("head")[0].appendChild(stylelink);
    }

    var styleUrl;
    if (styleUrl = localStorage.getItem('custom-theme'))
        loadStylesheet(styleUrl);
        
    document.getElementById('app-info-popout-link').onclick = function (e) {
        e.preventDefault();
        window.open("http://player.twitch.tv/?html5&channel=" + chat.channel, "height=1280;width=720");
    }

    document.getElementById('app-info-settings-link').onclick = function (e) {
        e.preventDefault();
        window.open("settings/", "3v.fi Chat Settings", "height=800,width=700");
    }

    document.getElementById('app-info-chatters-link').onclick = function (e) {
        e.preventDefault();
        window.open("http://twitchstuff.3v.fi/chatters/?ch=" + chat.channel, "height=800;width=700");
    }

    document.getElementById('app-info-reconnect-link').onclick = function (e) {
        chat.reconnect();
    }



    /*
    
    Chat
    
    */

    function Chat() {
        this.connection;
        this.anonconnection;
        this.channel;
        var chatElement = $('#app-messages');
        this.localuser = {
            mod: false,
            emoteset: "",
            badges: [],
            username: "",
            displayname: "",
            rawdisplayname: "",
            namecolor: ""
        };
        this.namecolors = ["#ff0000", "#0000ff", "#008000", "#b22222", "#ff7f50", "#9acd32", "#ff4500", "#2e8b57", "#daa520", "#d2691e", "#5f9ea0", "#1e90ff", "#ff6984"];
        var emoticons = [];
        this.timeouts = {};


        this.init = function () {
            var qstr = QueryString();
            if (typeof this.channel === "undefined")
                this.channel = ("channel" in qstr) ? qstr["channel"] : window.prompt("Channel?").toLowerCase();

            if (styleUrl = localStorage.getItem('#' + this.channel + 'custom-theme'))
                loadStylesheet(styleUrl);

            if ("anonymous" in QueryString()) {
                this.connection = new Connection("wss://irc-ws.chat.twitch.tv/", false, false);
                this.anonconnection = new Connection("wss://irc-ws.chat.twitch.tv/", true, true);
            }
            else {
                this.connection = new Connection("wss://irc-ws.chat.twitch.tv/", false, true);
            }

            $.ajax({
                url: 'https://twitchstuff.3v.fi/chat/api/global/display?language=en',
                success: function (data) {
                    Chat.badges = data.badge_sets;
                },
                dataType: 'json'
            }); 
            auth.apiRequest("kraken/channels/" + this.channel, null, function (ch) {
                $.ajax({
                    url: 'https://twitchstuff.3v.fi/chat/api/channels/' + ch._id + '/display?language=en',
                    success: function (data) {
                        Chat.badges.subscriber = data.badge_sets.subscriber;
                    },
                    dataType: 'json'
                }); 
            });

            $('#title').prepend(this.channel + ' - ');

            var self = this;
            $('#app-messages').on('click', "span.modicon", function (evt) {
                self.onModIconClicked(this);
            });
            $('#app-messages').on('mouseover', "span.user", function () {
                var user = $(this).attr('data-name');
                $('#app-messages span.user[data-name=' + user + ']').parent().addClass('mouse-highlight');
                var pos = $(this).offset();
                $("#emote-label").text((self.timeouts[user] ? self.timeouts[user].timeouts : 0) + " timeouts on record");
                $("#emote-label").css("left", pos.left).css("top", pos.top + 30).show();
            });
            $('#app-messages').on('mouseleave', "span.user", function () {
                $('#app-messages span.user[data-name=' + $(this).attr('data-name') + ']').parent().removeClass('mouse-highlight');
                $('#emote-label').hide();
            });
            $('#app-messages').on('mouseover', "img", function () {
                var pos = $(this).offset();
                $("#emote-label").text($(this).attr("alt"));
                $("#emote-label").css("left", pos.left).css("top", pos.top + 30).show();
            });
            $('#app-messages').on('mouseleave', "img", function () {
                $("#emote-label").hide();
            });
            $("#app-messaging-input").keydown(function (evt) {
                scrollPaused = false;
                self.messagingInputKeyDown(evt, this);
            });
            $("#app-messaging-input").tabcomplete({
                collection: function (w) {
                    var coll = [];
                    for (var u in Connection.chatters) {
                        if (u != "jtv" && u.toLowerCase().replace(" ", "").indexOf(w.toLowerCase()) == 0) coll.push(u);
                    }
                    coll.sort(function (a, b) { return Connection.chatters[b] - Connection.chatters[a]; });
                    return coll;
                }
            });
        }


        this.reconnect = function () {
            this.connection.onWsClose();
            if (this.anonconnection) {
                this.anonconnection.onWsClose();
            }
        }


        this.onModIconClicked = function (self) {
            var user = $(self).parent().attr("data-user");
            var msg = "/timeout " + user + " " + $(self).attr('data-time');
            if ($(self).attr('data-time') === "-1") {
                msg = "/ban " + user;
            }
            this.connection.send(msg);
        }


        this.messagingInputKeyDown = function (evt, self) {
            var code = evt.keyCode || evt.which;
            if (code == 13) {
                evt.preventDefault();
                var message = $(self).val();

                if (message.length < 1)
                    return;

                this.connection.send(message);

                var namecolor;

                if (/^(\/|\.)me /.test(message)) {
                    message = message.replace(/^(\/|\.)me /, " ");
                    namecolor = this.localuser.namecolor;
                }
                else if (message[0] === "/" || message[0] === ".") {
                    this.push({ badges: [], message: "Command sent: " + message });
                    $(self).val("");
                    return;
                }
                else
                    message = ": " + message;

                message = $('<div/>').text(message).html()
                                    .replace(/((?:[Hh][Tt]{2}[Pp][Ss]?:\/\/)?(?:[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*\.)+[A-Za-z]{2,}(?:\/[\w\d._~!$&'\(\)*+,;=:@\/#?%-]+)?)/g, '<a href="$1" target="_blank">$1</a>');

                // Check message for emotes
                if (typeof this.emoticons !== "undefined") {
                    for (var i = 0; i < this.emoticons.length; i++) {
                        message = message.replace(this.emoticons[i].code, '$1<img class="emote" src="https://static-cdn.jtvnw.net/emoticons/v1/' + this.emoticons[i].id + '/1.0" alt="$2" />');
                    }
                }

                this.push({
                    badges: this.localuser.badges,
                    username: this.localuser.username,
                    message: message,
                    displayname: this.localuser.displayname,
                    color: namecolor
                });
                $(self).val("");
            }
        }


        this.push = function (data) {
            var badgestr = "";
            var modicons = "";
            var ismod = data.mod;
            var styles = "";

            var classes = data.highlight ? " highlight" : "";
            if (data.color) {
                styles = ' style="color:' + data.color + '"';
            }

            if (data.badges) for (var i = 0; i < data.badges.length; i++) {
                badgestr += '<img class="badge" src="' + data.badges[i].image_url_1x + '" alt="' + data.badges[i].title + '" />';
            }

            if (localStorage.getItem('#' + this.channel + 'force-mod-icons') === "on"
                || (localStorage.getItem('force-mod-icons') === "on"
                    && localStorage.getItem('force-mod-icons') !== "off")
                || (this.localuser.mod
                    && !ismod
                    && localStorage.getItem('#' + this.channel + 'force-mod-icons') !== "off"
                    && localStorage.getItem('force-mod-icons') !== "off")) {
                modicons = '<span class="modicon" id="purge" title="1 second" data-time="1"></span>\
                <span class="modicon" id="t600" title="10 minutes" data-time="600"></span>\
                <span class="modicon" id="t3600" title="1 hour" data-time="3600"></span>\
                <span class="modicon" id="ban" title="permanent ban" data-time="-1"></span>';
            }

            //var scrollPaused = !(chatElement[0].scrollHeight - chatElement.scrollTop() <= chatElement.outerHeight() + 100);

            var id = "msg" + (Math.floor(Math.random() * (Math.pow(2, 52)))).toString();
            if (!data.username) {
                chatElement.append('<div class="line system" id="' + id + '">' + data.message + '</div>');
            }
            else {
                chatElement.append('<div class="line' + classes + '" data-user="' + data.username + '"' + styles + '>'
                    + modicons + badgestr + data.displayname + '<span class="message" id="' + id + '"><span class="normal">' + data.message + '</span></span></div>');
            }

            // Scrolling? i.e. not scrolled up and not holding CTRL while the document has focus
            if (!scrollPaused && !(pauseKeyHeld && !document.hidden)) {
                while ($('.line').length > 200) {
                    $('#app-messages .line').first().remove();
                }
                chatElement.scrollTop(chatElement[0].scrollHeight);
            }
            else {
                while ($('.line').length > 2000) {
                    $('#app-messages .line').first().remove();
                }
            }
            return '#' + id;
        }


        this.onEmotesLoad = function (data) {
            this.emoticons = [];
            var regexes = [];
            for (var emoteset in data.emoticon_sets) {
                if (data.emoticon_sets.hasOwnProperty(emoteset)) {
                    for (var i = 0; i < data.emoticon_sets[emoteset].length; i++) {
                        // we reverse-regex the emote codes
                        var prettycode = data.emoticon_sets[emoteset][i].code
                                         .replace(/\\(\W)/g, function (a, b) { return b; }) // unescape
                                         .replace(/\(([^\)]*)\)/g, function (a, b) { return b.split("|")[0]; }) // resolve alternatives
                                         .replace(/\[([^\]]*)\]/g, function (a, b) { return b[0]; }) // resolve character sets
                                         .replace(/[^\\]\?/, "") // remove optional characters
                                         .replace("&lt;", "<") // unescape html
                                         .replace("&gt;", ">"); // see above
                        Connection.chatters[prettycode] = 0;
                        var re = '(\\s|^)(' + data.emoticon_sets[emoteset][i].code + ')(?=\\s|$)';
                        var idx = regexes.indexOf(re);
                        if (idx === -1) {
                            regexes.push(re);

                            data.emoticon_sets[emoteset][i].code = new RegExp(re, 'g');
                            this.emoticons.push(data.emoticon_sets[emoteset][i]);
                        }
                        else {
                            this.emoticons[idx].id = data.emoticon_sets[emoteset][i].id;
                        }
                    }
                }
            }
        }


        this.userdata = function (data) {
            var user = {
                mod: false,
                emoteset: "",
                badges: [],
                username: data.command === "PRIVMSG" ? data.prefix.split('!')[0] : auth.username,
                displayname: "",
                rawdisplayname: "",
                namecolor: ""
            }

            if (typeof data.tags["emote-sets"] === "string") {
                if (user.username === auth.username && (!this.localuser || this.localuser.emoteset !== data.tags["emote-sets"])) {
                    this.localuser.emoteset = data.tags["emote-sets"];
                    var self = this;
                    auth.apiRequest("kraken/chat/emoticon_images", { emotesets: data.tags["emote-sets"] }, function (data) {
                        self.onEmotesLoad(data);
                    });
                }
            }

            if (this.channel == user.username) {
                user.mod = true;
            }
            else if (typeof data.tags["user-type"] === "string" && data.tags["user-type"].length > 0) {
                user.mod = true;
            }
            else if (data.tags.mod == "1") {
                user.mod = true;
            }
            
            if (typeof data.tags["badges"] === "string") {
                var badges = data.tags["badges"].split(',');
                for (var i = 0; i < badges.length; ++i) {
                    var badge = badges[i].split('/');
                    if (Chat.badges[badge[0]]) {
                        user.badges.push(Chat.badges[badge[0]].versions[badge[1]]);
                    }
                }
            }

            var hex = data.tags.color;
            if (typeof hex !== "string" || hex[0] !== '#')
                hex = this.namecolors[user.username.charCodeAt(0) % this.namecolors.length];

            if (localStorage.getItem('#' + this.channel + 'theme') === "dark" || (localStorage.getItem('theme') === "dark" && localStorage.getItem('#' + this.channel + 'theme') === null)) {
                var rgb = hexToRgb(hex);
                if (rgb.r + rgb.g + rgb.b < 150) {
                    var red = Math.floor((rgb.r + 30) * 2);
                    var green = Math.floor((rgb.g + 30) * 2);
                    var blue = Math.floor((rgb.b + 30) * 2);

                    hex = rgbToHex(Math.min(255, red), Math.min(255, green), Math.min(255, blue));
                }
            }
            else if (localStorage.getItem('#' + this.channel + 'theme') === "light" || (localStorage.getItem('theme') === "light" && localStorage.getItem('#' + this.channel + 'theme') === null)) {
                var rgb = hexToRgb(hex);
                if (rgb.r + rgb.g + rgb.b > 105) {
                    var red = Math.floor((rgb.r - 30) / 2);
                    var green = Math.floor((rgb.g - 30) / 2);
                    var blue = Math.floor((rgb.b - 30) / 2);

                    hex = rgbToHex(Math.max(0, red), Math.max(0, green), Math.max(0, blue));
                }
            }
            user.namecolor = hex;
            var name = data.tags['display-name'] && data.tags['display-name'].length > 0 ? unescapeTag(data.tags['display-name']) : user.username;
            user.rawdisplayname = name;

            user.displayname = '<span class="user" style="color:' + hex + '" data-name="' + user.username + '">' + name + '</span>';

            return user;
        }
    }
    
    Chat.badges = {};

    /*
    
    Connection
    
    */

    function Connection(address, anonymous, join) {
        var ws;
        var self = this;
        var reconnect = 2;
        this.messageid = 0;

        this.connect = function () {
            ws = new WebSocket(address);
            chat.push({ badges: [], username: "", message: "Connecting..." });

            ws.onopen = function () {
                self.onWsOpen();
            }

            ws.onmessage = function (event) {
                self.onWsMessage(event);
            }

            ws.onerror = function (event) {
                self.onWsError(event);
            }

            ws.onclose = function (event) {
                self.onWsClose(event);
            }
        }

        this.connect();


        this.onWsOpen = function () {
            ws.send('CAP REQ :twitch.tv/tags twitch.tv/commands');
            if (anonymous) {
                ws.send('NICK justinfan1');
                if (join) ws.send('JOIN #' + chat.channel);
            }
            else {
                ws.send('PASS oauth:' + auth.token);
                ws.send('NICK ' + auth.username);
                if (join) ws.send('JOIN #' + chat.channel);
            }
            chat.push({ badges: [], username: "", message: "Connected!" });
            reconnect = 2;
        }


        this.onWsError = function (event) {
            chat.push({ badges: [], username: "", message: "Socket error!"(ws.readyState === 3 ? " Connection refused." : "") });
            console.log(event);
            ws = null;
        }


        this.onWsClose = function (event) {
            chat.push({ badges: [], username: "", message: "Disconnected! Reconnecting in " + reconnect + " seconds..." });
            ws = null;
            setTimeout(function () {
                self.connect();
                if (reconnect < 30) reconnect *= 2;
            }, reconnect * 1000);
        }


        this.onWsMessage = function (event) {
            var data = parseMessage(event.data);

            switch (data.command) {
                case "PING":
                    ws.send('PONG mods');
                    break;
                case "GLOBALUSERSTATE":
                case "USERSTATE":
                    chat.localuser = chat.userdata(data);
                    break;
                case "PRIVMSG":
                    var message = data.params[1];
                    var user = chat.userdata(data);
                    var localuser = chat.localuser;
                    var highlight = false;

                    if (chat.timeouts[user.username]) {
                        chat.timeouts[user.username].endtimes = [];
                        chat.timeouts[user.username].reasons = [];
                    }

                    var ignoredUsers;
                    if (ignoredUsers = localStorage.getItem('#' + chat.channel + 'ignored-users') || localStorage.getItem('ignored-users')) {
                        if (ignoredUsers.split(',').indexOf(user.username) >= 0) {
                            return;
                        }
                    }

                    var ignorepattern;
                    if (ignorepattern = localStorage.getItem('#' + chat.channel + 'ignore-pattern') || localStorage.getItem('ignore-pattern')) {
                        var patterns = ignorepattern.split(/\r?\n/);
                        for (var i = 0; i < patterns.length; ++i) if (message.search(new RegExp(patterns[i])) >= 0) {
                            return;
                        }
                    }

                    this.messageid++;
                    Connection.chatters[user.rawdisplayname] = Math.max(Connection.chatters[user.rawdisplayname] || 0, this.messageid);

                    var highlightedUsers;
                    if (highlightedUsers = localStorage.getItem('#' + chat.channel + 'highlight-users') || localStorage.getItem('highlight-users')) {
                        if (highlightedUsers.split(',').indexOf(user.username) >= 0) {
                            highlight = true;
                        }
                    }

                    var highlightpattern;
                    if (highlightpattern = localStorage.getItem('#' + chat.channel + 'highlight-pattern') || localStorage.getItem('highlight-pattern')) {
                        var patterns = highlightpattern.split(/\r?\n/);
                        for (var i = 0; i < patterns.length; ++i) if (message.search(new RegExp(patterns[i])) >= 0) {
                            highlight = true;
                        }
                    }

                    var isAction = false;
                    if (message[0] === '\u0001') {
                        message = message.replace('\u0001ACTION ', '').replace('\u0001', '');
                        isAction = true;
                    }

                    // Replace emotes and links
                    if (typeof data.tags.emotes === "string") {
                        var surrogates = [];
                        for (var i = 0; i < message.length; ++i) {
                            var charcode = message.charCodeAt(i);
                            if (charcode <= 0xDBFF && charcode >= 0xD800) {
                                surrogates.push([charcode, message.charCodeAt(i + 1)]);
                                ++i;
                            }
                        }
                        // Replace surrogates while calculating emotes
                        for (var i = 0; i < surrogates.length; ++i) {
                            message = message.replace(String.fromCharCode(surrogates[i][0], surrogates[i][1]), String.fromCharCode(0xE000 + i));
                        }

                        var differentEmotes = data.tags.emotes.split('/');
                        var replacementData = [];
                        for (var i = 0; i < differentEmotes.length; i++) {
                            var emoteData = differentEmotes[i].split(':');
                            var ranges = emoteData[1].split(',');
                            for (var j = 0; j < ranges.length; j++) {
                                var range = ranges[j].split('-');
                                replacementData.push([parseInt(range[0]), parseInt(range[1]), emoteData[0]]);
                            }
                        }
                        replacementData.sort(function (x, y) {
                            if (x[0] > y[0]) return -1;
                            if (x[0] < y[0]) return 1;
                            return 0;
                        });
                        var normalText = [];
                        var lastStartIndex = message.length;
                        for (var i = 0; i < replacementData.length; i++) {
                            normalText.push(message.substring(replacementData[i][1] + 1, lastStartIndex));
                            lastStartIndex = replacementData[i][0];
                            message = replaceFromTo(message, '</span><div class="emote-container"><img class="emote" src="https://static-cdn.jtvnw.net/emoticons/v1/' + replacementData[i][2] + '/1.0" alt="' + message.substring(replacementData[i][0], replacementData[i][1] + 1) + '" /></div><span class="normal">', replacementData[i][0], replacementData[i][1]);
                        }
                        normalText.push(message.substring(0, lastStartIndex));

                        // Put surrogate pairs back in
                        for (var i = 0; i < surrogates.length; ++i) {
                            message = message.replace(String.fromCharCode(0xE000 + i), String.fromCharCode(surrogates[i][0], surrogates[i][1]));
                        }

                        message = message.replace(/[\uE000-\uF8FF]/g, function (x) {
                            return String.fromCharCode(0xD800 + (x.charCodeAt(0) - 0xE000));
                        });

                        for (var i = normalText.length - 1; i >= 0; i--) {
                            if (normalText[i].length > 0) {
                                var links = {};
                                var linkid = 0xE000;
                                var text = $('<div/>').text(normalText[i]).html()
                                    .replace(/(?:[Hh][Tt]{2}[Pp][Ss]?:\/\/)?(?:[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*\.)+[A-Za-z]{2,}(?:\/[\w\d._~!$&'\(\)*+,;=:@\/#?%-]+)?/g,
                                        function (m) {
                                            links[++linkid] = '<a href="' + m + '" target="_blank">' + m + '</a>';
                                            return String.fromCharCode(linkid);
                                        });
                                var oldtext = text;
                                message = message.replace(new RegExp(localuser.username, "i"), function (m) { return '<span class="highlight">' + m + '</span>' });
                                if (oldtext != text) {
                                    // found a highlight
                                    Connection.chatters[user.rawdisplayname] = Math.max(Connection.chatters[user.rawdisplayname] || 0, this.messageid + 200);
                                }
                                text = text.replace(/[\uE000-\uF8FF]/g, function (x) { return links[x.charCodeAt(0)]; });
                                message = message.replace(normalText[i], text);
                            }
                        }
                    }
                    else {
                        var links = {};
                        var linkid = 0xE000;
                        message = $('<div/>').text(message).html()
                                .replace(/((?:[Hh][Tt]{2}[Pp][Ss]?:\/\/)?(?:[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*\.)+[A-Za-z]{2,}(?:\/[\w\d._~!$&'\(\)*+,;=:@\/#?%-]+)?)/g,
                                    function (m) {
                                        links[++linkid] = '<a href="' + m + '" target="_blank">' + m + '</a>';
                                        return String.fromCharCode(linkid);
                                    });
                        var oldmessage = message;
                        message = message.replace(new RegExp(localuser.username, "i"), function (m) { return '<span class="highlight">' + m + '</span>' });
                        if (oldmessage != message) {
                            // found a highlight
                            Connection.chatters[user.rawdisplayname] = Math.max(Connection.chatters[user.rawdisplayname] || 0, this.messageid + 200);
                        }
                        message = message.replace(/[\uE000-\uF800]/g, function (x) { return links[x.charCodeAt(0)]; });
                    }

                    var color;
                    if (!isAction)
                        message = ': ' + message;
                    else {
                        color = user.namecolor;
                        message = ' ' + message;
                    }

                    if (user.username === "jtv" || user.username === "twitchnotify")
                        chat.push({ badges: [], username: "", message: message });
                    else
                        chat.push({
                            badges: user.badges,
                            displayname: user.displayname,
                            username: user.username,
                            message: message,
                            color: color,
                            highlight: highlight
                        });

                    var links = $('#app-messages a');
                    for (var i = 0; i < links.length; i++) {
                        var attr = $(links[i]).attr('href');
                        if (!attr.startsWith("http://") && !attr.startsWith("https://")) {
                            $(links[i]).attr('href', 'http://' + attr);
                        }
                    }

                    break;
                case "NOTICE":
                    chat.push({ badges: [], user: "", message: data.params[1] });
                    break;
                case "ROOMSTATE":
                    if ('r9k' in data.tags) {
                        if (data.tags['r9k'] === '1')
                            $("#app-info-r9k").text("R9K");
                        else
                            $("#app-info-r9k").text("");
                    }
                    if ('emote-only' in data.tags) {
                        if (data.tags['emote-only'] === '1')
                            $("#app-info-emote").html('<img alt="Emote only" title="Emote only" src="https://static-cdn.jtvnw.net/emoticons/v1/25/1.0" height="16" />');
                        else
                            $("#app-info-emote").text("");
                    }
                    if ('subs-only' in data.tags) {
                        if (data.tags['subs-only'] === '1')
                            $("#app-info-sub").text("SUB");
                        else
                            $("#app-info-sub").text("");
                    }
                    if ('slow' in data.tags) {
                        if (parseInt(data.tags['slow']) > 0)
                            $("#app-info-slow").text("SLOW " + data.tags['slow']);
                        else
                            $("#app-info-slow").text("");
                    }
                    if (data.tags['roomstate']) {
                        $("#app-info-lang").text(data.tags['roomstate'].toUpperCase() + ' |');
                    }
                    break;
                case "CLEARCHAT":
                    if (data.params.length > 1) {
                        var reason;
                        var reason_plain = "";
                        var endtime = Date.now();
                        if ('ban-duration' in data.tags) {
                            reason = "timed out for " + data.tags['ban-duration'] + " seconds";
                            endtime += parseInt(data.tags['ban-duration']) * 1000;
                        }
                        else {
                            reason = "permabanned";
                            endtime -= 2;
                        }
                        if ('ban-reason' in data.tags && data.tags['ban-reason'].length > 0) {
                            reason_plain = unescapeTag(data.tags['ban-reason']);
                            reason += " for: " + reason_plain;
                        }
                        
                        var reason_plain_lower = reason_plain.toLowerCase();
                        var user = data.params[1];
                        var lines = $('.line[data-user=' + user + ']');
                        lines.addClass('deleted');
                        
                        if (chat.timeouts[user]) {
                            var endtime_found = false;
                            for (var i = 0; i < chat.timeouts[user].endtimes.length; ++i) {
                                if (Math.abs(chat.timeouts[user].endtimes[i] - endtime) < 4000) {
                                    endtime_found = true;
                                    break;
                                }
                            }
                            if (!endtime_found || chat.timeouts[user].reasons.indexOf(reason_plain_lower) === -1) {
                                var id = chat.push({ badges: [], user: "", message: user + " has been " + reason });
                                console.log(chat.timeouts[user], endtime, reason_plain);
                                chat.timeouts[user].id = id;
                                chat.timeouts[user].reasons.push(reason_plain_lower);
                                chat.timeouts[user].endtimes.push(endtime);
                                ++chat.timeouts[user].timeouts;
                            }
                        }
                        else {
                            var id = chat.push({ badges: [], user: "", message: user + " has been " + reason });
                            console.log(chat.timeouts[user], endtime, reason_plain);
                            chat.timeouts[user] = {
                                id: id,
                                reasons: [ reason_plain_lower ],
                                endtimes: [ endtime ],
                                timeouts: 1
                            }
                        }
                    }
                    else {
                        var message = "Chat cleared by a moderator.";
                        if (chat.localuser.mod) {
                            message = "Chat cleared by a moderator, but prevented because of your moderator access.";
                        }
                        else if (localStorage.getItem('#' + chat.channel + 'clear-prevention') == "on" || localStorage.getItem('clear-prevention') == "on") {
                            message = "Chat cleared by a moderator, but prevented because of your settings.";
                        }
                        else {
                            $('#app-messages').html('');
                        }
                        chat.push({ badges: [], username: "", message: message });
                    }
                    break;
            }


            this.send = function (message) {
                ws.send('PRIVMSG #' + chat.channel + ' :' + message);
            }
        }
    }

    Connection.chatters = {};

    function unescapeTag(tag) {
        return tag.replace(/\\s/g, ' ').replace(/\\:/g, ';').replace(/\\\\/g, '\\').replace(/\\r/g, '').replace(/\\n/g, '\u23CE');
    }
})();
