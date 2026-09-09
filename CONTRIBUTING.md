# Contributing

Thanks for contributing an egg to the catalog! Here is how to add a new game or variant.

## Adding a new egg

1. **Create a folder** under `eggs/` for your game. For example: `eggs/factorio/`, `eggs/minecraft/java/forge/`.

2. **Add `egg-<name>.json`** exported from a Pterodactyl Panel instance. It must be `PTDL_v2` format. The JSON is validated against `schema/egg.schema.json` in CI - the same checks the Panel runs on import, plus a few extras for portability (see the schema file's description for details).

3. **Add a `README.md`** covering configuration, mod support, setup notes, and anything a server admin needs to know. This becomes the egg's detail page on the catalog site, so write it for that audience. GitHub-flavored markdown is rendered as-is.

4. **Open a PR.** The `validate.yml` workflow runs automatically and checks:
   - The egg JSON is valid against the schema
   - `config.startup`, `config.logs`, `config.files` are valid JSON when parsed
   - No reserved environment variable names are used
   - A sibling `README.md` exists

5. **On merge to `main`**, the `deploy.yml` workflow rebuilds the catalog data and republishes the GitHub Pages site. No manual step.

## JSON validation rules

The schema enforces the Panel's import-time rules:

- `meta.version` must be `PTDL_v1` or `PTDL_v2` (PTDL_v2 recommended)
- `name` is required, max 191 chars
- `author` is required, must be a valid email
- `docker_images` is required, must have at least one entry, each value must match the image ref regex
- `startup` is required (may be null)
- `config.stop`, `config.startup`, `config.logs`, `config.files` are all required for portable eggs
- Each variable must have `name`, `description`, `env_variable`, `default_value`, `user_viewable`, `user_editable`, `rules`
- `env_variable` must be word characters only (1-191 chars) and not a reserved name (`SERVER_MEMORY`, `SERVER_IP`, `SERVER_PORT`, `ENV`, `HOME`, `USER`, `STARTUP`, `SERVER_UUID`, `UUID`)

A warning (not a failure) is emitted if any variable's `rules` contains a `regex:` or `not_regex:` pattern with an unescaped pipe - this is silently broken by the Panel's rule parser (see [pterodactyl/panel#1960](https://github.com/pterodactyl/panel/issues/1960)).

## Local validation

```bash
cd scripts
npm install
node validate-eggs.mjs
```

To test the data build:

```bash
node build-data.mjs
```
