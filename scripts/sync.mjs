#!/usr/bin/env node
// Publish the Pulse Codex plugin from the zip Pulse already serves in public.
//
//   index.json  https://mcp.trypulse.tech/cli/bundles/index.json   (sha256 per bundle)
//   zip         https://mcp.trypulse.tech/cli/bundles/codex-plugin.zip
//
// Steps: read the index -> download the zip -> check its sha256 -> check every
// entry against an allowlist -> extract in memory -> check the manifests and
// scan the text -> compare the version with plugins/pulse -> replace
// plugins/pulse. Any failed check exits non-zero before anything is written, so
// the workflow never commits or pushes a bad bundle.
//
// Zero dependencies (Node 20+). The workflow runs it with no arguments. Run it by
// hand to test a bundle:
//
//   node scripts/sync.mjs --index ./index.json --zip ./codex-plugin.zip --dry-run
//
// Output (also written to $GITHUB_OUTPUT when set): changed=true|false,
// version=X.Y.Z, sha256=<verified zip hash> (used in the GitHub Release notes)

import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync, appendFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { inflateRawSync } from 'node:zlib'

const ORIGIN = 'https://mcp.trypulse.tech'
const MCP_URL = 'https://mcp.trypulse.tech/mcp'
const PLUGIN_NAME = 'pulse'
const BUNDLE_ID = 'codex-plugin'
const MAX_ZIP_BYTES = 5 * 1024 * 1024
const MAX_ENTRY_BYTES = 2 * 1024 * 1024

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

// Paths the plugin may contain. Everything else fails the sync.
// .agents/plugins/marketplace.json is the zip's own marketplace root: accepted,
// then dropped (this repo has its own marketplace file one level up).
const DROP = new Set(['.agents/plugins/marketplace.json'])
const SEGMENT = '[A-Za-z0-9][A-Za-z0-9._-]*'
const ALLOW = [
  /^\.codex-plugin\/plugin\.json$/,
  /^plugin\.json$/, // PUL-1057-1 portable layout
  /^mcp\.json$/,
  new RegExp(`^skills/${SEGMENT}(/${SEGMENT})*$`),
  new RegExp(`^assets/${SEGMENT}\\.png$`),
]

// Strings that must never reach the public repo. Case-insensitive.
const DENY = [
  [/authorization/i, 'an Authorization header'],
  [/bearer\s/i, 'a Bearer credential'],
  [/@gmail\.com/i, 'a personal email address'],
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, 'a private key'],
  [/\b(gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|glpat-[A-Za-z0-9_-]{20,}|sk-[A-Za-z0-9_-]{20,}|pulse_(pat|sk)_[A-Za-z0-9]{8,})/, 'an access key'],
]
const TEXT = /\.(json|md|ya?ml|txt|toml)$/i

// Internal names are matched as whole words by sha256, so this public file
// does not spell out the names it keeps out. SYNC_DENY_WORD_SHA256 (comma
// separated) adds more. Hash a word with: printf %s word | sha256sum
const DENY_WORDS = new Set([
  'e7bb08c05730fbee0e82a6319ebed6c7985779f90512198509cfecb48865d023',
  ...(process.env.SYNC_DENY_WORD_SHA256 ?? '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean),
])

function parseArgs(argv) {
  const args = { index: `${ORIGIN}/cli/bundles/index.json`, zip: null, dest: 'plugins/pulse', dryRun: false }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--dry-run') args.dryRun = true
    else if (a === '--index' || a === '--zip' || a === '--dest') args[a.slice(2)] = argv[++i]
    else fail(`unknown argument ${a}`)
  }
  return args
}

function fail(msg) {
  console.error(`sync: FAIL: ${msg}`)
  process.exit(1)
}

async function load(src) {
  if (/^https:\/\//.test(src)) {
    const res = await fetch(src, { redirect: 'error' })
    if (!res.ok) fail(`GET ${src} -> ${res.status}`)
    return Buffer.from(await res.arrayBuffer())
  }
  return readFileSync(src)
}

// ---- zip reading (central directory, stored + deflate only) ----------------

