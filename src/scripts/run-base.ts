import fs from 'node:fs'
import path from 'node:path'
import { config } from '../config.js'
import { runSql } from '../db.js'

async function main() {
  console.log('📦 Running base seed (02-base)...')
  const files = fs
    .readdirSync(config.baseDir)
    .filter((f) => f.endsWith('.sql'))
    .sort()

  for (const file of files) {
    const sql = fs.readFileSync(path.join(config.baseDir, file), 'utf8')
    console.log(`  → ${file}`)
    await runSql(sql)
  }
  console.log('✅ Base seed complete.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
