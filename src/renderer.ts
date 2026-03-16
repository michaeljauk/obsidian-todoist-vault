import type { Section, Task } from '@doist/todoist-api-typescript'
import type { AnyProject } from './api'
import type { FrontmatterSettings } from './settings'

function formatDueDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const now = new Date()
  if (y === now.getFullYear()) return `${months[m - 1]} ${d}`
  return `${months[m - 1]} ${d}, ${y}`
}

function formatVisibleMeta(task: Task): string {
  const parts: string[] = []
  if (task.due?.date) parts.push(`\`📅 ${formatDueDate(task.due.date)}\``)
  if (task.due?.isRecurring && task.due.string) parts.push(`\`🔁 ${task.due.string}\``)
  if (task.priority === 4) parts.push('`🔴 p1`')
  else if (task.priority === 3) parts.push('`🟠 p2`')
  else if (task.priority === 2) parts.push('`🟡 p3`')
  for (const label of task.labels) parts.push(`\`🏷 ${label}\``)
  return parts.join(' ')
}

function formatTaskMeta(task: Task): string {
  const parts: string[] = [`id:${task.id}`]
  if (task.due?.date) parts.push(`due:${task.due.date}`)
  if (task.due?.isRecurring && task.due.string) parts.push(`recur:${task.due.string}`)
  if (task.priority && task.priority > 1) parts.push(`p${5 - task.priority}`)
  return `<!-- ${parts.join(' ')} -->`
}

function renderFrontmatter(
  project: AnyProject,
  syncedAt: string,
  fm: FrontmatterSettings,
): string {
  const lines: string[] = ['---']
  lines.push(`todoist_project_id: "${project.id}"`)
  lines.push(`todoist_synced_at: "${syncedAt}"`)
  if (fm.includeUrl) lines.push(`todoist_url: "${project.url}"`)
  if (fm.includeColor) lines.push(`todoist_color: "${project.color}"`)
  if (fm.includeTags) lines.push(`tags:\n  - todoist`)
  if (fm.includeIsFavorite) lines.push(`todoist_is_favorite: ${project.isFavorite}`)
  if (fm.includeIsShared) lines.push(`todoist_is_shared: ${project.isShared}`)
  if (fm.customFields.trim()) {
    lines.push(...fm.customFields.trim().split('\n'))
  }
  lines.push('---')
  return lines.join('\n')
}

function boldContent(content: string): string {
  // Escape leading/trailing * to avoid creating *** which breaks bold markdown
  let s = content
  if (s.startsWith('*')) s = `\\${s}`
  if (s.endsWith('*')) s = `${s.slice(0, -1)}\\*`
  return `**${s}**`
}

function formatTaskContent(task: Task, hasChildren: boolean, deepLinks: boolean): string {
  const label = hasChildren ? boldContent(task.content) : task.content
  return deepLinks ? `[${label}](${task.url})` : label
}

function renderTaskTree(
  taskId: string,
  childrenMap: Map<string, Task[]>,
  isCompleted: (t: Task) => boolean,
  indent: number,
  lines: string[],
  deepLinks: boolean,
  showVisibleMeta: boolean,
  showDescription: boolean,
): void {
  const children = childrenMap.get(taskId) ?? []
  for (const task of children) {
    const prefix = '  '.repeat(indent)
    const checkbox = isCompleted(task) ? '[x]' : '[ ]'
    const hasChildren = (childrenMap.get(task.id)?.length ?? 0) > 0
    const content = formatTaskContent(task, hasChildren, deepLinks)
    lines.push(`${prefix}- ${checkbox} ${content} ${formatTaskMeta(task)}`)
    const meta = showVisibleMeta ? formatVisibleMeta(task) : ''
    if (meta) lines.push(`${prefix}  ${meta}`)
    if (showDescription && task.description.trim()) {
      const descIndent = `${prefix}  `
      lines.push(`${descIndent}> [!desc]- Description`)
      for (const line of task.description.trim().split('\n')) {
        lines.push(line.trim() ? `${descIndent}> ${line}` : `${descIndent}>`)
      }
    }
    renderTaskTree(task.id, childrenMap, isCompleted, indent + 1, lines, deepLinks, showVisibleMeta, showDescription)
  }
}

function buildChildrenMap(allTasks: Task[]): Map<string, Task[]> {
  const ids = new Set(allTasks.map((t) => t.id))
  const childrenMap = new Map<string, Task[]>()
  for (const task of allTasks) {
    const parentId = task.parentId && ids.has(task.parentId) ? task.parentId : null
    if (parentId) {
      if (!childrenMap.has(parentId)) childrenMap.set(parentId, [])
      childrenMap.get(parentId)!.push(task)
    }
  }
  return childrenMap
}

function renderTaskList(
  rootTasks: Task[],
  allTasks: Task[],
  isCompleted: (t: Task) => boolean,
  deepLinks: boolean,
  showVisibleMeta: boolean,
  showDescription: boolean,
): string[] {
  const childrenMap = buildChildrenMap(allTasks)

  const lines: string[] = []
  for (let i = 0; i < rootTasks.length; i++) {
    const task = rootTasks[i]
    const checkbox = isCompleted(task) ? '[x]' : '[ ]'
    const hasChildren = (childrenMap.get(task.id)?.length ?? 0) > 0
    const content = formatTaskContent(task, hasChildren, deepLinks)
    lines.push(`- ${checkbox} ${content} ${formatTaskMeta(task)}`)
    const meta = showVisibleMeta ? formatVisibleMeta(task) : ''
    if (meta) lines.push(`  ${meta}`)
    if (showDescription && task.description.trim()) {
      lines.push(`  > [!desc]- Description`)
      for (const line of task.description.trim().split('\n')) {
        lines.push(line.trim() ? `  > ${line}` : `  >`)
      }
    }
    renderTaskTree(task.id, childrenMap, isCompleted, 1, lines, deepLinks, showVisibleMeta, showDescription)
    if (i < rootTasks.length - 1) lines.push('')
  }
  return lines
}

