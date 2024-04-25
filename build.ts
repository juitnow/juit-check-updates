import { log, plugjs, tasks } from '@plugjs/build'

export default plugjs({
  ...tasks({
    minimumCoverage: 70,
    minimumFileCoverage: 60,
  }),

  async test_cjs(): Promise<void> {
    log.warn('Skipping test in CJS mode')
  },
})
