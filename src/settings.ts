import { App, PluginSettingTab, Setting } from 'obsidian'
import type TodoistVaultPlugin from './main'

export interface TodoistVaultSettings {
  apiToken: string
  syncFolder: string
  syncIntervalMinutes: number
  projectFilter: string[]
  includeCompleted: boolean
}

export const DEFAULT_SETTINGS: TodoistVaultSettings = {
  apiToken: '',
  syncFolder: 'tasks',
  syncIntervalMinutes: 15,
  projectFilter: [],
  includeCompleted: false,
}

export class TodoistVaultSettingTab extends PluginSettingTab {
  plugin: TodoistVaultPlugin

  constructor(app: App, plugin: TodoistVaultPlugin) {
    super(app, plugin)
    this.plugin = plugin
  }

  display(): void {
    const { containerEl } = this
    containerEl.empty()

    containerEl.createEl('h2', { text: 'Todoist Vault Sync' })

    new Setting(containerEl)
      .setName('API Token')
      .setDesc('Your Todoist API token (found in Todoist → Settings → Integrations)')
      .addText((text) =>
        text
          .setPlaceholder('Enter API token')
          .setValue(this.plugin.settings.apiToken)
          .onChange(async (value) => {
            this.plugin.settings.apiToken = value.trim()
            await this.plugin.saveSettings()
          }),
      )

    new Setting(containerEl)
      .setName('Sync Folder')
      .setDesc('Vault folder where task files will be written (created if it does not exist)')
      .addText((text) =>
        text
          .setPlaceholder('tasks')
          .setValue(this.plugin.settings.syncFolder)
          .onChange(async (value) => {
            this.plugin.settings.syncFolder = value.trim() || 'tasks'
            await this.plugin.saveSettings()
          }),
      )

    new Setting(containerEl)
      .setName('Sync Interval (minutes)')
      .setDesc('How often to sync from Todoist (minimum 1 minute)')
      .addText((text) =>
        text
          .setPlaceholder('15')
          .setValue(String(this.plugin.settings.syncIntervalMinutes))
          .onChange(async (value) => {
            const num = parseInt(value, 10)
            if (!isNaN(num) && num >= 1) {
              this.plugin.settings.syncIntervalMinutes = num
              await this.plugin.saveSettings()
            }
          }),
      )

    new Setting(containerEl)
      .setName('Project Filter')
      .setDesc('Comma-separated list of project names to sync (leave empty to sync all projects)')
      .addText((text) =>
        text
          .setPlaceholder('Work, Personal')
          .setValue(this.plugin.settings.projectFilter.join(', '))
          .onChange(async (value) => {
            this.plugin.settings.projectFilter = value
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean)
            await this.plugin.saveSettings()
          }),
      )

    new Setting(containerEl)
      .setName('Include Completed Tasks')
      .setDesc('Show completed tasks as - [x] in output files')
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.includeCompleted).onChange(async (value) => {
          this.plugin.settings.includeCompleted = value
          await this.plugin.saveSettings()
        }),
      )
  }
}