function escapeTableCell(value: string): string {
  return value.replace(/\|/g, '\\|').replace(/\n/g, ' ')
}

function renderTaskTableRows(
  tasks: Task[],
  childrenMap: Map<string, Task[]>,
  isCompleted: (t: Task) => boolean,
  showDescription: boolean,
  deepLinks: boolean,
  depth: number,
  rows: string[],
): void {
  for (const task of tasks) {
    const status = isCompleted(task) ? '✅' : '⬜'
    const indent = depth > 0 ? `${'  '.repeat(depth - 1)}↳ ` : ''
    const hasChildren = (childrenMap.get(task.id)?.length ?? 0) > 0
    const rawContent = formatTaskContent(task, hasChildren, deepLinks)
    const taskCell = escapeTableCell(`${indent}${rawContent}`)
    const dueCell = task.due?.date ? formatDueDate(task.due.date) : ''
    const priCell =
      task.priority === 4 ? '🔴 p1'
      : task.priority === 3 ? '🟠 p2'
      : task.priority === 2 ? '🟡 p3'
      : ''
    const labelsCell = escapeTableCell(task.labels.join(', '))
    const descCell = showDescription
      ? escapeTableCell((task.description.trim().split('\n\n')[0] ?? '').trim())
      : null

    if (descCell !== null) {
      rows.push(`| ${status} | ${taskCell} | ${dueCell} | ${priCell} | ${labelsCell} | ${descCell} |`)
    } else {
      rows.push(`| ${status} | ${taskCell} | ${dueCell} | ${priCell} | ${labelsCell} |`)
    }

    const children = childrenMap.get(task.id) ?? []
    if (children.length > 0) {
      renderTaskTableRows(children, childrenMap, isCompleted, showDescription, deepLinks, depth + 1, rows)
    }
  }
}

function renderTaskTable(
  rootTasks: Task[],
  allTasks: Task[],
  isCompleted: (t: Task) => boolean,
  showDescription: boolean,
  deepLinks: boolean,
): string[] {
  const childrenMap = buildChildrenMap(allTasks)

  const lines: string[] = []
  if (showDescription) {
    lines.push('| | Task | 📅 Due | Pri | 🏷 Labels | Description |')
    lines.push('|---|---|---|---|---|---|')
  } else {
    lines.push('| | Task | 📅 Due | Pri | 🏷 Labels |')
    lines.push('|---|---|---|---|---|')
  }

  const rows: string[] = []
  renderTaskTableRows(rootTasks, childrenMap, isCompleted, showDescription, deepLinks, 0, rows)
  lines.push(...rows)
  return lines
}

export function renderProject(
  project: AnyProject,
  sections: Section[],
  tasks: Task[],
  includeCompleted: boolean,
  syncedAt: string,
  fm: FrontmatterSettings,
  taskDeepLinks: boolean,
  showVisibleMeta: boolean,
  showDescription: boolean,
  taskLayout: 'list' | 'table',
): string {
  const lines: string[] = []

  // Frontmatter
  lines.push(renderFrontmatter(project, syncedAt, fm))
  lines.push('')

  // Title
  lines.push(`# ${project.name}`)
  lines.push('')

  const isCompleted = (t: Task) => t.completedAt !== null
  const displayTasks = includeCompleted ? tasks : tasks.filter((t) => !isCompleted(t))

  // Only top-level tasks (no parent, or parent is in a different project/not fetched)
  const taskIds = new Set(displayTasks.map((t) => t.id))
  const isRootTask = (t: Task) => !t.parentId || !taskIds.has(t.parentId)

  // Build section map (root tasks only — children are rendered recursively)
  const sectionMap = new Map<string | null, Task[]>()
  sectionMap.set(null, [])
  for (const section of sections) {
    sectionMap.set(section.id, [])
  }
  for (const task of displayTasks) {
    if (!isRootTask(task)) continue
    const key = task.sectionId ?? null
    if (!sectionMap.has(key)) sectionMap.set(key, [])
    sectionMap.get(key)!.push(task)
  }

  // Render named sections
  for (const section of sections) {
    const rootTasks = sectionMap.get(section.id) ?? []
    if (rootTasks.length === 0) continue

    if (taskLayout === 'table') {
      lines.push(`## ${section.name}`)
      lines.push('')
      lines.push(...renderTaskTable(rootTasks, displayTasks, isCompleted, showDescription, taskDeepLinks))
    } else {
      lines.push(`## ${section.name}`)
      lines.push('')
      lines.push(...renderTaskList(rootTasks, displayTasks, isCompleted, taskDeepLinks, showVisibleMeta, showDescription))
    }
    lines.push('')
  }

  // Render unsectioned tasks under ## Inbox
  const unsectioned = sectionMap.get(null) ?? []
  if (unsectioned.length > 0) {
    if (taskLayout === 'table') {
      lines.push('## Inbox')
      lines.push('')
      lines.push(...renderTaskTable(unsectioned, displayTasks, isCompleted, showDescription, taskDeepLinks))
    } else {
      lines.push('## Inbox')
      lines.push('')
      lines.push(...renderTaskList(unsectioned, displayTasks, isCompleted, taskDeepLinks, showVisibleMeta, showDescription))
    }
    lines.push('')
  }

  if (displayTasks.length === 0) {
    lines.push('_No tasks_')
    lines.push('')
  }

  return lines.join('\n')
}
