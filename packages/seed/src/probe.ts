/**
 * Sonda de cobertura: consulta una region y reporta que hay mapeado, sin escribir
 * nada. Sirve para saber si vale la pena generar el seed desde OSM o si hay que
 * sembrar a mano, antes de gastar tiempo.
 */
import { guessMcc } from './mcc-map';
import { coordsOf, fetchOverpass } from './overpass';
import { regionOrThrow } from './regions';

async function main(): Promise<void> {
  const regionId = process.argv[2];
  if (!regionId) {
    console.error('Uso: npm run probe --workspace=@yapa/seed -- <region>');
    process.exit(1);
  }

  const region = regionOrThrow(regionId);
  console.log(`Sondeando ${region.label}`);
  console.log(`bbox: ${JSON.stringify(region.bbox)}\n`);

  const elements = await fetchOverpass(region.bbox);

  let named = 0;
  let mapped = 0;
  const byMcc: Record<string, string[]> = {};
  const unmapped: Record<string, number> = {};

  for (const el of elements) {
    const tags = el.tags ?? {};
    const name = tags['name'];
    if (!name || !coordsOf(el)) continue;
    named += 1;

    const guess = guessMcc(tags);
    if (!guess) {
      const key = tags['shop'] ? `shop=${tags['shop']}` : `amenity=${tags['amenity']}`;
      unmapped[key] = (unmapped[key] ?? 0) + 1;
      continue;
    }

    mapped += 1;
    (byMcc[guess.mcc] ??= []).push(name);
  }

  console.log(`Elementos devueltos : ${elements.length}`);
  console.log(`Con nombre y coords : ${named}`);
  console.log(`Con MCC inferible   : ${mapped}\n`);

  for (const [mcc, names] of Object.entries(byMcc).sort()) {
    console.log(`MCC ${mcc} (${names.length}):`);
    console.log(`  ${names.slice(0, 12).join(', ')}${names.length > 12 ? ', ...' : ''}`);
  }

  if (Object.keys(unmapped).length > 0) {
    console.log('\nTags sin mapeo a MCC:');
    for (const [tag, count] of Object.entries(unmapped).sort((a, b) => b[1] - a[1])) {
      console.log(`  ${tag}: ${count}`);
    }
  }
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
