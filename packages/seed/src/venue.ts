/**
 * Convierte un archivo de venue sembrado a mano en JSON que el motor puede usar.
 *
 * Uso: npm run venue --workspace=@yapa/seed -- innovo-plaza
 */
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CATEGORY_TO_MCC, knownCategories } from './categories';

const HERE = dirname(fileURLToPath(import.meta.url));
const VENUES_DIR = resolve(HERE, '../../../data/venues');

type Tenant = {
  id: string;
  name: string;
  mcc: string;
  mccSource: 'hand-seeded';
  category: string;
};

type VenueFile = {
  id: string;
  name: string;
  lat: number;
  lon: number;
  radiusM: number;
  source: string;
  tenantCount: number;
  mccBreakdown: Record<string, number>;
  tenants: Tenant[];
};

function slug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

async function main(): Promise<void> {
  const venueId = process.argv[2];
  if (!venueId) {
    console.error('Uso: npm run venue --workspace=@yapa/seed -- <venue-id>');
    process.exit(1);
  }

  const inPath = resolve(VENUES_DIR, `${venueId}.txt`);
  const raw = await readFile(inPath, 'utf8');

  const header: Record<string, string> = {};
  const tenants: Tenant[] = [];
  const sinCategoria: string[] = [];
  const desconocidas: Array<{ name: string; category: string }> = [];

  let inTenants = false;
  let lineNo = 0;

  for (const line of raw.split('\n')) {
    lineNo += 1;
    const text = line.trim();
    if (text === '' || text.startsWith('#')) continue;

    if (text.startsWith('---')) {
      inTenants = true;
      continue;
    }

    if (!inTenants) {
      const [key, ...rest] = text.split(':');
      if (key && rest.length > 0) header[key.trim()] = rest.join(':').trim();
      continue;
    }

    const parts = text.split('|').map((p) => p.trim());
    const name = parts[0];
    const category = (parts[1] ?? '').toLowerCase();

    if (!name) continue;

    if (category === '' || category === '?') {
      sinCategoria.push(name);
      continue;
    }

    const mcc = CATEGORY_TO_MCC[category];
    if (!mcc) {
      desconocidas.push({ name, category });
      continue;
    }

    tenants.push({
      id: `${venueId}-${slug(name)}`,
      name,
      mcc,
      mccSource: 'hand-seeded',
      category,
    });
  }

  for (const field of ['id', 'nombre', 'lat', 'lon', 'radio']) {
    if (!header[field]) {
      throw new Error(`Falta el campo "${field}" en la cabecera de ${inPath}`);
    }
  }

  const mccBreakdown: Record<string, number> = {};
  for (const t of tenants) {
    mccBreakdown[t.mcc] = (mccBreakdown[t.mcc] ?? 0) + 1;
  }

  const venue: VenueFile = {
    id: header['id']!,
    name: header['nombre']!,
    lat: Number(header['lat']),
    lon: Number(header['lon']),
    radiusM: Number(header['radio']),
    source: 'Sembrado a mano caminando el lugar',
    tenantCount: tenants.length,
    mccBreakdown,
    tenants,
  };

  const outPath = resolve(VENUES_DIR, `${venueId}.json`);
  await writeFile(outPath, `${JSON.stringify(venue, null, 2)}\n`, 'utf8');

  console.log(`${venue.name}: ${tenants.length} locales -> ${outPath}\n`);
  console.log('Reparto por MCC:');
  for (const [mcc, count] of Object.entries(mccBreakdown).sort()) {
    console.log(`  ${mcc}: ${count}`);
  }

  if (sinCategoria.length > 0) {
    console.log(
      `\n${sinCategoria.length} local(es) sin categoria, quedaron afuera del seed:`,
    );
    for (const name of sinCategoria) console.log(`  ${name}`);
    console.log('  Mejor eso que adivinar el MCC.');
  }

  if (desconocidas.length > 0) {
    console.log(`\n${desconocidas.length} categoria(s) que no existen en el vocabulario:`);
    for (const d of desconocidas) console.log(`  ${d.name} -> "${d.category}"`);
    console.log(`\n  Categorias validas: ${knownCategories().join(' ')}`);
    process.exitCode = 1;
  }
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
