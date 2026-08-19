import { copyFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const rootData = resolve(here, '../../../data');
const mobileData = resolve(here, '../src/data');

const files = [
  ['merchants.duitama.json', 'merchants.duitama.json'],
  ['merchants.costa-mesa.json', 'merchants.costa-mesa.json'],
  ['venues/innovo-plaza.json', 'venue.innovo-plaza.json'],
];

await mkdir(mobileData, { recursive: true });

for (const [source, destination] of files) {
  await copyFile(resolve(rootData, source), resolve(mobileData, destination));
  console.log(`Copied ${source} to ${destination}`);
}
