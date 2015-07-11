
/*

Auth

*/

function Auth()
{
    var username = "justinfan1";
    var token;
    var hash = window.location.hash;

    this.data = function ()
    {
        return {
            username: this.username,
            token: this.token
        }
    }

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

    this.authorize = function ()
    {
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
            if (data.responseJSON.token.valid && data.responseJSON.token.authorization.scopes.indexOf('chat_login') >= 0)
            {
                this.authorized();
            }
        });

        return true;
    }

    this.redirectToTwitchAuth = function ()
    {
        window.location = "https://api.twitch.tv/kraken/oauth2/authorize?response_type=token&client_id="
            + Auth.clientId + "&redirect_uri="
            + encodeURIComponent(window.location.href.substring(0, window.location.href.lastIndexOf('/') + 1)) +
            "&scope=chat_login";
    }

    this.authorized = function ()
    {
        $('#auth').addClass('hidden');
        $('#app').removeClass('hidden');
        chat.init();
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
    this.init = function ()
    {

    }
}

/*

Connection

*/

function Connection()
{
    var ws = new WebSocket('wss://i.3v.fi:8016/');

    ws.onopen = function ()
    {
        ws.send('CHANNEL ' + chat.channel);
    }
}