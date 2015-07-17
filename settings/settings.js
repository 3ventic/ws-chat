"use strict";
(function ()
{
    var settings = [
        "force-mod-icons",
        "clear-prevention",
        "theme",
        "custom-theme",
        "highlight-pattern",
        "ignore-pattern",
        "highlight-users",
        "ignored-users"
    ];

    var globalSettings = [
        "auth-persist"
    ];

    var channel = "";

    function loadValue(prefix, setting)
    {
        var value;
        if (value = localStorage.getItem(prefix + setting))
        {
            var sel = document.getElementById(setting);
            if (sel.tagName.toLowerCase() === "select")
            {
                var opts = sel.options;
                for (var j = 0; j < opts.length; ++j)
                {
                    if (opts[j].value == value)
                    {
                        sel.selectedIndex = j;
                        break;
                    }
                }
            }
            else
            {
                sel.value = value;
            }
        }
    }

    function loadValues()
    {
        for (var i = 0; i < settings.length; ++i)
            loadValue(channel, settings[i]);
        for (var i = 0; i < globalSettings.length; ++i)
            loadValue("", globalSettings[i]);
    }

    loadValues();

    document.getElementById('editing').onblur = function ()
    {
        var value = document.getElementById('editing').value;
        if (value.length > 0 && value[0] === "#")
        {
            channel = value;
        }
        else if (value === "default")
        {
            channel = "";
        }
        else
        {
            document.getElementById('editing').value = channel;
            alert('Channel profiles start with #, default profile is called "default"');
            return;
        }
        loadValues();
    }

    document.getElementById('copyb').onclick = function ()
    {
        var chFrom = document.getElementById('copy').value;
        var chTo = channel;
        if (chFrom.length > 0 && chFrom[0] === "#")
        {
            channel = chFrom;
        }
        else if (chFrom === "default")
        {
            channel = "";
        }
        else
        {
            alert('Channel profiles start with #, default profile is called "default"');
            return;
        }

        loadValues();
        channel = chTo;
        document.getElementById('copy').value = "";
        saveValues("Copied!");
    }

    document.getElementById('save').onclick = saveValues;
    function saveValue(prefix, setting)
    {
        var sel = document.getElementById(setting);
        var value;
        if (sel.tagName.toLowerCase() === "select")
        {
            value = sel.options[sel.selectedIndex].value;
        }
        else
        {
            value = sel.value;
        }

        if (value === "")
        {
            localStorage.removeItem(prefix + setting);
        }
        else
        {
            localStorage.setItem(prefix + setting, value);
        }
    }
    function saveValues(message)
    {
        for (var i = 0; i < settings.length; ++i)
            saveValue(channel, settings[i]);
        for (var i = 0; i < globalSettings.length; ++i)
            saveValue("", globalSettings[i]);

        alert(typeof message === "string" ? message : "Saved!");
    }
})();