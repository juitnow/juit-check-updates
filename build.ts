import { plugjs, tasks } from '@plugjs/build'

export default plugjs({
  ...tasks(),

  async all(): Promise<void> {
    await this.transpile()
    await this.lint()
  },
})
