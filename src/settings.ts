import { App, Notice, PluginSettingTab, Setting } from 'obsidian'
import type TodoistVaultPlugin from './main'

export interface TodoistVaultSettings {
  apiToken: string
  syncFolder: string
  syncIntervalMinutes: number
  projectFilter: string[]
  includeCompleted: boolean
  bidirectionalSync: boolean
}

export const DEFAULT_SETTINGS: TodoistVaultSettings = {
  apiToken: '',
  syncFolder: 'tasks',
  syncIntervalMinutes: 15,
  projectFilter: [],
  includeCompleted: false,
  bidirectionalSync: false,
}

function heading(containerEl: HTMLElement, text: string): void {
  containerEl.createEl('h3', { text, cls: 'todoist-vault-settings-heading' })
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

    // ── Connection ────────────────────────────────────────────────────────────
    heading(containerEl, 'Connection')

    new Setting(containerEl)
      .setName('API token')
      .setDesc(
        createFragment((f) => {
          f.appendText('Your Todoist API token. Find it in ')
          f.createEl('a', {
            text: 'Todoist → Settings → Integrations',
            href: 'https://app.todoist.com/app/settings/integrations/developer',
          })
          f.appendText('.')
        }),
      )
      .addText((text) =>
        text
          .setPlaceholder('Paste token here')
          .setValue(this.plugin.settings.apiToken)
          .onChange(async (value) => {
            this.plugin.settings.apiToken = value.trim()
            await this.plugin.saveSettings()
          }),
      )

    // ── Sync ──────────────────────────────────────────────────────────────────
    heading(containerEl, 'Sync')

    new Setting(containerEl)
      .setName('Sync folder')
      .setDesc('Vault folder where task files are written. Created automatically if missing.')
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
      .setName('Sync interval')
      .setDesc('How often to pull from Todoist in the background (minutes, minimum 1).')
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
      .setName('Project filter')
      .setDesc('Comma-separated list of project names to sync. Leave empty to sync all projects.')
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

    // ── Output ────────────────────────────────────────────────────────────────
    heading(containerEl, 'Output')

    new Setting(containerEl)
      .setName('Show completed tasks')
      .setDesc('Render completed tasks as - [x] in the output files.')
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.includeCompleted).onChange(async (value) => {
          this.plugin.settings.includeCompleted = value
          await this.plugin.saveSettings()
        }),
      )

    new Setting(containerEl)
      .setName('Bidirectional sync')
      .setDesc(
        'When enabled, checking a checkbox in Obsidian closes the task in Todoist on the next sync. Todoist remains the source of truth for task content.',
      )
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.bidirectionalSync).onChange(async (value) => {
          this.plugin.settings.bidirectionalSync = value
          await this.plugin.saveSettings()
        }),
      )

    // ── Actions ───────────────────────────────────────────────────────────────
    heading(containerEl, 'Actions')

    new Setting(containerEl)
      .setName('Sync now')
      .setDesc('Manually trigger a full sync from Todoist.')
      .addButton((btn) =>
        btn
          .setButtonText('Sync now')
          .setCta()
          .onClick(async () => {
            btn.setButtonText('Syncing…').setDisabled(true)
            try {
              await this.plugin.runSync()
              new Notice('[TodoistVault] Sync complete')
            } catch {
              new Notice('[TodoistVault] Sync failed — see console')
            } finally {
              btn.setButtonText('Sync now').setDisabled(false)
            }
          }),
      )
  }
}
