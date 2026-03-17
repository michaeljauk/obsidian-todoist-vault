import { App, TFile, TFolder, normalizePath } from 'obsidian'
import type { Task } from '@doist/todoist-api-typescript'
import { TodoistClient } from './api'
import { renderProject } from './renderer'
import { parseTaskStates } from './parser'
import type { TodoistVaultSettings } from './settings'

/**
 * Persisted across syncs. Tracks bidirectional state and the incremental completed-task cache.
 *
 * - `completedTaskIds`: IDs completed at end of last sync — used to detect user-driven checkbox changes.
 * - `lastCompletedFetchAt`: ISO timestamp of last completed-task fetch — used in incremental mode.
 * - `completedTasksCache`: per-project accumulated completed tasks — used in incremental mode so the
 *   archive stays complete even though each sync only fetches the delta.
 */
export interface SyncState {
  completedTaskIds: string[]
  lastCompletedFetchAt: string | null
  completedTasksCache: Record<string, Task[]>
}

export async function runSync(
  app: App,
  settings: TodoistVaultSettings,
  syncState: SyncState = { completedTaskIds: [], lastCompletedFetchAt: null, completedTasksCache: {} },
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

  // Ensure archive subfolder exists for 'archive-folder' mode
  if (settings.completedMode === 'archive-folder') {
    const archiveFolderPath = normalizePath(`${folderPath}/${settings.archiveFolder}`)
    if (!app.vault.getFolderByPath(archiveFolderPath)) {
      await app.vault.createFolder(archiveFolderPath)
    }
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
  const writtenPaths = new Set<string>()
  // Strip milliseconds — some API endpoints reject ISO dates with sub-second precision
  const now = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')
  // Seed with existing cache so projects not in this sync run don't lose their history
  const newCompletedTasksCache: Record<string, Task[]> = { ...(syncState.completedTasksCache ?? {}) }

  for (const project of filtered) {
    try {
      const fetchCompleted = settings.completedMode !== 'hide'
      const [sections, activeTasks] = await Promise.all([
        client.getSections(project.id),
        client.getTasks(project.id),
      ])

      let completedTasks: Task[] = []
      if (fetchCompleted) {
        try {
          if (settings.completedFetchMode === 'all') {
            completedTasks = await client.getCompletedTasks(project.id, '2007-01-01T00:00:00Z', now)
          } else if (settings.completedFetchMode === 'lookback') {
            const since = new Date(Date.now() - settings.completedLookbackDays * 86_400_000).toISOString().replace(/\.\d{3}Z$/, 'Z')
            completedTasks = await client.getCompletedTasks(project.id, since, now)
          } else {
            // incremental: fetch delta since last sync, merge with cached tasks
            const since =
              syncState.lastCompletedFetchAt ??
              new Date(Date.now() - settings.completedLookbackDays * 86_400_000).toISOString().replace(/\.\d{3}Z$/, 'Z')
            const delta = await client.getCompletedTasks(project.id, since, now)
            const cached = syncState.completedTasksCache[project.id] ?? []
            const taskMap = new Map(cached.map((t) => [t.id, t]))
            for (const t of delta) taskMap.set(t.id, t)
            completedTasks = [...taskMap.values()]
            newCompletedTasksCache[project.id] = completedTasks
          }
        } catch (err) {
          const status = (err as { httpStatusCode?: number }).httpStatusCode
          const body = (err as { responseData?: unknown }).responseData
          console.warn(
            `[TodoistVault] Failed to fetch completed tasks for "${project.name}" (HTTP ${status ?? '?'}) — syncing active tasks only.`,
            body ? `API response: ${JSON.stringify(body)}` : '(empty response body)',
          )
        }
      }

      const tasks = [...activeTasks, ...completedTasks]

      const filename = `${settings.filePrefix}${sanitizeFilename(project.name)}${settings.fileSuffix}.md`
      const filePath = normalizePath(`${folderPath}/${filename}`)
      // If prefix/suffix changed, find the old file by todoist_project_id in frontmatter
      let existingFile = app.vault.getFileByPath(filePath)
      if (!existingFile) {
        existingFile = await findAndMoveFileByProjectId(app, folderPath, project.id, filePath)
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
          // Only possible when completed tasks are visible (otherwise [x] tasks aren't in the file).
          // The `wasCompletedLastSync` guard ensures we don't reopen a task that was just
          // completed externally in Todoist before Obsidian had a chance to render it as [x].
          if (!todoistOpen && localChecked === false && wasCompletedLastSync && settings.completedMode !== 'hide') {
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

      const result = renderProject(
        project,
        sections,
        tasks,
        settings.completedMode,
        settings.frontmatter,
        settings.taskDeepLinks,
        settings.showVisibleMeta,
        settings.showDescription,
      )

      if (existingFile instanceof TFile) {
        await app.vault.modify(existingFile, result.projectContent)
      } else {
        await app.vault.create(filePath, result.projectContent)
      }
      writtenPaths.add(filePath)

      // Write archive file for 'archive-file' and 'archive-folder' modes
      if (result.archiveContent !== null) {
        const archivePath = getArchivePath(folderPath, project.name, settings)
        let archiveFile = app.vault.getFileByPath(archivePath)
        if (!archiveFile) {
          const archiveScanFolder =
            settings.completedMode === 'archive-folder'
              ? normalizePath(`${folderPath}/${settings.archiveFolder}`)
              : folderPath
          archiveFile = await findAndMoveFileByProjectId(app, archiveScanFolder, project.id, archivePath, filePath)
        }
        if (archiveFile instanceof TFile) {
          await app.vault.modify(archiveFile, result.archiveContent)
        } else {
          await app.vault.create(archivePath, result.archiveContent)
        }
        writtenPaths.add(archivePath)
      }
    } catch (err) {
      console.error(`[TodoistVault] Error syncing project "${project.name}":`, err)
    }
  }

  await cleanupOrphanedArchiveFiles(app, folderPath, writtenPaths)

  return {
    completedTaskIds: newCompletedTaskIds,
    lastCompletedFetchAt: settings.completedMode !== 'hide' && settings.completedFetchMode === 'incremental' ? now : null,
    // Clear cache when not in incremental mode so stale data doesn't accumulate in data.json
    completedTasksCache: settings.completedFetchMode === 'incremental' ? newCompletedTasksCache : {},
  }
}

function getArchivePath(
  folderPath: string,
  projectName: string,
  settings: TodoistVaultSettings,
): string {
  const base = sanitizeFilename(projectName)
  if (settings.completedMode === 'archive-file') {
    return normalizePath(`${folderPath}/${settings.filePrefix}${base}${settings.archiveFileSuffix}.md`)
  }
  // 'archive-folder'
  return normalizePath(`${folderPath}/${settings.archiveFolder}/${settings.filePrefix}${base}${settings.fileSuffix}.md`)
}

/**
 * Scans a folder for a file whose todoist_project_id frontmatter matches projectId,
 * renames it to targetPath, and returns it. Returns null if no match found.
 * @param excludePath - Optional path to skip (e.g. the main project file when scanning for archive)
 */
async function findAndMoveFileByProjectId(
  app: App,
  scanFolderPath: string,
  projectId: string,
  targetPath: string,
  excludePath?: string,
): Promise<TFile | null> {
  const folder = app.vault.getFolderByPath(scanFolderPath)
  if (!folder) return null
  for (const child of folder.children) {
    if (!(child instanceof TFile)) continue
    if (child.path === targetPath) continue
    if (excludePath && child.path === excludePath) continue
    const cache = app.metadataCache.getFileCache(child)
    if (cache?.frontmatter?.['todoist_project_id'] === projectId) {
      await app.fileManager.renameFile(child, targetPath)
      return app.vault.getFileByPath(targetPath)
    }
  }
  return null
}

/**
 * Deletes any file with `todoist_is_archive: true` frontmatter that was not written
 * in the current sync. Scans the root sync folder and all immediate subfolders.
 * Empty subfolders left behind are also removed.
 */
async function cleanupOrphanedArchiveFiles(
  app: App,
  folderPath: string,
  writtenPaths: Set<string>,
): Promise<void> {
  const syncFolder = app.vault.getFolderByPath(folderPath)
  if (!syncFolder) return

  for (const child of [...syncFolder.children]) {
    if (child instanceof TFile) {
      if (!writtenPaths.has(child.path)) {
        const cache = app.metadataCache.getFileCache(child)
        if (cache?.frontmatter?.['todoist_is_archive'] === true) {
          await app.fileManager.trashFile(child)
        }
      }
    } else if (child instanceof TFolder) {
      let deletedAny = false
      for (const subChild of [...child.children]) {
        if (subChild instanceof TFile && !writtenPaths.has(subChild.path)) {
          const cache = app.metadataCache.getFileCache(subChild)
          if (cache?.frontmatter?.['todoist_is_archive'] === true) {
            await app.fileManager.trashFile(subChild)
            deletedAny = true
          }
        }
      }
      // Remove the subfolder if it is now empty
      if (deletedAny && child.children.length === 0) {
        await app.fileManager.trashFile(child)
      }
    }
  }
}

function sanitizeFilename(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, '-').trim()
}
