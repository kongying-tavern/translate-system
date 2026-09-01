#!/usr/bin/env tsx
/**
 * 为所有脚本文件预算 SHA256，写入 *.sha256 文件。
 * 时机：pnpm gen:scripts（开发启动前 / 部署构建时）
 */
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

const SCRIPTS_ROOT = __dirname

// 扫描所有 SCRIPT.ps1 / SCRIPT.sh，自动发现
const entries = fs.readdirSync(SCRIPTS_ROOT, { withFileTypes: true })
const scriptDirs = entries.filter(e => e.isDirectory() && !e.name.startsWith('_'))

let count = 0
for (const dir of scriptDirs) {
  for (const ext of ['ps1', 'sh']) {
    const rel = `${dir.name}/SCRIPT.${ext}`
    const abs = path.join(SCRIPTS_ROOT, rel)
    if (!fs.existsSync(abs))
      continue
    const content = fs.readFileSync(abs)
    const sha256 = createHash('sha256').update(content).digest('hex')
    fs.writeFileSync(`${abs}.sha256`, `${sha256}\n`, 'utf-8')
    count++
  }
}

console.log(`[scripts] 已生成 ${count} 个 .sha256 文件`)
