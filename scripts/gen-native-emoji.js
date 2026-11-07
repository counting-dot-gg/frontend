const fs = require('fs')
const path = require('path')

const data = require('../node_modules/@emoji-mart/data')

const map = {}
for (const [id, emoji] of Object.entries(data.emojis)) {
  const native = emoji?.skins?.[0]?.native
  if (native) map[id] = native
}

const ids = Object.keys(map).sort()
const sorted = {}
for (const id of ids) sorted[id] = map[id]

const out = `export const NATIVE_BY_ID: Record<string, string> = ${JSON.stringify(sorted, null, 0)}
`

const target = path.join(__dirname, '..', 'lib', 'nativeEmojiMap.ts')
fs.writeFileSync(target, out)

const fullSize = JSON.stringify(data).length
console.log(`wrote ${path.relative(process.cwd(), target)}`)
console.log(`  ${ids.length} emoji, ${(out.length / 1024).toFixed(0)} KB (full dataset is ${(fullSize / 1024).toFixed(0)} KB)`)
