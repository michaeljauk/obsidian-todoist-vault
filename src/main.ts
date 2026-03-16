import { Notice, Plugin } from 'obsidian'
import { DEFAULT_SETTINGS, TodoistVaultSettingTab } from './settings'
import type { TodoistVaultSettings } from './settings'
import { runSync } from './sync'

export default class TodoistVaultPlugin extends Plugin {
  settings!: TodoistVaultSettings
  private syncIntervalId: number | null = null
  private isSyncing = false

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
      name: 'Sync Todoist now',
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

    // Register polling interval
    this.registerSyncInterval()

    console.debug('Plugin loaded')
  }

  onunload() {
    if (this.syncIntervalId !== null) {
      window.clearInterval(this.syncIntervalId)
    }
    console.debug('Plugin unloaded')
  }

  async runSync() {
    if (this.isSyncing) return
    this.isSyncing = true
    try {
      await runSync(this.app, this.settings)
    } finally {
      this.isSyncing = false
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
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData())
  }

  async saveSettings() {
    await this.saveData(this.settings)
    // Re-register interval in case syncIntervalMinutes changed
    this.registerSyncInterval()
  }
}
