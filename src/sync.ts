import { App, TFile, normalizePath } from 'obsidian'
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

  // Ensure sync folder exists
  const folderPath = normalizePath(settings.syncFolder)
  if (!app.vault.getFolderByPath(folderPath)) {
    await app.vault.createFolder(folderPath)
  }

  let projects
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

      const filename = `${settings.filePrefix}${sanitizeFilename(project.name)}${settings.fileSuffix}.md`
      const filePath = normalizePath(`${folderPath}/${filename}`)
      // If prefix/suffix changed, find the old file by todoist_project_id in frontmatter
      let existingFile = app.vault.getFileByPath(filePath)
      if (!existingFile) {
        const folder = app.vault.getFolderByPath(folderPath)
        if (folder) {
          for (const child of folder.children) {
            if (!(child instanceof TFile) || child.path === filePath) continue
            const cache = app.metadataCache.getFileCache(child)
            if (cache?.frontmatter?.['todoist_project_id'] === project.id) {
              await app.fileManager.renameFile(child, filePath)
              existingFile = app.vault.getFileByPath(filePath)
              break
            }
          }
        }
      }

      // Bidirectional sync: detect locally-checked/unchecked tasks → close/reopen in Todoist
      if (settings.bidirectionalSync && existingFile instanceof TFile) {
        const existingContent = await app.vault.read(existingFile)
        const localStates = parseTaskStates(existingContent)

        for (const task of tasks) {
          const localChecked = localStates.get(task.id)

          // Close: open in Todoist + checked locally
          if (task.completedAt === null && localChecked === true) {
            try {
              await client.closeTask(task.id)
              // Reflect completion locally so renderer shows it as done
              ;(task as { completedAt: string | null }).completedAt = new Date().toISOString()
            } catch (err) {
              console.error(`[TodoistVault] Failed to close task ${task.id}:`, err)
            }
          }

          // Reopen: completed in Todoist + unchecked locally
          // Only possible when includeCompleted is on (otherwise [x] tasks aren't in the file)
          if (task.completedAt !== null && localChecked === false && settings.includeCompleted) {
            try {
              await client.reopenTask(task.id)
              ;(task as { completedAt: string | null }).completedAt = null
            } catch (err) {
              console.error(`[TodoistVault] Failed to reopen task ${task.id}:`, err)
            }
          }
        }
      }

      const content = renderProject(
        project,
        sections,
        tasks,
        settings.includeCompleted,
        settings.frontmatter,
        settings.taskDeepLinks,
        settings.showVisibleMeta,
        settings.showDescription,
      )

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
