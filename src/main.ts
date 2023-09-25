#!/usr/bin/env node

import { glob } from 'glob'
import yargsParser from 'yargs-parser'

import { B, G, K, R, X, Y, makeDebug } from './debug'
import { Updater } from './updater'
import { VersionsCache } from './versions'

import type { UpdaterOptions } from './updater'

type ReleaseType = undefined | 'major' | 'minor' | 'patch'
function releaseType(releaseType: unknown): ReleaseType {
  if (releaseType === undefined) return
  if (releaseType === '') return 'patch'
  if (releaseType === 'major') return 'major'
  if (releaseType === 'minor') return 'minor'
  if (releaseType === 'patch') return 'patch'
  console.log(`Invalid flag for --bump: "${releaseType}"`)
  process.exit(1)
}

/* ========================================================================== *
 * CALL UP MAIN() AND DEAL WITH THE ASYNC PROMISE IT RETURNS                  *
 * ========================================================================== */

function showHelp(): never {
  console.log(`
${Y}Usage${X}:

  ${G}check-updates${X} [--options ...] [package.json ...]

${Y}Options${X}:

  ${G}-h${X}, ${G}--help${X}           Show this help.

  ${G}-b${X}, ${G}--bump${X}           Bump the version of the  package file when changes in the
                       dependencies are found. Specifiy either "${B}major${X}",  "${B}minor${X}"
                       or "${B}patch${X}" ${K}(default)${X} to indicate which version to bump.

  ${G}-s${X}, ${G}--strict${X}         Strictly  adhere to semver  rules for  tilde ${K}(~x.y.z)${X} and
                       caret ${K}(^x.y.z)${X} dependency ranges.

  ${G}-q${X}, ${G}--quick${X}          Consider dev/peer/optional dependency updates if and only
                       if the main depenencies also had updates.

  ${G}-d${X}, ${G}--debug${X}          Output debugging informations.

  ${G}-x${X}, ${G}--dry-run${X}        Do not write package changes.

      ${G}--no-errors${X}      Exit with ${B}0${X} in case  of no updates.  Normally the updater
                       will exit with ${B}255${X} in this case.

      ${G}--no-workspaces${X}  Do not process workspaces.

      ${G}--no-align${X}       Do not align workspaces versions. By default all versions
                       will  be set to  the highest  one amongst  all workspaces
                       after bumping.

${Y}Remarks${X}:

  Options can be negated using the ${K}"${G}no${K}"${X} prefix. For example, to avoid processing
  workspaces,  either ${K}"${G}--workspaces=false${K}"${X} or ${K}"${G}--no-workspaces${K}"${X} define  the same
  behaviour.

  Multiple files (or globs) can be specified on the command line.  When no files
  are specified the default is to process the "package.json" file in the current
  directory
`)
  process.exit(1)
}

/* Parse command line arguments */
const { _: args, ...opts } = yargsParser(process.argv.slice(2), {
  configuration: {
    'camel-case-expansion': false,
    'strip-aliased': true,
    'strip-dashed': true,
  },
  alias: {
    'align': [ 'a' ],
    'bump': [ 'b' ],
    'debug': [ 'd' ],
    'dry-run': [ 'x' ],
    'help': [ 'h' ],
    'errors': [ 'n' ],
    'quick': [ 'q' ],
    'strict': [ 's' ],
    'workspaces': [ 'w' ],
  },
  string: [ 'bump' ],
  boolean: [
    'align',
    'debug',
    'dry-run',
    'help',
    'errors',
    'quick',
    'strict',
    'workspaces',
  ],
})

/* Preliminiary stuff before checking options */
makeDebug(opts.debug)('Options:', { args, ...opts })
if (opts.help) showHelp()

/* Defaults */
let align = true
let dryRun = false
let errors = true
const options: UpdaterOptions = {
  bump: undefined,
  debug: false,
  quick: false,
  strict: false,
  workspaces: true,
}

/* Process each option, one by one */
for (const [ key, value ] of Object.entries(opts)) {
  switch (key) {
    case 'align': align = !! value; break
    case 'bump': options.bump = releaseType(value); break
    case 'debug': options.debug = !! value; break
    case 'dry-run': dryRun = !! value; break
    case 'errors': errors = !! value; break
    case 'quick': options.quick = !! value; break
    case 'strict': options.strict = !! value; break
    case 'workspaces': options.workspaces = !! value; break
    default:
      console.log(`${R}[ERROR]${X} Unsupported / unknown option: --${key}\n`)
      showHelp()
  }
}

/* Normalize arguments and default to package.json in the current directory */
const patterns = args.map((arg) => arg.toString())
if (! patterns.length) patterns.push('package.json')

/* Process packages, one by one */
try {
  const files = await glob.glob(patterns)
  const cache = new VersionsCache()

  let changed = false
  for (const file of files) {
    const updater = await new Updater(file, options, cache).init()
    await updater.update()
    if (align) await updater.align()
    if (! dryRun) await updater.write()
    changed ||= updater.changed
  }

  process.exitCode = changed ? 0 : errors ? -1 : 0
} catch (error) {
  console.error(error)
  process.exitCode = 1
}
