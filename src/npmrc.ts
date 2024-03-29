import fs from 'node:fs/promises'
import path from 'node:path'

import { parse } from 'ini'

function replaceEnvironmentVariable(token: string): string {
  return token.replace(/^\$\{?([^}]*)\}?$/, (_match, ...vars: any[]) => {
    return process.env[vars[0]] || ''
  })
}

async function readIniFile(filename: string): Promise<Record<string, any>> {
  try {
    const data = await fs.readFile(filename, 'utf8')
    const npmrc = parse(data)

    for (const key in npmrc) {
      if (typeof npmrc[key] === 'string') {
        npmrc[key] = replaceEnvironmentVariable(npmrc[key])
      }
    }

    return npmrc
  } catch (error: any) {
    if (error.code === 'ENOENT') return {}
    throw error
  }
}

export async function readNpmRc(packageJsonFile: string): Promise<Record<string, any>> {
  const local = readIniFile(path.resolve(packageJsonFile, '..', '.npmrc'))
  const user = readIniFile(
    process.env.NPM_CONFIG_USERCONFIG ?
      process.env.NPM_CONFIG_USERCONFIG :
      process.env.HOME ? path.resolve(process.env.HOME, '.npmrc') : '' )
  const global = readIniFile(
    process.env.NPM_CONFIG_GLOBALCONFIG ?
      process.env.NPM_CONFIG_GLOBALCONFIG :
      '/etc/npmrc')
  return Object.assign({}, ...await Promise.all([ global, user, local ]))
}
