import { describe, expect, test } from 'bun:test'
import type { Section, Task } from '@doist/todoist-api-typescript'
import type { AnyProject } from './api'
import type { FrontmatterSettings } from './settings'
import type { RenderOptions } from './renderer'
import { renderProject } from './renderer'

// ─── Fixtures ────────────────────────────────────────────────────────────────

const project: AnyProject = {
  id: 'proj1',
  name: 'My Project',
  url: 'https://todoist.com/app/project/proj1',
  color: 'blue',
  isFavorite: false,
  isShared: false,
  isArchived: false,
  isDeleted: false,
  isFrozen: false,
  isCollapsed: false,
  inboxProject: false,
  canAssignTasks: false,
  parentId: null,
  childOrder: 0,
  defaultOrder: 0,
  createdAt: null,
  updatedAt: null,
  viewStyle: 'list',
  description: '',
}

const section: Section = {
  id: 'sec1',
  name: 'Work',
  projectId: 'proj1',
  url: 'https://todoist.com/app/project/proj1/section/sec1',
  userId: 'u1',
  sectionOrder: 1,
  addedAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  archivedAt: null,
  isArchived: false,
  isDeleted: false,
  isCollapsed: false,
}

function makeTask(overrides: Partial<Task> & { id: string; content: string }): Task {
  return {
    userId: 'u1',
    projectId: 'proj1',
    sectionId: null,
    parentId: null,
    addedByUid: null,
    assignedByUid: null,
    responsibleUid: null,
    labels: [],
    deadline: null,
    duration: null,
    checked: false,
    isDeleted: false,
    isUncompletable: false,
    isCollapsed: false,
    addedAt: '2026-01-01T00:00:00Z',
    completedAt: null,
    updatedAt: null,
    priority: 1,
    childOrder: 0,
    dayOrder: 0,
    description: '',
    due: null,
    url: `https://todoist.com/app/task/${overrides.id}`,
    ...overrides,
  }
}

