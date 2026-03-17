import { App, Notice, PluginSettingTab, Setting } from 'obsidian'
import type TodoistVaultPlugin from './main'

export interface FrontmatterSettings {
  includeUrl: boolean
  includeColor: boolean
  includeTags: boolean
  includeIsFavorite: boolean
  includeIsShared: boolean
  customFields: string
}

export interface TodoistVaultSettings {
  apiToken: string
  syncFolder: string
  syncIntervalMinutes: number
  projectFilter: string[]
  includeCompleted: boolean
  bidirectionalSync: boolean
  taskDeepLinks: boolean
  showVisibleMeta: boolean
  showDescription: boolean
  filePrefix: string
  fileSuffix: string
  frontmatter: FrontmatterSettings
}

export const DEFAULT_SETTINGS: TodoistVaultSettings = {
  apiToken: '',
  syncFolder: 'tasks',
  syncIntervalMinutes: 15,
  projectFilter: [],
  includeCompleted: false,
  bidirectionalSync: false,
  taskDeepLinks: false,
  showVisibleMeta: true,
  showDescription: true,
  filePrefix: '',
  fileSuffix: '',
  frontmatter: {
    includeUrl: true,
    includeColor: true,
    includeTags: true,
    includeIsFavorite: false,
    includeIsShared: false,
    customFields: '',
  },
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
            text: 'Todoist → settings → integrations',
            href: 'https://app.todoist.com/app/settings/integrations/developer',
          })
          f.appendText('. Stored unencrypted in your vault\'s plugin data — protect your vault accordingly.')
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
          .setPlaceholder('Tasks')
          .setValue(this.plugin.settings.syncFolder)
          .onChange(async (value) => {
            this.plugin.settings.syncFolder = value.trim() || 'tasks'
            await this.plugin.saveSettings()
          }),
      )

    new Setting(containerEl)
      .setName('Filename prefix')
      .setDesc('Prepended to every synced project filename (e.g. "📋 "). Useful to avoid name collisions with project hub notes.')
      .addText((text) =>
        text
          .setPlaceholder('📋 ')
          .setValue(this.plugin.settings.filePrefix)
          .onChange(async (value) => {
            this.plugin.settings.filePrefix = value
            await this.plugin.saveSettings()
          }),
      )

    new Setting(containerEl)
      .setName('Filename suffix')
      .setDesc('Appended to every synced project filename before the .md extension (e.g. " tasks").')
      .addText((text) =>
        text
          .setPlaceholder(' Tasks')
          .setValue(this.plugin.settings.fileSuffix)
          .onChange(async (value) => {
            this.plugin.settings.fileSuffix = value
            await this.plugin.saveSettings()
          }),
      )

    new Setting(containerEl)
      .setName('Sync interval')
      .setDesc('Background sync interval in minutes (minimum 1).')
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
          .setPlaceholder('Work, personal')
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
      .setDesc('Render completed tasks as - [X] in the output files.')
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.includeCompleted).onChange(async (value) => {
          this.plugin.settings.includeCompleted = value
          await this.plugin.saveSettings()
        }),
      )

    new Setting(containerEl)
      .setName('Show metadata badges')
      .setDesc('Show due date, priority, recurrence, and labels below each task.')
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.showVisibleMeta).onChange(async (value) => {
          this.plugin.settings.showVisibleMeta = value
          await this.plugin.saveSettings()
        }),
      )

    new Setting(containerEl)
      .setName('Show task descriptions')
      .setDesc('Show task description below each task as a collapsible callout.')
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.showDescription).onChange(async (value) => {
          this.plugin.settings.showDescription = value
          await this.plugin.saveSettings()
        }),
      )

    new Setting(containerEl)
      .setName('Task deep links')
      .setDesc('Wrap each task in a deep link back to its source.')
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.taskDeepLinks).onChange(async (value) => {
          this.plugin.settings.taskDeepLinks = value
          await this.plugin.saveSettings()
        }),
      )

    new Setting(containerEl)
      .setName('Bidirectional sync')
      .setDesc(
        'Checking a checkbox closes the task on the next sync. Unchecking a completed task reopens it — but only if "show completed tasks" is also enabled. The remote project remains the source of truth for task content.',
      )
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.bidirectionalSync).onChange(async (value) => {
          this.plugin.settings.bidirectionalSync = value
          await this.plugin.saveSettings()
        }),
      )

    // ── Frontmatter ───────────────────────────────────────────────────────────
    heading(containerEl, 'Frontmatter')

    new Setting(containerEl)
      .setName('Include project URL')
      .setDesc('Include the project URL in frontmatter.')
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.frontmatter.includeUrl).onChange(async (value) => {
          this.plugin.settings.frontmatter.includeUrl = value
          await this.plugin.saveSettings()
        }),
      )

    new Setting(containerEl)
      .setName('Include project color')
      .setDesc('Include the project color in frontmatter.')
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.frontmatter.includeColor)
          .onChange(async (value) => {
            this.plugin.settings.frontmatter.includeColor = value
            await this.plugin.saveSettings()
          }),
      )

    new Setting(containerEl)
      .setName('Include tags')
      .setDesc('Include a tags array in frontmatter.')
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.frontmatter.includeTags)
          .onChange(async (value) => {
            this.plugin.settings.frontmatter.includeTags = value
            await this.plugin.saveSettings()
          }),
      )

    new Setting(containerEl)
      .setName('Include is_favorite')
      .setDesc('Include the favorite status in frontmatter.')
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.frontmatter.includeIsFavorite)
          .onChange(async (value) => {
            this.plugin.settings.frontmatter.includeIsFavorite = value
            await this.plugin.saveSettings()
          }),
      )

    new Setting(containerEl)
      .setName('Include is_shared')
      .setDesc('Include the shared status in frontmatter.')
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.frontmatter.includeIsShared)
          .onChange(async (value) => {
            this.plugin.settings.frontmatter.includeIsShared = value
            await this.plugin.saveSettings()
          }),
      )

    new Setting(containerEl)
      .setName('Custom fields')
      .setDesc('Raw YAML lines appended to frontmatter, one per line (e.g. Type: task).')
      .addTextArea((textarea) =>
        textarea
          .setPlaceholder('Type: task')
          .setValue(this.plugin.settings.frontmatter.customFields)
          .onChange(async (value) => {
            this.plugin.settings.frontmatter.customFields = value
            await this.plugin.saveSettings()
          }),
      )

    // ── Actions ───────────────────────────────────────────────────────────────
    heading(containerEl, 'Actions')

    new Setting(containerEl)
      .setName('Sync now')
      .setDesc('Manually trigger a full sync.')
      .addButton((btn) =>
        btn
          .setButtonText('Sync now')
          .setCta()
          .onClick(async () => {
            btn.setButtonText('Syncing…').setDisabled(true)
            try {
              await this.plugin.runSync()
              new Notice('Sync complete')
            } catch {
              new Notice('Sync failed — see console')
            } finally {
              btn.setButtonText('Sync now').setDisabled(false)
            }
          }),
      )
  }
}
