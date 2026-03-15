import { App, TFile, normalizePath } from 'obsidian'
import type { Project } from '@doist/todoist-api-typescript'
import { TodoistClient } from './api'
import { renderProject } from './renderer'
import { parseTaskStates } from './parser'
import type { TodoistVaultSettings } from './settings'

export async function runSync(app: App, settings: TodoistVaultSettings): Promise<void> {
  if (!settings.apiToken) {
    console.warn('[TodoistVault] No API token configured — skipping sync')
    return
  }

  const client = new TodoistClient(settings.apiToken)
  const syncedAt = new Date().toISOString()

  // Ensure sync folder exists
  const folderPath = normalizePath(settings.syncFolder)
  if (!app.vault.getFolderByPath(folderPath)) {
    await app.vault.createFolder(folderPath)
  }

  let projects: Project[]
  try {
    projects = await client.getProjects()
  } catch (err) {
    console.error('[TodoistVault] Failed to fetch projects:', err)
    return
  }

  // Apply project filter
  const filtered =
    settings.projectFilter.length > 0
      ? projects.filter((p) => settings.projectFilter.includes(p.name))
      : projects

  for (const project of filtered) {
    try {
      const [sections, tasks] = await Promise.all([
        client.getSections(project.id),
        client.getTasks(project.id),
      ])

      const filePath = normalizePath(`${folderPath}/${sanitizeFilename(project.name)}.md`)
      const existingFile = app.vault.getFileByPath(filePath)

      // Bidirectional sync: detect locally-checked tasks → close in Todoist
      if (existingFile instanceof TFile) {
        const existingContent = await app.vault.read(existingFile)
        const localStates = parseTaskStates(existingContent)

        for (const task of tasks) {
          if (task.isCompleted) continue // already done in Todoist
          const localChecked = localStates.get(task.id)
          if (localChecked === true) {
            try {
              await client.closeTask(task.id)
              task.isCompleted = true // reflect in render
            } catch (err) {
              console.error(`[TodoistVault] Failed to close task ${task.id}:`, err)
            }
          }
        }
      }

      const content = renderProject(project, sections, tasks, settings.includeCompleted, syncedAt)

      if (existingFile instanceof TFile) {
        await app.vault.modify(existingFile, content)
      } else {
        await app.vault.create(filePath, content)
      }
    } catch (err) {
      console.error(`[TodoistVault] Error syncing project "${project.name}":`, err)
    }
  }
}

function sanitizeFilename(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, '-').trim()
}
