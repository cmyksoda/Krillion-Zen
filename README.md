# Krillion - Zen Edition

Krillion, without the timer. This is a modpack for the daily trivia game, Krillion, that is meant to be run locally or semi-locally for a more laid-back experience with friends.

## Dependencies
- Docker & Docker Compose
- Node.js
- `wget` and `curl`

## Quick start

```bash
chmod +x setup.sh
./setup.sh
docker compose up -d
```

Then open http://localhost:3030

`setup.sh` will:

1. `npm install`
2. `wget` a static mirror of krillion.io into `krillion-mirror/`
3. Strip Vercel `?dpl=` query strings from downloaded filenames
4. Curl canvas backgrounds and tier icons that wget misses
5. Run `apply_mods.js` (menu, timer, copy, missing JS chunks, inject `local-auth.js`)
6. `touch users.db` so Docker does not mount a directory over the SQLite file

If krillion.io pushes an update that breaks your mirror, rerun `./setup.sh` (to pick up a new official deploy), then rebuild:

```bash
docker compose up -d --build
```

## What this changes

- No 25-second timer.
- Menu is simplified, removing paid options and items tied to the real site. Unlimited, archive, packs, friends, merch, FAQ are hidden.
- Local usernames instead of Google. Simple, case-insensitive login.
- `/leaderboard` with scores from Today's Dive and All-Time Best scores from all users of your mirror. Both tabs are gated until the viewer has played today's dive.

## Hosting Advisory

<<<<<<< HEAD
Keep the running instance on localhost/LAN/tailscale. Do **not** put it on a public URL. Krillion's site is copyrighted and is not free to redistribute.
=======
Keep the running instance on localhost/LAN/tailscale. Do ***not*** put it on a public URL. Krillion's site is copyrighted and is not free to redistribute.
>>>>>>> aea7cccf134afa8548896547ce74184ef47ff88c
