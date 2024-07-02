import * as plug from '@plugjs/build'
import * as semver from 'semver'

import { Updater } from '../src/updater'
import { VersionsCache } from '../src/versions'


describe('Dependencies Updater', () => {
  const scriptFile = plug.resolve('./src/main.mts')

  it('should update a simple package', async () => {
    const tempdir: plug.AbsolutePath = plug.mkdtemp()
    try {
      const source = plug.resolve('test', 'package.json')
      const target = plug.resolve(tempdir, 'package.json')
      await plug.fs.copyFile(source, target)

      await plug.exec('tsrun', scriptFile, '--bump=major', { cwd: tempdir })

      const original = plug.parseJson(source)
      const modified = plug.parseJson(target)

      expect(modified).toEqual({
        ...original,
        version: '2.0.0', // bump major from 1.2.3 to 2.0.0
        dependencies: {
          ...original.dependencies,
          typescript: expect.toMatch(/^\^\d+\.\d+.\d+$/),
        },
      })

      const originalVersion = semver.minVersion(original.dependencies.typescript)!
      const modifiedVersion = semver.minVersion(modified.dependencies.typescript)!
      const comparison = semver.compare(modifiedVersion, originalVersion)
      expect(comparison, `New version ${modifiedVersion} is not greater than old version ${originalVersion}`)
          .toBeGreaterThan(0)
    } finally {
      await plug.rmrf(tempdir)
    }
  })

  it('should not update in dry run mode', async () => {
    const tempdir: plug.AbsolutePath = plug.mkdtemp()
    try {
      const source = plug.resolve('test', 'package.json')
      const target = plug.resolve(tempdir, 'package.json')
      await plug.fs.copyFile(source, target)

      await plug.exec('tsrun', scriptFile, '--dry-run', '--debug', { cwd: tempdir })

      const original = plug.parseJson(source)
      const modified = plug.parseJson(target)

      expect(modified).toEqual(original)
    } finally {
      await plug.rmrf(tempdir)
    }
  })

  it('should not upgrade from release to pre-release', async () => {
    const source = plug.resolve('test', 'package-release.json')

    const cache = new VersionsCache()
    ;(cache as any)._cache['test-dep'] = [ '0.9', '0.8', '0.7' ]
    ;(cache as any)._cache['test-dep+prerelease'] = [ '1.0.0-beta.2', '1.0.0-beta.1' ]

    const updater = new Updater(source, {
      bump: 'patch',
      debug: false,
      quick: false,
      strict: false,
      workspaces: false,
    }, cache)

    await updater.init()
    await updater.update()

    expect((updater as any)._packageData.dependencies['test-dep']).toEqual('^1.0.0')
  })

  it('should upgrade from pre-release to pre-release', async () => {
    const source = plug.resolve('test', 'package-prerelease.json')

    const cache = new VersionsCache()
    ;(cache as any)._cache['test-dep'] = [ '0.9', '0.8', '0.7' ]
    ;(cache as any)._cache['test-dep+prerelease'] = [ '1.1.0-beta.3', '1.0.0-beta.2', '1.0.0-beta.1' ]

    const updater = new Updater(source, {
      bump: 'patch',
      debug: false,
      quick: false,
      strict: false,
      workspaces: false,
    }, cache)

    await updater.init()
    await updater.update()

    expect((updater as any)._packageData.dependencies['test-dep']).toEqual('^1.0.0-beta.2')
  })

  it('should stop upgrading pre-releases at the next release', async () => {
    const source = plug.resolve('test', 'package-prerelease.json')

    const cache = new VersionsCache()
    ;(cache as any)._cache['test-dep'] = [ '1.1.0', '1.0.0', '0.9.0', '0.8.0', '0.7.0' ]
    ;(cache as any)._cache['test-dep+prerelease'] = [ '1.1.0-beta.3', '1.0.0-beta.2', '1.0.0-beta.1' ]

    const updater = new Updater(source, {
      bump: 'patch',
      debug: false,
      quick: false,
      strict: false,
      workspaces: false,
    }, cache)

    await updater.init()
    await updater.update()

    expect((updater as any)._packageData.dependencies['test-dep']).toEqual('^1.1.0')
  })
})