const defaultFm: FrontmatterSettings = {
  includeUrl: false,
  includeColor: false,
  includeTags: false,
  includeIsFavorite: false,
  includeIsShared: false,
  customFields: '',
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function render(
  tasks: Task[],
  opts?: {
    sections?: Section[]
    completedMode?: Parameters<typeof renderProject>[3]
    fm?: FrontmatterSettings
    deepLinks?: boolean
    showVisibleMeta?: boolean
    showDescription?: boolean
  },
) {
  const options: RenderOptions = {
    taskDeepLinks: opts?.deepLinks ?? false,
    showVisibleMeta: opts?.showVisibleMeta ?? true,
    showDescription: opts?.showDescription ?? true,
  }
  return renderProject(
    project,
    opts?.sections ?? [],
    tasks,
    opts?.completedMode ?? 'hide',
    opts?.fm ?? defaultFm,
    options,
  )
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('renderProject — completedMode: hide', () => {
  test('only renders active tasks', () => {
    const active = makeTask({ id: 't1', content: 'Active task' })
    const done = makeTask({ id: 't2', content: 'Done task', completedAt: '2026-03-01T10:00:00Z' })
    const { projectContent, archiveContent } = render([active, done])

    expect(projectContent).toContain('Active task')
    expect(projectContent).not.toContain('Done task')
    expect(archiveContent).toBeNull()
  })

  test('shows _No tasks_ when all tasks are completed', () => {
    const done = makeTask({ id: 't1', content: 'Done', completedAt: '2026-03-01T10:00:00Z' })
    const { projectContent } = render([done])
    expect(projectContent).toContain('_No tasks_')
  })
})

describe('renderProject — completedMode: inline', () => {
  test('renders both active and completed tasks', () => {
    const active = makeTask({ id: 't1', content: 'Active' })
    const done = makeTask({ id: 't2', content: 'Completed', completedAt: '2026-03-01T10:00:00Z' })
    const { projectContent, archiveContent } = render([active, done], { completedMode: 'inline' })

    expect(projectContent).toContain('Active')
    expect(projectContent).toContain('Completed')
    expect(archiveContent).toBeNull()
  })

  test('completed task has [x] checkbox', () => {
    const done = makeTask({ id: 't1', content: 'Done', completedAt: '2026-03-01T10:00:00Z' })
    const { projectContent } = render([done], { completedMode: 'inline' })
    expect(projectContent).toContain('- [x] Done')
  })

  test('active task has [ ] checkbox', () => {
    const active = makeTask({ id: 't1', content: 'Active' })
    const { projectContent } = render([active], { completedMode: 'inline' })
    expect(projectContent).toContain('- [ ] Active')
  })
})

describe('renderProject — completedMode: archive-section', () => {
  test('active tasks in main body, completed under ## Completed', () => {
    const active = makeTask({ id: 't1', content: 'Active' })
    const done = makeTask({ id: 't2', content: 'Done', completedAt: '2026-03-01T10:00:00Z' })
    const { projectContent, archiveContent } = render([active, done], {
      completedMode: 'archive-section',
    })

    const completedIdx = projectContent.indexOf('## Completed')
    const activeIdx = projectContent.indexOf('Active')
    const doneIdx = projectContent.indexOf('Done')

    expect(completedIdx).toBeGreaterThan(-1)
    expect(activeIdx).toBeLessThan(completedIdx) // active comes before ## Completed
    expect(doneIdx).toBeGreaterThan(completedIdx) // done comes after ## Completed
    expect(archiveContent).toBeNull()
  })

  test('no ## Completed heading when there are no completed tasks', () => {
    const active = makeTask({ id: 't1', content: 'Active' })
    const { projectContent } = render([active], { completedMode: 'archive-section' })
    expect(projectContent).not.toContain('## Completed')
  })

  test('shows _No active tasks._ when all tasks are completed', () => {
    const done = makeTask({ id: 't1', content: 'Done', completedAt: '2026-03-01T10:00:00Z' })
    const { projectContent } = render([done], { completedMode: 'archive-section' })
    expect(projectContent).toContain('_No active tasks._')
  })
})

describe('renderProject — completedMode: archive-file / archive-folder', () => {
  for (const mode of ['archive-file', 'archive-folder'] as const) {
    test(`${mode}: active tasks in projectContent, completed in archiveContent`, () => {
      const active = makeTask({ id: 't1', content: 'Active' })
      const done = makeTask({ id: 't2', content: 'Done', completedAt: '2026-03-01T10:00:00Z' })
      const { projectContent, archiveContent } = render([active, done], { completedMode: mode })

      expect(projectContent).toContain('Active')
      expect(projectContent).not.toContain('Done')
      expect(archiveContent).not.toBeNull()
      expect(archiveContent).toContain('Done')
      expect(archiveContent).not.toContain('Active')
    })

    test(`${mode}: archiveContent has todoist_is_archive: true in frontmatter`, () => {
      const done = makeTask({ id: 't1', content: 'Done', completedAt: '2026-03-01T10:00:00Z' })
      const { archiveContent } = render([done], { completedMode: mode })
      expect(archiveContent).toContain('todoist_is_archive: true')
    })

    test(`${mode}: projectContent does not have todoist_is_archive`, () => {
      const active = makeTask({ id: 't1', content: 'Active' })
      const { projectContent } = render([active], { completedMode: mode })
      expect(projectContent).not.toContain('todoist_is_archive')
    })
  }
})

describe('frontmatter', () => {
  test('always includes todoist_project_id', () => {
    const { projectContent } = render([])
    expect(projectContent).toContain('todoist_project_id: "proj1"')
  })

  test('includes optional fields when enabled', () => {
    const fm: FrontmatterSettings = {
      ...defaultFm,
      includeUrl: true,
      includeColor: true,
      includeTags: true,
      includeIsFavorite: true,
      includeIsShared: true,
    }
    const { projectContent } = render([], { fm })
    expect(projectContent).toContain('todoist_url:')
    expect(projectContent).toContain('todoist_color:')
    expect(projectContent).toContain('tags:')
    expect(projectContent).toContain('todoist_is_favorite:')
    expect(projectContent).toContain('todoist_is_shared:')
  })

  test('excludes optional fields when disabled', () => {
    const { projectContent } = render([], { fm: defaultFm })
    expect(projectContent).not.toContain('todoist_url:')
    expect(projectContent).not.toContain('todoist_color:')
    expect(projectContent).not.toContain('tags:')
  })
})

describe('task inline comment', () => {
  test('includes id in comment', () => {
    const task = makeTask({ id: 'abc123', content: 'Task' })
    const { projectContent } = render([task])
    expect(projectContent).toContain('<!-- id:abc123 -->')
  })

  test('includes due date in comment', () => {
    const task = makeTask({
      id: 't1',
      content: 'Task',
      due: { date: '2026-04-01', isRecurring: false, string: 'Apr 1', lang: 'en', timezone: null },
    })
    const { projectContent } = render([task])
    expect(projectContent).toContain('due:2026-04-01')
  })

  test('includes recurrence in comment', () => {
    const task = makeTask({
      id: 't1',
      content: 'Task',
      due: {
        date: '2026-04-01',
        isRecurring: true,
        string: 'every day',
        lang: 'en',
        timezone: null,
      },
    })
    const { projectContent } = render([task])
    expect(projectContent).toContain('recur:every day')
  })

  test('includes priority in comment for p1-p3', () => {
    const p1 = makeTask({ id: 't1', content: 'Urgent', priority: 4 })
    const p4 = makeTask({ id: 't2', content: 'Default', priority: 1 })
    const { projectContent: c1 } = render([p1])
    const { projectContent: c4 } = render([p4])
    expect(c1).toContain('p1')
    expect(c4).not.toMatch(/p[1-3]/)
  })
})

describe('visible meta', () => {
  test('renders priority badge', () => {
    const task = makeTask({ id: 't1', content: 'Task', priority: 4 })
    const { projectContent } = render([task], { showVisibleMeta: true })
    expect(projectContent).toContain('🔴 p1')
  })

  test('renders due date badge', () => {
    const task = makeTask({
      id: 't1',
      content: 'Task',
      due: { date: '2026-06-15', isRecurring: false, string: 'Jun 15', lang: 'en', timezone: null },
    })
    const { projectContent } = render([task], { showVisibleMeta: true })
    expect(projectContent).toContain('📅')
  })

  test('hides meta when showVisibleMeta is false', () => {
    const task = makeTask({ id: 't1', content: 'Task', priority: 4 })
    const { projectContent } = render([task], { showVisibleMeta: false })
    expect(projectContent).not.toContain('🔴')
  })
})

describe('sections', () => {
  test('groups tasks under their section heading', () => {
    const task = makeTask({ id: 't1', content: 'Work task', sectionId: 'sec1' })
    const { projectContent } = render([task], { sections: [section] })
    const sectionIdx = projectContent.indexOf('## Work')
    const taskIdx = projectContent.indexOf('Work task')
    expect(sectionIdx).toBeGreaterThan(-1)
    expect(taskIdx).toBeGreaterThan(sectionIdx)
  })

  test('unsectioned tasks appear under ## Inbox', () => {
    const task = makeTask({ id: 't1', content: 'Inbox task', sectionId: null })
    const { projectContent } = render([task], { sections: [section] })
    expect(projectContent).toContain('## Inbox')
  })

  test('empty sections are not rendered', () => {
    const task = makeTask({ id: 't1', content: 'Inbox task', sectionId: null })
    const { projectContent } = render([task], { sections: [section] })
    expect(projectContent).not.toContain('## Work')
  })
})

describe('description', () => {
  test('renders description callout when showDescription is true', () => {
    const task = makeTask({ id: 't1', content: 'Task', description: 'Some detail' })
    const { projectContent } = render([task], { showDescription: true })
    expect(projectContent).toContain('[!desc]- Description')
    expect(projectContent).toContain('Some detail')
  })

  test('hides description when showDescription is false', () => {
    const task = makeTask({ id: 't1', content: 'Task', description: 'Some detail' })
    const { projectContent } = render([task], { showDescription: false })
    expect(projectContent).not.toContain('Some detail')
  })
})
