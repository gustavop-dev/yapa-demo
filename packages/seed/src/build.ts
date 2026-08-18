import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { guessMcc } from './mcc-map';
import { coordsOf, fetchOverpass } from './overpass';
import { regionOrThrow } from './regions';

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(HERE, '../../../data');

type SeedMerchant = {
  id: string;
  name: string;
  mcc: string;
  mccSource: 'inferred-from-osm' | 'community';
  mccNote?: string;
  brandId?: string;
  lat: number;
  lon: number;
  osmId: string;
};

type SeedFile = {
  region: string;
  label: string;
  bbox: ReturnType<typeof regionOrThrow>['bbox'];
  note: string;
  attribution: string;
  license: string;
  generatedFrom: string;
  merchantCount: number;
  mccBreakdown: Record<string, number>;
  merchants: SeedMerchant[];
};

async function main(): Promise<void> {
  const regionId = process.argv[2];
  if (!regionId) {
    console.error('Uso: npm run build --workspace=@yapa/seed -- <region>');
    process.exit(1);
  }

  const region = regionOrThrow(regionId);
  console.log(`Consultando Overpass para ${region.label}...`);

  const elements = await fetchOverpass(region.bbox);
  console.log(`Overpass devolvio ${elements.length} elementos.`);

  const merchants: SeedMerchant[] = [];
  let sinNombre = 0;
  let sinMcc = 0;
  let sinCoords = 0;

  for (const el of elements) {
    const tags = el.tags ?? {};
    const name = tags['name'];
    if (!name) {
      sinNombre += 1;
      continue;
    }

    const coords = coordsOf(el);
    if (!coords) {
      sinCoords += 1;
      continue;
    }

    const guess = guessMcc(tags);
    if (!guess) {
      sinMcc += 1;
      continue;
    }

    merchants.push({
      id: `${el.type}-${el.id}`,
      name,
      mcc: guess.mcc,
      mccSource: guess.source,
      ...(guess.note ? { mccNote: guess.note } : {}),
      ...(guess.brandId ? { brandId: guess.brandId } : {}),
      lat: Number(coords.lat.toFixed(6)),
      lon: Number(coords.lon.toFixed(6)),
      osmId: `${el.type}/${el.id}`,
    });
  }

  merchants.sort((a, b) => a.name.localeCompare(b.name));

  const mccBreakdown: Record<string, number> = {};
  for (const m of merchants) {
    mccBreakdown[m.mcc] = (mccBreakdown[m.mcc] ?? 0) + 1;
  }

  const seed: SeedFile = {
    region: region.id,
    label: region.label,
    bbox: region.bbox,
    note: region.note,
    attribution: '(c) OpenStreetMap contributors',
    license: 'ODbL 1.0',
    generatedFrom: 'Overpass API, extraccion puntual',
    merchantCount: merchants.length,
    mccBreakdown,
    merchants,
  };

  await mkdir(DATA_DIR, { recursive: true });
  const outPath = resolve(DATA_DIR, `merchants.${region.id}.json`);
  await writeFile(outPath, `${JSON.stringify(seed, null, 2)}\n`, 'utf8');

  console.log(`\nDescartados: ${sinNombre} sin nombre, ${sinMcc} sin mapeo a MCC, ${sinCoords} sin coordenadas.`);
  console.log(`Guardados ${merchants.length} comercios en ${outPath}\n`);
  console.log('Reparto por MCC:');
  for (const [mcc, count] of Object.entries(mccBreakdown).sort()) {
    console.log(`  ${mcc}: ${count}`);
  }
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
