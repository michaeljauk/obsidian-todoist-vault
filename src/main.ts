import { Notice, Plugin } from 'obsidian'
import { DEFAULT_SETTINGS, TodoistVaultSettingTab } from './settings'
import type { TodoistVaultSettings } from './settings'
import { runSync } from './sync'
import type { SyncState } from './sync'

export default class TodoistVaultPlugin extends Plugin {
  settings!: TodoistVaultSettings
  private syncState: SyncState = {
    completedTaskIds: [],
    lastCompletedFetchAt: null,
    completedTasksCache: {},
  }
  private syncIntervalId: number | null = null
  private statusBarRefreshId: number | null = null
  private isSyncing = false
  private statusBarItem: HTMLElement | null = null
  private statusBarMsg: HTMLElement | null = null
  private statusBarDot: HTMLElement | null = null
  private lastSyncedAt: Date | null = null

  async onload() {
    await this.loadSettings()

    this.addSettingTab(new TodoistVaultSettingTab(this.app, this))

    // Ensure sync folder exists
    const folder = this.settings.syncFolder
    if (folder && !this.app.vault.getFolderByPath(folder)) {
      await this.app.vault.createFolder(folder)
    }

    // Command: manual sync
    this.addCommand({
      id: 'sync-now',
      name: 'Sync now',
      callback: async () => {
        new Notice('Syncing…')
        try {
          await this.runSync()
          new Notice('Sync complete')
        } catch (err) {
          console.error('Sync failed:', err)
          new Notice('Sync failed — see console')
        }
      },
    })

    // Ribbon icon — click to sync immediately
    this.addRibbonIcon('refresh-cw', 'Todoist: sync now', async () => {
      new Notice('Syncing…')
      try {
        await this.runSync()
        new Notice('Sync complete')
      } catch (err) {
        console.error('Sync failed:', err)
        new Notice('Sync failed — see console')
      }
    })

    // Status bar indicator — clickable to trigger sync
    this.statusBarItem = this.addStatusBarItem()
    const btn = this.statusBarItem.createEl('span', {
      cls: 'todoist-vault-status-bar',
      attr: {
        role: 'button',
        'aria-label': 'Sync Todoist now',
        tabindex: '0',
      },
    })
    this.statusBarMsg = btn
    this.statusBarDot = btn.createEl('span', { cls: 'todoist-vault-status-dot' })
    this.statusBarDot.dataset.status = 'waiting'
    btn.addEventListener('click', () => {
      this.runSync().catch((err: unknown) => {
        console.error('Manual sync failed:', err)
      })
    })
    this.updateStatusBar('idle')
    this.statusBarRefreshId = window.setInterval(() => {
      if (!this.isSyncing) this.updateStatusBar('idle')
    }, 60_000)

    // Register polling interval
    this.registerSyncInterval()

    console.debug('Plugin loaded')
  }

  onunload() {
    if (this.syncIntervalId !== null) {
      window.clearInterval(this.syncIntervalId)
    }
    if (this.statusBarRefreshId !== null) {
      window.clearInterval(this.statusBarRefreshId)
    }
    console.debug('Plugin unloaded')
  }

  async runSync() {
    if (this.isSyncing) return
    this.isSyncing = true
    this.updateStatusBar('syncing')
    try {
      this.syncState = await runSync(this.app, this.settings, this.syncState)
      await this.persistSyncState()
      this.lastSyncedAt = new Date()
      this.updateStatusBar('idle')
    } catch (err) {
      this.updateStatusBar('error')
      throw err
    } finally {
      this.isSyncing = false
    }
  }

  private updateStatusBar(state: 'idle' | 'syncing' | 'error') {
    if (!this.statusBarMsg) return
    // Update text — clear first to preserve the dot element
    const dot = this.statusBarDot
    let text: string
    let dotStatus: string
    if (state === 'syncing') {
      text = 'Todoist syncing…'
      dotStatus = 'syncing'
    } else if (state === 'error') {
      text = 'Todoist sync failed'
      dotStatus = 'error'
    } else if (this.lastSyncedAt) {
      const mins = Math.round((Date.now() - this.lastSyncedAt.getTime()) / 60_000)
      const label = mins < 1 ? 'just now' : `${mins}m ago`
      text = `Todoist synced ${label}`
      dotStatus = 'idle'
    } else {
      text = 'Todoist sync'
      dotStatus = 'waiting'
    }
    // Set text then re-append dot so it stays after the text
    this.statusBarMsg.textContent = text
    if (dot) {
      dot.dataset.status = dotStatus
      this.statusBarMsg.appendChild(dot)
    }
  }

  private registerSyncInterval() {
    if (this.syncIntervalId !== null) {
      window.clearInterval(this.syncIntervalId)
    }

    const intervalMs = this.settings.syncIntervalMinutes * 60 * 1000
    this.syncIntervalId = window.setInterval(() => {
      this.runSync().catch((err: unknown) => {
        console.error('Interval sync failed:', err)
      })
    }, intervalMs)
  }

  async loadSettings() {
    const data = (await this.loadData()) ?? {}
    this.settings = Object.assign({}, DEFAULT_SETTINGS, data)
    if (data._syncState) {
      const saved = data._syncState as Partial<SyncState>
      this.syncState = {
        completedTaskIds: saved.completedTaskIds ?? [],
        lastCompletedFetchAt: saved.lastCompletedFetchAt ?? null,
        completedTasksCache: saved.completedTasksCache ?? {},
      }
    }
    // Migration: v1.x users have includeCompleted boolean, not completedMode
    if (!this.settings.completedMode) {
      const legacy = (data as { includeCompleted?: boolean }).includeCompleted
      this.settings.completedMode = legacy === true ? 'inline' : 'hide'
    }
  }

  async saveSettings() {
    await this.persistData()
    // Re-register interval in case syncIntervalMinutes changed
    this.registerSyncInterval()
  }

  private async persistSyncState() {
    await this.persistData()
  }

  private async persistData() {
    await this.saveData({ ...this.settings, _syncState: this.syncState })
  }
}
