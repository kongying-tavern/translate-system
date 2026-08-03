import type { Project } from '@/types/models'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import * as projectApi from '@/api/project'

export const useProjectStore = defineStore('project', () => {
  const projects = ref<Project[]>([])
  const loaded = ref(false)

  const bySlug = computed<Record<string, Project>>(() => {
    const map: Record<string, Project> = {}
    for (const p of projects.value)
      map[p.code || p.id] = p
    return map
  })

  function getProject(slug: string): Project | undefined {
    return bySlug.value[slug]
  }

  async function fetchProjects(force = false) {
    if (loaded.value && !force)
      return
    const { data: res } = await projectApi.getProjects(1, 100)
    projects.value = res.data.list
    loaded.value = true
  }

  function upsert(p: Project) {
    const idx = projects.value.findIndex(x => x.id === p.id)
    if (idx === -1)
      projects.value.unshift(p)
    else
      projects.value[idx] = p
  }

  async function create(name: string, code: string, description: string, sourceLanguage: string): Promise<Project> {
    const { data: res } = await projectApi.createProject({ name, code, description, sourceLanguage })
    upsert(res.data)
    loaded.value = true
    return res.data
  }

  async function update(slug: string, data: { name: string, code?: string, description?: string, sourceLanguage?: string }): Promise<Project> {
    const { data: res } = await projectApi.updateProject(slug, data)
    upsert(res.data)
    return res.data
  }

  async function remove(slug: string) {
    await projectApi.deleteProject(slug)
    const p = bySlug.value[slug]
    if (p)
      projects.value = projects.value.filter(x => x.id !== p.id)
  }

  function clear() {
    projects.value = []
    loaded.value = false
  }

  return { projects, loaded, bySlug, getProject, fetchProjects, create, update, remove, clear }
})
