<script setup lang="ts">
import type { ProjectLanguage } from '@/types/models'
import { ElMessage } from 'element-plus'
import { computed, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getProjectLanguages } from '@/api/language'
import { getProject, updateProject } from '@/api/project'
import { BaseButton, BaseForm, BaseFormItem, BaseInput, BasePageHeader, BaseSelect } from '@/components/ui'
import { decPathParam } from '@/utils/path'

const route = useRoute()
const router = useRouter()
const projectSlug = computed(() => decPathParam(route.params.projectSlug as string) as string)
const projectLanguages = ref<ProjectLanguage[]>([])
const saving = ref(false)
const form = reactive({ name: '', code: '', description: '', sourceLanguage: 'en' })

async function loadProject() {
  const [pRes, lRes] = await Promise.all([getProject(projectSlug.value), getProjectLanguages(projectSlug.value)])
  form.name = pRes.data.data.name
  form.code = pRes.data.data.code || ''
  form.description = pRes.data.data.description || ''
  form.sourceLanguage = pRes.data.data.sourceLanguage
  projectLanguages.value = lRes.data.data
}
watch(projectSlug, loadProject, { immediate: true })

async function handleSave() {
  if (!form.name.trim()) {
    ElMessage.warning('项目名称不能为空')
    return
  }
  saving.value = true
  try {
    await updateProject(projectSlug.value, { name: form.name, code: form.code, description: form.description, sourceLanguage: form.sourceLanguage })
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
        <BaseSelect v-model="form.sourceLanguage" style="width:100%">
          <el-option v-for="l in projectLanguages" :key="l.languageCode" class="base-option" :label="l.languageCode" :value="l.languageCode" />
        </BaseSelect>
      </BaseFormItem>
      <BaseFormItem>
        <BaseButton type="primary" :loading="saving" @click="handleSave">
          保存
        </BaseButton>
      </BaseFormItem>
    </BaseForm>
  </div>
</template>
