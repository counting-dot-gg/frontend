import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = mkdtempSync(join(tmpdir(), 'rank-import-'))
process.on('exit', () => rmSync(outDir, { recursive: true, force: true }))

const tsc = join(root, 'node_modules', 'typescript', 'lib', 'tsc.js')
execFileSync(
  process.execPath,
  [
    tsc,
    'lib/rankAdminImport.ts', 'lib/rankAdmin.ts', 'lib/challengeTypes.ts', 'lib/rankUtils.ts',
    'lib/rankCoverage.ts',
    '--outDir', outDir, '--module', 'commonjs', '--target', 'es2022', '--skipLibCheck',
  ],
  { cwd: root, stdio: 'inherit' },
)

const require = createRequire(import.meta.url)
const { parseImport, planImport, toCreateDto, toUpdateDto } = require(join(outDir, 'rankAdminImport.js'))
const { coverageByRank, forThread, underfundedRanks, emptyRanks, busiestThread, UNDERFUNDED_RATIO } =
  require(join(outDir, 'rankCoverage.js'))
const { formatDuration, formatDurationPrecise, getProgressLabel } = require(join(outDir, 'rankUtils.js'))

const THREAD_UUID = '16775349-6197-4147-a162-185459147162'

const synthetic = () => JSON.stringify({
  format: 'countgg-rank-challenges',
  version: 1,
  challenges: ['bronze', 'silver'].flatMap(rank =>
    [0, 1, 2].map(sequence => ({
      type: 'thread_counts', rank, sequence,
      ggReward: 90, target: 200 * (sequence + 1), rewardType: 'gg',
      threadUuid: THREAD_UUID, thread: 'main', baseReassignmentWaitMs: null,
    })),
  ),
})

const blobPath = process.argv[2]
const raw = blobPath ? readFileSync(blobPath, 'utf8') : synthetic()
console.log(blobPath ? `checking against ${blobPath}` : 'checking against a synthetic design')


let failures = 0
const check = (name, cond, extra = '') => {
  if (cond) {
    console.log(`  ok   ${name}`)
  } else {
    failures++
    console.log(`  FAIL ${name} ${extra}`)
  }
}

const threads = [
  { uuid: THREAD_UUID, name: 'main' },
  { uuid: '16775360-0807-4168-8764-337096168764', name: 'letters' },
]

console.log('parse a real export blob')
const parsed = parseImport(raw)
check('parses', !('error' in parsed), parsed.error ?? '')
if ('error' in parsed) process.exit(1)
check('has rows', parsed.rows.length > 0, `got ${parsed.rows.length}`)

console.log('\nplan against an empty season')
const fresh = planImport(parsed.rows, [], threads)
check('no errors', fresh.errors.length === 0, JSON.stringify(fresh.errors.slice(0, 3)))
check('all creates', fresh.counts.create === parsed.rows.length, JSON.stringify(fresh.counts))
check('no orphans', fresh.orphans.length === 0)
const dto = toCreateDto(fresh.rows[0].row)
check('create dto has no `thread` name field', !('thread' in dto))
check('create dto keeps threadUuid', dto.threadUuid === threads[0].uuid)

console.log('\nplan against a season that already has it')
const existing = parsed.rows.map((r, i) => ({
  id: `id-${i}`,
  type: r.type,
  rank: r.rank,
  sequence: r.sequence,
  ggReward: r.ggReward,
  rewardType: r.rewardType,
  target: r.target,
  params: r.params ?? null,
  threadUuid: r.threadUuid,
  bingoCategory: null,
  seasonId: 1,
  clonedFromId: null,
  baseReassignmentWaitMs: r.baseReassignmentWaitMs,
  createdAt: 0,
}))
const same = planImport(parsed.rows, existing, threads)
check('everything unchanged', same.counts.unchanged === parsed.rows.length, JSON.stringify(same.counts))
check('no errors', same.errors.length === 0, JSON.stringify(same.errors.slice(0, 3)))
check('no orphans', same.orphans.length === 0)

console.log('\nplan after a re-tune moved one target')
const bumped = structuredClone(existing)
bumped[0].target = bumped[0].target + 1234
const drift = planImport(parsed.rows, bumped, threads)
check('exactly one update', drift.counts.update === 1, JSON.stringify(drift.counts))
const updated = drift.rows.find(p => p.action === 'update')
check('names the field that moved', updated.changes.some(c => c.startsWith('target ')), JSON.stringify(updated.changes))
check('patch dto omits type', !('type' in toUpdateDto(updated.row)))

