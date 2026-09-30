// Guard-rail tests for scripts/sync.mjs: node --test scripts/
// Each case builds a small zip + index.json in a temp dir and runs the script
// against it, so the checks are exercised end to end with no network.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdtempSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const SCRIPT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'sync.mjs')
const MCP_URL = 'https://mcp.trypulse.tech/mcp'

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})
const crc32 = buf => {
  let c = 0xffffffff
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

// Minimal stored (uncompressed) zip writer.
function makeZip(entries) {
  const locals = []
  const centrals = []
  let offset = 0
  for (const [name, content] of Object.entries(entries)) {
    const data = Buffer.from(content)
    const n = Buffer.from(name, 'utf8')
    const crc = crc32(data)
    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(20, 4)
    local.writeUInt32LE(crc, 14)
    local.writeUInt32LE(data.length, 18)
    local.writeUInt32LE(data.length, 22)
    local.writeUInt16LE(n.length, 26)
    const central = Buffer.alloc(46)
    central.writeUInt32LE(0x02014b50, 0)
    central.writeUInt16LE(20, 4)
    central.writeUInt16LE(20, 6)
    central.writeUInt32LE(crc, 16)
    central.writeUInt32LE(data.length, 20)
    central.writeUInt32LE(data.length, 24)
    central.writeUInt16LE(n.length, 28)
    central.writeUInt32LE((0o100644 << 16) >>> 0, 38)
    central.writeUInt32LE(offset, 42)
    locals.push(local, n, data)
    centrals.push(central, n)
    offset += local.length + n.length + data.length
  }
  const cd = Buffer.concat(centrals)
  const eocd = Buffer.alloc(22)
  eocd.writeUInt32LE(0x06054b50, 0)
  eocd.writeUInt16LE(centrals.length / 2, 8)
  eocd.writeUInt16LE(centrals.length / 2, 10)
  eocd.writeUInt32LE(cd.length, 12)
  eocd.writeUInt32LE(offset, 16)
  return Buffer.concat([...locals, cd, eocd])
}

function manifest(overrides = {}) {
  return JSON.stringify({
    name: 'pulse',
    version: '1.0.0',
    skills: './skills/',
    mcpServers: { pulse: { url: MCP_URL, oauth_resource: MCP_URL } },
    interface: { displayName: 'Pulse', logo: './assets/pulse-logo.png' },
    ...overrides,
  })
}

function bundle(extra = {}, drop = []) {
  const entries = {
    '.agents/plugins/marketplace.json': '{"name":"pulse","plugins":[]}',
    '.codex-plugin/plugin.json': manifest(),
    'assets/pulse-logo.png': 'png',
    'skills/pulse-use-mcp/SKILL.md': '---\nname: pulse-use-mcp\n---\nUse Pulse.\n',
    'skills/pulse-use-mcp/agents/openai.yaml': 'interface: {}\n',
    ...extra,
  }
  for (const k of drop) delete entries[k]
  return entries
}

// Stands in for the real internal names, which are only known by hash.
const INTERNAL = 'zorblax'
const INTERNAL_SHA = createHash('sha256').update(INTERNAL).digest('hex')

function run(entries, { dest, dryRun = false, sha } = {}) {
  const dir = mkdtempSync(path.join(tmpdir(), 'pulse-sync-'))
  const zip = makeZip(entries)
  writeFileSync(path.join(dir, 'p.zip'), zip)
  writeFileSync(path.join(dir, 'index.json'), JSON.stringify({
    bundles: [{ id: 'codex-plugin', filename: 'p.zip', url: '/cli/bundles/codex-plugin.zip',
      sha256: sha ?? createHash('sha256').update(zip).digest('hex') }],
  }))
  const args = [SCRIPT, '--index', path.join(dir, 'index.json'), '--zip', path.join(dir, 'p.zip'),
    '--dest', dest ?? path.join(dir, 'out')]
  if (dryRun) args.push('--dry-run')
  const r = spawnSync(process.execPath, args, { encoding: 'utf8', env: { ...process.env, GITHUB_OUTPUT: '', SYNC_DENY_WORD_SHA256: INTERNAL_SHA } })
  return { code: r.status, out: r.stdout + r.stderr, dest: dest ?? path.join(dir, 'out') }
}

const fails = (r, re) => {
  assert.equal(r.code, 1, r.out)
  assert.match(r.out, re)
}

test('a clean bundle publishes and drops the zip marketplace file', () => {
  const r = run(bundle())
  assert.equal(r.code, 0, r.out)
  assert.match(r.out, /changed=true/)
  assert.match(r.out, /^sha256=[0-9a-f]{64}$/m) // the release notes quote it
  assert.ok(existsSync(path.join(r.dest, '.codex-plugin/plugin.json')))
  assert.ok(existsSync(path.join(r.dest, 'assets/pulse-logo.png')))
  assert.ok(!existsSync(path.join(r.dest, '.agents')))
})

// agent-plugins.org layout: no mcpServers (Codex reads the root mcp.json) and
// the interface under extensions["com.openai"].
function portable(openai = {}) {
  return JSON.stringify({
    $schema: 'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json',
    name: 'pulse',
    version: '1.0.0',
    extensions: { 'com.openai': {
      interface: { displayName: 'Pulse', logo: './assets/pulse-logo.png' },
      onboardingSkill: './skills/pulse-use-mcp/SKILL.md',
      ...openai,
    } },
  })
}
const PORTABLE_MCP = JSON.stringify({
  $schema: 'https://agent-plugins.org/schemas/1.0.0/mcp.schema.json',
  mcpServers: { pulse: { type: 'streamable-http', url: MCP_URL } },
})

test('the portable layout (root plugin.json + mcp.json) is accepted', () => {
  const r = run(bundle({ 'plugin.json': portable(), 'mcp.json': PORTABLE_MCP }))
  assert.equal(r.code, 0, r.out)
})

test('a portable plugin.json without mcp.json fails', () =>
  fails(run(bundle({ 'plugin.json': portable() })), /no mcp\.json/))

test('a missing onboarding skill fails', () => fails(run(bundle({
  'plugin.json': portable({ onboardingSkill: './skills/pulse-get-started/SKILL.md' }), 'mcp.json': PORTABLE_MCP,
})), /onboardingSkill/))

test('a portable plugin.json at another version fails', () => fails(run(bundle({
  'plugin.json': portable().replace('"1.0.0"', '"1.0.1"'), 'mcp.json': PORTABLE_MCP,
})), /differs from/))

test('sha256 mismatch fails', () => fails(run(bundle(), { sha: '0'.repeat(64) }), /sha256/))
test('a path off the allowlist fails', () => fails(run(bundle({ 'src/index.ts': 'x' })), /allowlist/))
test('dot-files fail', () => fails(run(bundle({ 'skills/.DS_Store': 'x' })), /allowlist/))
test('path traversal fails', () => fails(run(bundle({ 'skills/../../evil': 'x' })), /traversal/))
test('a non-png asset fails', () => fails(run(bundle({ 'assets/run.sh': 'x' })), /allowlist/))
test('a missing logo fails', () => fails(run(bundle({}, ['assets/pulse-logo.png'])), /not in the bundle/))
test('a skill without SKILL.md fails', () => fails(run(bundle({ 'skills/x/notes.md': 'x' })), /no SKILL\.md/))
test('another plugin name fails', () => fails(run(bundle({ '.codex-plugin/plugin.json': manifest({ name: 'other' }) })), /name/))
test('a pre-release version fails', () => fails(run(bundle({ '.codex-plugin/plugin.json': manifest({ version: '1.0.0+local' }) })), /X\.Y\.Z/))

test('another MCP url fails', () => fails(run(bundle({
  '.codex-plugin/plugin.json': manifest({ mcpServers: { pulse: { url: 'https://evil.example/mcp' } } }),
})), /expected https:\/\/mcp\.trypulse\.tech\/mcp/))

test('an MCP header fails', () => fails(run(bundle({
  '.codex-plugin/plugin.json': manifest({ mcpServers: { pulse: { url: MCP_URL, http_headers: { 'X-Key': 'v' } } } }),
})), /http_headers is not allowed/))

test('an mcp.json with another url fails', () => fails(run(bundle({
  'mcp.json': JSON.stringify({ mcpServers: { pulse: { url: 'http://localhost:3000/mcp' } } }),
})), /mcp\.json/))

for (const [what, text] of [
  ['Authorization', 'send Authorization: x'],
  ['Bearer', 'use Bearer abc'],
  ['personal email', 'mail someone@gmail.com'],
  ['internal name', `the ${INTERNAL[0].toUpperCase()}${INTERNAL.slice(1)} workspace`],
  ['internal name in a hostname', `https://git.${INTERNAL}.example/x`],
  ['access key', 'key glpat-abcdefghijklmnopqrstu'],
]) {
  test(`deny-list: ${what} fails`, () => fails(run(bundle({ 'skills/pulse-use-mcp/SKILL.md': text })), /contains/))
}

test('versions: same tree is a no-op, same version with changes fails, older fails, newer publishes', () => {
  const first = run(bundle())
  assert.equal(first.code, 0, first.out)
  const same = run(bundle(), { dest: first.dest })
  assert.equal(same.code, 0, same.out)
  assert.match(same.out, /changed=false/)
  fails(run(bundle({ 'skills/pulse-use-mcp/SKILL.md': 'changed' }), { dest: first.dest }), /must bump the version/)
  fails(run(bundle({ '.codex-plugin/plugin.json': manifest({ version: '0.9.0' }) }), { dest: first.dest }), /older/)
  const newer = run(bundle({ '.codex-plugin/plugin.json': manifest({ version: '1.0.1' }) }), { dest: first.dest })
  assert.equal(newer.code, 0, newer.out)
  assert.equal(JSON.parse(readFileSync(path.join(first.dest, '.codex-plugin/plugin.json'), 'utf8')).version, '1.0.1')
})

test('a dry run writes nothing', () => {
  const r = run(bundle(), { dryRun: true })
  assert.equal(r.code, 0, r.out)
  assert.ok(!existsSync(r.dest))
})