const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()
function crc32(buf) {
  let c = 0xffffffff
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function readZip(zip) {
  let eocd = zip.length - 22
  while (eocd >= 0 && zip.readUInt32LE(eocd) !== 0x06054b50) eocd--
  if (eocd < 0) fail('not a zip (no end-of-central-directory record)')
  const count = zip.readUInt16LE(eocd + 10)
  let at = zip.readUInt32LE(eocd + 16)
  const entries = []
  for (let i = 0; i < count; i++) {
    if (zip.readUInt32LE(at) !== 0x02014b50) fail('bad central directory header')
    const flags = zip.readUInt16LE(at + 8)
    const method = zip.readUInt16LE(at + 10)
    const crc = zip.readUInt32LE(at + 16)
    const csize = zip.readUInt32LE(at + 20)
    const usize = zip.readUInt32LE(at + 24)
    const nlen = zip.readUInt16LE(at + 28)
    const xlen = zip.readUInt16LE(at + 30)
    const clen = zip.readUInt16LE(at + 32)
    const unixMode = zip.readUInt32LE(at + 38) >>> 16
    const local = zip.readUInt32LE(at + 42)
    const name = zip.subarray(at + 46, at + 46 + nlen).toString('utf8')
    at += 46 + nlen + xlen + clen
    entries.push({ name, flags, method, crc, csize, usize, unixMode, local })
  }
  return entries
}

function extract(zip, e) {
  if (e.flags & 0x1) fail(`${e.name}: encrypted entry`)
  if (e.usize > MAX_ENTRY_BYTES) fail(`${e.name}: ${e.usize} bytes is over the ${MAX_ENTRY_BYTES} limit`)
  if (zip.readUInt32LE(e.local) !== 0x04034b50) fail(`${e.name}: bad local header`)
  const start = e.local + 30 + zip.readUInt16LE(e.local + 26) + zip.readUInt16LE(e.local + 28)
  const raw = zip.subarray(start, start + e.csize)
  let data
  if (e.method === 0) data = Buffer.from(raw)
  else if (e.method === 8) data = inflateRawSync(raw, { maxOutputLength: MAX_ENTRY_BYTES })
  else fail(`${e.name}: unsupported compression method ${e.method}`)
  if (data.length !== e.usize) fail(`${e.name}: size mismatch`)
  if (crc32(data) !== e.crc) fail(`${e.name}: CRC mismatch`)
  return data
}

// ---- checks ------------------------------------------------------------------

function checkPath(name) {
  if (name.includes('\\') || name.startsWith('/') || /^[A-Za-z]:/.test(name)) fail(`${name}: absolute or non-POSIX path`)
  if (name.split('/').some(s => s === '..' || s === '.')) fail(`${name}: path traversal`)
}

const SEMVER = /^(\d+)\.(\d+)\.(\d+)$/
function cmpSemver(a, b) {
  const x = a.match(SEMVER).slice(1).map(Number)
  const y = b.match(SEMVER).slice(1).map(Number)
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] - y[i]
  return 0
}

function parseJson(files, rel) {
  try {
    return JSON.parse(files.get(rel).toString('utf8'))
  } catch (err) {
    fail(`${rel}: invalid JSON (${err.message})`)
  }
}

// An MCP server entry must point at the public Pulse endpoint and carry no
// credential of its own: sign-in is `codex mcp login pulse` (OAuth).
function checkServer(where, server) {
  if (!server || typeof server !== 'object') fail(`${where}: not an object`)
  if (server.url !== MCP_URL) fail(`${where}.url is ${JSON.stringify(server.url)}, expected ${MCP_URL}`)
  if (server.oauth_resource !== undefined && server.oauth_resource !== MCP_URL) fail(`${where}.oauth_resource must be ${MCP_URL}`)
  for (const key of ['headers', 'http_headers', 'env_http_headers', 'bearer_token', 'bearer_token_env_var', 'env', 'command', 'args']) {
    if (key in server) fail(`${where}.${key} is not allowed`)
  }
}

