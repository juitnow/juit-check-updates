Dependencies Update Checker
===========================

This package contains a simple script to update the dependencies of a given
package file.

By default it will _extend_ the semantics of `semver` checking for _minor_
version updates for tilde ranges (`~x.y.z`) and checking for _major_ version
updates for caret ranges (`^x.y.z`).

To adhere to the standard `semver` rules simply specify the `--strict` option.

When installed, the `check-updates` script can be invoked directly:

```
$ check-updates --help

Usage:

  check-updates [--options ...] [package.json ...]

Options:

  -h, --help           Show this help

  -s, --strict         Strictly  adhere to semver  rules for  tilde (~x.y.z) and
                       caret (^x.y.z) dependency ranges         [default: false]

  -q, --quick          Consider dev/peer/optional dependency updates if and only
                       if the main depenencies also had updates [default: false]

  -d, --debug          Output debugging informations            [default: false]

  -n, --errors         Exit with 255 (-1) in case of no updates  [default: true]

  -w, --workspaces     Process package workspaces                [default: true]

  -a, --align          Align workspaces versions by setting all packages version
                       to the greatest found after updates      [default: false]

  -b, --bump           Bump the version of the  package file when changes in the
                       dependencies are found [one of "major", "minor", "patch"]

  -x, --dry-run        Do not write package changes             [default: false]

Remarks:

  Options can be negated using the "no" prefix. For example, to avoid processing
  workspaces,  either "--workspaces=false" or "--no-workspaces" define  the same
  behaviour.

  Multiple files (or globs) can be specified on the command line.  When no files
  are specified the default is to process the "package.json" file in the current
  directory

$
```

Alternatively it can be invoked via `npx '@juit/check-updates'`.

By default (unless `--no-errors` is specified) the exit code returned to the
caller will be:

* `0`: dependencies were updated and `package.json` was changed.
* `255`: nothing was updated, no changes.
* _any other_: error from NodeJS.

Legal
-----

* [Copyright Notice](NOTICE.md)
* [License](LICENSE.md)
