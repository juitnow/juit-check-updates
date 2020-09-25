#!/usr/bin/env node

'use strict'

const { readFile, writeFile } = require('fs').promises
const semver = require('semver')
const packageJson = require('package-json')

/* Colors */
const [ K, R, G, Y, B ] = [ 0, 31, 32, 33, 34 ].map((x) => `\u001b[${x}m`)

/* ========================================================================== *
 * A super-simple debug function                                              *
 * ========================================================================== */
function debug(...args) {
  if (dbg) console.log(`${R}[DEBUG]${K}`, ...args)
}

/* ========================================================================== *
 * Download (or return cached) versions for a package, greatest first (we're  *
 * upgrading, ainnit?) without any prerelease                                 *
 * ========================================================================== */
const cache = {}

function getVersions(name) {
  if (cache[name]) {
    debug(`Returning cached versions for ${Y}${name}${K}`)
    return cache[name]
  }

  debug(`Retrieving versions for package ${Y}${name}${K}`)

  const range = new semver.Range('>=0.0.0', { includePrerelease: false })
  const filter = (version) => range.test(version)

  return cache[name] = packageJson(name, { allVersions: true })
      .then(({ versions }) => Object.keys(versions).filter(filter).sort(semver.rcompare))
}

/* ========================================================================== *
 * Update the version for a single dependency                                 *
 * ========================================================================== */
async function updateDependency(name, rangeString) {
  const match = /^\s*([~^])\s*(\d+(\.\d+(\.\d+)?)?)\s*$/.exec(rangeString)
  if (! match) {
    debug(`Not processing range ${G}${rangeString}${K} for ${Y}${name}${K}`)
    return rangeString
  }

  const [ , specifier, version ] = match

  if (! strict) {
    const r = rangeString
    rangeString = `>=${version}`
    if (specifier === '~') rangeString += ` <${semver.inc(version, 'major')}`
    debug(`Extending version for ${Y}${name}${K} from ${G}${r}${K} to ${G}${rangeString}${K}`)
  }

  const range = new semver.Range(rangeString)
  const versions = await getVersions(name)

  for (const v of versions) {
    if (range.test(v)) return `${specifier}${v}`
  }
  return `${specifier}${version}`
}

/* ========================================================================== *
 * Process all dependencies in a package file                                 *
 * ========================================================================== */
async function processPackage(file) {
  process.stdout.write(`Processing ${G}${file}${K} `)

  const data = JSON.parse(await readFile(file, 'utf8'))
  if (data.name) {
    process.stdout.write(`[${Y}${data.name}`)
    if (data.version) process.stdout.write(` ${data.version}`)
    process.stdout.write(`${K}] `)
  }
  if (dbg) process.stdout.write('\n')

  const changes = []
  for (const type in data) {
    if (! type.match(/[dD]ependencies$/)) continue
    if (type.match(/bundled?Dependencies/)) continue

    const kind = type.length > 12 ? ` [${type.slice(0, -12)}]` : ''

    const dependencies = {}
    for (const name of Object.keys(data[type] || {}).sort()) {
      if (! dbg) process.stdout.write('.')
      const from = data[type][name]
      const to = await updateDependency(name, from)
      if (from !== to) changes.push({ name, from, to, kind })
      dependencies[name] = to
    }

    if (Object.keys(dependencies).length) {
      data[type] = dependencies
    } else {
      delete data[type]
    }
  }

  if (dbg) process.stdout.write('Updated with')

  if (! changes.length) {
    console.log(` ${R}no changes${K}`)
    return false
  }

  /* Really pretty print */
  console.log(` ${R}${changes.length} changes${K}`)
  let lname = 0, lfrom = 0, lto = 0
  for (const { name, from, to } of changes) {
    lname = lname > name.length ? lname : name.length
    lfrom = lfrom > from.length ? lfrom : from.length
    lto = lto > to.length ? lto : to.length
  }

  for (const { name, from, to, kind } of changes) {
    console.log(` * ${Y}${name.padEnd(lname)}${K}  :  ${G}${from.padStart(lfrom)}${K} -> ${G}${to.padEnd(lto)} ${B}${kind}${K}`)
  }

  /* Bump the version number if we have to */
  if (data.version && bump) {
    const bumped = semver.inc(data.version, bump)
    console.log(`Bumping ${Y}${bump}${K} version: ${G}${data.version}${K} -> ${G}${bumped}${K}`)
    data.version = bumped
  }

  /* Write out the new package file */
  if (dryRun) {
    console.log(`Dry run, not writing ${G}${file}${K}`)
  } else {
    writeFile(file, JSON.stringify(data, null, 2) + '\n')
  }
  return true
}

/* ========================================================================== *
 * Process a number of package files one by one                               *
 * ========================================================================== */
async function processPackages(...files) {
  let newline = false
  for (const file of files) {
    if (newline) console.log()
    newline = await processPackage(file)
  }
}

/* ========================================================================== *
 * CALL UP MAIN() AND DEAL WITH THE ASYNC PROMISE IT RETURNS                  *
 * ========================================================================== */
/* Parse command line arguments */
const { strict, bump, debug: dbg, dryRun, _: files } = require('yargs')
    .usage(`check-updates [--options ...] [package.json ...]`)
    .help('h').alias('h', 'help').alias('v', 'version')
    .option('strict', {
      alias: 's',
      type: 'boolean',
      description: [
        'Strictly adhere to semver rules for tilde (~x.y.z)',
        'and caret (^x.y.z) dependency ranges',
      ].join('\n')
    })
    .option('bump', {
      alias: 'b',
      type: 'string',
      coerce: (value) => value || 'patch',
      description: [
        'Bump the package\'s own (major, minor, patch, ...)',
        'version on changes (assumes "patch" when specified)',
      ].join('\n')
    })
    .option('debug', {
      alias: 'd',
      type: 'boolean',
      description: 'Output debugging informations',
    })
    .options('dry-run', {
      type: 'boolean',
      description: 'Only process changes without writing to disk',
    })
    .epilogue([
      'A number of "package.json" files can be specified on the command line.\n',
      'When no files are specified, the default is to process the "package.json" file in the current directory'
    ].join('\n'))
    .strict()
    .argv

/* Default is package.json in the current directory */
if (! files.length) files.push('package.json')

/* Process packages, one by one */
processPackages(...files).catch(console.error)
