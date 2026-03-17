import { App, TFile, normalizePath } from 'obsidian'
import { TodoistClient } from './api'
import { renderProject } from './renderer'
import { parseTaskStates } from './parser'
import type { TodoistVaultSettings } from './settings'

/**
 * IDs of tasks that were completed (completedAt !== null) at the end of the last sync.
 * Used to distinguish "user just checked this in Obsidian" from "Todoist reopened this
 * since the last sync and Obsidian's [x] is stale".
 */
export interface SyncState {
  completedTaskIds: string[]
}

export async function runSync(
  app: App,
  settings: TodoistVaultSettings,
  syncState: SyncState = { completedTaskIds: [] },
): Promise<SyncState> {
  if (!settings.apiToken) {
    console.warn('[TodoistVault] No API token configured — skipping sync')
    return syncState
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
    return syncState
  }

  // Apply project filter
  const filtered =
    settings.projectFilter.length > 0
      ? projects.filter((p) => settings.projectFilter.includes(p.name))
      : projects

  const newCompletedTaskIds: string[] = []
  const previouslyCompleted = new Set(syncState.completedTaskIds)

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
          const todoistOpen = task.completedAt === null
          const wasCompletedLastSync = previouslyCompleted.has(task.id)

          // Close: open in Todoist + checked locally + was open at last sync.
          // The `wasCompletedLastSync` guard ensures we don't re-close a task that
          // Todoist reopened since the last sync (Obsidian's [x] would be stale in that case).
          if (todoistOpen && localChecked === true && !wasCompletedLastSync) {
            try {
              await client.closeTask(task.id)
              // Reflect completion locally so renderer shows it as done
              ;(task as { completedAt: string | null }).completedAt = new Date().toISOString()
            } catch (err) {
              console.error(`[TodoistVault] Failed to close task ${task.id}:`, err)
            }
          }

          // Reopen: completed in Todoist + unchecked locally + was completed at last sync.
          // Only possible when includeCompleted is on (otherwise [x] tasks aren't in the file).
          // The `wasCompletedLastSync` guard ensures we don't reopen a task that was just
          // completed externally in Todoist before Obsidian had a chance to render it as [x].
          if (!todoistOpen && localChecked === false && wasCompletedLastSync && settings.includeCompleted) {
            try {
              await client.reopenTask(task.id)
              ;(task as { completedAt: string | null }).completedAt = null
            } catch (err) {
              console.error(`[TodoistVault] Failed to reopen task ${task.id}:`, err)
            }
          }
        }
      }

      // Record which tasks are completed after bidirectional sync (source of truth for next sync)
      for (const task of tasks) {
        if (task.completedAt !== null) {
          newCompletedTaskIds.push(task.id)
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

  return { completedTaskIds: newCompletedTaskIds }
}

function sanitizeFilename(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, '-').trim()
}
