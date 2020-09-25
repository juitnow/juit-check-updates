Dependencies Update Checker
===========================

This package contains a simple script to update the dependencies of a given
package file.

By default it will _extend_ the semantics of `semver` checking for _minor_
version updates for tilde ranges (`~x.y.z`) and checking for _major_ version
updates for caret ranges (`^x.y.z`)

When installed, the `check-updates` script can be invoked directly:

```
$ check-updates --help
check-updates [--options ...] [package.json ...]

Options:
check-updates [--options ...] [package.json ...]

Options:
  -h, --help     Show help                                             [boolean]
  -s, --strict   Strictly adhere to semver rules for tilde (~x.y.z)
                 and caret (^x.y.z) dependency ranges                  [boolean]
  -b, --bump     Bump the package's own (major, minor, patch, ...)
                 version on changes (assumes "patch" when specified)    [string]
  -d, --debug    Output debugging informations                         [boolean]
      --dry-run  Only process changes without writing to disk          [boolean]
  -v, --version  Show version number                                   [boolean]

A number of "package.json" files can be specified on the command line.

When no files are specified, the default is to process the "package.json" file
in the current directory
$
```

Options
-------

* `--strict`: When used, the tilde (`~x.y.z`) and caret  (`^x.y.z`) ranges will
  be processed _strictly_ according to `semver`
* `--bump [major, minor, patch, ...]`: When specified the version of the package
  will be bumped in case of changes. By default no bumping is performed, and
  when specified without an argument the `patch` version will be bumped
