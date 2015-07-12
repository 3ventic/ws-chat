"use strict";
(function ()
{
    var pauseKeyHeld = false;

    /*
    
    Auth
    
    */

    function Auth()
    {
        var username;
        var token;
        var hash = window.location.hash;

        if (!sessionStorage.getItem('chatquery'))
            sessionStorage.setItem('chatquery', window.location.search.length > 0 ? window.location.search : "?");

        this.apiRequest = function (endpoint, data, callback)
        {
            $.ajax({
                url: 'https://api.twitch.tv/' + endpoint,
                success: callback,
                dataType: "jsonp",
                data: data
            });
        }

        this.hashMatch = function (regex)
        {
            var match = hash.match(regex);
            return match ? match[1] : null;
        }

        this.authorized = function ()
        {
            $('#auth').addClass('hidden');
            $('#app').removeClass('hidden');
            window.history.pushState(null, null, sessionStorage.getItem('chatquery'));
            sessionStorage.removeItem('chatquery');
            chat.init();
        }

        this.authorize = function ()
        {
            var self = this;
            if (!(this.token = localStorage.getItem('token')))
            {
                if (this.token = this.hashMatch(/access_token=(\w+)/))
                {
                    if (localStorage.getItem('auth-persist') === "true")
                    {
                        localStorage.setItem('token', this.token);
                    }
                }
                else return false;
            }
            this.apiRequest('kraken/', { oauth_token: this.token }, function (data)
            {
                self.tokenCheckCallback(data);
            });

            return true;
        }

        this.tokenCheckCallback = function (data)
        {
            if (data.token.valid && data.token.authorization.scopes.indexOf('chat_login') >= 0)
            {
                this.username = data.token.user_name;
                this.authorized();
            }
        }

        this.redirectToTwitchAuth = function ()
        {
            window.location = "https://api.twitch.tv/kraken/oauth2/authorize?response_type=token&client_id="
                + Auth.clientId + "&redirect_uri="
                + encodeURIComponent(window.location.href.substring(0, window.location.href.lastIndexOf('/') + 1)) +
                "&scope=chat_login";
        }
    }

    Auth.clientId = "j28hw1wtt0adjocbgipyj70zd6a8ssg";

    var auth = new Auth();
    var chat = new Chat();

    auth.authorize();

    document.getElementById('auth-img').onclick = function ()
    {
        localStorage.setItem('auth-persist', document.getElementById('auth-persist').checked);
        auth.redirectToTwitchAuth();
    }

    $(document).keydown(
            function (evt)
            {
                var code = evt.keyCode || evt.which;
                if (code == 17)
                {
                    pauseKeyHeld = true;
                }
            }
        );
    $(document).keyup(
        function (evt)
        {
            var code = evt.keyCode || evt.which;
            if (code == 17)
            {
                pauseKeyHeld = false;
                var element = $('#app-messages');
                element.animate({ "scrollTop": element[0].scrollHeight }, 200);
            }
        }
    );

    /*
    
    Chat
    
    */

    function Chat()
    {
        this.connection;
        this.channel;
        var chatElement = $('#app-messages');
        this.localuser = {
            mod: false,
            emoteset: "",
            badges: [],
            username: "",
            displayname: "",
            namecolor: ""
        };
        this.namecolors = ["#ff0000", "#0000ff", "#008000", "#b22222", "#ff7f50", "#9acd32", "#ff4500", "#2e8b57", "#daa520", "#d2691e", "#5f9ea0", "#1e90ff", "#ff6984"];
        var emoticons = [];


        this.init = function ()
        {
            if (typeof this.channel === "undefined")
                this.channel = ("channel" in QueryString) ? QueryString["channel"] : window.prompt("Channel?").toLowerCase();
            this.connection = new Connection("wss://i.3v.fi:8016/");

            $('#title').prepend(this.channel + ' - ');

            var self = this;
            $('#app-messages').on('click', "span.modicon", function (evt)
            {
                self.onModIconClicked(this);
            });
            $('#app-messages').on('mouseover', "span.user", function ()
            {
                $('#messages span.user[data-name=' + $(this).attr('data-name') + ']').parent().addClass('highlight-line');
            });
            $('#app-messages').on('mouseleave', "span.user", function ()
            {
                $('#messages span.user[data-name=' + $(this).attr('data-name') + ']').parent().removeClass('highlight-line');
            });
            $('#app-messages').on('mouseover', "img", function ()
            {
                var pos = $(this).offset();
                $("#emote-label").text($(this).attr("alt"));
                $("#emote-label").css("left", pos.left).css("top", pos.top + 30).show();
            });
            $('#app-messages').on('mouseleave', "img", function ()
            {
                $("#emote-label").hide();
            });
            $("#app-messaging-input").keydown(function (evt)
            {
                self.messagingInputKeyDown(evt, this);
            });
            $("#app-messaging-input").tabcomplete({
                collection: function (w)
                {
                    var coll = [];
                    for (var u in self.chatters)
                    {
                        if (u != "jtv" && u.toLowerCase().replace(" ", "").indexOf(w.toLowerCase()) == 0) coll.push(u);
                    }
                    coll.sort(function (a, b) { return self.chatters[b] - self.chatters[a]; });
                    return coll;
                }
            });
        }


        this.onModIconClicked = function (self)
        {
            var user = $(self).parent().attr("data-user");
            var msg = "/timeout " + user + " " + $(self).attr('data-time');
            if ($(self).attr('data-time') === "-1")
            {
                msg = "/ban " + user;
            }
            this.connection.send(msg);
        }


        this.messagingInputKeyDown = function (evt, self)
        {
            var code = evt.keyCode || evt.which;
            if (code == 13)
            {
                evt.preventDefault();
                var message = $(self).val();

                if (message.length < 1)
                    return;

                this.connection.send(message);

                var namecolor;

                if (/^(\/|\.)me /.test(message))
                {
                    message = message.replace(/^(\/|\.)me /, " ");
                    namecolor = this.localuser.namecolor;
                }
                else if (message[0] === "/" || message[0] === ".")
                {
                    this.push({ badges: [], message: "Command sent: " + message });
                    $(self).val("");
                    return;
                }
                else
                    message = ": " + message;

                message = $('<div/>').text(message).html()
                                    .replace(/((?:[Hh][Tt]{2}[Pp][Ss]?:\/\/)?(?:[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*\.)+[A-Za-z]{2,}(?:\/[\w\d._~!$&'\(\)*+,;=:@\/#?%-]+)?)/g, '<a href="$1" target="_blank">$1</a>');

                // Check message for emotes
                if (typeof this.emoticons !== "undefined")
                {
                    for (var i = 0; i < this.emoticons.length; i++)
                    {
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


        this.push = function (data)
        {
            var badgestr = "";
            var modicons = "";
            var ismod = false;
            var styles = "";

            if (data.color)
            {
                styles = ' style="color:' + data.color + '"';
            }

            if (data.badges) for (var i = 0; i < data.badges.length; i++)
                {
                badgestr += '<span class="badge ' + data.badges[i] + '"></span>';
                if (data.badges[i] !== "subscriber" && data.badges[i] !== "turbo") ismod = true;
            }

            if (localStorage.getItem('force-mod-icons') !== "off" && ((this.localuser.mod && !ismod) || localStorage.getItem('force-mod-icons') === "on"))
            {
                modicons = '<span class="modicon" id="purge" title="1 second" data-time="1">P</span>\
                <span class="modicon" id="t600" title="10 minutes" data-time="600">T</span>\
                <span class="modicon" id="t3600" title="1 hour" data-time="3600">H</span>\
                <span class="modicon" id="ban" title="permanent ban" data-time="-1">B</span>';
            }

            var scrollPaused = !(chatElement[0].scrollHeight - chatElement.scrollTop() <= chatElement.outerHeight() + 100);

            if (!data.username)
            {
                chatElement.append('<div class="line system">' + data.message + '</div>');
            }
            else
            {
                chatElement.append('<div class="line" data-user="' + data.username + '"' + styles + '>' + modicons + badgestr + data.displayname
                    + '<span class="normal">' + data.message + '</span></div>');
            }

            // Scrolling?
            if (!scrollPaused && !pauseKeyHeld)
            {
                while ($('.line').length > 200)
                {
                    $('#messages .line').first().remove();
                }
                chatElement.scrollTop(chatElement[0].scrollHeight);
            }
            else
            {
                while ($('.line').length > 2000)
                {
                    $('#messages .line').first().remove();
                }
            }
        }


        this.onEmotesLoad = function (data)
        {
            this.emoticons = [];
            var regexes = [];
            for (var emoteset in data.emoticon_sets)
            {
                if (data.emoticon_sets.hasOwnProperty(emoteset))
                {
                    for (var i = 0; i < data.emoticon_sets[emoteset].length; i++)
                    {
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
                        if (idx === -1)
                        {
                            regexes.push(re);

                            data.emoticon_sets[emoteset][i].code = new RegExp(re, 'g');
                            this.emoticons.push(data.emoticon_sets[emoteset][i]);
                        }
                        else
                        {
                            this.emoticons[idx].id = data.emoticon_sets[emoteset][i].id;
                        }
                    }
                }
            }
        }


        this.userdata = function (data)
        {
            var user = {
                mod: false,
                emoteset: "",
                badges: [],
                username: data.command === "PRIVMSG" ? data.prefix.split('!')[0] : auth.username,
                displayname: "",
                namecolor: ""
            }

            if (typeof data.tags["emote-sets"] === "string")
            {
                if (user.username === auth.username && (!this.localuser || this.localuser.emoteset !== data.tags["emote-sets"]))
                {
                    this.localuser.emoteset = data.tags["emote-sets"];
                    var self = this;
                    auth.apiRequest("kraken/chat/emoticon_images", { emotesets: data.tags["emote-sets"] }, function (data)
                    {
                        self.onEmotesLoad(data);
                    });
                }
            }

            if (this.channel == user.username)
            {
                user.mod = true;
                user.badges.push("broadcaster");
            }
            else if (typeof data.tags["user-type"] === "string" && data.tags["user-type"].length > 0)
            {
                user.mod = true;
                user.badges.push(data.tags["user-type"]);
            }

            if (data.tags.subscriber == "1")
            {
                user.badges.push("subscriber");
            }
            if (data.tags.turbo == "1")
            {
                user.badges.push("turbo");
            }

            var hex = data.tags.color;
            if (typeof hex !== "string" || hex[0] !== '#')
                hex = this.namecolors[user.username.charCodeAt(0) % this.namecolors.length];

            if (localStorage.getItem('theme') === "dark")
            {
                var rgb = hexToRgb(hex);
                if (rgb.r + rgb.g + rgb.b < 150)
                {
                    var red = Math.floor((rgb.r + 30) * 2);
                    var green = Math.floor((rgb.g + 30) * 2);
                    var blue = Math.floor((rgb.b + 30) * 2);

                    hex = rgbToHex(Math.min(255, red), Math.min(255, green), Math.min(255, blue));
                }
            }
            else if (localStorage.getItem('theme') === "light")
            {
                var rgb = hexToRgb(hex);
                if (rgb.r + rgb.g + rgb.b > 105)
                {
                    var red = Math.floor((rgb.r - 30) / 2);
                    var green = Math.floor((rgb.g - 30) / 2);
                    var blue = Math.floor((rgb.b - 30) / 2);

                    hex = rgbToHex(Math.max(0, red), Math.max(0, green), Math.max(0, blue));
                }
            }
            user.namecolor = hex;
            user.displayname = '<span class="user" style="color:' + hex + '" data-name="' + user.username + '">' + user.username + '</span>';

            return user;
        }
    }

    /*
    
    Connection
    
    */

    function Connection(address)
    {
        var ws;
        var anonymous = ("anonymous" in QueryString);
        var self = this;
        var reconnect = 2;

        this.connect = function ()
        {
            ws = new WebSocket(address);
            chat.push({ badges: [], username: "", message: "Connecting..." });
        }

        this.connect();


        ws.onopen = function ()
        {
            ws.send('CHANNEL ' + (anonymous ? "!" : "") + chat.channel);
            chat.push({ badges: [], username: "", message: "Connected!" });
            reconnect = 2;
        }


        ws.onmessage = function (event)
        {
            self.onWsMessage(event);
        }


        ws.onclose = function (event)
        {
            chat.push({ badges: [], username: "", message: "Disconnected! Reconnecting in " + reconnect + " seconds..." });
            setTimeout(function ()
            {
                self.connect();
                if (reconnect < 300) reconnect *= 2;
            }, reconnect * 1000);
        }


        this.onWsMessage = function (event)
        {
            var data = parseMessage(event.data);

            switch (data.command)
            {
                case "RELAYAUTH":
                    ws.send('CAP REQ :twitch.tv/tags twitch.tv/commands');
                    ws.send('PASS oauth:' + auth.token);
                    ws.send('NICK ' + auth.username);
                    if (!anonymous) ws.send('JOIN #' + chat.channel);
                    break;
                case "PING":
                    ws.send('PONG');
                    break;
                case "GLOBALUSERSTATE":
                case "USERSTATE":
                    chat.localuser = chat.userdata(data);
                    break;
                case "PRIVMSG":
                    var message = data.params[1];
                    var user = chat.userdata(data);
                    var localuser = chat.localuser;

                    var isAction = false;
                    if (message[0] === '\u0001')
                    {
                        message = message.replace('\u0001ACTION ', '').replace('\u0001', '');
                        isAction = true;
                    }

                    // Replace emotes and links
                    if (typeof data.tags.emotes === "string")
                    {
                        var surrogates = [];
                        for (var i = 0; i < message.length; ++i)
                        {
                            var charcode = message.charCodeAt(i);
                            if (charcode <= 0xDBFF && charcode >= 0xD800)
                            {
                                surrogates.push([charcode, message.charCodeAt(i + 1)]);
                                ++i;
                            }
                        }
                        // Replace surrogates while calculating emotes
                        for (var i = 0; i < surrogates.length; ++i)
                        {
                            message = message.replace(String.fromCharCode(surrogates[i][0], surrogates[i][1]), String.fromCharCode(0xE000 + i));
                        }

                        var differentEmotes = data.tags.emotes.split('/');
                        var replacementData = [];
                        for (var i = 0; i < differentEmotes.length; i++)
                        {
                            var emoteData = differentEmotes[i].split(':');
                            var ranges = emoteData[1].split(',');
                            for (var j = 0; j < ranges.length; j++)
                            {
                                var range = ranges[j].split('-');
                                replacementData.push([parseInt(range[0]), parseInt(range[1]), emoteData[0]]);
                            }
                        }
                        replacementData.sort(function (x, y)
                        {
                            if (x[0] > y[0]) return -1;
                            if (x[0] < y[0]) return 1;
                            return 0;
                        });
                        var normalText = [];
                        var lastStartIndex = message.length;
                        for (var i = 0; i < replacementData.length; i++)
                        {
                            normalText.push(message.substring(replacementData[i][1] + 1, lastStartIndex));
                            lastStartIndex = replacementData[i][0];
                            message = replaceFromTo(message, '</span><img class="emote" src="https://static-cdn.jtvnw.net/emoticons/v1/' + replacementData[i][2] + '/1.0" alt="' + message.substring(replacementData[i][0], replacementData[i][1] + 1) + '" /><span class="normal">', replacementData[i][0], replacementData[i][1]);
                        }
                        normalText.push(message.substring(0, lastStartIndex));

                        // Put surrogate pairs back in
                        for (var i = 0; i < surrogates.length; ++i)
                        {
                            message = message.replace(String.fromCharCode(0xE000 + i), String.fromCharCode(surrogates[i][0], surrogates[i][1]));
                        }

                        message = message.replace(/[\uE000-\uF8FF]/g, function (x)
                        {
                            return String.fromCharCode(0xD800 + (x.charCodeAt(0) - 0xE000));
                        });

                        for (var i = normalText.length - 1; i >= 0; i--)
                        {
                            if (normalText[i].length > 0)
                            {
                                var links = {};
                                var linkid = 0xE000;
                                var text = $('<div/>').text(normalText[i]).html()
                                    .replace(/(?:[Hh][Tt]{2}[Pp][Ss]?:\/\/)?(?:[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*\.)+[A-Za-z]{2,}(?:\/[\w\d._~!$&'\(\)*+,;=:@\/#?%-]+)?/g,
                                        function (m)
                                        {
                                            links[++linkid] = '<a href="' + m + '" target="_blank">' + m + '</a>';
                                            return String.fromCharCode(linkid);
                                        });
                                var oldtext = text;
                                message = message.replace(new RegExp(localuser.username, "i"), function (m) { return '<span class="highlight">' + m + '</span>' });
                                if (oldtext != text)
                                {
                                    // found a highlight
                                    Connection.chatters[displayName] = Math.max(Connection.chatters[displayName] || 0, this.messageid + 200);
                                }
                                text = text.replace(/[\uE000-\uF8FF]/g, function (x) { return links[x.charCodeAt(0)]; });
                                message = message.replace(normalText[i], text);
                            }
                        }
                    }
                    else
                    {
                        var links = {};
                        var linkid = 0xE000;
                        message = $('<div/>').text(message).html()
                                .replace(/((?:[Hh][Tt]{2}[Pp][Ss]?:\/\/)?(?:[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*\.)+[A-Za-z]{2,}(?:\/[\w\d._~!$&'\(\)*+,;=:@\/#?%-]+)?)/g,
                                    function (m)
                                    {
                                        links[++linkid] = '<a href="' + m + '" target="_blank">' + m + '</a>';
                                        return String.fromCharCode(linkid);
                                    });
                        var oldmessage = message;
                        message = message.replace(new RegExp(localuser.username, "i"), function (m) { return '<span class="highlight">' + m + '</span>' });
                        if (oldmessage != message)
                        {
                            // found a highlight
                            Connection.chatters[displayName] = Math.max(Connection.chatters[displayName] || 0, this.messageid + 200);
                        }
                        message = message.replace(/[\uE000-\uF800]/g, function (x) { return links[x.charCodeAt(0)]; });
                    }

                    var color;
                    if (!isAction)
                        message = ': ' + message;
                    else
                    {
                        color = user.namecolor;
                        message = ' ' + message;
                    }

                    if (user.username === "jtv" || user.username === "twitchnotify")
                        chat.push({ badges: [], username: "", message: message });
                    else
                        chat.push({ badges: user.badges, displayname: user.displayname, username: user.username, message: message, color: color });

                    var links = $('#app-messages a');
                    for (var i = 0; i < links.length; i++)
                    {
                        var attr = $(links[i]).attr('href');
                        if (!attr.startsWith("http://") && !attr.startsWith("https://"))
                        {
                            $(links[i]).attr('href', 'http://' + attr);
                        }
                    }

                    break;
                case "NOTICE":
                    chat.push({ badges: [], user: "", message: data.params[1] });
                    break;
                case "ROOMSTATE":
                    if ('r9k' in data.tags)
                    {
                        if (data.tags['r9k'] === '1')
                            $("#app-info-r9k").text("R9K");
                        else
                            $("#app-info-r9k").text("");
                    }
                    if ('subs-only' in data.tags)
                    {
                        if (data.tags['subs-only'] === '1')
                            $("#app-info-sub").text("SUB");
                        else
                            $("#app-info-sub").text("");
                    }
                    if ('slow' in data.tags)
                    {
                        if (parseInt(data.tags['slow']) > 0)
                            $("#app-info-slow").text("SLOW " + data.tags['slow']);
                        else
                            $("#app-info-slow").text("");
                    }
                    break;
                case "CLEARCHAT":
                    if (data.params.length > 1)
                    {
                        $('.line[data-user=' + data.params[1] + ']').addClass('deleted');
                    }
                    else
                    {
                        var message = "Chat cleared by a moderator.";
                        if (chat.localuser.mod)
                        {
                            message = "Chat cleared by a moderator, but prevented because of your moderator access.";
                        }
                        else if (localStorage.getItem('clear-prevention') == "on")
                        {
                            message = "Chat cleared by a moderator, but prevented because of your settings.";
                        }
                        else
                        {
                            $('#app-messages').html('');
                        }
                        chat.push({ badges: [], username: "", message: message });
                    }
                    break;
            }


            this.send = function (message)
            {
                ws.send('PRIVMSG #' + chat.channel + ' :' + message);
            }
        }
    }

    Connection.chatters = {};
})();