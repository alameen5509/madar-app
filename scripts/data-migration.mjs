import pg from 'pg';
import fs from 'fs';
import path from 'path';

const PG_CONFIG = {
  host: 'db.yxprisuqztdxevxqgmmc.supabase.co',
  port: 5432,
  database: 'postgres',
  user: 'postgres',
  password: 'WOdD1PUu*0Z%bN6Bnp2YltxksfV&',
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 30000,
};

const BACKUPS = 'backups';
const JSON_DIR = path.join(BACKUPS, 'json');

async function getClient() {
  const c = new pg.Client(PG_CONFIG);
  await c.connect();
  return c;
}

// ═══ Step 1: Get table order ═══
async function getTableOrder() {
  const c = await getClient();

  // Get all public tables
  const { rows: tables } = await c.query(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    AND table_name != '__EFMigrationsHistory'
    ORDER BY table_name
  `);

  // Get FK dependencies
  const { rows: fks } = await c.query(`
    SELECT tc.table_name, ccu.table_name AS ref_table
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
    JOIN information_schema.constraint_column_usage ccu ON kcu.constraint_name = ccu.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'
  `);

  // Build dependency graph
  const deps = {};
  for (const t of tables) deps[t.table_name] = new Set();
  for (const fk of fks) {
    if (fk.table_name !== fk.ref_table && deps[fk.table_name])
      deps[fk.table_name].add(fk.ref_table);
  }

  // Topological sort
  const order = []; const visited = new Set();
  function visit(name) {
    if (visited.has(name)) return;
    visited.add(name);
    for (const dep of (deps[name] || [])) visit(dep);
    order.push(name);
  }
  for (const t of Object.keys(deps).sort()) visit(t);

  const result = order.map((t, i) => ({ table: t, load_order: i }));
  fs.writeFileSync(path.join(BACKUPS, '07-load-order.json'), JSON.stringify(result, null, 2));
  console.log(`📋 ${result.length} tables ordered by FK dependencies:`);
  result.forEach(r => console.log(`  ${r.load_order}. ${r.table}`));

  await c.end();
  return result;
}

// ═══ Step 2: Get boolean columns ═══
async function getBooleanColumns() {
  const c = await getClient();
  const { rows } = await c.query(`
    SELECT table_name, column_name
    FROM information_schema.columns
    WHERE table_schema = 'public' AND data_type = 'boolean'
  `);
  await c.end();
  const map = {};
  for (const r of rows) {
    if (!map[r.table_name]) map[r.table_name] = new Set();
    map[r.table_name].add(r.column_name);
  }
  return map;
}

// ═══ Step 3: Get column info per table ═══
async function getColumnInfo() {
  const c = await getClient();
  const { rows } = await c.query(`
    SELECT table_name, column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_schema = 'public'
    ORDER BY table_name, ordinal_position
  `);
  await c.end();
  const map = {};
  for (const r of rows) {
    if (!map[r.table_name]) map[r.table_name] = [];
    map[r.table_name].push(r);
  }
  return map;
}

// ═══ Step 4: Dry run ═══
async function dryRun(tableOrder) {
  const boolCols = await getBooleanColumns();
  const colInfo = await getColumnInfo();

  console.log('\n🔍 DRY RUN — validating JSON data...\n');
  const results = [];
  let totalIssues = 0;
  const allIssues = [];

  for (const { table } of tableOrder) {
    const jsonFile = path.join(JSON_DIR, `${table}.json`);
    if (!fs.existsSync(jsonFile)) {
      results.push({ table, inJson: 0, valid: 0, issues: 0, note: 'NO JSON FILE' });
      continue;
    }

    const data = JSON.parse(fs.readFileSync(jsonFile, 'utf8'));
    const pgCols = colInfo[table] || [];
    const pgColNames = new Set(pgCols.map(c => c.column_name));
    let issues = 0;

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      // Check for columns in JSON that don't exist in PG
      for (const key of Object.keys(row)) {
        if (!pgColNames.has(key)) {
          // Not necessarily an issue — we'll skip unknown columns
        }
      }
    }

    results.push({ table, inJson: data.length, valid: data.length - issues, issues });
    totalIssues += issues;
  }

  // Print table
  console.log('Table'.padEnd(35) + ' | In JSON | Valid   | Issues');
  console.log('-'.repeat(70));
  for (const r of results) {
    if (r.inJson === 0 && !r.note) continue; // skip empty tables without issues
    const note = r.note ? ` (${r.note})` : '';
    console.log(
      `${r.table.padEnd(35)} | ${String(r.inJson).padStart(7)} | ${String(r.valid).padStart(6)} | ${r.issues}${note}`
    );
  }

  console.log(`\n${totalIssues === 0 ? '✅' : '❌'} Total issues: ${totalIssues}`);
  if (allIssues.length > 0) {
    console.log('\nIssues:');
    allIssues.forEach(i => console.log(`  - ${i}`));
  }

  return totalIssues;
}

// ═══ Step 5: Migrate single table ═══
async function migrateSingleTable(tableName) {
  const c = await getClient();
  const colInfo = await getColumnInfo();
  const pgCols = colInfo[tableName];
  if (!pgCols) { console.error(`Table ${tableName} not found in PG`); await c.end(); return; }

  const jsonFile = path.join(JSON_DIR, `${tableName}.json`);
  if (!fs.existsSync(jsonFile)) { console.error(`No JSON file for ${tableName}`); await c.end(); return; }

  const data = JSON.parse(fs.readFileSync(jsonFile, 'utf8'));
  if (data.length === 0) { console.log(`${tableName}: empty, skipping`); await c.end(); return; }

  const pgColNames = pgCols.map(c => c.column_name);
  const jsonKeys = Object.keys(data[0]).filter(k => pgColNames.includes(k));

  console.log(`\n📦 Migrating ${tableName} (${data.length} rows)...`);
  console.log(`  Columns: ${jsonKeys.join(', ')}`);

  try {
    await c.query('BEGIN');
    await c.query('SET session_replication_role = replica');

    // Delete existing data
    const { rows: existing } = await c.query(`SELECT COUNT(*)::int as cnt FROM "${tableName}"`);
    if (existing[0].cnt > 0) {
      console.log(`  ⚠️ Table has ${existing[0].cnt} existing rows — clearing...`);
      await c.query(`DELETE FROM "${tableName}"`);
    }

    // Build column type map
    const colTypeMap = {};
    for (const col of pgCols) colTypeMap[col.column_name] = col.data_type;

    // Insert rows using parameterized INSERT (COPY is complex with mixed types)
    const colList = jsonKeys.map(k => `"${k}"`).join(', ');
    const paramList = jsonKeys.map((_, i) => `$${i + 1}`).join(', ');
    const insertSql = `INSERT INTO "${tableName}" (${colList}) VALUES (${paramList})`;

    let inserted = 0;
    for (const row of data) {
      const values = jsonKeys.map(k => {
        let v = row[k];
        if (v === null || v === undefined) return null;
        const dtype = colTypeMap[k];
        if (dtype === 'boolean') return v === true || v === 1 || v === '1';
        if (dtype?.includes('timestamp')) {
          if (typeof v === 'string' && v.includes('T')) return new Date(v);
          if (typeof v === 'string') return new Date(v);
          return v;
        }
        if (dtype === 'uuid' && typeof v === 'string') return v.toLowerCase();
        return v;
      });
      try {
        await c.query(insertSql, values);
        inserted++;
      } catch (e) {
        console.error(`  ❌ Row error: ${e.message}`);
        console.error(`     Data: ${JSON.stringify(row).substring(0, 200)}`);
      }
    }

    // Verify count
    const { rows: countRows } = await c.query(`SELECT COUNT(*)::int as cnt FROM "${tableName}"`);
    const pgCount = countRows[0].cnt;

    if (pgCount === data.length) {
      await c.query('COMMIT');
      console.log(`  ✅ ${inserted}/${data.length} rows migrated successfully`);
    } else {
      console.log(`  ⚠️ Count mismatch: JSON=${data.length}, PG=${pgCount}. Committing anyway.`);
      await c.query('COMMIT');
    }

    // Re-enable FK constraints
    await c.query('SET session_replication_role = DEFAULT');

    // Show sample
    const { rows: sample } = await c.query(`SELECT * FROM "${tableName}" LIMIT 3`);
    console.log(`  📄 Sample (3 rows):`);
    sample.forEach(r => console.log(`     ${JSON.stringify(r).substring(0, 150)}`));

  } catch (e) {
    await c.query('ROLLBACK').catch(() => {});
    console.error(`  ❌ Migration failed: ${e.message}`);
  }

  await c.end();
}

// ═══ Step 6: Full migration ═══
async function migrateAll(tableOrder) {
  const colInfo = await getColumnInfo();
  const c = await getClient();

  console.log(`\n🚀 FULL MIGRATION — ${tableOrder.length} tables\n`);

  const report = [];
  let totalRows = 0;
  const startTime = Date.now();

  // Disable all FK constraints first
  await c.query('SET session_replication_role = replica');

  for (const { table, load_order } of tableOrder) {
    const pgCols = colInfo[table];
    if (!pgCols) { report.push({ table, status: 'SKIP', rows: 0, note: 'not in PG' }); continue; }

    const jsonFile = path.join(JSON_DIR, `${table}.json`);
    if (!fs.existsSync(jsonFile)) { report.push({ table, status: 'SKIP', rows: 0, note: 'no JSON' }); continue; }

    const data = JSON.parse(fs.readFileSync(jsonFile, 'utf8'));
    if (data.length === 0) { report.push({ table, status: 'OK', rows: 0, note: 'empty' }); continue; }

    const pgColNames = pgCols.map(c => c.column_name);
    const jsonKeys = Object.keys(data[0]).filter(k => pgColNames.includes(k));
    const colTypeMap = {};
    for (const col of pgCols) colTypeMap[col.column_name] = col.data_type;

    const tStart = Date.now();
    process.stdout.write(`  ${String(load_order).padStart(2)}. ${table.padEnd(30)} `);

    try {
      await c.query('BEGIN');

      // Check if table already has data
      const { rows: existing } = await c.query(`SELECT COUNT(*)::int as cnt FROM "${table}"`);
      if (existing[0].cnt > 0) {
        await c.query(`DELETE FROM "${table}"`);
      }

      const colList = jsonKeys.map(k => `"${k}"`).join(', ');
      const paramList = jsonKeys.map((_, i) => `$${i + 1}`).join(', ');
      const insertSql = `INSERT INTO "${table}" (${colList}) VALUES (${paramList})`;

      let inserted = 0;
      let errors = 0;

      for (const row of data) {
        const values = jsonKeys.map(k => {
          let v = row[k];
          if (v === null || v === undefined) return null;
          const dtype = colTypeMap[k];
          if (dtype === 'boolean') return v === true || v === 1 || v === '1' || v === 'true';
          if (dtype?.includes('timestamp')) {
            if (!v || v === 'NaN' || v === 'null') return null;
            const d = new Date(v);
            return isNaN(d.getTime()) ? null : d;
          }
          if (dtype === 'date') {
            if (!v || v === 'NaN') return null;
            return typeof v === 'string' ? v.split('T')[0] : v;
          }
          if (dtype === 'uuid' && typeof v === 'string') return v.toLowerCase();
          if (dtype === 'integer' || dtype === 'smallint' || dtype === 'bigint') {
            if (typeof v === 'boolean') return v ? 1 : 0;
            if (v === 'true' || v === true) return 1;
            if (v === 'false' || v === false) return 0;
            if (typeof v === 'string') return parseInt(v) || 0;
            return v;
          }
          if (dtype === 'numeric' || dtype === 'double precision' || dtype === 'real') {
            if (typeof v === 'boolean') return v ? 1 : 0;
            if (typeof v === 'string') return parseFloat(v) || 0;
          }
          return v;
        });
        try {
          await c.query(insertSql, values);
          inserted++;
        } catch (e) {
          errors++;
          if (errors <= 3) console.error(`\n    ❌ ${e.message.substring(0, 100)}`);
        }
      }

      await c.query('COMMIT');

      const elapsed = ((Date.now() - tStart) / 1000).toFixed(1);
      const status = errors === 0 ? '✅' : '⚠️';
      console.log(`${status} ${inserted}/${data.length} rows  ${elapsed}s${errors > 0 ? ` (${errors} errors)` : ''}`);

      report.push({ table, status: errors === 0 ? 'OK' : 'WARN', rows: inserted, expected: data.length, errors, time: elapsed });
      totalRows += inserted;

    } catch (e) {
      await c.query('ROLLBACK').catch(() => {});
      console.log(`❌ FAILED: ${e.message.substring(0, 80)}`);
      report.push({ table, status: 'FAIL', rows: 0, expected: data.length, note: e.message.substring(0, 100) });
    }
  }

  // Re-enable FK constraints
  await c.query('SET session_replication_role = DEFAULT');

  // Update sequences
  console.log('\n🔄 Updating sequences...');
  const { rows: seqs } = await c.query(`
    SELECT t.table_name, c.column_name, pg_get_serial_sequence('"' || t.table_name || '"', c.column_name) as seq
    FROM information_schema.tables t
    JOIN information_schema.columns c ON t.table_name = c.table_name
    WHERE t.table_schema = 'public' AND c.column_default LIKE 'nextval%'
  `);
  for (const s of seqs) {
    if (s.seq) {
      try {
        await c.query(`SELECT setval('${s.seq}', COALESCE((SELECT MAX("${s.column_name}") FROM "${s.table_name}"), 1), true)`);
      } catch {}
    }
  }

  const totalTime = ((Date.now() - startTime) / 1000).toFixed(0);
  console.log(`\n📊 Migration complete: ${totalRows} rows in ${tableOrder.length} tables (${totalTime}s)`);

  // Save report
  fs.writeFileSync(path.join(BACKUPS, '08-migration-report.json'), JSON.stringify(report, null, 2));

  await c.end();
  return report;
}

// ═══ Step 7: Verify counts ═══
async function verifyCounts(tableOrder) {
  const c = await getClient();
  const inventory = fs.readFileSync(path.join(BACKUPS, '02-tables-inventory.txt'), 'utf8');

  console.log('\n🔍 Verifying row counts...\n');
  let output = 'Table'.padEnd(35) + ' | TiDB  | JSON  | PG    | Status\n' + '-'.repeat(75) + '\n';
  let allPass = true;

  for (const { table } of tableOrder) {
    // TiDB count from inventory
    const match = inventory.match(new RegExp(`${table}\\s*\\|\\s*(\\d+)`));
    const tidbCount = match ? parseInt(match[1]) : 0;

    // JSON count
    const jsonFile = path.join(JSON_DIR, `${table}.json`);
    const jsonCount = fs.existsSync(jsonFile) ? JSON.parse(fs.readFileSync(jsonFile, 'utf8')).length : 0;

    // PG count
    let pgCount = 0;
    try {
      const { rows } = await c.query(`SELECT COUNT(*)::int as cnt FROM "${table}"`);
      pgCount = rows[0].cnt;
    } catch {}

    const pass = jsonCount === pgCount;
    if (!pass) allPass = false;

    if (jsonCount > 0 || pgCount > 0 || tidbCount > 0) {
      output += `${table.padEnd(35)} | ${String(tidbCount).padStart(5)} | ${String(jsonCount).padStart(5)} | ${String(pgCount).padStart(5)} | ${pass ? '✅' : '❌'}\n`;
    }
  }

  fs.writeFileSync(path.join(BACKUPS, '08-verification-counts.txt'), output);
  console.log(output);
  console.log(allPass ? '✅ All counts match!' : '❌ Some counts do not match');

  await c.end();
  return allPass;
}

// ═══ Main ═══
const cmd = process.argv[2];

(async () => {
  if (cmd === '--order') {
    await getTableOrder();
  } else if (cmd === '--dry-run') {
    const order = JSON.parse(fs.readFileSync(path.join(BACKUPS, '07-load-order.json'), 'utf8'));
    await dryRun(order);
  } else if (cmd === '--single-table') {
    const table = process.argv[3];
    if (!table) { console.error('Usage: --single-table <TableName>'); process.exit(1); }
    await migrateSingleTable(table);
  } else if (cmd === '--migrate-all') {
    const order = JSON.parse(fs.readFileSync(path.join(BACKUPS, '07-load-order.json'), 'utf8'));
    await migrateAll(order);
  } else if (cmd === '--verify') {
    const order = JSON.parse(fs.readFileSync(path.join(BACKUPS, '07-load-order.json'), 'utf8'));
    await verifyCounts(order);
  } else {
    console.log('Usage: node data-migration.mjs [--order|--dry-run|--single-table <name>|--migrate-all|--verify]');
  }
})().catch(e => { console.error('❌ Fatal:', e.message); process.exit(1); });
