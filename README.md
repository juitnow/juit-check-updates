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
  -h, --help     Show help                                             [boolean]
  -s, --strict   Strictly adhere to semver rules for tilde (~x.y.z)
                 and caret (^x.y.z) dependency ranges                  [boolean]
  -d, --debug    Output debugging informations                         [boolean]
  -b, --bump     Bump the version of the package file on changes
                                            [choices: "major", "minor", "patch"]
      --dryrun   Only process changes without writing to disk          [boolean]
  -v, --version  Show version number                                   [boolean]

Multiple files (or globs) can be specified on the command line.

When no files are specified, the default is to process the "package.json" file
in the current directory
$
```
