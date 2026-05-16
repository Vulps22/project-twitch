# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Purpose

A locally-run Twitch overlay and chat bot for streamers. It connects to Twitch's EventSub API, responds to Twitch events and chat, and broadcasts visual/audio effects to a browser-based overlay (displayed via OBS browser source). Everything runs on the streamer's own machine.

## Roadmap

**GitHub issues are the single source of truth for the roadmap.** Always check open issues before starting work. If the roadmap changes, update the GitHub issues — not this file or memory.

```bash
gh issue list --state open
```

## Commands

```bash
npm start          # Dev server with auto-reload (node --watch)
npm run start-fail # Production start (no watch)
npm run stream-check  # Verify streaming safety config
```

No test framework or linter is configured.

## Branch, Commit and PR Conventions

Every piece of work is prefixed with its GitHub issue number. Every commit must leave the codebase in a runnable state and cover a single responsibility.

| Type | Format | Example |
|---|---|---|
| Branch | `<issue>-<slug>` | `22-define-baseEventType` |
| Commit | `#<issue> - <description>` (≤50 chars) | `#22 - Add BaseEventType class` |
| PR title | `[#<issue>] <description>` | `[#22] Define BaseEventType contract` |

Feature branches are cut from the milestone branch and PR'd back into it. The milestone branch PRs into `main` when complete. PR titles are the source for automated changelog generation.

**Commit discipline:** Never bundle unrelated changes into one commit to avoid a messy diff. Use `git add -p` to stage hunks, or `git cherry-pick` to isolate work. A commit that touches two responsibilities should be two commits. Prefer smaller and correct over larger and convenient.

## Working Style

**Never begin executing tasks without explicit instruction to do so.** Plan, present, confirm — then wait for the user to say go.

## Code Standards

**SOLID and DRY are non-negotiable.** Every class has one responsibility, dependencies are injected, and logic is never duplicated.

**Everything must be modular and extensible without touching existing code.** The test for this: adding a new event type means dropping a new handler module into `backend/src/event-types/` and restarting — nothing else changes. Adding a new overlay effect means a new renderer module. No switch statements or if-chains that need editing each time a new type is added; use a registry or dynamic loader instead.

## Architecture

**Twitch → Backend → Overlay**

1. `backend/src/twitch-client.js` — connects to Twitch EventSub WebSocket, routes incoming events to `TwitchEventHandler`
2. `backend/src/handlers/TwitchEventHandler.js` — single unified handler; looks up matching event config and executes it
3. `overlay/index.html` — browser overlay (OBS browser source) that connects via WebSocket and renders animations, video, images, and audio

### Dependency Injection

Services are wired in `backend/index.js` using a two-phase pattern. Constructors accept `null` for circular dependencies, resolved afterward via setters:

```js
eventHandler.setTwitchClient(twitchClient)
```

The server runs without Twitch credentials — services initialize conditionally.

### Unified Event Config

All triggers — chat commands, Twitch events, channel point redemptions — are defined as entries in `backend/config/events.js` with an `event_type` field:

```js
{
  event_name: string,       // unique identifier
  event_type: string,       // see types below
  trigger_on?: string[],    // required for chat_command, chat_contains, channel_points_redemption
  reply?: string,           // chat message
  image?: string,           // overlay image (served from /assets/img/)
  sound?: string,           // overlay audio (served from /assets/audio/)
  video?: string,           // overlay video (served from /assets/video/)
  text?: string,            // overlay text
  transition_in?: string,   // 'fade-in' | 'bounce-in' | 'slide-in' | 'scale-in'
  transition_out?: string,  // 'fade-out' | 'bounce-out' | 'slide-out' | 'scale-out'
  timeout?: string          // display duration e.g. '6s', '20s'
}
```

**Event types:**

| `event_type` | Trigger | `trigger_on` |
|---|---|---|
| `chat_command` | `!keyword` in chat | command names e.g. `['lurk']` |
| `chat_contains` | message contains phrase | phrases e.g. `['six seven']` |
| `follow` | channel follow | — |
| `subscription` | new sub | — |
| `raid` | incoming raid | — |
| `bits` | bits cheer | — |
| `channel_points_redemption` | Twitch reward redeemed | reward titles e.g. `['My Reward']` |

Template variables: `{{username}}`, `{{count}}`, `{{display_name}}`, `{{followed_at}}`, `{{user_id}}`

### Handler Pattern

`backend/src/base/Handler.js` is the base class. It provides:

- `executeConfig(config, templateData)` — dispatches chat replies and overlay effects based on a config object
- `processTemplate(template, data)` — replaces `{{placeholder}}` tokens

### WebSocket Protocol

`OverlayBroadcasterService` broadcasts JSON to all connected overlay clients:

```js
{ type: 'connection', message: string }         // on connect
{ type: 'event', event_name: string,            // on trigger
  image?, sound?, video?, text?,
  transition_in?, transition_out?, timeout? }
```

## Environment

Copy `.env.example` to `.env`:

```
TWITCH_CLIENT_ID
TWITCH_ACCESS_TOKEN   # scopes: user:read:chat, channel:read:subscriptions, moderator:read:followers, user:write:chat, channel:read:redemptions
TWITCH_CHANNEL_NAME
PORT                  # default 3000
```

## Known Issues

- `TwitchEventHanndler.js` has a typo in the filename (double 'n') — should be fixed when the file is next significantly changed
- No command cooldown system yet (issue #20)
- No auth on the Express server or WebSocket endpoint
