
/*

Auth

*/

function Auth()
{
    var username;
    var token;
    var hash = window.location.hash;

    this.apiRequest = function (endpoint, data, callback)
    {
        $.ajax({
            url: 'https://api.twitch.tv/' + endpoint,
            complete: callback,
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
        window.history.pushState(null, null, window.location.search.length > 0 ? window.location.search : "?");
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
        if (data.responseJSON.token.valid && data.responseJSON.token.authorization.scopes.indexOf('chat_login') >= 0)
        {
            this.username = data.responseJSON.token.user_name;
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

/*

Chat

*/

function Chat()
{
    var connection;
    var channel;

    this.init = function ()
    {
        if (typeof this.channel === "undefined")
            this.channel = ("channel" in QueryString) ? QueryString["channel"] : window.prompt("Channel?");
        connection = new Connection();
    }


}

/*

Connection

*/

function Connection()
{
    var ws = new WebSocket('wss://i.3v.fi:8016/');
    var anonymous = ("anonymous" in QueryString);
    var self = this;

    ws.onopen = function ()
    {
        ws.send('CHANNEL ' + (anonymous ? "!" : "") + chat.channel);
    }

    ws.onmessage = function (event)
    {
        self.onWsMessage(event);
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

        }
    }
}