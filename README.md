# ws-chat

A Twitch chat client for chat moderators. The goal is to offer chat moderators any useful features that can be done with just the client and Twitch's chat servers.

## Current features

- Hotkey to pause chat scrolling (CTRL) to avoid misclicks
- Regex-supported highlight and ignore rules
- Tab-complete for usernames and emotes
- Channel mode indicators (emote- and subscriber-only, slow, r9k)
- Chatters list (popout to another tool)
- Name color corrections to make them easier to read (optional setting)
- Prevent /clear (optional setting)
- Custom stylesheet setting to change colors (or anything else, really)
- Channel-specific setting profiles in addition to the default

## Dependencies not included in this repository

Should you wish to host this on your site, you'll need to change the client ID in app.js and get the dependencies below.

- [jQuery caret](https://github.com/acdvorak/jquery.caret/tree/master/dist)