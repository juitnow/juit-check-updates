import assert from 'node:assert'
import { EventEmitter } from 'node:events'
import { readFile, writeFile } from 'node:fs/promises'
import { relative, resolve } from 'node:path'

import semver from 'semver'


import { B, G, R, X, Y, makeDebug } from './debug'
import { readNpmRc } from './npmrc'

import type { ReleaseType } from 'semver'
import type { VersionsCache } from './versions'

export type UpdaterOptions = {
  bump: ReleaseType | undefined,
  debug: boolean,
  quick: boolean,
  strict: boolean,
  workspaces: boolean,
}

const dependencyTypes = [
  'dependencies',
  'devDependencies',
  'peerDependencies',
  'optionalDependencies',
] as const

type DependencyType = (typeof dependencyTypes)[number]

interface PackageData {
  name?: string,
  version?: string,
  dependencies?: Record<string, string>,
  devDependencies?: Record<string, string>,
  peerDependencies?: Record<string, string>,
  optionalDependencies?: Record<string, string>,
}

interface DependencyChange {
  name: string,
  declared: string,
  updated: string,
  type: DependencyType,
}

class Workspaces {
  private _versions: Record<string, string> = {}
  private _emitter = new EventEmitter().setMaxListeners(100)

  get length(): number {
    return Object.entries(this._versions).length
  }

  onUpdate(handler: (name: string, version: string) => void): void {
    this._emitter.on('update', handler)
  }

  register(name: string, version?: string): void {
    assert(! this._versions[name], `Package "${name}" already registered`)
    this._versions[name] = version || '0.0.0'
  }

  update(name: string, version: string): void {
    assert(this._versions[name], `Package "${name}" not registered`)
    const oldVersion = this._versions[name] || '0.0.0'
    assert(semver.gte(version, oldVersion), `Package "${name}" new version ${version} less than old ${oldVersion}`)
    if (semver.eq(version, oldVersion)) return
    this._versions[name] = version
    this._emitter.emit('update', name, version)
  }

  has(name: string): boolean {
    return !! this._versions[name]
  }

  * [Symbol.iterator](): Generator<[ name: string, version: string ]> {
    for (const [ name, version ] of Object.entries(this._versions)) {
      yield [ name, version ]
    }
  }
}


export class Updater {
  private _packageData?: PackageData
  private _npmRc?: Record<string, any>
  private _originalVersion?: string

  private _debug: (...args: any[]) => void
  private _children: Updater[]
  private _changed = false

  constructor(
      private readonly _packageFile: string,
      private readonly _options: UpdaterOptions,
      private readonly _cache: VersionsCache,
      private readonly _workspaces: Workspaces = new Workspaces(),
  ) {
    this._packageFile = resolve(_packageFile)
    this._debug = makeDebug(_options.debug)
    this._children = []

    _workspaces.onUpdate((name, version) => {
      if (! this._packageData) return

      for (const type of dependencyTypes) {
        const dependencies = this._packageData[type]
        if (! dependencies) continue
        if (! dependencies[name]) continue
        if (dependencies[name] === version) continue

        dependencies[name] = version
        this._changed = true
        this._bump()
      }
    })
  }

  get name(): string | undefined {
    assert(this._packageData, 'Updater not initialized')
    return this._packageData.name
  }

  get version(): string {
    assert(this._packageData, 'Updater not initialized')
    return this._packageData.version || '0.0.0'
  }

  set version(version: string) {
    assert(this._originalVersion && this._packageData, 'Updater not initialized')

    assert(semver.lte(this._originalVersion, version), [
      `Unable to set version for "${this.packageFile}" to "${version}"`,
      `as it's less than original version "${this._originalVersion}"`,
    ].join(' '))

    if (semver.eq(this._originalVersion, version)) return
    if (this._packageData.version === version) return

    this._changed = true
    console.log(`Updating ${this._details} version to ${Y}${version}${X}`)
    this._packageData.version = version
    if (this.name) this._workspaces.update(this.name, version)
  }

  get packageFile(): string {
    return relative(process.cwd(), this._packageFile)
  }

  get changed(): boolean {
    if (this._changed) return true
    return this._children.reduce((changed, child) => changed || child.changed, false)
  }

  async init(): Promise<this> {
    this._debug('Reading package file', this.packageFile)

    /* Parse our package file */
    const json = await readFile(this._packageFile, 'utf8')
    const data = this._packageData = JSON.parse(json)
    assert(data && (typeof data === 'object') && (! Array.isArray(data)),
        `File ${this.packageFile} is not a valid "pacakge.json" file`)

    /* Parse the ".npmrc" relative to the package file */
    const npmrc = await readNpmRc(this._packageFile)

    /* Register this package in our workspaces and set the original version */
    if (data.name) this._workspaces.register(data.name, data.version)
    this._originalVersion = data.version || '0.0.0'

    /* Read up our workspaces */
    if (this._options.workspaces && data.workspaces) {
      for (const path of data.workspaces) {
        const packageFile = resolve(this._packageFile, '..', path, 'package.json')
        const updater = new Updater(packageFile, this._options, this._cache, this._workspaces)
        this._children.push(await updater.init())
      }
    }

    /* Done */
    this._packageData = data
    this._npmRc = npmrc
    return this
  }

  private get _details(): string {
    let string = `${G}${this.packageFile}${X}`
    if (this.name || this.version) {
      string += ` [${Y}`
      if (this.name) string += `${this.name}`
      if (this.name && this.version) string += ' '
      if (this.version) string += `${this.version}`
      string += `${X}]`
    }
    return string
  }

  private _bump(): void {
    assert(this._originalVersion, 'Updater not initialized')

    if (this._options.bump) {
      this.version = semver.inc(this._originalVersion, this._options.bump) || this._originalVersion
    }
  }

