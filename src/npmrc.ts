import { promises as fs } from 'fs'
import { parse } from 'ini'
import path from 'path'

function replaceEnvironmentVariable(token: string) {
  return token.replace(/^\$\{?([^}]*)\}?$/, (match, ...vars: any[]) => {
    return process.env[vars[0]] || ''
  })
}

async function readFile(filename: string): Promise<Record<string, any>> {
  try {
    const data = await fs.readFile(filename, 'utf8')
    const npmrc = parse(data)

    for (const key in npmrc) {
      if (typeof npmrc[key] === 'string') {
        npmrc[key] = replaceEnvironmentVariable(npmrc[key])
      }
    }

    return npmrc
  } catch (error) {
    if (error.code === 'ENOENT') return {}
    throw error
  }
}

export async function readNpmRc(packageJsonFile: string): Promise<Record<string, any>> {
  const local = readFile(path.resolve(packageJsonFile, '..', '.npmrc'))
  const user = readFile(
    process.env.NPM_CONFIG_USERCONFIG ?
      process.env.NPM_CONFIG_USERCONFIG :
      process.env.HOME ? path.resolve(process.env.HOME, '.npmrc') : '' )
  const global = readFile(
    process.env.NPM_CONFIG_GLOBALCONFIG ?
      process.env.NPM_CONFIG_GLOBALCONFIG :
      '/etc/npmrc')
  return Object.assign({}, ...await Promise.all([ global, user, local ]))
}
