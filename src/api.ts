import { requestUrl } from 'obsidian'
import { TodoistApi } from '@doist/todoist-api-typescript'
import type {
  PersonalProject,
  WorkspaceProject,
  Section,
  Task,
  CustomFetch,
} from '@doist/todoist-api-typescript'

export type AnyProject = PersonalProject | WorkspaceProject

// Obsidian-compatible fetch adapter (mirrors the SDK's own obsidian-fetch-adapter)
const obsidianFetch: CustomFetch = async (url, options) => {
  const urlStr = url.toString()
  const res = await requestUrl({
    url: urlStr,
    method: (options?.method ?? 'GET') as 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH',
    headers: options?.headers as Record<string, string> | undefined,
    body: options?.body as string | undefined,
    throw: false,
  })
  if (res.status >= 400 && urlStr.includes('completed')) {
    console.debug('[TodoistVault] completed tasks request:', urlStr)
    console.debug('[TodoistVault] completed tasks response:', res.status, res.text)
  }
  return {
    ok: res.status >= 200 && res.status < 300,
    status: res.status,
    statusText: res.text.slice(0, 200),
    headers: res.headers,
    text: () => Promise.resolve(res.text),
    json: () => Promise.resolve(res.json as unknown),
  }
}

export class TodoistClient {
  private api: TodoistApi

  constructor(apiToken: string) {
    this.api = new TodoistApi(apiToken, { customFetch: obsidianFetch })
  }

  async getProjects(): Promise<AnyProject[]> {
    const results: AnyProject[] = []
    let cursor: string | undefined

    do {
      const page = await this.api.getProjects({ cursor })
      results.push(...page.results)
      cursor = page.nextCursor ?? undefined
    } while (cursor)

    return results
  }

  async getSections(projectId: string): Promise<Section[]> {
    const results: Section[] = []
    let cursor: string | undefined

    do {
      const page = await this.api.getSections({ projectId, cursor })
      results.push(...page.results)
      cursor = page.nextCursor ?? undefined
    } while (cursor)

    return results
  }

  async getTasks(projectId: string): Promise<Task[]> {
    const results: Task[] = []
    let cursor: string | undefined

    do {
      const page = await this.api.getTasks({ projectId, cursor })
      results.push(...page.results)
      cursor = page.nextCursor ?? undefined
    } while (cursor)

    return results
  }

  async getCompletedTasks(projectId: string, since: string, until: string): Promise<Task[]> {
    const results: Task[] = []
    let cursor: string | undefined

    do {
      const page = await this.api.getCompletedTasksByCompletionDate({ projectId, since, until, cursor })
      results.push(...page.items)
      cursor = page.nextCursor ?? undefined
    } while (cursor)

    return results
  }

  async closeTask(taskId: string): Promise<void> {
    await this.api.closeTask(taskId)
  }

  async reopenTask(taskId: string): Promise<void> {
    await this.api.reopenTask(taskId)
  }
}
