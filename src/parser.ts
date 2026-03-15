/**
 * Parses an existing task file to extract checkbox state per task id.
 * Returns a Map<taskId, isChecked>.
 */
export function parseTaskStates(content: string): Map<string, boolean> {
  const result = new Map<string, boolean>()

  // Match lines like:   - [ ] Task content <!-- id:abc123 ... -->  (any indent)
  const lineRe = /^\s*- \[([ xX])\] .+<!-- id:(\S+)/gm
  let match: RegExpExecArray | null

  while ((match = lineRe.exec(content)) !== null) {
    const checked = match[1] !== ' '
    const id = match[2].replace(/\s.*$/, '') // strip anything after whitespace in id
    result.set(id, checked)
  }

  return result
}
