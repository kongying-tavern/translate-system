<script setup lang="ts">
import type { ComponentExposed } from 'vue-component-type-helpers'
import { ElMessage } from 'element-plus'
import { computed, onMounted, reactive, ref, useTemplateRef } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { BaseButton, BaseForm, BaseFormItem, BaseInput, BasePageHeader } from '@/components/ui'
import { useAuthStore } from '@/stores/auth'
import { useProjectStore } from '@/stores/project'
import { useTabsStore } from '@/stores/tabs'
import { encPathParam } from '@/utils/path'

const router = useRouter()
const route = useRoute()
const store = useProjectStore()
const auth = useAuthStore()
const tabsStore = useTabsStore()
const loading = ref(false)
const loaded = ref(false)
const slug = computed(() => route.params.projectSlug as string | undefined)
const isEdit = computed(() => !!slug.value)
const title = computed(() => (isEdit.value ? '编辑项目' : '新建项目'))
const form = reactive({ name: '', code: '', description: '', sourceLanguage: 'en' })
const formRef = useTemplateRef<ComponentExposed<typeof BaseForm>>('formRef')
const rules = { name: [{ required: true, message: '请输入项目名称', trigger: 'blur' }], code: [{ required: true, message: '请输入项目标识', trigger: 'blur' }] }

onMounted(async () => {
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

async function handleSubmit() {
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
      if (newSlug !== slug.value) {
        tabsStore.renameProjectSlug(slug.value!, newSlug)
        if (auth.activeProjectSlug === slug.value)
          auth.setActiveProject(newSlug)
      }
      ElMessage.success('项目已保存')
      router.replace(`/projects/${encPathParam(newSlug)}/translations`)
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
    <BaseForm ref="formRef" :model="form" :rules="rules" label-width="100px" style="max-width:600px">
      <BaseFormItem label="项目名称" prop="name">
        <BaseInput v-model="form.name" placeholder="请输入项目名称" />
      </BaseFormItem>
      <BaseFormItem label="项目标识" prop="code">
        <BaseInput v-model="form.code" placeholder="英文标识，如 my-project" />
      </BaseFormItem>
      <BaseFormItem label="项目描述">
        <BaseInput v-model="form.description" type="textarea" placeholder="项目描述(可选)" />
      </BaseFormItem>
      <BaseFormItem label="源语言">
        <BaseInput v-model="form.sourceLanguage" placeholder="如 en、zh-Hans" />
      </BaseFormItem>
      <BaseFormItem>
        <BaseButton type="primary" :loading="loading" @click="handleSubmit">
          {{ isEdit ? '保存' : '创建' }}
        </BaseButton><BaseButton @click="$router.push('/')">
          取消
        </BaseButton>
      </BaseFormItem>
    </BaseForm>
  </div>
</template>
