<script setup lang="tsx">
import type { BaseTableColumnConfig } from '@/components/ui/BaseTable/types'
import type { LayoutConfig, LayoutTemplate } from '@/types/models'
import { ElMessage, ElMessageBox } from 'element-plus'
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { deleteConfig, deleteTemplate, getConfigs, getTemplates } from '@/api/layout'
import { BaseButton, BasePageHeader, BaseTable, BaseTabs } from '@/components/ui'

const route = useRoute()
const router = useRouter()
const projectSlug = computed(() => route.params.projectSlug as string)
const activeTab = ref('templates')
const templates = ref<LayoutTemplate[]>([])
const configs = ref<LayoutConfig[]>([])

onMounted(() => loadLayouts())
watch(projectSlug, () => {
  if (projectSlug.value)
    loadLayouts()
})
async function loadLayouts() {
  const [tRes, cRes] = await Promise.all([getTemplates(projectSlug.value), getConfigs(projectSlug.value)])
  templates.value = tRes.data.data
  configs.value = cRes.data.data
}

async function handleDeleteTemplate(id: string) {
  try {
    await ElMessageBox.confirm('确定要删除该布局模板吗？', '确认删除', { confirmButtonText: '确认删除', cancelButtonText: '取消', type: 'error' })
  }
  catch { return }
  await deleteTemplate(projectSlug.value, id)
  templates.value = templates.value.filter(t => t.id !== id)
  ElMessage.success('删除成功')
}

async function handleDeleteConfig(id: string) {
  try {
    await ElMessageBox.confirm('确定要删除该布局配置吗？', '确认删除', { confirmButtonText: '确认删除', cancelButtonText: '取消', type: 'error' })
  }
  catch { return }
  await deleteConfig(projectSlug.value, id)
  configs.value = configs.value.filter(c => c.id !== id)
  ElMessage.success('删除成功')
}

const templateColumns: BaseTableColumnConfig<LayoutTemplate>[] = [
  { dataKey: 'name', title: '名称' },
  { dataKey: 'description', title: '描述' },
  {
    title: '默认',
    width: 80,
    cell: row => row.isDefault ? '是' : '否',
  },
  {
    title: '操作',
    width: 160,
    cell: row => (
      <div>
        <BaseButton link type="primary" onClick={() => router.push(`/projects/${projectSlug.value}/layouts/templates/${row.id}/edit`)}>编辑</BaseButton>
        <BaseButton link type="danger" onClick={() => handleDeleteTemplate(row.id)}>删除</BaseButton>
      </div>
    ),
  },
]

const configColumns: BaseTableColumnConfig<LayoutConfig>[] = [
  { dataKey: 'name', title: '名称' },
  {
    title: '引用模板',
    cell: row => row.templateId || '无',
  },
  {
    title: '操作',
    width: 160,
    cell: row => (
      <div>
        <BaseButton link type="primary" onClick={() => router.push(`/projects/${projectSlug.value}/layouts/configs/${row.id}/edit`)}>编辑</BaseButton>
        <BaseButton link type="danger" onClick={() => handleDeleteConfig(row.id)}>删除</BaseButton>
      </div>
    ),
  },
]
</script>

<template>
  <div>
    <BasePageHeader title="布局管理">
      <BaseTabs v-model="activeTab" :tabs="[{ key: 'templates', label: '模板' }, { key: 'configs', label: '配置' }]" style="margin-top:4px">
        <template #tab-templates>
          <BaseButton type="primary" style="margin-bottom:16px" @click="$router.push(`/projects/${projectSlug}/layouts/templates/new/edit`)">
            新建模板
          </BaseButton>
          <BaseTable :data="templates" :columns="templateColumns" stripe />
        </template>
        <template #tab-configs>
          <BaseButton type="primary" style="margin-bottom:16px" @click="$router.push(`/projects/${projectSlug}/layouts/configs/new/edit`)">
            新建配置
          </BaseButton>
          <BaseTable :data="configs" :columns="configColumns" stripe />
        </template>
      </BaseTabs>
    </BasePageHeader>
  </div>
</template>
