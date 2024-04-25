import * as plug from '@plugjs/build'
import * as semver from 'semver'


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

      await plug.exec('tsrun', scriptFile, '--dry-run', { cwd: tempdir })

      const original = plug.parseJson(source)
      const modified = plug.parseJson(target)

      expect(modified).toEqual(original)
    } finally {
      await plug.rmrf(tempdir)
    }
  })
})
