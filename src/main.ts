#!/usr/bin/env node

import * as yargs from 'yargs'

import { processPackages } from './updater'

type ReleaseType = 'major' | 'minor' | 'patch'

/* ========================================================================== *
 * CALL UP MAIN() AND DEAL WITH THE ASYNC PROMISE IT RETURNS                  *
 * ========================================================================== */

/* Parse command line arguments */
const parsed = yargs
    .usage('$0 [--options ...] [package.json ...]')
    .help('h').alias('h', 'help').alias('v', 'version')
    .option('s', {
      alias: 'strict',
      type: 'boolean',
      description: [
        'Strictly adhere to semver rules for tilde (~x.y.z)',
        'and caret (^x.y.z) dependency ranges',
      ].join('\n'),
    })
    .option('q', {
      alias: 'quick',
      type: 'boolean',
      description: [
        'Consider dev/peer/optional dependency updates if and',
        'only if the main depenencies also had updates',
      ].join('\n'),
    })
    .option('d', {
      alias: 'debug',
      type: 'boolean',
      description: 'Output debugging informations',
    })
    .option('n', {
      alias: 'no-errors',
      type: 'boolean',
      description: 'Exit with 0 (zero) in case of no updates',
    })
    .options('b', {
      alias: 'bump',
      coerce: ((bump): ReleaseType => bump == true ? 'patch' : bump),
      choices: [ 'major', 'minor', 'patch' ] as ReleaseType[],
      description: 'Bump the version of the package file on changes',
    })
    .options('x', {
      alias: 'dry-run',
      type: 'boolean',
      description: 'Only process changes without writing to disk',
    })
    .epilogue([
      'Multiple files (or globs) can be specified on the command line.\n',
      'When no files are specified, the default is to process the "package.json" file in the current directory',
    ].join('\n'))
    .strictOptions()
    .argv

Promise.resolve(parsed).then(({ b: bump, s: strict, q: quick, n: noerr, d: debug, x: dryrun, _: args = [] }) => {
  /* Normalize arguments and default to package.json in the current directory */
  const files = args.map((arg) => arg.toString())
  if (! files.length) files.push('package.json')

  /* Process packages, one by one */
  processPackages(files, { strict, quick, debug, dryrun, bump })
      .then((changes) => {
        process.exit(changes ? 0 : noerr ? 0 : -1)
      })
      .catch((error) => {
        console.error(error)
        process.exit(1)
      })
}).catch((error) => console.log(error))
