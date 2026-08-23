<script setup lang="ts">
import type { ComponentExposed } from 'vue-component-type-helpers'
import { ElMessage, ElMessageBox } from 'element-plus'
import { computed, onMounted, reactive, ref, useTemplateRef } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { BaseButton, BaseForm, BaseFormItem, BaseInput, BaseNotice, BasePageHeader, BaseSelect } from '@/components/ui'
import { useImportStatus } from '@/hooks/useImportStatus'
import { useProjectPermission } from '@/hooks/useProjectPermission'
import { useAuthStore } from '@/stores/auth'
import { useLanguageStore } from '@/stores/language'
import { useProjectStore } from '@/stores/project'
import { useTabsStore } from '@/stores/tabs'
import { decPathParam, encPathParam } from '@/utils/path'

const router = useRouter()
const route = useRoute()
const store = useProjectStore()
const auth = useAuthStore()
const langStore = useLanguageStore()
const tabsStore = useTabsStore()
const perm = useProjectPermission()
const loading = ref(false)
const loaded = ref(false)
const slug = computed(() => decPathParam(route.params.projectSlug as string | undefined))
const isEdit = computed(() => !!slug.value)
const title = computed(() => (isEdit.value ? '编辑项目' : '新建项目'))
// 编辑模式复用本页（/projects/:slug/edit）：改源语言会写项目语言数据，导入进行中需锁定整个表单与删除按钮
const { isLocked: importLocked, bannerTitle: importLockBannerTitle } = useImportStatus(() => slug.value || '')
const form = reactive({ name: '', code: '', description: '', sourceLanguage: 'en-US' })
const formRef = useTemplateRef<ComponentExposed<typeof BaseForm>>('formRef')
const rules = {
  name: [{ required: true, message: '请输入项目名称', trigger: 'blur' }],
  code: [{ required: true, message: '请输入项目标识', trigger: 'blur' }],
  sourceLanguage: [{ required: true, message: '请选择源语言', trigger: 'change' }],
}
const sortedBaseLanguages = computed(() => [...langStore.baseLanguages].sort((a, b) => a.englishName.localeCompare(b.englishName)))

onMounted(async () => {
  await langStore.fetchBaseLanguages()
  if (!isEdit.value) {
    loaded.value = true
    return
  }
  await store.fetchProjects()
  const p = store.getProject(slug.value!)
  if (!p) {
    ElMessage.error('项目不存在或已被删除')
    router.replace('/')
    return
  }
  form.name = p.name
  form.code = p.code || ''
  form.description = p.description || ''
  form.sourceLanguage = p.sourceLanguage
  loaded.value = true
})

async function handleDelete() {
  if (!slug.value || importLocked.value)
    return
  try {
    await ElMessageBox.confirm(`确定要删除项目「${form.name}」吗？该操作不可恢复。`, '危险操作', { confirmButtonText: '确认删除', cancelButtonText: '取消', type: 'error' })
  }
  catch {
    return
  }
  try {
    await store.remove(slug.value)
    if (auth.activeProjectSlug === slug.value)
      auth.setActiveProject('')
    tabsStore.removeProjectTabs(slug.value)
    ElMessage.success('项目已删除')
    router.replace('/')
  }
  catch {
    ElMessage.error('删除失败')
  }
}

async function handleSubmit() {
  if (importLocked.value)
    return
  if (!formRef.value)
    return
  try {
    await formRef.value.validate()
  }
  catch {
    return
  }
  loading.value = true
  try {
    if (isEdit.value) {
      const updated = await store.update(slug.value!, { name: form.name, code: form.code, description: form.description, sourceLanguage: form.sourceLanguage })
      const newSlug = updated.code || updated.id
      let closePath = `/projects/${encPathParam(slug.value!)}/edit`
      if (newSlug !== slug.value) {
        tabsStore.renameProjectSlug(slug.value!, newSlug)
        if (auth.activeProjectSlug === slug.value)
          auth.setActiveProject(newSlug)
        closePath = `/projects/${encPathParam(newSlug)}/edit`
      }
      ElMessage.success('项目已保存')
      router.replace(tabsStore.removeTab(closePath) ?? '/')
    }
    else {
      const p = await store.create(form.name, form.code, form.description, form.sourceLanguage)
      ElMessage.success('项目创建成功')
      router.push(`/projects/${encPathParam(p.code || p.id)}`)
    }
  }
  catch {
    ElMessage.error(isEdit.value ? '保存失败' : '创建失败')
  }
  finally {
    loading.value = false
  }
}
</script>

<template>
  <div>
    <BasePageHeader :title="title" />
    <BaseNotice
      v-if="importLocked"
      type="warning"
      :closable="false"
      :title="importLockBannerTitle"
    />
    <BaseForm ref="formRef" :model="form" :rules="rules" label-width="100px" style="max-width:600px">
      <BaseFormItem label="项目名称" prop="name">
        <BaseInput v-model="form.name" placeholder="请输入项目名称" :disabled="loading || importLocked" />
      </BaseFormItem>
      <BaseFormItem label="项目标识" prop="code">
        <BaseInput v-model="form.code" placeholder="英文标识，如 my-project" :disabled="loading || importLocked" />
      </BaseFormItem>
      <BaseFormItem label="项目描述">
        <BaseInput v-model="form.description" type="textarea" placeholder="项目描述(可选)" :disabled="loading || importLocked" />
      </BaseFormItem>
      <BaseFormItem label="源语言" prop="sourceLanguage">
        <BaseSelect v-model="form.sourceLanguage" filterable placeholder="搜索语言..." style="width:100%" :disabled="loading || importLocked">
          <el-option v-for="l in sortedBaseLanguages" :key="l.languageCode" class="base-option" :label="`${l.englishName} (${l.nativeName || ''}) - ${l.languageCode}`" :value="l.languageCode">
            <span class="lang-option">
              <span class="lang-option__name">{{ l.englishName }} ({{ l.nativeName || '' }})</span>
              <span class="lang-option__code">{{ l.languageCode }}</span>
            </span>
          </el-option>
        </BaseSelect>
        <div class="source-hint">
          源语言会自动添加为项目语言（排序最前），其他目标语言请在语言管理中维护
        </div>
      </BaseFormItem>
      <BaseFormItem>
        <div class="form-actions">
          <div class="form-actions__main">
            <BaseButton type="primary" :loading="loading" :disabled="loading || importLocked" @click="handleSubmit">
              {{ isEdit ? '保存' : '创建' }}
            </BaseButton><BaseButton @click="$router.push('/')">
              取消
            </BaseButton>
          </div>
          <BaseButton v-if="isEdit && perm.canDeleteProject.value" type="danger" :disabled="loading || importLocked" @click="handleDelete">
            删除项目
          </BaseButton>
        </div>
      </BaseFormItem>
    </BaseForm>
  </div>
</template>

<style lang="scss" scoped>
.form-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;

  &__main {
    display: flex;
    gap: 8px;
  }
}

.source-hint { color: #909399; font-size: 13px; line-height: 1.6; margin-top: 4px; }
.lang-option { display: flex; align-items: center; justify-content: space-between; gap: 12px; width: 100%; }
.lang-option__name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.lang-option__code { flex: none; color: #909399; font-size: 12px; }
</style>
