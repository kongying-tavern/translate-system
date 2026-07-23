<template>
  <div>
    <div class="page-header">
      <h2>布局管理</h2>
      <el-tabs v-model="activeTab">
        <el-tab-pane label="模板" name="templates" />
        <el-tab-pane label="配置" name="configs" />
      </el-tabs>
    </div>

    <template v-if="activeTab === 'templates'">
      <el-button type="primary" @click="$router.push(`/projects/${projectId}/layouts/templates/new/edit`)" style="margin-bottom:16px">新建模板</el-button>
      <el-table :data="templates" stripe>
        <el-table-column prop="name" label="名称" />
        <el-table-column prop="description" label="描述" />
        <el-table-column prop="isDefault" label="默认" width="80">
          <template #default="{ row }">{{ row.isDefault ? '是' : '否' }}</template>
        </el-table-column>
        <el-table-column label="操作" width="160">
          <template #default="{ row }">
            <el-button link type="primary" @click="$router.push(`/projects/${projectId}/layouts/templates/${row.id}/edit`)">编辑</el-button>
            <el-button link type="danger" @click="handleDeleteTemplate(row.id)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </template>

    <template v-else>
      <el-button type="primary" @click="$router.push(`/projects/${projectId}/layouts/configs/new/edit`)" style="margin-bottom:16px">新建配置</el-button>
      <el-table :data="configs" stripe>
        <el-table-column prop="name" label="名称" />
        <el-table-column label="引用模板">
          <template #default="{ row }">{{ row.templateId || '无' }}</template>
        </el-table-column>
        <el-table-column label="操作" width="160">
          <template #default="{ row }">
            <el-button link type="primary" @click="$router.push(`/projects/${projectId}/layouts/configs/${row.id}/edit`)">编辑</el-button>
            <el-button link type="danger" @click="handleDeleteConfig(row.id)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { getTemplates, deleteTemplate, getConfigs, deleteConfig } from '@/api/layout'
import type { LayoutTemplate, LayoutConfig } from '@/types/models'
import { ElMessage } from 'element-plus'

const route = useRoute()
const projectId = computed(() => route.params.projectId as string)
const activeTab = ref('templates')
const templates = ref<LayoutTemplate[]>([])
const configs = ref<LayoutConfig[]>([])

onMounted(() => loadLayouts())
watch(projectId, () => { if (projectId.value) loadLayouts() })
async function loadLayouts() {
  const [tRes, cRes] = await Promise.all([getTemplates(projectId.value), getConfigs(projectId.value)])
  templates.value = tRes.data.data; configs.value = cRes.data.data
}

async function handleDeleteTemplate(id: string) {
  await deleteTemplate(projectId.value, id)
  templates.value = templates.value.filter(t => t.id !== id)
  ElMessage.success('删除成功')
}

async function handleDeleteConfig(id: string) {
  await deleteConfig(projectId.value, id)
  configs.value = configs.value.filter(c => c.id !== id)
  ElMessage.success('删除成功')
}
</script>

<style scoped>
.page-header { margin-bottom: 16px; }
.page-header h2 { margin: 0 0 8px 0; }
</style>
