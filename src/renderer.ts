import type { Section, Task } from '@doist/todoist-api-typescript'
import type { AnyProject } from './api'
import type { CompletedMode, FrontmatterSettings } from './settings'

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
  fm: FrontmatterSettings,
  isArchive = false,
): string {
  const lines: string[] = ['---']
  lines.push(`todoist_project_id: "${project.id}"`)
  if (isArchive) lines.push('todoist_is_archive: true')
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

/**
 * Builds the task body lines for a given set of display tasks.
 * @param headingLevel - Markdown heading level for section names (default 2 → ##, use 3 for sub-sections)
 * @param emptyMessage - Text shown when displayTasks is empty
 */
function buildTaskLines(
  displayTasks: Task[],
  sections: Section[],
  deepLinks: boolean,
  showVisibleMeta: boolean,
  showDescription: boolean,
  emptyMessage = '_No tasks_',
  headingLevel = 2,
): string[] {
  const hPrefix = '#'.repeat(headingLevel) + ' '
  const isCompleted = (t: Task) => t.completedAt !== null
  const taskIds = new Set(displayTasks.map((t) => t.id))
  const isRootTask = (t: Task) => !t.parentId || !taskIds.has(t.parentId)

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

  const lines: string[] = []

  for (const section of sections) {
    const rootTasks = sectionMap.get(section.id) ?? []
    if (rootTasks.length === 0) continue
    lines.push(`${hPrefix}${section.name}`)
    lines.push('')
    lines.push(...renderTaskList(rootTasks, displayTasks, isCompleted, deepLinks, showVisibleMeta, showDescription))
    lines.push('')
  }

  const unsectioned = sectionMap.get(null) ?? []
  if (unsectioned.length > 0) {
    lines.push(`${hPrefix}Inbox`)
    lines.push('')
    lines.push(...renderTaskList(unsectioned, displayTasks, isCompleted, deepLinks, showVisibleMeta, showDescription))
    lines.push('')
  }

  if (displayTasks.length === 0) {
    lines.push(emptyMessage)
    lines.push('')
  }

  return lines
}

export interface RenderResult {
  projectContent: string
  archiveContent: string | null
}

export function renderProject(
  project: AnyProject,
  sections: Section[],
  tasks: Task[],
  completedMode: CompletedMode,
  fm: FrontmatterSettings,
  taskDeepLinks: boolean,
  showVisibleMeta: boolean,
  showDescription: boolean,
): RenderResult {
  const activeTasks = tasks.filter((t) => t.completedAt === null)
  const completedTasks = tasks.filter((t) => t.completedAt !== null)

  const header = [renderFrontmatter(project, fm), '', `# ${project.name}`, '']

  let projectLines: string[]
  let archiveContent: string | null = null

  if (completedMode === 'hide') {
    projectLines = buildTaskLines(activeTasks, sections, taskDeepLinks, showVisibleMeta, showDescription)
  } else if (completedMode === 'inline') {
    projectLines = buildTaskLines(tasks, sections, taskDeepLinks, showVisibleMeta, showDescription)
  } else if (completedMode === 'archive-section') {
    projectLines = buildTaskLines(activeTasks, sections, taskDeepLinks, showVisibleMeta, showDescription, '_No active tasks._')
    if (completedTasks.length > 0) {
      projectLines.push('## Completed')
      projectLines.push('')
      projectLines.push(
        ...buildTaskLines(completedTasks, sections, taskDeepLinks, showVisibleMeta, showDescription, '_No completed tasks._', 3),
      )
    }
  } else {
    // 'archive-file' | 'archive-folder'
    projectLines = buildTaskLines(activeTasks, sections, taskDeepLinks, showVisibleMeta, showDescription)
    archiveContent = buildArchiveContent(project, sections, completedTasks, fm, taskDeepLinks, showVisibleMeta, showDescription)
  }

  return {
    projectContent: [...header, ...projectLines].join('\n'),
    archiveContent,
  }
}

function buildArchiveContent(
  project: AnyProject,
  sections: Section[],
  completedTasks: Task[],
  fm: FrontmatterSettings,
  taskDeepLinks: boolean,
  showVisibleMeta: boolean,
  showDescription: boolean,
): string {
  const lines = [renderFrontmatter(project, fm, true), '', `# ${project.name}`, '']
  lines.push(...buildTaskLines(completedTasks, sections, taskDeepLinks, showVisibleMeta, showDescription, '_No completed tasks._'))
  return lines.join('\n')
}
