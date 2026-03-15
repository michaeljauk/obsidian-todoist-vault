import type { Project, Section, Task } from '@doist/todoist-api-typescript'

function formatTaskMeta(task: Task): string {
  const parts: string[] = [`id:${task.id}`]
  if (task.due?.date) parts.push(`due:${task.due.date}`)
  if (task.priority && task.priority > 1) parts.push(`p${5 - task.priority}`)
  return `<!-- ${parts.join(' ')} -->`
}

function renderTask(task: Task, isCompleted: boolean): string {
  const checkbox = isCompleted ? '[x]' : '[ ]'
  const meta = formatTaskMeta(task)
  return `- ${checkbox} ${task.content} ${meta}`
}

export function renderProject(
  project: Project,
  sections: Section[],
  tasks: Task[],
  includeCompleted: boolean,
  syncedAt: string
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

  const activeTasks = tasks.filter((t) => !t.isCompleted)
  const completedTasks = tasks.filter((t) => t.isCompleted)
  const displayTasks = includeCompleted ? tasks : activeTasks

  // Build section map
  const sectionMap = new Map<string | null, Task[]>()
  sectionMap.set(null, [])
  for (const section of sections) {
    sectionMap.set(section.id, [])
  }
  for (const task of displayTasks) {
    const key = task.sectionId ?? null
    if (!sectionMap.has(key)) sectionMap.set(key, [])
    sectionMap.get(key)!.push(task)
  }

  // Render named sections
  for (const section of sections) {
    const sectionTasks = sectionMap.get(section.id) ?? []
    if (sectionTasks.length === 0 && !includeCompleted) continue

    lines.push(`## ${section.name}`)
    lines.push('')
    for (const task of sectionTasks) {
      lines.push(renderTask(task, task.isCompleted))
    }
    lines.push('')
  }

  // Render unsectioned tasks under ## Inbox
  const unsectioned = sectionMap.get(null) ?? []
  if (unsectioned.length > 0) {
    lines.push('## Inbox')
    lines.push('')
    for (const task of unsectioned) {
      lines.push(renderTask(task, task.isCompleted))
    }
    lines.push('')
  }

  // If no tasks at all, show empty state
  if (displayTasks.length === 0) {
    lines.push('_No tasks_')
    lines.push('')
  }

  return lines.join('\n')
}
