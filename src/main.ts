import { Notice, Plugin } from 'obsidian'
import { DEFAULT_SETTINGS, TodoistVaultSettingTab } from './settings'
import type { TodoistVaultSettings } from './settings'
import { runSync } from './sync'

export default class TodoistVaultPlugin extends Plugin {
  settings!: TodoistVaultSettings
  private syncIntervalId: number | null = null

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
        new Notice('[TodoistVault] Syncing…')
        try {
          await runSync(this.app, this.settings)
          new Notice('[TodoistVault] Sync complete')
        } catch (err) {
          console.error('[TodoistVault] Sync failed:', err)
          new Notice('[TodoistVault] Sync failed — see console')
        }
      },
    })

    // Register polling interval
    this.registerSyncInterval()

    console.log('[TodoistVault] Plugin loaded')
  }

  onunload() {
    if (this.syncIntervalId !== null) {
      window.clearInterval(this.syncIntervalId)
    }
    console.log('[TodoistVault] Plugin unloaded')
  }

  private registerSyncInterval() {
    if (this.syncIntervalId !== null) {
      window.clearInterval(this.syncIntervalId)
    }

    const intervalMs = this.settings.syncIntervalMinutes * 60 * 1000
    this.syncIntervalId = window.setInterval(async () => {
      try {
        await runSync(this.app, this.settings)
      } catch (err) {
        console.error('[TodoistVault] Interval sync failed:', err)
      }
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