function checkServers(where, servers) {
  if (!servers || typeof servers !== 'object' || Array.isArray(servers)) fail(`${where}: expected an object of servers`)
  const names = Object.keys(servers)
  if (names.length === 0) fail(`${where}: no servers`)
  for (const name of names) checkServer(`${where}.${name}`, servers[name])
}

function checkManifest(files, rel, expectVersion) {
  const m = parseJson(files, rel)
  if (m.name !== PLUGIN_NAME) fail(`${rel}: name is ${JSON.stringify(m.name)}, expected "${PLUGIN_NAME}"`)
  if (typeof m.version !== 'string' || !SEMVER.test(m.version)) fail(`${rel}: version ${JSON.stringify(m.version)} is not X.Y.Z`)
  if (expectVersion && m.version !== expectVersion) fail(`${rel}: version ${m.version} differs from ${expectVersion}`)
  // mcpServers is inline, a relative path to an mcp.json in the zip, or (the
  // portable layout) absent, in which case Codex reads the root mcp.json.
  if (typeof m.mcpServers === 'string') {
    if (!files.has(bundlePath(m.mcpServers))) fail(`${rel}: mcpServers points at ${m.mcpServers}, which is not in the bundle`)
  } else if (m.mcpServers !== undefined) {
    checkServers(`${rel} mcpServers`, m.mcpServers)
  } else if (!files.has('mcp.json')) {
    fail(`${rel}: no mcpServers and no mcp.json, so the plugin would install without the Pulse server`)
  }
  // The legacy manifest keeps interface at the top; the portable one keeps it
  // under extensions["com.openai"], next to the onboarding skill.
  const openai = m.extensions?.['com.openai'] ?? {}
  const ui = m.interface ?? openai.interface ?? {}
  const refs = [['interface.logo', ui.logo], ['interface.logoDark', ui.logoDark],
    ['interface.composerIcon', ui.composerIcon], ['onboardingSkill', openai.onboardingSkill]]
  for (const [key, ref] of refs) {
    if (ref === undefined) continue
    if (!files.has(bundlePath(ref))) fail(`${rel}: ${key} points at ${ref}, which is not in the bundle`)
  }
  return m
}

function bundlePath(ref) {
  return path.posix.normalize(String(ref).replace(/^\.\//, ''))
}

// ---- tree helpers ------------------------------------------------------------

function readTree(dir, prefix = '', out = new Map()) {
  if (!existsSync(dir)) return out
  for (const name of readdirSync(dir).sort()) {
    const abs = path.join(dir, name)
    const rel = prefix ? `${prefix}/${name}` : name
    if (statSync(abs).isDirectory()) readTree(abs, rel, out)
    else out.set(rel, readFileSync(abs))
  }
  return out
}

function sameTree(a, b) {
  if (a.size !== b.size) return false
  for (const [k, v] of a) if (!b.has(k) || !b.get(k).equals(v)) return false
  return true
}

function output(values) {
  for (const [k, v] of Object.entries(values)) console.log(`${k}=${v}`)
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, Object.entries(values).map(([k, v]) => `${k}=${v}\n`).join(''))
  }
}

// ---- main --------------------------------------------------------------------

const args = parseArgs(process.argv.slice(2))
const dest = path.resolve(ROOT, args.dest)

const index = JSON.parse((await load(args.index)).toString('utf8'))
const listed = index.bundles?.find(b => b.id === BUNDLE_ID)
if (!listed) fail(`no "${BUNDLE_ID}" bundle in the index`)
if (!/^[0-9a-f]{64}$/.test(listed.sha256 ?? '')) fail('index entry has no sha256')
// The CDN in front of mcp.trypulse.tech caches /cli/bundles/codex-plugin.zip
// despite `Cache-Control: no-store` and kept serving the previous release after
// a deploy (measured 2026-09-30: fresh index, stale zip, sha256 mismatch). A
// query unique to this release always misses that cache; the sha256 check
// below still decides whether the bytes are the ones the index lists.
const zipUrl = new URL(listed.url, ORIGIN)
zipUrl.searchParams.set('sha256', listed.sha256)
const zipSrc = args.zip ?? zipUrl.href
if (!args.zip && !zipSrc.startsWith(`${ORIGIN}/`)) fail(`bundle url ${zipSrc} is not on ${ORIGIN}`)

