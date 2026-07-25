<script setup lang="ts">
import type { ProjectLanguage } from '@/types/models'
import { ArrowDown, ArrowUp } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { storeToRefs } from 'pinia'
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import client from '@/api/client'
import EmptyState from '@/components/common/EmptyState.vue'
import { useLanguageStore } from '@/stores/language'
import { useLoadingStore } from '@/stores/loading'

const route = useRoute()
const projectSlug = computed(() => route.params.projectSlug as string)
const langStore = useLanguageStore()
const { projectLanguages, baseLanguages } = storeToRefs(langStore)
const showAddDialog = ref(false)
const selectedLang = ref('')
const aliasCache = reactive<Record<string, string>>({})

watch(projectLanguages, (langs) => {
  if (langs) {
    for (const l of langs) {
      if (!(l.id in aliasCache))
        aliasCache[l.id] = l.alias || ''
    }
  }
}, { immediate: true, deep: true })

onMounted(() => loadLangs())
watch(projectSlug, () => {
  if (projectSlug.value)
    loadLangs()
})
const sortedBaseLanguages = computed(() => [...baseLanguages.value].sort((a, b) => a.englishName.localeCompare(b.englishName)))
const loadingStore = useLoadingStore()
function loadLangs() { loadingStore.start(); langStore.fetchProjectLanguages(projectSlug.value).finally(() => loadingStore.stop()) }

async function onAliasSave(row: ProjectLanguage) {
  const alias = aliasCache[row.id]?.trim() ?? ''
  if (alias === (row.alias || ''))
    return
  try { await client.put(`/projects/${projectSlug.value}/languages/${row.id}/alias`, { alias }); row.alias = alias || null; ElMessage.success('已更新') }
  catch { ElMessage.error('更新失败') }
}

async function handleAdd() {
  try { await langStore.addLanguage(projectSlug.value, selectedLang.value); ElMessage.success('添加成功'); showAddDialog.value = false; selectedLang.value = '' }
  catch { ElMessage.error('添加失败') }
}

async function handleRemove(code: string) {
  try { await langStore.removeLanguage(projectSlug.value, code); ElMessage.success('删除成功') }
  catch { ElMessage.error('删除失败') }
}

async function moveUp(index: number) {
  const list = projectLanguages.value || []
  if (index <= 0 || !list.length)
    return
  const cur = list[index]; const prev = list[index - 1]
  const newOrder = prev.sortOrder ?? (index - 1)
  cur.sortOrder = newOrder; prev.sortOrder = newOrder + 1
  list.splice(index, 1); list.splice(index - 1, 0, cur)
  await saveOrder(cur); await saveOrder(prev)
}

async function moveDown(index: number) {
  const list = projectLanguages.value || []
  if (index >= list.length - 1)
    return
  const cur = list[index]; const next = list[index + 1]
  const newOrder = next.sortOrder ?? (index + 1)
  cur.sortOrder = newOrder; next.sortOrder = newOrder - 1
  list.splice(index, 1); list.splice(index + 1, 0, cur)
  await saveOrder(cur); await saveOrder(next)
}

async function saveOrder(row: ProjectLanguage) {
  await client.put(`/projects/${projectSlug.value}/languages/${row.id}/sortOrder`, { sortOrder: row.sortOrder }).catch(() => {})
}
</script>

<template>
  <div>
    <div class="page-header">
      <h2>语言管理</h2><el-button type="primary" @click="showAddDialog = true">
        添加语言
      </el-button>
    </div>
    <el-table :data="projectLanguages || []" stripe row-key="id">
      <el-table-column label="排序" width="80" align="center">
        <template #default="{ row, $index }">
          <el-button link size="small" :disabled="$index === 0" @click="moveUp($index)">
            <el-icon><ArrowUp /></el-icon>
          </el-button>
          <el-button link size="small" :disabled="$index === (projectLanguages || []).length - 1" @click="moveDown($index)">
            <el-icon><ArrowDown /></el-icon>
          </el-button>
        </template>
      </el-table-column>
      <el-table-column prop="languageCode" label="语言代码" min-width="120" />
      <el-table-column label="语言名称" min-width="200">
        <template #default="{ row }">
          {{ langStore.getBaseName(row.languageCode) }}
        </template>
      </el-table-column>
      <el-table-column label="别名" min-width="160">
        <template #default="{ row }">
          <el-input v-model="aliasCache[row.id]" size="small" placeholder="输入别名..." @blur="onAliasSave(row)" />
        </template>
      </el-table-column>
      <el-table-column label="显示名" min-width="120">
        <template #default="{ row }">
          {{ row.alias || row.languageCode }}
        </template>
      </el-table-column>
      <el-table-column label="操作" min-width="80">
        <template #default="{ row }">
          <el-button type="danger" link @click="handleRemove(row.languageCode)">
            删除
          </el-button>
        </template>
      </el-table-column>
    </el-table>
    <EmptyState v-if="!projectLanguages || !projectLanguages.length" description="暂无语言" />

    <el-dialog v-model="showAddDialog" title="添加语言" width="500px">
      <el-select v-model="selectedLang" filterable placeholder="搜索语言..." style="width:100%">
        <el-option v-for="l in sortedBaseLanguages" :key="l.languageCode" :label="`${l.englishName} (${l.nativeName || ''}) - ${l.languageCode}`" :value="l.languageCode" />
      </el-select>
      <template #footer>
        <el-button @click="showAddDialog = false">
          取消
        </el-button><el-button type="primary" :disabled="!selectedLang" @click="handleAdd">
          确认添加
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
.page-header h2 { margin: 0; }
</style>
