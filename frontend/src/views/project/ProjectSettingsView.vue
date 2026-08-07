<script setup lang="ts">
import { ElMessage } from 'element-plus'
import { computed, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getProject, updateProject } from '@/api/project'
import { BaseButton, BaseForm, BaseFormItem, BaseInput, BasePageHeader, BaseSelect } from '@/components/ui'
import { useLanguageStore } from '@/stores/language'
import { decPathParam } from '@/utils/path'

const route = useRoute()
const router = useRouter()
const projectSlug = computed(() => decPathParam(route.params.projectSlug as string) as string)
const langStore = useLanguageStore()
const saving = ref(false)
const form = reactive({ name: '', code: '', description: '', sourceLanguage: 'en-US' })
const sortedBaseLanguages = computed(() => [...langStore.baseLanguages].sort((a, b) => a.englishName.localeCompare(b.englishName)))

async function loadProject() {
  const [pRes] = await Promise.all([getProject(projectSlug.value), langStore.fetchBaseLanguages()])
  form.name = pRes.data.data.name
  form.code = pRes.data.data.code || ''
  form.description = pRes.data.data.description || ''
  form.sourceLanguage = pRes.data.data.sourceLanguage
}
watch(projectSlug, loadProject, { immediate: true })

async function handleSave() {
  if (!form.name.trim()) {
    ElMessage.warning('项目名称不能为空')
    return
  }
  if (!form.sourceLanguage) {
    ElMessage.warning('请选择源语言')
    return
  }
  saving.value = true
  try {
    await updateProject(projectSlug.value, { name: form.name, code: form.code, description: form.description, sourceLanguage: form.sourceLanguage })
    await langStore.fetchProjectLanguages(projectSlug.value)
    ElMessage.success('保存成功')
    router.back()
  }
  catch {
    ElMessage.error('保存失败')
  }
  finally {
    saving.value = false
  }
}
</script>

<template>
  <div>
    <BasePageHeader title="项目设置" />
    <BaseForm :model="form" label-width="100px" style="max-width:600px">
      <BaseFormItem label="项目名称">
        <BaseInput v-model="form.name" />
      </BaseFormItem>
      <BaseFormItem label="项目标识">
        <BaseInput v-model="form.code" placeholder="英文标识，如 my-project" />
      </BaseFormItem>
      <BaseFormItem label="描述">
        <BaseInput v-model="form.description" type="textarea" :rows="3" />
      </BaseFormItem>
      <BaseFormItem label="源语言">
        <BaseSelect v-model="form.sourceLanguage" filterable placeholder="搜索语言..." style="width:100%">
          <el-option v-for="l in sortedBaseLanguages" :key="l.languageCode" class="base-option" :label="`${l.englishName} (${l.nativeName || ''}) - ${l.languageCode}`" :value="l.languageCode">
            <span class="lang-option">
              <span class="lang-option__name">{{ l.englishName }} ({{ l.nativeName || '' }})</span>
              <span class="lang-option__code">{{ l.languageCode }}</span>
            </span>
          </el-option>
        </BaseSelect>
        <div class="source-hint">
          修改源语言后会自动添加为项目语言（排序最前），其他目标语言请在语言管理中维护
        </div>
      </BaseFormItem>
      <BaseFormItem>
        <BaseButton type="primary" :loading="saving" @click="handleSave">
          保存
        </BaseButton>
      </BaseFormItem>
    </BaseForm>
  </div>
</template>

<style lang="scss" scoped>
.source-hint { color: #909399; font-size: 13px; line-height: 1.6; margin-top: 4px; }
.lang-option { display: flex; align-items: center; justify-content: space-between; gap: 12px; width: 100%; }
.lang-option__name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.lang-option__code { flex: none; color: #909399; font-size: 12px; }
</style>