const zip = await load(zipSrc)
if (zip.length > MAX_ZIP_BYTES) fail(`zip is ${zip.length} bytes, over the ${MAX_ZIP_BYTES} limit`)
const sha = createHash('sha256').update(zip).digest('hex')
if (sha !== listed.sha256) fail(`sha256 ${sha} does not match the index (${listed.sha256})`)
console.log(`sync: ${listed.filename} sha256 ok (${sha})`)

const files = new Map()
for (const e of readZip(zip)) {
  checkPath(e.name)
  if (e.name.endsWith('/')) continue // directory record
  const type = e.unixMode & 0o170000
  if (type !== 0 && type !== 0o100000) fail(`${e.name}: not a regular file (symlink or device)`)
  if (DROP.has(e.name)) continue
  if (!ALLOW.some(re => re.test(e.name))) fail(`${e.name}: path is not on the allowlist`)
  if (files.has(e.name)) fail(`${e.name}: duplicate entry`)
  files.set(e.name, extract(zip, e))
}

if (!files.has('.codex-plugin/plugin.json')) fail('.codex-plugin/plugin.json is missing')
const manifest = checkManifest(files, '.codex-plugin/plugin.json')
const version = manifest.version
if (files.has('plugin.json')) checkManifest(files, 'plugin.json', version)
if (files.has('mcp.json')) checkServers('mcp.json mcpServers', parseJson(files, 'mcp.json').mcpServers)

const skills = new Set([...files.keys()].filter(k => k.startsWith('skills/')).map(k => k.split('/')[1]))
if (skills.size === 0) fail('bundle has no skills')
for (const s of skills) if (!files.has(`skills/${s}/SKILL.md`)) fail(`skills/${s}: no SKILL.md`)

for (const [rel, data] of files) {
  if (!TEXT.test(rel)) continue
  const text = data.toString('utf8')
  for (const [re, what] of DENY) {
    const m = text.match(re)
    if (m) fail(`${rel}: contains ${what} (${JSON.stringify(m[0])})`)
  }
  for (const word of new Set(text.toLowerCase().split(/[^a-z0-9]+/))) {
    if (word && DENY_WORDS.has(createHash('sha256').update(word).digest('hex'))) fail(`${rel}: contains an internal name`)
  }
}
console.log(`sync: ${files.size} files, ${skills.size} skills, version ${version}: checks passed`)

const publishedPath = path.join(dest, '.codex-plugin/plugin.json')
const published = existsSync(publishedPath) ? JSON.parse(readFileSync(publishedPath, 'utf8')).version : null
if (published !== null) {
  if (!SEMVER.test(published)) fail(`published version ${published} is not X.Y.Z`)
  const order = cmpSemver(version, published)
  // Codex only refreshes an installed plugin when its version changes, so a
  // changed tree under the same version would never reach anyone.
  if (order === 0) {
    if (sameTree(files, readTree(dest))) {
      console.log(`sync: ${version} is already published`)
      output({ changed: 'false', version, sha256: sha })
      process.exit(0)
    }
    fail(`bundle ${version} differs from the published ${version}: releases must bump the version`)
  }
  if (order < 0) fail(`bundle ${version} is older than the published ${published}: refusing to go back`)
}

if (args.dryRun) {
  console.log(`sync: dry run, would publish ${version} (published: ${published ?? 'none'})`)
  output({ changed: 'true', version, sha256: sha })
  process.exit(0)
}

rmSync(dest, { recursive: true, force: true })
for (const [rel, data] of files) {
  const abs = path.join(dest, rel)
  mkdirSync(path.dirname(abs), { recursive: true })
  writeFileSync(abs, data)
}
console.log(`sync: wrote ${files.size} files to ${path.relative(ROOT, dest)} (${published ?? 'none'} -> ${version})`)
output({ changed: 'true', version, sha256: sha })
