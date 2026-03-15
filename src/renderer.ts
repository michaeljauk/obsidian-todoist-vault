import type { Section, Task } from '@doist/todoist-api-typescript'
import type { AnyProject } from './api'

function formatTaskMeta(task: Task): string {
  const parts: string[] = [`id:${task.id}`]
  if (task.due?.date) parts.push(`due:${task.due.date}`)
  if (task.priority && task.priority > 1) parts.push(`p${5 - task.priority}`)
  return `<!-- ${parts.join(' ')} -->`
}

function renderTaskTree(
  taskId: string,
  childrenMap: Map<string, Task[]>,
  isCompleted: (t: Task) => boolean,
  indent: number,
  lines: string[],
): void {
  const children = childrenMap.get(taskId) ?? []
  for (const task of children) {
    const prefix = '  '.repeat(indent)
    const checkbox = isCompleted(task) ? '[x]' : '[ ]'
    lines.push(`${prefix}- ${checkbox} ${task.content} ${formatTaskMeta(task)}`)
    renderTaskTree(task.id, childrenMap, isCompleted, indent + 1, lines)
  }
}

function renderTaskList(
  rootTasks: Task[],
  allTasks: Task[],
  isCompleted: (t: Task) => boolean,
): string[] {
  // Build map: parentId → children (only within this section's task set)
  const ids = new Set(allTasks.map((t) => t.id))
  const childrenMap = new Map<string, Task[]>()
  for (const task of allTasks) {
    const parentId = task.parentId && ids.has(task.parentId) ? task.parentId : null
    if (parentId) {
      if (!childrenMap.has(parentId)) childrenMap.set(parentId, [])
      childrenMap.get(parentId)!.push(task)
    }
  }

  const lines: string[] = []
  for (const task of rootTasks) {
    const checkbox = isCompleted(task) ? '[x]' : '[ ]'
    lines.push(`- ${checkbox} ${task.content} ${formatTaskMeta(task)}`)
    renderTaskTree(task.id, childrenMap, isCompleted, 1, lines)
  }
  return lines
}

export function renderProject(
  project: AnyProject,
  sections: Section[],
  tasks: Task[],
  includeCompleted: boolean,
  syncedAt: string,
): string {
  const lines: string[] = []

  // Frontmatter
  lines.push('---')
  lines.push(`todoist_project_id: "${project.id}"`)
  lines.push(`todoist_synced_at: "${syncedAt}"`)
  lines.push('---')
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

    lines.push(`## ${section.name}`)
    lines.push('')
    lines.push(...renderTaskList(rootTasks, displayTasks, isCompleted))
    lines.push('')
  }

  // Render unsectioned tasks under ## Inbox
  const unsectioned = sectionMap.get(null) ?? []
  if (unsectioned.length > 0) {
    lines.push('## Inbox')
    lines.push('')
    lines.push(...renderTaskList(unsectioned, displayTasks, isCompleted))
    lines.push('')
  }

  if (displayTasks.length === 0) {
    lines.push('_No tasks_')
    lines.push('')
  }

  return lines.join('\n')
}
