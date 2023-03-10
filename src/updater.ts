import fs from 'node:fs/promises'

import glob from 'glob'
import semver from 'semver'
import fetch from 'npm-registry-fetch'

import { readNpmRc } from './npmrc'

import type { ReleaseType } from 'semver'

export type UpdaterOptions = {
  bump?: ReleaseType,
  strict?: boolean,
  quick?: boolean,
  debug?: boolean,
  dryrun?: boolean,
}

interface Change {
  name: string,
  from: string,
  to: string,
  kind: string,
}

/* Our packages cache version */
const cache: Record<string, Promise<string[]>> = {}

/* Destructuring from "fs.promises" */
const { readFile, writeFile } = fs

/* Colors */
const [ K, R, G, Y, B ] = [ 0, 31, 32, 33, 34 ].map((x) => `\u001b[${x}m`)

/* ========================================================================== *
 * Process a number of package files one by one                               *
 * ========================================================================== */
export async function processPackages(
    patterns: string | string[],
    options: UpdaterOptions,
): Promise<number> {
  /* Destructure our options */
  const { bump, quick, strict, debug, dryrun } = options

  /* ------------------------------------------------------------------------ *
   * A super-simple debug function                                            *
   * ------------------------------------------------------------------------ */
  function $debug(...args: string[]): void {
    if (debug && args) console.log(`${R}[DEBUG]${K}`, ...args)
  }

  /* ------------------------------------------------------------------------ *
   * Download (or return cached) versions for a package, greatest first       *
   * (we're upgrading, ainnit?) without any prerelease                        *
   * ------------------------------------------------------------------------ */

  function getVersions(name: string, npmrc: Record<string, any>): Promise<string[]> {
    if (name in cache) {
      $debug(`Returning cached versions for ${Y}${name}${K}`)
      return cache[name]
    }

    $debug(`Retrieving versions for package ${Y}${name}${K}`)

    const range = new semver.Range('>=0.0.0', { includePrerelease: false })

    return cache[name] = fetch.json(name, Object.assign({}, npmrc, { spec: name }))
        .then((data: any) => {
          return Object.entries(data.versions as Record<string, Record<string, any>>)
              .filter(([ , info ]) => ! info.deprecated) // no deprecated
              .map(([ version ]) => version) // extract key (version)
              .filter((version) => range.test(version)) // range match
              .sort(semver.rcompare)
        })
  }

  /* ------------------------------------------------------------------------ *
   * Update the version for a single dependency                               *
   * ------------------------------------------------------------------------ */
  async function updateDependency(name: string, rangeString: string, npmrc: Record<string, any>): Promise<string> {
    const match = /^\s*([~^])\s*(\d+(\.\d+(\.\d+)?)?)\s*$/.exec(rangeString)
    if (! match) {
      $debug(`Not processing range ${G}${rangeString}${K} for ${Y}${name}${K}`)
      return rangeString
    }

    const [ , specifier, version ] = match

    if (! strict) {
      const r = rangeString
      rangeString = `>=${version}`
      if (specifier === '~') rangeString += ` <${semver.inc(version, 'major')}`
      $debug(`Extending version for ${Y}${name}${K} from ${G}${r}${K} to ${G}${rangeString}${K}`)
    }

    const range = new semver.Range(rangeString)
    const versions = await getVersions(name, npmrc)

    for (const v of versions) {
      if (range.test(v)) return `${specifier}${v}`
    }
    return `${specifier}${version}`
  }

  /* ------------------------------------------------------------------------ *
   * Process all dependencies in a package file                               *
   * ------------------------------------------------------------------------ */
  async function processPackage(file: string): Promise<number> {
    process.stdout.write(`Processing ${G}${file}${K} `)

    const data = JSON.parse(await readFile(file, 'utf8'))
    if (data.name) {
      process.stdout.write(`[${Y}${data.name}`)
      if (data.version) process.stdout.write(` ${data.version}`)
      process.stdout.write(`${K}] `)
    }
    if (debug) process.stdout.write('\n')

    const npmrc = await readNpmRc(file)

    const changes: Change[] = []
    let mainDependencyChanges = 0

    for (const type in data) {
      if (! type.match(/[dD]ependencies$/)) continue
      if (type.match(/bundled?Dependencies/)) continue

      const kind = type.length > 12 ? ` [${type.slice(0, -12)}]` : ''

      const dependencies: Record<string, string> = {}
      const promises = Object.keys(data[type] || {}).sort().map(async (name) => {
        const from: string = data[type][name]
        const to = await updateDependency(name, from, npmrc)
        if (! debug) process.stdout.write('.')
        if (from !== to) {
          changes.push({ name, from, to, kind })
          if (type === 'dependencies') mainDependencyChanges ++
        }
        dependencies[name] = to
      })

      await Promise.all(promises)

      if (Object.keys(dependencies).length) {
        data[type] = dependencies
      } else {
        delete data[type]
      }
    }

    if (debug) process.stdout.write('Updated with')

    if (! changes.length) {
      console.log(` ${R}no changes${K}`)
      return 0
    }

    /* Really pretty print */
    changes.sort(({ name: a }, { name: b }) => a < b ? -1 : a > b ? 1 : 0)
    console.log(` ${R}${changes.length} changes${K}`)
    let lname = 0; let lfrom = 0; let lto = 0
    for (const { name, from, to } of changes) {
      lname = lname > name.length ? lname : name.length
      lfrom = lfrom > from.length ? lfrom : from.length
      lto = lto > to.length ? lto : to.length
    }

    for (const { name, from, to, kind } of changes) {
      console.log(` * ${Y}${name.padEnd(lname)}${K}  :  ${G}${from.padStart(lfrom)}${K} -> ${G}${to.padEnd(lto)} ${B}${kind}${K}`)
    }

    /* Ignore all changes if no main changes, and in "quick" mode */
    if (quick && (mainDependencyChanges === 0)) {
      console.log(`No changes to main dependencies, ${Y}ignoring ${changes.length} other changes${K}`)
      return 0
    }

    /* Bump the package if we need to */
    if (bump) {
      const bumped = semver.inc(data.version, bump)
      console.log(` - Bumping version ${Y}${data.version}${K} -> ${G}${bumped}${K}`)
      data.version = bumped
    }

    /* Write out the new package file */
    if (dryrun) {
      console.log(`Dry run, not writing ${G}${file}${K}`)
      return 0
    } else {
      await writeFile(file, JSON.stringify(data, null, 2) + '\n')
      return changes.length
    }
  }

  /* ------------------------------------------------------------------------ *
   * Process a number of package files one by one                             *
   * ------------------------------------------------------------------------ */
  const files = await glob(patterns)
  let changes = 0

  let newline = false
  for (const file of files) {
    if (newline) console.log()
    const packageChanges = await processPackage(file)
    newline = !! packageChanges
    changes += packageChanges
  }

  return changes
}
