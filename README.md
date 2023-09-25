Dependencies Update Checker
===========================

This package contains a simple script to update the dependencies of a given
package file (or files).

By default it will _extend_ the semantics of `semver` checking for _minor_
version updates for tilde ranges (`~x.y.z`) and checking for _major_ version
updates for caret ranges (`^x.y.z`).

To adhere to the standard `semver` rules simply specify the `--strict` option.

When installed, the `check-updates` script can be invoked directly:

```console
$ check-updates --help

Usage:
  check-updates [--options ...] [package.json ...]

Options:
  -h, --help           Show this help.

  -v, --version        Show the version and exit.

  -b, --bump           Bump the version of the  package file when changes in the
                       dependencies are found. Specifiy either "major",  "minor"
                       or "patch" (default) to indicate which version to bump.

  -s, --strict         Strictly  adhere to semver  rules for  tilde (~x.y.z) and
                       caret (^x.y.z) dependency ranges.

  -q, --quick          Consider dev/peer/optional dependency updates if and only
                       if the main depenencies also had updates.

  -d, --debug          Output debugging informations.

  -x, --dry-run        Do not write package changes.

      --no-errors      Exit with 0 in case  of no updates.  Normally the updater
                       will exit with 255 in this case.

      --no-workspaces  Do not process workspaces.

      --no-align       Do not align workspaces versions. By default all versions
                       will  be set to  the highest  one amongst  all workspaces
                       after bumping.

Remarks:
  Multiple package.json files can be  specified on the command line.  In case no
  files are specified,  the default is to process  the package.json  file in the
  current directory.

$
```

Alternatively it can be invoked via `npx '@juit/check-updates'`.

By default (unless `--no-errors` is specified) the exit code returned to the
caller will be:

* `0`: dependencies were updated and `package.json` was changed.
* `255`: nothing was updated, no changes.
* _any other_: error from NodeJS.


Options
-------

#### `--bump` (or `-b`)

Bump the `major`, `minor` or `patch` revision level if changes were detected.

By default no versions will be bumped, and when the `--bump` version is
specified without any argument, the `patch` version will be bumped.

#### `--strict` (or `-s`)

By default, version ranges specified by `~` (tilde: match on patch version) or
`^` (caret: match patch or minor versions) will be _extended_ so that `~` will
behave like `^` and match both patch _and_ minor versions, while `^` will match
any version _above_ the one specified.

The `--strict` flag makes the updater work with the strict definition of `~` or
`^` ranges. See [here](https://nodesource.com/blog/semver-tilde-and-caret/) for
more informations on range specifiers.

#### `--quick` (or `-q`)

By specifying the `--quick` flags, the updater will process the main
`dependencies` _first_ and only if any changes were detected then the other
dependencies in `devDependencies`, `peerDependencies` and `optionalDependencies`
will be processed.

#### `--dry-run` (or `-x`)

Only process and display changes _without_ writing the updated `package.json`
files.

#### `--debug` (or `-d`)

Dump out lots of debugging informations while updating packages.

#### `--no-errors`

By default the updater will _exit_ with `255` if _no changes_ were detected in
the dependencies. Specifying `--no-errors` will make the updater exit with `0`
unless a real error happened.

The `255` exit code is useful in scripts to detect whether changes were not
detected. For example the following script will exit with zero if no changes
were detected, will fail if an error occurred, and will perform some tasks if
changes were detected:

```bash
#!/bin/bash

set -e # exit on errors
npx '@juit/check-updates' --quick --bump || exit $(( $? == 255 ? 0 : $? ))
# ... do stuff when changes were detected
```

#### `--no-workspaces`

By default the updater will _recursively_ process workspaces defined in the
various _package.json_ files. The `--no-workspaces` flag disables this.

#### `--no-align`

By default, when workspaces are present, versions will be aligned to the
greates versions amongst all workspaces after (if specified) bumping. When
`--no-align` is specified,



Legal
-----

* [Copyright Notice](NOTICE.md)
* [License](LICENSE.md)
