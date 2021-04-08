import upgradePackages from './index'

import { ReleaseType } from 'semver'
import yargs from 'yargs'

/* ========================================================================== *
 * CALL UP MAIN() AND DEAL WITH THE ASYNC PROMISE IT RETURNS                  *
 * ========================================================================== */

/* Parse command line arguments */
const { bump, strict, debug, dryrun, _: args = [] } = yargs
  .usage('$0 [--options ...] [package.json ...]')
  .help('h').alias('h', 'help').alias('v', 'version')
  .option('strict', {
    alias: 's',
    type: 'boolean',
    description: [
      'Strictly adhere to semver rules for tilde (~x.y.z)',
      'and caret (^x.y.z) dependency ranges',
    ].join('\n'),
  })
  .option('debug', {
    alias: 'd',
    type: 'boolean',
    description: 'Output debugging informations',
  })
  .options('bump', {
    alias: 'b',
    coerce: ((bump): ReleaseType => bump == true ? 'patch' : bump),
    choices: [ 'major', 'minor', 'patch' ] as ReleaseType[],
    description: 'Bump the version of the package file on changes',
  })
  .options('dryrun', {
    type: 'boolean',
    description: 'Only process changes without writing to disk',
  })
  .epilogue([
    'Multiple files (or globs) can be specified on the command line.\n',
    'When no files are specified, the default is to process the "package.json" file in the current directory',
  ].join('\n'))
  .strict()
  .argv

/* Normalize arguments and default to package.json in the current directory */
const files = args.map((arg) => arg.toString())
if (! files.length) files.push('package.json')

/* Process packages, one by one */
upgradePackages(files, { strict, debug, dryrun, bump }).catch((error) => {
  console.error(error)
  process.exit(1)
})