console.log('\norphans are reported, never deleted')
const extra = [...existing, {
  ...existing[0], id: 'orphan-1', type: 'roll', rank: 'bronze', sequence: 0, params: { direction: 'under', threshold: 5 },
}]
const orph = planImport(parsed.rows, extra, threads)
check('one orphan', orph.orphans.length === 1 && orph.orphans[0].id === 'orphan-1', JSON.stringify(orph.orphans.map(o => o.id)))

console.log('\nrejections')
const bad = (rows, label, want) => {
  const p = planImport(rows, [], threads)
  const hit = p.errors.some(e => e.includes(want)) || p.rows.some(r => r.errors.some(e => e.includes(want)))
  check(label, hit, JSON.stringify(p.errors.concat(p.rows.flatMap(r => r.errors)).slice(0, 2)))
}
const one = () => structuredClone(parsed.rows.filter(r => r.type === 'thread_counts' && r.rank === 'bronze'))
bad([{ ...one()[0], type: 'nonsense' }], 'unknown type', 'unknown type')
bad([{ ...one()[0], rank: 'tin' }], 'unknown rank', 'unknown rank')
bad([{ ...one()[0], target: 0 }], 'target must be >= 1', 'target must be')
bad([{ ...one()[0], threadUuid: 'deadbeef-0000-0000-0000-000000000000', threadName: 'main' }],
  'unknown uuid', 'is not a thread here')
bad([{ ...one()[0], threadUuid: threads[1].uuid, threadName: 'main' }],
  'uuid/name disagree', 'but the blob calls it')
bad([{ ...one()[0], type: 'split_under_ms', threadUuid: null, threadName: undefined, params: { maxMs: 1000 } }],
  'sitewide speed challenge', 'cannot be sitewide')
bad([{ ...one()[0], type: 'split_under_ms', params: undefined }], 'missing maxMs', 'maxMs is required')

console.log('\nsequence contiguity mirrors the API')
const gap = one().filter(r => r.sequence !== 1)
check('a gap is caught', planImport(gap, [], threads).errors.some(e => e.includes('contiguous')),
  JSON.stringify(planImport(gap, [], threads).errors))
const dup = [...one(), { ...one()[0] }]
check('a duplicate sequence is caught', planImport(dup, [], threads).errors.some(e => e.includes('used twice')),
  JSON.stringify(planImport(dup, [], threads).errors))
const half = one().filter(r => r.sequence === 1)
const other = existing.filter(c => c.type === 'thread_counts' && c.rank === 'bronze' && c.sequence !== 1)
check('a partial paste over existing rows is fine',
  planImport(half, other, threads).errors.length === 0,
  JSON.stringify(planImport(half, other, threads).errors))

console.log('\nbare arrays and malformed input')
check('bare array accepted', !('error' in parseImport(JSON.stringify(parsed.rows.slice(0, 2).map(r => ({ ...r, thread: r.threadName }))))))
check('wrong format rejected', 'error' in parseImport('{"format":"something-else","challenges":[]}'))
check('future version rejected', 'error' in parseImport('{"format":"countgg-rank-challenges","version":99,"challenges":[{}]}'))
check('garbage rejected', 'error' in parseImport('{nope'))
check('empty rejected', 'error' in parseImport('   '))

console.log('\ncoverage: the design read back one thread at a time')
{
  const ch = (over) => ({
    id: over.id ?? Math.random().toString(36).slice(2),
    type: 'thread_counts', rank: 'bronze', sequence: 0, ggReward: 40, target: 100,
    rewardType: 'gg', threadUuid: 'T1', params: null, baseReassignmentWaitMs: null,
    ...over,
  })

  const mixed = [ch({ id: 'a' }), ch({ id: 'b', threadUuid: 'T2' }), ch({ id: 'c', threadUuid: null })]
  check('forThread keeps only that thread', forThread(mixed, 'T1').length === 1)
  check('sitewide is its own scope', forThread(mixed, null).length === 1)

  const thin = [ch({ id: 'a', sequence: 0 }), ch({ id: 'b', sequence: 1 }), ch({ id: 'c', sequence: 2 })]
  const rows = coverageByRank(thin)
  const bronze = rows.find(r => r.rank === 'bronze')
  check('gg per pass sums one clear of each', bronze.ggOnePass === 120, String(bronze.ggOnePass))
  check('rank cost comes from RANK_GG', bronze.ggToRankUp === 300, String(bronze.ggToRankUp))
  check('a rank that cannot fund itself is flagged',
    underfundedRanks(rows).some(r => r.rank === 'bronze'))

  check('steps of one chain count as one chain', bronze.chains === 1, String(bronze.chains))
  check('deepest chain is its step count', bronze.longestChain === 3, String(bronze.longestChain))

  const twoTypes = [ch({ id: 'a' }), ch({ id: 'b', type: 'counts_in_day' })]
  check('different types are different chains',
    coverageByRank(twoTypes).find(r => r.rank === 'bronze').chains === 2)

  const fat = [ch({ id: 'a', ggReward: 400 })]
  check('a funded rank is not flagged', underfundedRanks(coverageByRank(fat)).length === 0)

  const designed = [ch({ id: 'a', ggReward: 259 })]
  const designedRows = coverageByRank(designed)
  check('a normally-funded rank is not flagged',
    underfundedRanks(designedRows).length === 0,
    String(designedRows.find(r => r.rank === 'bronze').ggCoverage))
  check('coverage is reported as a ratio',
    Math.abs(designedRows.find(r => r.rank === 'bronze').ggCoverage - 259 / 300) < 1e-9)
  check('the threshold sits below the designed band', UNDERFUNDED_RATIO < 0.79)
  check('peak coverage is not a division by infinity',
    designedRows.find(r => r.rank === 'peak').ggCoverage === 1)

  const empties = emptyRanks(coverageByRank(thin))
  check('peak is not reported as an empty rank', !empties.some(r => r.rank === 'peak'))
  check('a genuinely empty rank is reported', empties.some(r => r.rank === 'silver'))
  check('peak is never underfunded',
    !underfundedRanks(coverageByRank(thin)).some(r => r.rank === 'peak'))

  check('busiest thread wins the default',
    busiestThread([ch({ id: 'a' }), ch({ id: 'b' }), ch({ id: 'c', threadUuid: 'T2' })]) === 'T1')
  check('no challenges means no default', busiestThread([]) === null)
}

