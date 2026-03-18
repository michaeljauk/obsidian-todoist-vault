/**
 * Parses an existing task file to extract checkbox state per task id.
 * Returns a Map<taskId, isChecked>.
 */
export function parseTaskStates(content: string): Map<string, boolean> {
  const result = new Map<string, boolean>()

  // Match lines like:   - [ ] Task content <!-- id:abc123 ... -->  (any indent)
  // [^\s>]+ stops at whitespace or '>' so id:abc123--> (no space) won't capture the '-->'
  const lineRe = /^\s*- \[([ xX])\] .+<!-- id:([^\s>]+)/gm
  let match: RegExpExecArray | null

  while ((match = lineRe.exec(content)) !== null) {
    const checked = match[1] !== ' '
    result.set(match[2], checked)
  }

  return result
}
