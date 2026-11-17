# Windrose Native
Embark on a PvE survival adventure in the Age of Piracy. Fight on land and sea, solo or with friends. Build, craft and explore vast open world filled with dark secrets. Master soulslite combat and take on challenging bosses, command your ship and plunder unspoken treasures!

This egg uses the official native Linux dedicated server, [`windroseserver/windroseserver`](https://hub.docker.com/r/windroseserver/windroseserver), instead of running the Windows server under Wine. The Steam depot for this app still only serves Windows files, so there's no `steamcmd` install step - the install script copies the game files out of that image instead.

## Warning
- If running in a VM, set the CPU type to host/passthrough (or equivalent) to expose full CPU features and avoid crashes.
- [UE4SS](https://github.com/UE4SS-RE/RE-UE4SS) is **not supported** on this egg. It works by DLL-injecting into the Windows `.exe`; the native Linux server is a plain ELF binary with nothing to inject into. If you need UE4SS mods/plugins, you need the Windows server running under Wine instead.

## Server Requirements
| Players | RAM  | Storage |
|---------|------|---------|
| 2       | 8GB  | 32GB SSD |
| 4       | 12GB | 32GB SSD |
| 10      | 16GB | 32GB SSD |

# Connecting to the server
Players can connect by:
- Using the Direct Connect feature, allowing you to connect to the server using your servers allocated ip:port
- Using the Invite Code set by the Invite Code variable (and password if set). The Invite Code does not work when Direct Connection is enabled.
- The Invite Code can be found in `/home/container/R5/ServerDescription.json` and changed in your Invite Code variable.

## Server Ports
- With the Invite Code, ports are dynamically assigned via NAT punch-through. Ensure your router supports UPnP. Disable proxy/VPN temporarily if connections fail.
- With Direct Connect it will use your servers allocated Game Port instead.

# Updating the server
**Reinstall = update.** Use the Pterodactyl **Reinstall** action to re-pull `:latest` from the vendor image and refresh the server files. There is no automatic update on boot.

If players see "The client and server versions do not match", the server is stale - reinstall. The egg automatically patches the server's `DeploymentId` to match the new version during install, so a reinstall is the complete fix.

## Installation Details
- The install script pulls the native Linux server directly from the `windroseserver/windroseserver:latest` Docker image (the Steam depot has no Linux files).
- Debug symbols (`.debug` and `.sym` files) are stripped after install to save ~2.1GB of disk space.
- A single TCP+UDP allocation is enough for either connection mode.

## Mods (Unreal .pak files)
The server loads mods from `R5/Content/Paks/`. To install a mod, upload the mod's `.pak`, `.ucas`, and `.utoc` files (all three are required for each mod) to either:

- `/home/container/R5/Content/Paks/` (directly where the game reads them), or
- `/home/container/Mods/` (a staging directory the install script copies from)

After uploading, **Reinstall** to have the install script preserve them. The install script automatically backs up complete mod trios before updating and restores them after, so mods survive reinstalls.

**Important:** All three files (`.pak`, `.ucas`, `.utoc`) must be present for each mod. Partial sets are skipped. There is no load-order or enable/disable support - mods are always active, matching the behavior of bind-mounting them directly into the container.
