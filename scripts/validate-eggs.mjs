import { glob } from 'glob';
import { readFile } from 'fs/promises';
import { resolve, dirname, join, relative } from 'path';
import { fileURLToPath } from 'url';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import schema from '../schema/egg.schema.json' with { type: 'json' };

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');

const RESERVED_ENV_NAMES = new Set([
  'SERVER_MEMORY',
  'SERVER_IP',
  'SERVER_PORT',
  'ENV',
  'HOME',
  'USER',
  'STARTUP',
  'SERVER_UUID',
  'UUID',
]);

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);
const validate = ajv.compile(schema);

let errors = 0;
let warnings = 0;

function logError(file, msg) {
  console.error(`\x1b[31mERROR\x1b[0m ${file}: ${msg}`);
  errors++;
}

function logWarning(file, msg) {
  console.warn(`\x1b[33mWARN \x1b[0m ${file}: ${msg}`);
  warnings++;
}

async function validateEgg(jsonPath) {
  const relPath = relative(repoRoot, jsonPath);
  const folder = dirname(jsonPath);
  const content = await readFile(jsonPath, 'utf-8');

  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch (e) {
    logError(relPath, `Invalid JSON: ${e.message}`);
    return;
  }

  if (!parsed.meta || !['PTDL_v1', 'PTDL_v2'].includes(parsed.meta.version)) {
    logError(relPath, "meta.version must be 'PTDL_v1' or 'PTDL_v2'");
    return;
  }

  const valid = validate(parsed);
  if (!valid) {
    for (const err of validate.errors) {
      logError(relPath, `${err.instancePath || '/'}: ${err.message}`);
    }
  }

  const config = parsed.config || {};
  for (const key of ['startup', 'logs', 'files']) {
    if (typeof config[key] === 'string' && config[key] !== '') {
      try {
        JSON.parse(config[key]);
      } catch (e) {
        logError(relPath, `config.${key} is not valid JSON: ${e.message}`);
      }
    }
  }

  const variables = parsed.variables || [];
  for (let i = 0; i < variables.length; i++) {
    const v = variables[i];
    const envVar = v.env_variable;

    if (envVar && RESERVED_ENV_NAMES.has(envVar)) {
      logError(relPath, `variables[${i}].env_variable '${envVar}' is a reserved name`);
    }

    if (typeof v.rules === 'string') {
      const regexMatch = v.rules.match(/(?:not_)?regex:\/([^/]*)\//);
      if (regexMatch && regexMatch[1].includes('|')) {
        logWarning(
          relPath,
          `variables[${i}].rules has a regex pattern with unescaped pipe: '${v.rules}'. This will be silently broken by the Panel's rule parser (see pterodactyl/panel#1960).`
        );
      }
    }
  }

  const readmePath = join(folder, 'README.md');
  try {
    await readFile(readmePath, 'utf-8');
  } catch {
    logError(relPath, `Missing sibling README.md at ${relative(repoRoot, readmePath)}`);
  }
}

async function main() {
  const targetFiles = process.argv.slice(2);

  let files;
  if (targetFiles.length > 0) {
    files = targetFiles.map((f) => resolve(repoRoot, f));
  } else {
    const pattern = join(repoRoot, 'eggs/**/egg-*.json');
    files = await glob(pattern, {
      ignore: ['**/node_modules/**', '**/site/**', '**/.git/**'],
    });
  }

  if (files.length === 0) {
    console.log('No egg JSON files found.');
    return;
  }

  console.log(`Found ${files.length} egg file(s) to validate.\n`);

  for (const file of files.sort()) {
    await validateEgg(file);
  }

  console.log('');
  if (warnings > 0) {
    console.log(`\x1b[33m${warnings} warning(s)\x1b[0m`);
  }
  if (errors > 0) {
    console.log(`\x1b[31m${errors} error(s)\x1b[0m`);
    process.exit(1);
  } else {
    console.log('\x1b[32mAll eggs valid.\x1b[0m');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
