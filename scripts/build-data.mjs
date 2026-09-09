import { glob } from 'glob';
import { readFile, writeFile, mkdir, copyFile, rm } from 'fs/promises';
import { resolve, dirname, join, relative, basename } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');
const siteDataDir = join(repoRoot, 'site', 'public', 'data');
const sitePublicEggsDir = join(repoRoot, 'site', 'public', 'eggs');

function slugifyFolderPath(folderPath) {
  return relative(repoRoot, folderPath).toLowerCase().replace(/\//g, '-');
}

function slugifyFilePath(jsonPath) {
  const base = basename(jsonPath, '.json');
  return base.replace(/^egg-/, '').toLowerCase();
}

async function main() {
  await rm(sitePublicEggsDir, { recursive: true, force: true });
  await rm(siteDataDir, { recursive: true, force: true });

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

  const eggs = [];

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

    const dockerImages = Object.values(parsed.docker_images || {});
    const variables = (parsed.variables || []).map((v) => ({
      name: v.name,
      envVariable: v.env_variable,
      description: v.description,
    }));

    const originalFileName = basename(jsonPath);
    const downloadPath = `eggs/${slug}/${originalFileName}`;

    eggs.push({
      slug,
      name: parsed.name,
      author: parsed.author,
      description: parsed.description || '',
      dockerImages,
      variables,
      path: relFolder,
      jsonPath: join(relFolder, originalFileName),
      fileName: originalFileName,
      downloadPath,
      readme,
    });

    const publicEggDir = join(sitePublicEggsDir, slug);
    await mkdir(publicEggDir, { recursive: true });
    await copyFile(jsonPath, join(publicEggDir, originalFileName));

    console.log(`  ${slug} -> ${parsed.name}`);
  }

  await mkdir(siteDataDir, { recursive: true });
  await writeFile(join(siteDataDir, 'eggs.json'), JSON.stringify(eggs, null, 2));

  console.log(`\nWrote ${eggs.length} egg(s) to site/public/data/eggs.json`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
