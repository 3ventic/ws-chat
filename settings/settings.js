"use strict";
(function ()
{
    var settings = [
        "force-mod-icons",
        "theme",
        "custom-theme",
        "auth-persist"
    ];

    for (var i = 0; i < settings.length; ++i)
    {
        var value;
        if (value = localStorage.getItem(settings[i]))
        {
            var sel = document.getElementById(settings[i]);
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

    document.getElementById('save').onclick = function ()
    {
        for (var i = 0; i < settings.length; ++i)
        {
            var sel = document.getElementById(settings[i]);
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
                localStorage.removeItem(settings[i]);
            }
            else
            {
                localStorage.setItem(settings[i], value);
            }
        }
        alert('Saved!');
    }
})();