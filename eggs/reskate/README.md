# ReSkate

ReSkate is a fan project that brings skate. offline play, Steam lobbies, parties, throwdowns and dedicated servers. This egg runs its **headless dedicated server as a native Linux x86_64 binary**: no game install, no Proton and no Wine, and it is a lobby host rather than a game server, so it stays small.

> Note: the native Linux server is the newest part of ReSkate and is still moving. Expect the occasional rough edge, and expect a reinstall to be how you pick up upstream changes.

---

## Which release this installs

Each ReSkate release ships a Windows package, and the releases that have a published Linux package also ship `ReSkateServer-Linux-<version>.zip`. The egg downloads that archive and nothing else: no compiler, no source build.

Leave `[INSTALL] ReSkate Version` empty to take the newest release. If the newest release does not have a Linux package yet, the install stops and prints the exact URL it wanted, for example:

```
error: could not download https://github.com/Dingo-Shenanigans/ReSkate/releases/download/v1.0.6/ReSkateServer-Linux-1.0.6.zip.
```

Check <https://github.com/Dingo-Shenanigans/ReSkate/releases> for the releases that list a `ReSkateServer-Linux-*.zip` asset, set `[INSTALL] ReSkate Version` to one of those tags, and reinstall.

Two variables decide what gets installed:

| Variable | Default | Effect |
|----------|---------|--------|
| `[INSTALL] Repository` | `Dingo-Shenanigans/ReSkate` | The `owner/name` releases are downloaded from |
| `[INSTALL] ReSkate Version` | empty | The tag to install. Empty takes the newest one in that repository |

### Installing from a fork

While the official releases carry no Linux package, `[INSTALL] Repository` lets you install from anywhere that does publish one. A fork qualifies if it has a `v<major>.<minor>.<patch>` tag whose release lists `ReSkateServer-Linux-<version>.zip`:

```
[INSTALL] Repository    SavageCore/ReSkate
[INSTALL] ReSkate Version  v1.0.7
```

A repository with no tags fails before downloading anything, so leave `ReSkate Version` empty only when the repository has releases to pick from.

`world-layers.json` is fetched from the same repository, then falls back to the project's own releases, since a fork may publish no Windows package. The catalog describes the game rather than the server build, so either source is the same file.

The server has **no self-update on Linux**, so a reinstall is also how you move to a newer release. Your `ReSkateServer.json`, `Mods/` and bans carry over: back them up first if you care about them.

---

## Server Ports

| Name  | Default | Allocation        |
|-------|---------|-------------------|
| Game  | 27015   | Primary allocation (`SERVER_PORT`) |
| Query | 27016   | A second allocation |

Both are **UDP**. Players connect through Steam's relay network, so nothing strictly has to be reachable. Forwarding UDP 27015 and 27016 anyway makes the in-game browser show the server's ping and lets players join a little faster.

Add a second allocation for the query port and set `[SERVER] Query Port` to match it.

---

## System Requirements

| Type        | Memory | Storage |
|-------------|--------|---------|
| Minimal     | 512 MB | 1 GB   |
| Recommended | 1 GB   | 2 GB   |

There are no game assets to store. Most of the disk use is Valve's `steamclient.so`, which the server loads to talk to Steam.

---

## Configuration

Settings live in `ReSkateServer.json` next to the server binary. The Panel rewrites the values it manages every time the server starts, so anything the Panel lists below wins over a change made in game.

| Panel Option | Config key | Notes |
|--------------|------------|-------|
| `[SERVER] Server Name` | `name` | Shown in the browser. 1 to 64 characters |
| `[SERVER] Map` | `map` | `San Vansterdam`, `Isle of Grom`, `Super Ultra Mega Resort`, `Tutorial Island`, `Stadium 1`, `Stadium 2`, or a custom map |
| `[SERVER] Max Players` | `max_players` | 1 to 249 |
| `[SERVER] Server Password` | `password` | Empty for anyone |
| `[SERVER] Welcome Message` | `welcome` | One chat line, at most 200 bytes |
| `[SERVER] Listed` | `listed` | `0` hides the server; players then need the join code |
| `[SERVER] Query Port` | `query_port` | Matches the query allocation |
| `[SERVER] Network Tick Rate` | `tps` | 20, 30, 60 or 120 |
| `[SERVER] Voice Chat` | `voice_chat` | |
| `[SERVER] Voice Range` | `voice_range` | 50 to 1000 metres |
| `[SERVER] Object Placement` | `object_placement` | `everyone`, `admins` or `nobody` |
| `[SERVER] Speed Check` | `speed_check` | `warn`, `kick` or `off` |
| `[SERVER] Score Check` | `score_check` | `warn`, `kick` or `off` |
| `[SERVER] Parties` | `parties` | |
| `[SERVER] Party Size` | `party_size` | 2 to 8 |
| `[SERVER] Activity Log` | `activity_log` | |
| `[SERVER] Announce Throwdowns` | `announce_throwdowns` | |
| `[SERVER] Noclip` | `noclip` | Admins always can |
| `[SERVER] No Bail` | `no_bail` | |
| `[SERVER] Boosts` | `boosts` | Admins always can |
| `[SERVER] Enforce Physics Tuning` | `enforce_tuning` | Players use the game's own tuning |
| `[SERVER] World Layer Sync` | `world_layer_sync` | See below |
| Game port | `port` | Follows the primary allocation |

