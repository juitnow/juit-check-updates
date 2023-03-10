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
check-updates [--options ...] [package.json ...]

Options:
  -h, --help       Show help                                           [boolean]
  -s, --strict     Strictly adhere to semver rules for tilde (~x.y.z)
                   and caret (^x.y.z) dependency ranges                [boolean]
  -q, --quick      Consider dev/peer/optional dependency updates if and
                   only if the main depenencies also had updates       [boolean]
  -d, --debug      Output debugging informations                       [boolean]
  -n, --no-errors  Exit with 0 (zero) in case of no updates            [boolean]
  -b, --bump       Bump the version of the package file on changes
                                            [choices: "major", "minor", "patch"]
  -x, --dry-run    Only process changes without writing to disk        [boolean]
  -v, --version    Show version number                                 [boolean]

Multiple files (or globs) can be specified on the command line.

When no files are specified, the default is to process the "package.json" file
in the current directory
$
```

Alternatively it can be invoked via `npx '@juit/check-updates'`.

The exit code returned to the caller will be:

* `0`: dependencies were updated and `package.json` was changed.
* `255`: nothing was updated, no changes.
* _any other_: error from NodeJS.

Legal
-----

* [Copyright Notice](NOTICE.md)
* [License](LICENSE.md)
