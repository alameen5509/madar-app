import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';

const CONFIG = {
  host: 'gateway01.eu-central-1.prod.aws.tidbcloud.com',
  port: 4000,
  user: '3iP7gbQYUFyyRRi.root',
  password: 'Dm24XJ5BQUHU4YpK',
  database: 'madar',
  ssl: { rejectUnauthorized: true },
  connectTimeout: 30000,
};

const BACKUPS = 'backups';

async function main() {
  console.log('🔌 Connecting to TiDB...');
  const conn = await mysql.createConnection(CONFIG);
  console.log('✅ Connected!');

  // 1. Version
  const [[ver]] = await conn.query('SELECT VERSION() as v');
  console.log(`📌 TiDB Version: ${ver.v}`);

  // 2. Tables inventory
  console.log('\n📋 Getting tables inventory...');
  const [tables] = await conn.query(
    `SELECT table_name, table_rows FROM information_schema.tables WHERE table_schema = ? ORDER BY table_rows DESC`,
    [CONFIG.database]
  );

  let inventory = 'Table Name                          | Rows\n';
  inventory += '-'.repeat(50) + '\n';
  for (const t of tables) {
    const tname = t.TABLE_NAME ?? t.table_name;
    const trows = t.TABLE_ROWS ?? t.table_rows ?? 0;
    t._name = tname;
    t._rows = trows;
    inventory += `${tname.padEnd(36)}| ${trows}\n`;
  }
  fs.writeFileSync(path.join(BACKUPS, '02-tables-inventory.txt'), inventory);
  console.log(`✅ ${tables.length} tables found`);
  console.log(inventory);

  // 3. Schema dump
  console.log('📐 Dumping schema...');
  let schemaSql = `-- Schema dump from TiDB ${ver.v}\n-- Date: ${new Date().toISOString()}\n\n`;
  for (const t of tables) {
    const [[create]] = await conn.query(`SHOW CREATE TABLE \`${t._name}\``);
    schemaSql += `-- Table: ${t._name}\n`;
    schemaSql += `DROP TABLE IF EXISTS \`${t.TABLE_NAME}\`;\n`;
    schemaSql += create['Create Table'] + ';\n\n';
  }
  fs.writeFileSync(path.join(BACKUPS, '01-schema-only.sql'), schemaSql);
  console.log(`✅ Schema saved (${(Buffer.byteLength(schemaSql) / 1024).toFixed(1)} KB)`);

  // 4. Data dump + JSON export
  console.log('\n📦 Dumping data...');
  let dataSql = `-- Data dump from TiDB\n-- Date: ${new Date().toISOString()}\nSET NAMES utf8mb4;\n\n`;
  let insertCount = 0;

  for (const t of tables) {
    const tname = t._name;
    const rowCount = t._rows;
    process.stdout.write(`  ${tname} (${rowCount} rows)... `);

    try {
      const [rows] = await conn.query(`SELECT * FROM \`${tname}\``);

      if (rows.length === 0) {
        console.log('(empty)');
        fs.writeFileSync(path.join(BACKUPS, 'json', `${tname}.json`), '[]');
        continue;
      }

      // JSON export
      const jsonRows = rows.map(row => {
        const obj = {};
        for (const [key, val] of Object.entries(row)) {
          if (val instanceof Date) {
            obj[key] = val.toISOString();
          } else if (Buffer.isBuffer(val)) {
            obj[key] = val.toString('base64');
          } else if (typeof val === 'number' && (key.toLowerCase().includes('is') || key.toLowerCase().includes('fulfilled') || key.toLowerCase().includes('enabled') || key.toLowerCase().includes('completed') || key.toLowerCase().includes('private') || key.toLowerCase().includes('active') || key.toLowerCase().includes('recurring')) && (val === 0 || val === 1)) {
            obj[key] = val === 1;
          } else {
            obj[key] = val;
          }
        }
        return obj;
      });
      fs.writeFileSync(path.join(BACKUPS, 'json', `${tname}.json`), JSON.stringify(jsonRows, null, 2));

      // SQL INSERT
      const cols = Object.keys(rows[0]);
      const colNames = cols.map(c => `\`${c}\``).join(', ');

      // Batch inserts (100 rows per INSERT)
      for (let i = 0; i < rows.length; i += 100) {
        const batch = rows.slice(i, i + 100);
        const values = batch.map(row => {
          const vals = cols.map(c => {
            const v = row[c];
            if (v === null || v === undefined) return 'NULL';
            if (v instanceof Date) return `'${v.toISOString().replace('T', ' ').replace('Z', '')}'`;
            if (Buffer.isBuffer(v)) return `X'${v.toString('hex')}'`;
            if (typeof v === 'number') return String(v);
            if (typeof v === 'boolean') return v ? '1' : '0';
            return `'${String(v).replace(/'/g, "''").replace(/\\/g, '\\\\')}'`;
          });
          return `(${vals.join(', ')})`;
        }).join(',\n  ');

        dataSql += `INSERT INTO \`${tname}\` (${colNames}) VALUES\n  ${values};\n`;
        insertCount++;
      }
      dataSql += '\n';

      console.log(`${rows.length} rows exported`);
    } catch (err) {
      console.log(`ERROR: ${err.message}`);
    }
  }

  fs.writeFileSync(path.join(BACKUPS, '03-data-only.sql'), dataSql);
  console.log(`\n✅ Data saved (${(Buffer.byteLength(dataSql) / 1024).toFixed(1)} KB, ${insertCount} INSERT statements)`);

  // 5. Full backup (schema + data combined)
  const fullSql = schemaSql + '\n-- ═══ DATA ═══\n\n' + dataSql;
  fs.writeFileSync(path.join(BACKUPS, '04-full-backup.sql'), fullSql);
  console.log(`✅ Full backup saved (${(Buffer.byteLength(fullSql) / 1024).toFixed(1)} KB)`);

  await conn.end();
  console.log('\n🔌 Connection closed');
}

main().catch(err => {
  console.error('❌ Fatal error:', err.message);
  process.exit(1);
});
