#!/usr/bin/env node

import { promises as fs } from 'fs'
import glob from 'glob'
import semver, { ReleaseType } from 'semver'
import packageJson from 'package-json'

export type UpdaterOptions = {
  bump?: ReleaseType,
  strict?: boolean,
  debug?: boolean,
  dryrun?: boolean,
}

/* Our packages cache version */
const cache: { [name: string]: Promise<string[]> } = { }

/* Destructuring from "fs.promises" */
const { readFile, writeFile } = fs

/* Colors */
const [ K, R, G, Y, B ] = [ 0, 31, 32, 33, 34 ].map((x) => `\u001b[${x}m`)

/* ========================================================================== *
 * Process a number of package files one by one                               *
 * ========================================================================== */
export default async function processPackages(
  patterns: string | string[],
  options: UpdaterOptions,
): Promise<boolean> {
  /* Destructure our options */
  const { bump, strict, debug, dryrun } = options

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

  function getVersions(name: string): Promise<string[]> {
    if (cache[name]) {
      $debug(`Returning cached versions for ${Y}${name}${K}`)
      return cache[name]
    }

    $debug(`Retrieving versions for package ${Y}${name}${K}`)

    const range = new semver.Range('>=0.0.0', { includePrerelease: false })
    const filter = (version: string) => range.test(version)

    return cache[name] = packageJson(name, { allVersions: true })
      .then(({ versions }) => Object.keys(versions).filter(filter).sort(semver.rcompare))
  }

  /* ------------------------------------------------------------------------ *
   * Update the version for a single dependency                               *
   * ------------------------------------------------------------------------ */
  async function updateDependency(name: string, rangeString: string) {
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
    const versions = await getVersions(name)

    for (const v of versions) {
      if (range.test(v)) return `${specifier}${v}`
    }
    return `${specifier}${version}`
  }

  /* ------------------------------------------------------------------------ *
   * Process a list of glob patterns and return all matching files            *
   * ------------------------------------------------------------------------ */
  async function find(...patterns: string[]) {
    const files: string[] = []
    for (const pattern of patterns) {
      await new Promise((resolve, reject) => {
        glob(pattern, (error, matches) => {
          if (error) return reject(error)
          files.push(...matches)
          resolve(matches)
        })
      })
    }
    return files.filter((file, index, files) => files.indexOf(file) === index)
  }

  /* ------------------------------------------------------------------------ *
   * Process all dependencies in a package file                               *
   * ------------------------------------------------------------------------ */
  async function processPackage(file: string) {
    process.stdout.write(`Processing ${G}${file}${K} `)

    const data = JSON.parse(await readFile(file, 'utf8'))
    if (data.name) {
      process.stdout.write(`[${Y}${data.name}`)
      if (data.version) process.stdout.write(` ${data.version}`)
      process.stdout.write(`${K}] `)
    }
    if (debug) process.stdout.write('\n')

    const changes = []
    for (const type in data) {
      if (! type.match(/[dD]ependencies$/)) continue
      if (type.match(/bundled?Dependencies/)) continue

      const kind = type.length > 12 ? ` [${type.slice(0, -12)}]` : ''

      const dependencies: { [name: string]: string } = {}
      for (const name of Object.keys(data[type] || {}).sort()) {
        if (! debug) process.stdout.write('.')
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

    if (debug) process.stdout.write('Updated with')

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

    /* Bump the package if we need to */
    if (bump) {
      const bumped = semver.inc(data.version, bump)
      console.log(` - Bumping version ${Y}${data.version}${K} -> ${G}${bumped}${K}`)
      data.version = bumped
    }

    /* Write out the new package file */
    if (dryrun) {
      console.log(`Dry run, not writing ${G}${file}${K}`)
    } else {
      writeFile(file, JSON.stringify(data, null, 2) + '\n')
    }
    return true
  }

  /* ------------------------------------------------------------------------ *
   * Process a number of package files one by one                             *
   * ------------------------------------------------------------------------ */
  const files = await find(...patterns)

  let newline = false
  for (const file of files) {
    if (newline) console.log()
    newline = await processPackage(file)
  }

  return false
}