### Settings the Panel does not manage

These are arrays or nested objects, so they are left alone by the Panel and persist across restarts. Change them from the console (**Console** tab) or from the in-game admin menu:

| Setting | Command |
|---------|---------|
| `admins` | `admin add <SteamID64>` / `admin remove <SteamID64>` |
| `bans` | `ban <player>`, `unban <SteamID64>`, `bans` |
| `votes` | `votes map on`, `votes kick on`, `votes tod on`, `votes seconds <n>`, `votes cooldown <n>` |
| `layers` | `layer-sync on`, `layer <key> on\|off`, `tod <time>` |
| `parks` | `park <construction\|historic\|financial> <layout>` |
| `distances` | `distances <full> <half> <half-return> <low>` |
| `score_allow` | `score-allow <fingerprint>` |

`[SERVER] Admin SteamIDs` is the exception: it is written into the file **on install**, so fill it in before installing if you can. Afterwards use `admin add`.

The Panel rewrites the managed keys but keeps everything else, so console changes to the settings above survive a restart while Panel-managed values are reset to the Panel.

---

## How to Join

Players find the server in the game under **Multiplayer > Servers**, or join it by its join code. The server signs in to Steam anonymously, so it gets a new Steam ID and therefore a **new join code on every start**. The browser always finds it by name.

Players and the server need the same ReSkate version. If a player cannot connect, check that their game is up to date first.

### How to Become an Admin

1. Set `[SERVER] Admin SteamIDs` to your SteamID64 (comma separated) **before** installing, or
2. Start the server and send `admin add <SteamID64>` in the **Console** tab

Admins then type `/` followed by a command in game chat, such as `/kick <player>` or `/votes`.

---

## Time of Day and World Layers

`world-layers.json` is the catalog of the world's time-of-day and layer states. The Linux package does not carry it, so the egg fetches it from the matching Windows package during install (`[INSTALL] World Layers File`).

With the file in place, set `[SERVER] World Layer Sync` to `1` to force the same time of day and layers on everyone, and use `tod <default\|morning\|noon\|afternoon\|evening\|night>` in the console. Without it every player keeps their own.

Exporting a fresh catalog needs the Windows game, so re-run the fetch by reinstalling after a game update, or copy one from a player's `%LOCALAPPDATA%\ReSkate\cache\` folder.

---

## Custom Maps

Copy a map's mod folder from the game's `Mods/` folder into `Mods/` next to the server. Only the mod's `reskate-levels.json` is read, and the map then becomes selectable by name in `[SERVER] Map`. Players need the same map mod installed to join it.

---

## Backups

`.pteroignore` keeps backups to just the configuration and any custom maps:

```
*
!ReSkateServer.json
!Mods/
```

The binary, the Steam libraries and the `ReSkateServer.log` the server writes are all reinstalled or regenerated, so there is nothing to back up for them.

## Files

| File | What it is |
|------|------------|
| `ReSkateServer` | The server binary |
| `ReSkateServer.json` | All settings, rewritten by the Panel on every boot |
| `ReSkateServer.log` | A dated copy of everything the console shows |
| `libsteam_api.so`, `steamclient.so`, `libtier0_s.so`, `libvstdlib_s.so` | Valve's Steam libraries, from the release archive |
| `.steam/sdk64/` | Symlinks to those libraries. `libsteam_api.so` loads `steamclient.so` from here, so **deleting this folder stops the server from starting** |
| `world-layers.json` | Time of day and world layer catalog |
| `Mods/` | Custom maps. Each mod's `reskate-levels.json` is all that is read |

If the server is ever moved or restored from a backup, check that `.steam/sdk64/steamclient.so` still points at `steamclient.so` next to the binary.

---

## Troubleshooting

| Symptom | Cause and fix |
|---------|---------------|
| Install stops at `could not download ...ReSkateServer-Linux-<version>.zip` | That release has no published Linux package. Pick a tag that lists one, wait for the next release, or point `[INSTALL] Repository` at a repository that publishes them |
| Install stops at `... has no v<major>.<minor>.<patch> tags` | `[INSTALL] Repository` points at a repository with no tags. Check the spelling, or set `[INSTALL] ReSkate Version` yourself |
| Panel stays on "starting" | The startup line the Panel waits for is the join code, printed only after the server has signed in to Steam. A sign-in that cannot reach Steam times out after 60 seconds and the server exits |
| `Cannot load .../libsteam_api.so` | The package did not unpack completely. Reinstall |
| `Failed to load module '.../.steam/sdk64/steamclient.so'` | The `.steam/sdk64` symlinks are gone. Reinstall, or recreate them: `ln -sf ../../steamclient.so /home/container/.steam/sdk64/steamclient.so` |
| Players cannot find the server | Check `[SERVER] Listed` is `1`, that the name is not duplicated, and that the allocation is reachable if you want ping shown |

`ReSkateServer.log` next to the binary keeps a dated copy of everything the console shows, which is the first place to look after a crash.

---

## Documentation

- Project and launcher: <https://github.com/Dingo-Shenanigans/ReSkate>
- Server settings and every console command: shipped as `README-server.txt` next to the server
- Native Linux notes: shipped as `README-linux.md` next to the server

## Contributors

| Name       | GitHub Profile                |
|------------|-------------------------------|
| SavageCore | https://github.com/SavageCore |