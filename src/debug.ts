/** Our colors */
export const X = '\u001b[0m'
export const R = '\u001b[38;5;203m'
export const G = '\u001b[38;5;76m'
export const Y = '\u001b[38;5;220m'
export const B = '\u001b[38;5;69m'
export const K = '\u001b[38;5;240m'

/* Create our debug function */
export function makeDebug(debug?: boolean): (...args: any[]) => void {
  return debug ?
    (...args: any[]) => void (args.length && console.log(`${K}[DEBUG]${X}`, ...args)) :
    () => void 0
}
