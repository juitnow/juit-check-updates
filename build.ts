import { build, find, tasks, bundleLocals, banner } from '@plugjs/build'

export default build({
  ...tasks({
    'cjsTranspile': false,
  }),

  async bundle(): Promise<void> {
    banner('Bundling output')

    await find('dist/main.mjs')
        .esbuild({
          bundle: true,
          format: 'esm',
          outfile: 'check-updates.js',
          platform: 'node',
          sourcemap: false,
          minify: false,
          plugins: [ bundleLocals() ],
        })
  },

  async all(): Promise<void> {
    await this.transpile()
    await this.lint()
    await this.bundle()
  },
})
