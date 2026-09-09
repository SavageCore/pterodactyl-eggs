# Pterodactyl Game Eggs

A curated collection of Pterodactyl panel eggs with a searchable catalog site.

**[View the catalog &rarr;](https://savagecore.github.io/pterodactyl-eggs/)**

## What is this?

Each folder under `eggs/` contains a game server egg exported from a Pterodactyl panel as `egg-<name>.json` plus a `README.md` with setup notes. The catalog site renders these in a searchable, sortable table with detail pages showing each egg's README and a download button for the JSON.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). In short: add a folder under `eggs/` with your `egg-<name>.json` and `README.md`, open a PR, and validation runs automatically. On merge, the catalog site rebuilds and deploys.

## Validation

Egg JSON is schema-validated in CI against the same rules Pterodactyl's panel applies on import (plus a few extras for portability). See `schema/egg.schema.json` for the full spec.