  /** Update a single dependency, returning the highest matching version */
  private async _updateDependency(name: string, rangeString: string): Promise<string> {
    assert(this._npmRc, 'Updater not initialized')

    /* Check if this is a workspace package */
    if (this._workspaces.has(name)) {
      this._debug(`Not processing workspace package ${Y}${name}${X}`)
      return rangeString
    }

    /* Check that we have a proper range (^x... or ~x...) */
    const match = /^\s*([~^])\s*(\d+(\.\d+(\.\d+)?)?)(-(alpha|beta|rc)[.-]\d+)?\s*/.exec(rangeString)
    if (! match) {
      this._debug(`Not processing range ${G}${rangeString}${X} for ${Y}${name}${X}`)
      return rangeString
    }

    /* Extract specifier and version from the string range*/
    const [ , specifier = '', version = '' ] = match

    /* Extend range if not in strict mode */
    if (! this._options.strict) {
      const r = rangeString
      rangeString = `>=${version}`
      if (specifier === '~') rangeString += ` <${semver.inc(version, 'major')}`
      this._debug(`Extending version for ${Y}${name}${X} from ${G}${r}${X} to ${G}${rangeString}${X}`)
    }

    /* Get the highest matching version and return it */
    const range = new semver.Range(rangeString)
    const versions = await this._cache.getVersions(name, this._npmRc)
    for (const v of versions) {
      if (range.test(v)) return `${specifier}${v}`
    }

    /* No version found, return the original one cleaned up */
    return `${specifier}${version}`
  }

  /** Update a dependencies group, populating the "updated" version field */
  private async _updateDependenciesGroup(type: DependencyType): Promise<DependencyChange []> {
    assert(this._packageData, 'Updater not initialized')
    const dependencies = this._packageData[type]
    if (! dependencies) return []

    /* Parallelize updates for this group */
    const promises = Object.entries(dependencies)
        .map(async ([ name, declared ]) => {
          const updated = await this._updateDependency(name, declared)
          if (! this._options.debug) process.stdout.write('.')
          if (updated === declared) return

          dependencies[name] = updated
          return { name, declared, updated, type } satisfies DependencyChange
        })

    /* Await all updates and return changes */
    return (await Promise.all(promises))
        .filter((change): change is DependencyChange => !! change)
  }

  /** Update dependencies and return the version number of this package */
  async update(): Promise<void> {
    assert(this._packageData, 'Updater not initialized')

    /* Start by processing all workspaces first */
    for (const child of this._children) await child.update()

    /* Some pretty printing of our package name and version */
    process.stdout.write(`Processing ${this._details} `)
    if (this._options.debug) process.stdout.write('\n')

    /* Process the _main_ dependencies group first */
    const changes = await this._updateDependenciesGroup('dependencies')

    /* Process all the other dependencies if we need to do so */
    if (changes.length || (! this._options.quick)) {
      changes.push(...await this._updateDependenciesGroup('devDependencies'))
      changes.push(...await this._updateDependenciesGroup('optionalDependencies'))
      changes.push(...await this._updateDependenciesGroup('peerDependencies'))
    }

    /* Simply return if no changes were detected or mark this as changed */
    if (this._options.debug) process.stdout.write('Updated with')
    if (! changes.length) return void console.log(` ${R}no changes${X}`)
    this._changed = true

    /* Really pretty print all our changed dependencies */
    changes.sort(({ name: a }, { name: b }) => a < b ? -1 : a > b ? 1 : 0)
    console.log(` ${R}${changes.length} changes${X}`)
    let lname = 0
    let ldeclared = 0
    let lupdated = 0
    for (const { name, declared, updated } of changes) {
      lname = lname > name.length ? lname : name.length
      ldeclared = ldeclared > declared.length ? ldeclared : declared.length
      lupdated = lupdated > updated.length ? lupdated : updated.length
    }

    for (const { name, declared, updated, type } of changes) {
      const kind =
          type === 'devDependencies' ? 'dev' :
          type === 'peerDependencies' ? 'peer' :
          type === 'optionalDependencies' ? 'optional' :
          'main'
      console.log([
        ` * ${Y}${name.padEnd(lname)}${X}`,
        `  :  ${G}${declared.padStart(ldeclared)}${X}`,
        ` -> ${G}${updated.padEnd(lupdated)} ${B}${kind}${X}`,
      ].join(''))
    }

    /* Bump the package if we need to */
    this._bump()
  }

  align(version?: string): void {
    if (this._workspaces.length < 2) {
      return this._debug(`No workspaces found in ${this._details}`)
    }

    if (! version) {
      let aligned = '0.0.0'
      for (const [ , version ] of this._workspaces) {
        if (semver.gt(version, aligned)) aligned = version
      }
      version = aligned
    }

    this.version = version
    for (const child of this._children) child.version = version
    console.log(`Workspaces versions aligned to ${Y}${version}${X}`)
  }

  /** Write out the new package file */
  async write(): Promise<void> {
    assert(this._packageData, 'Updater not initialized')

    /* Sort all our dependencies */
    for (const type of dependencyTypes) {
      const dependencies = Object.entries(this._packageData[type] || {})
      if (dependencies.length) {
        this._packageData[type] = dependencies
            .sort(([ nameA ], [ nameB ]) => nameA.localeCompare(nameB))
            .reduce((deps, [ name, version ]) => {
              deps[name] = version
              return deps
            }, {} as Record<string, string>)
      } else {
        delete this._packageData[type]
      }
    }
    const json = JSON.stringify(this._packageData, null, 2)
    this._debug(`${Y}>>>`, this.packageFile, `<<<${X}\n${json}`)
    await writeFile(this.packageFile, json + '\n')

    for (const child of this._children) await child.write()
  }
}
