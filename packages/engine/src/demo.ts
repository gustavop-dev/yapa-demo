/**
 * Demo de consola del motor. Corre con `npm run demo` y no necesita telefono,
 * GPS, red ni app. Existe para que el bloque de mayor valor del proyecto sea
 * mostrable por si solo.
 */
import { CARDS } from './cards';
import { decide } from './converge';
import { recommend } from './recommend';
import type { Card, Merchant, Recommendation } from './types';

const merchants = {
  target: {
    id: 'target-costa-mesa',
    name: 'Target',
    mcc: '5310',
    mccSource: 'community',
    brandId: 'target',
    lat: 33.6905,
    lon: -117.8886,
  },
  ralphs: {
    id: 'ralphs-costa-mesa',
    name: 'Ralphs',
    mcc: '5411',
    mccSource: 'visa-supplier-locator',
    lat: 33.6907,
    lon: -117.889,
  },
  shellInside: {
    id: 'shell-inside',
    name: 'Shell (pagando en caja)',
    mcc: '5541',
    mccSource: 'inferred-from-osm',
    lat: 33.6901,
    lon: -117.8892,
  },
  shellPump: {
    id: 'shell-pump',
    name: 'Shell (pagando en el surtidor)',
    mcc: '5542',
    mccSource: 'inferred-from-osm',
    lat: 33.6901,
    lon: -117.8892,
  },
} satisfies Record<string, Merchant>;

const foodCourt: Merchant[] = [
  { name: 'Panda Express', mcc: '5814' },
  { name: 'Chipotle', mcc: '5814' },
  { name: 'Din Tai Fung', mcc: '5812' },
  { name: 'Sushi Roku', mcc: '5812' },
  { name: 'Blaze Pizza', mcc: '5814' },
  { name: 'True Food Kitchen', mcc: '5812' },
].map((m, i) => ({
  id: `fc-${i}`,
  name: m.name,
  mcc: m.mcc,
  mccSource: 'inferred-from-osm' as const,
  lat: 33.6903 + i * 0.00005,
  lon: -117.8887 + i * 0.00005,
}));

function pct(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

function sourceLabel(rec: Recommendation): string {
  const p = rec.winner.rule.provenance;
  if (p.verified) return `verificado (${p.sourceDate})`;
  return 'SIN VERIFICAR';
}

function printRecommendation(rec: Recommendation): void {
  const estimated = rec.winner.valueIsEstimated ? ' (valuacion estimada)' : '';

  console.log(`\n  Comercio : ${rec.merchant.name}`);
  console.log(
    `  MCC      : ${rec.mcc.code} ${rec.mcc.title}  [origen: ${rec.merchant.mccSource}]`,
  );
  console.log(
    `  Usa      : ${rec.winner.cardName} / ${rec.winner.rule.label} ` +
      `-> ${pct(rec.winner.valuePerDollar)} por dolar${estimated}`,
  );
  console.log(`  Tasa     : ${sourceLabel(rec)}`);

  if (rec.rejected.length > 0) {
    console.log('  Por que no las otras:');
    for (const r of rec.rejected) {
      console.log(`    [${r.kind}] ${r.cardName} / ${r.rule.label}`);
      console.log(`      ${r.reason}`);
    }
  }
}

function section(title: string): void {
  console.log(`\n${'='.repeat(78)}\n${title}\n${'='.repeat(78)}`);
}

function run(cards: Card[]): void {
  section('1. El caso canonico: Target no es un supermercado');
  printRecommendation(recommend(merchants.target, cards));

  section('2. Un supermercado de verdad si activa la categoria');
  printRecommendation(recommend(merchants.ralphs, cards));

  section('3. Misma gasolinera, distinto MCC segun donde pagues');
  printRecommendation(recommend(merchants.shellInside, cards));
  printRecommendation(recommend(merchants.shellPump, cards));

  section('4. Convergencia: seis locales de comida, cero preguntas');
  const converged = decide(foodCourt, cards);
  if (converged.kind === 'converged') {
    console.log(
      `\n  ${converged.candidates.length} comercios cerca, todos llevan a la misma tarjeta.`,
    );
    console.log('  No hace falta preguntar en cual esta parado el usuario.');
    printRecommendation(converged.recommendation);
  }

  section('5. Discrepancia: la pregunta minima que desempata');
  const ambiguous = decide([...foodCourt, merchants.target], cards);
  if (ambiguous.kind === 'ambiguous') {
    console.log(
      `\n  ${foodCourt.length + 1} candidatos, ${ambiguous.groups.length} respuestas posibles.`,
    );
    console.log('  Se agrupa por respuesta, no por comercio:\n');
    for (const group of ambiguous.groups) {
      const names = group.merchants.map((m) => m.name).join(', ');
      console.log(`    Si estas en: ${names}`);
      console.log(`      -> ${group.cardName} / ${group.recommendation.winner.rule.label}\n`);
    }
  }
}

run(CARDS);
