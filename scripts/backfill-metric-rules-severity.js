/**
 * Backfill severity on metric rules
 *
 * Adds an explicit `severity` field ('normal' | 'preventivo' | 'critico') to each rule
 * in the metrics.rules JSONB array. Uses label heuristics for existing rules that
 * don't have severity set. Rules with severity already set are left unchanged.
 *
 * Run: node scripts/backfill-metric-rules-severity.js
 *
 * Options:
 *   --dry-run   Log changes without updating the database
 */

import { query } from '../src/config/postgres.config.js';
import dotenv from 'dotenv';

dotenv.config();

const DRY_RUN = process.argv.includes('--dry-run');

function inferSeverityFromLabel(label) {
  const l = (label || '').trim().toLowerCase();
  if (l.includes('critico') || l.includes('crítico') || l.includes('correctivo') || l.includes('danger') || l.includes('peligro') || l.includes('muy bajo') || l.includes('urgente')) {
    return 'critico';
  }
  if (l.includes('preventivo') || l.includes('warning') || l.includes('advertencia') || l.includes('precaucion') || l.includes('bajo') || l.includes('nivel bajo')) {
    return 'preventivo';
  }
  if (l.includes('normal') || l.includes('ok') || l.includes('óptimo') || l.includes('optimo') || l.includes('buen') || l.includes('buen estado') || l.includes('bueno') || l.includes('correcto') || l.includes('adecuado')) {
    return 'normal';
  }
  return 'preventivo'; // default when unclear
}

async function backfill() {
  console.log('\n📋 Backfill metric rules severity\n');
  if (DRY_RUN) {
    console.log('  [DRY RUN] No changes will be persisted.\n');
  }

  const result = await query(
    `SELECT id, metric_name, sensor_type, punto_venta_id, rules
     FROM metrics
     WHERE rules IS NOT NULL AND jsonb_array_length(rules) > 0`
  );

  let updated = 0;
  let skipped = 0;

  for (const row of result.rows) {
    const rules = Array.isArray(row.rules) ? row.rules : (row.rules ? JSON.parse(JSON.stringify(row.rules)) : []);
    let changed = false;
    const newRules = rules.map((r) => {
      if (r.severity && ['normal', 'preventivo', 'critico'].includes(String(r.severity).toLowerCase())) {
        return r;
      }
      const inferred = inferSeverityFromLabel(r.label);
      changed = true;
      return { ...r, severity: inferred };
    });

    if (changed) {
      console.log(`  Metric ID ${row.id} (${row.metric_name || row.sensor_type || 'N/A'}, PV ${row.punto_venta_id}):`);
      newRules.forEach((r, i) => {
        const label = (r.label || '(sin etiqueta)').substring(0, 40);
        console.log(`    Rule ${i}: "${label}" -> severity: ${r.severity}`);
      });
      console.log('');

      if (!DRY_RUN) {
        await query(
          `UPDATE metrics SET rules = $1::jsonb, updatedat = CURRENT_TIMESTAMP WHERE id = $2`,
          [JSON.stringify(newRules), row.id]
        );
      }
      updated++;
    } else {
      skipped++;
    }
  }

  console.log(`\n✅ Done. Updated ${updated} metrics, skipped ${skipped} (already have severity).\n`);
  if (DRY_RUN && updated > 0) {
    console.log('  Run without --dry-run to persist changes.\n');
  }
}

backfill().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
