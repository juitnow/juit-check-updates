import fetch from 'npm-registry-fetch'
import semver from 'semver'

import { X, Y, makeDebug } from './debug'

/** Cache of versions */
export class VersionsCache {
  private _cache: Record<string, Promise<string[]>>
  private _debug: (...args: any) => void

  constructor(debug: boolean = false) {
    this._debug = makeDebug(debug)
    this._cache = {}
  }

  /** Return the available versions for a package, sorted */
  getVersions(
      name: string,
      npmrc: Record<string, any>,
      includePrerelease: boolean,
  ): Promise<string[]> {
    const key = includePrerelease ? name + '+prerelease' : name

    if (this._cache[key]) {
      this._debug(`Returning cached versions for ${Y}${name}${X}`)
      return this._cache[key]!
    }

    this._debug(`Retrieving versions for package ${Y}${name}${X}`)

    const range = new semver.Range('>=0.0.0', { includePrerelease })

    /* we cache the promise, so that multiple concurrent requests for the same
     * package will generate only one http fetch request */
    const promise = fetch.json(name, Object.assign({}, npmrc, { spec: name }))
        .then((data: any) => {
          return Object.entries(data.versions as Record<string, Record<string, any>>)
              .filter(([ , info ]) => ! info.deprecated) // no deprecated
              .map(([ version ]) => version) // extract key (version)
              .filter((version) => range.test(version)) // range match
              .sort(semver.rcompare)
        })
    this._cache[key] = promise
    return promise
  }
}