console.log('\ntime_counting is legible while it moves')
{
  check('a target reads as the number that was chosen', formatDuration(1200) === '20m', formatDuration(1200))
  check('hours and minutes together', formatDuration(6300) === '1h45', formatDuration(6300))
  check('whole hours drop the minutes', formatDuration(144000) === '40h', formatDuration(144000))

  check('progress never rounds up to the target',
    formatDurationPrecise(1199) === '19m 59s', formatDurationPrecise(1199))
  check('progress carries seconds under an hour',
    formatDurationPrecise(754) === '12m 34s', formatDurationPrecise(754))
  check('progress carries seconds above an hour too',
    formatDurationPrecise(10050) === '2h 47m 30s', formatDurationPrecise(10050))
  check('progress floors rather than rounds',
    formatDurationPrecise(59.9) === '0m 59s', formatDurationPrecise(59.9))
  check('negative progress is not rendered as time travel',
    formatDurationPrecise(-5) === '0m 00s', formatDurationPrecise(-5))

  const label = getProgressLabel({ type: 'time_counting', target: 1200, params: null }, 754)
  check('the label pairs precise progress with a round target',
    label === '12m 34s / 20m Counting', label)
}

console.log('\nre-pasting an unchanged design changes nothing')
{
  const base = {
    id: 'x1', type: 'accuracy_rate', rank: 'bronze', sequence: 0, ggReward: 6, target: 1,
    rewardType: 'gg', threadUuid: threads[0].uuid,
    params: { windowSize: 350, minAccuracyPercent: 95 },
    baseReassignmentWaitMs: 86400000,
  }
  const paste = [{
    type: base.type, rank: base.rank, sequence: base.sequence, ggReward: base.ggReward,
    target: base.target, rewardType: base.rewardType, thread: threads[0].name,
    threadUuid: base.threadUuid,
    params: { minAccuracyPercent: 95, windowSize: 350 },
    baseReassignmentWaitMs: 86400000,
  }]

  const same = planImport(paste, [base], threads)
  check('key order alone is not a params change', same.counts.unchanged === 1,
    JSON.stringify(same.rows[0].changes))

  const strWait = [{ ...base, baseReassignmentWaitMs: '86400000' }]
  const vsString = planImport(paste, strWait, threads)
  check('a bigint wait read back as a string is not a change',
    vsString.counts.unchanged === 1, JSON.stringify(vsString.rows[0].changes))

  const realWait = [{ ...base, baseReassignmentWaitMs: 3600000 }]
  check('a genuinely different wait is still a change',
    planImport(paste, realWait, threads).counts.update === 1)
  const realParams = [{ ...base, params: { windowSize: 500, minAccuracyPercent: 95 } }]
  check('a genuinely different param is still a change',
    planImport(paste, realParams, threads).counts.update === 1)
  const arrA = [{ ...base, params: { xs: [1, 2] } }]
  const arrPaste = [{ ...paste[0], params: { xs: [2, 1] } }]
  check('array order still counts as a change',
    planImport(arrPaste, arrA, threads).counts.update === 1)
}

console.log(failures === 0 ? '\nall ok' : `\n${failures} FAILURES`)
process.exit(failures === 0 ? 0 : 1)
