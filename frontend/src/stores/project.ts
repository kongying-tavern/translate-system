import { defineStore } from 'pinia'
import { ref } from 'vue'
import * as projectApi from '@/api/project'
import type { Project } from '@/types/models'

export const useProjectStore = defineStore('project', () => {
  const projects = ref<Project[]>([])
  const currentProject = ref<Project | null>(null)

  async function fetchProjects() {
    const { data: res } = await projectApi.getProjects()
    projects.value = res.data.list
  }

  async function fetchProject(id: string) {
    const { data: res } = await projectApi.getProject(id)
    currentProject.value = res.data
  }

  async function create(name: string, code: string, description: string, sourceLanguage: string): Promise<Project> {
    const { data: res } = await projectApi.createProject({ name, code, description, sourceLanguage })
    projects.value.unshift(res.data)
    return res.data
  }

  async function update(id: string, data: { name: string; code?: string; description?: string; sourceLanguage?: string }) {
    const { data: res } = await projectApi.updateProject(id, data)
    const idx = projects.value.findIndex(p => p.id === id)
    if (idx !== -1) projects.value[idx] = res.data
    if (currentProject.value?.id === id) currentProject.value = res.data
  }

  async function remove(id: string) {
    await projectApi.deleteProject(id)
    projects.value = projects.value.filter(p => p.id !== id)
  }

  return { projects, currentProject, fetchProjects, fetchProject, create, update, remove }
})
