# God Save Birmingham Core Group Test Dedicated Server

Judgment Day has come to medieval Birmingham, and a plague of flesh-hungry ghouls has claimed every living soul… except one. Fight to survive in a highly tactile, physics-based survival sim where every object can be manipulated.

This egg runs the official **Core Group Test dedicated server** (Steam app `5206950`) of the game.

> The dedicated server is a **Windows build**. It has no native Linux server binary, so the egg runs it under Proton.

---

## Requirements

- The **Steam account** used for the install has to own the dedicated server tool. A Steam Guard mobile authenticator is fine, but the confirmation on your phone has to be accepted while the server boots, because the update runs `steamcmd` on every start.
- The server binary needs the Steam client libraries, which the install script places next to it. Do not delete `steamclient64.dll` from `MZClient/Binaries/Win64/`.

---

## Server Ports

| Name | Default | Notes |
|------|---------|-------|
| Game | the panel allocation | The game port. UDP. |
| Query | `9878` | The Steam query port. UDP. Needs its own allocation and firewall rule. |

Both ports are UDP. The game port is the one Pterodactyl allocates for the server, the query port is a separate allocation you add yourself.

---

## Configuration

Everything is configured in `MZClient/Saved/Config/serverconfig.json`, which the panel edits for you:

| Panel option | Config key | Description |
|--------------|------------|-------------|
| Server Name | `name` | Name shown in the server browser. First 20 characters are used. |
| Server Description | `description` | Description shown next to the name. First 200 characters are used. |
| Server Password | `password` | Password required to join the server. Leave empty for none. |
| Max Players | `maxPlayers` | Maximum number of simultaneous players. The publisher recommends 4. |
| Public | `public` | Make the server publicly visible in the server browser. |
| Public Address | `publicAddress` | IP address players use to reach the server. `0.0.0.0` lets the server work it out. |
| Port | `port` | The game port, taken from the server allocation. |

Settings take effect after a restart.

`reopenConsoleOnClose` is kept off deliberately. The server spawns a console helper next to it, which gets an immediate end-of-file on its input in a container and exits. With the option on, the server respawns that helper in a loop until it gives up and dies.

---

## Logs

The server does not write a log file. It pipes its log to the console window it opens on the machine it runs on, so nothing shows up in the Pterodactyl console beyond the Proton start-up banner. The panel marks the server as ready when the game port is bound.

---

## Backups

These are backed up by default:

- `MZClient/Saved/Config/serverconfig.json` - the server configuration
- `MZClient/Saved/SaveGames/` - the save games

---

## Official Documentation

- God Save Birmingham: https://store.steampowered.com/app/3073940/
- Dedicated server tool: https://store.steampowered.com/app/5206950/
