import { glob } from 'glob';
import { readFile, writeFile, mkdir, copyFile, rm } from 'fs/promises';
import { resolve, dirname, join, relative, basename } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');
const siteDataDir = join(repoRoot, 'site', 'public', 'data');
const sitePublicEggsDir = join(repoRoot, 'site', 'public', 'eggs');

function slugifyFolderPath(folderPath) {
  const rel = relative(repoRoot, folderPath);
  const withoutTop = rel.replace(/^eggs[\/\\]/i, '');
  return withoutTop.toLowerCase().replace(/[\/\\]/g, '-');
}

function slugifyFilePath(jsonPath) {
  const base = basename(jsonPath, '.json');
  return base.replace(/^egg-/, '').toLowerCase();
}

function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const GAME_ADJECTIVES = [
  'Cosmic', 'Shadow', 'Iron', 'Crystal', 'Neon', 'Frozen', 'Crimson', 'Golden',
  'Phantom', 'Rusty', 'Electric', 'Mystic', 'Savage', 'Silent', 'Wild', 'Ancient',
  'Turbo', 'Quantum', 'Solar', 'Lunar',
];
const GAME_NOUNS = [
  'Frontier', 'Forge', 'Realm', 'Drift', 'Haven', 'Vortex', 'Citadel', 'Expedition',
  'Legends', 'Horizon', 'Reapers', 'Embers', 'Nomads', 'Sentinels', 'Raiders', 'Odyssey',
  'Protocol', 'Corsair', 'Bastion', 'Engine',
];

function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}

function generateReadme(slug, rng) {
  const sections = 2 + Math.floor(rng() * 3);
  const lines = [`# ${slug}`, ''];
  for (let i = 0; i < sections; i++) {
    lines.push(`## Section ${i + 1}`, '');
    lines.push(`Details for section ${i + 1} of ${slug}.`, '');
    if (rng() > 0.5) {
      lines.push('| Setting | Default | Notes |', '|---------|---------|-------|');
      const rows = 2 + Math.floor(rng() * 4);
      for (let r = 0; r < rows; r++) {
        lines.push(`| Key${r} | value${r} | Note ${r} |`);
      }
      lines.push('');
    }
    if (rng() > 0.5) {
      lines.push('```bash', `echo "${slug} setup complete"`, '```', '');
    }
  }
  return lines.join('\n');
}

function generateEggJson(name) {
  return JSON.stringify({
    meta: { version: 'PTDL_v2', update_url: null },
    name,
    author: 'seeded@example.com',
    description: `Seeded test egg for ${name}.`,
    docker_images: { latest: 'ghcr.io/ptero-eggs/seeded:latest' },
    config: { startup: '{}', logs: '{}', files: '{}' },
    scripts: { installation: { script: '#!/bin/bash\necho install', container: 'alpine', entrypoint: 'ash' } },
    variables: [],
  }, null, 2);
}

function generateDummyEggs(count) {
  const rng = mulberry32(12345);
  const eggs = [];
  for (let i = 0; i < count; i++) {
    const adj = pick(rng, GAME_ADJECTIVES);
    const noun = pick(rng, GAME_NOUNS);
    const num = String(i + 1).padStart(2, '0');
    const name = `Seeded ${adj} ${noun} ${num}`;
    const slug = `seeded-${adj.toLowerCase()}-${noun.toLowerCase()}-${num}`;
    const fileName = `egg-${slug}.json`;
    const downloadPath = `eggs/${slug}/${fileName}`;
    const readmePath = `data/readme/${slug}.md`;
    eggs.push({
      slug,
      name,
      author: 'seeded@example.com',
      description: `Deterministic test entry #${i + 1}: ${adj} ${noun}.`,
      path: `seeded/${slug}`,
      jsonPath: `seeded/${slug}/${fileName}`,
      fileName,
      downloadPath,
      readmePath,
      readme: generateReadme(slug, rng),
      eggJson: generateEggJson(name),
    });
  }
  return eggs;
}

async function main() {
  const args = process.argv.slice(2);
  const dummyIndex = args.indexOf('--dummy');
  const dummyCount = dummyIndex !== -1 ? Number(args[dummyIndex + 1]) || 50 : 0;

  await rm(sitePublicEggsDir, { recursive: true, force: true });
  await rm(siteDataDir, { recursive: true, force: true });

  let eggs;

  if (dummyCount > 0) {
    console.log(`\x1b[33mSEEDED MODE: ${dummyCount} dummy eggs - NOT real data\x1b[0m\n`);
    eggs = generateDummyEggs(dummyCount);
  } else {
    const pattern = join(repoRoot, 'eggs/**/egg-*.json');
    const files = await glob(pattern, {
      ignore: ['**/node_modules/**', '**/site/**', '**/.git/**'],
    });

    console.log(`Found ${files.length} egg file(s) to process.\n`);

    const folderCounts = new Map();
    for (const f of files) {
      const folder = dirname(f);
      folderCounts.set(folder, (folderCounts.get(folder) ?? 0) + 1);
    }

    eggs = [];

    for (const jsonPath of files.sort()) {
      const folder = dirname(jsonPath);
      const folderSlug = slugifyFolderPath(folder);
      const fileSlug = slugifyFilePath(jsonPath);
      const slug = folderCounts.get(folder) === 1 ? folderSlug : `${folderSlug}-${fileSlug}`;
      const relFolder = relative(repoRoot, folder);

      const jsonContent = await readFile(jsonPath, 'utf-8');
      const parsed = JSON.parse(jsonContent);

      let readme = '';
      try {
        readme = await readFile(join(folder, 'README.md'), 'utf-8');
      } catch {
        console.warn(`WARN: No README.md for ${relFolder}`);
      }

      const originalFileName = basename(jsonPath);
      const downloadPath = `eggs/${slug}/${originalFileName}`;
      const readmePath = `data/readme/${slug}.md`;

      eggs.push({
        slug,
        name: parsed.name,
        author: parsed.author,
        description: parsed.description || '',
        path: relFolder,
        jsonPath: join(relFolder, originalFileName),
        fileName: originalFileName,
        downloadPath,
        readmePath,
        readme,
      });

      console.log(`  ${slug} -> ${parsed.name}`);
    }
  }

  await mkdir(siteDataDir, { recursive: true });
  await mkdir(join(siteDataDir, 'readme'), { recursive: true });

  for (const egg of eggs) {
    await writeFile(join(siteDataDir, 'readme', `${egg.slug}.md`), egg.readme);
    const { readme, eggJson, ...rest } = egg;
    void readme;

    const publicEggDir = join(sitePublicEggsDir, egg.slug);
    await mkdir(publicEggDir, { recursive: true });
    if (eggJson) {
      await writeFile(join(publicEggDir, egg.fileName), eggJson);
    } else {
      await copyFile(join(repoRoot, egg.jsonPath), join(publicEggDir, egg.fileName));
    }

    if (!dummyCount) console.log(`  ${egg.slug} -> ${egg.name}`);
  }

  const payload = eggs.map(({ readme, eggJson, ...rest }) => rest);
  await writeFile(join(siteDataDir, 'eggs.json'), JSON.stringify(payload, null, 2));

  console.log(`\nWrote ${eggs.length} egg(s) to site/public/data/eggs.json`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
