<script setup lang="ts">
import type { ComponentExposed } from 'vue-component-type-helpers'
import { ElMessage } from 'element-plus'
import { reactive, ref, useTemplateRef } from 'vue'
import { useRouter } from 'vue-router'
import { BaseButton, BaseForm, BaseFormItem, BaseInput, BasePageHeader } from '@/components/ui'
import { useProjectStore } from '@/stores/project'
import { encPathParam } from '@/utils/path'

const router = useRouter()
const store = useProjectStore()
const loading = ref(false)
const form = reactive({ name: '', code: '', description: '', sourceLanguage: 'en' })
const formRef = useTemplateRef<ComponentExposed<typeof BaseForm>>('formRef')
const rules = { name: [{ required: true, message: '请输入项目名称', trigger: 'blur' }], code: [{ required: true, message: '请输入项目标识', trigger: 'blur' }] }

async function handleCreate() {
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
    const p = await store.create(form.name, form.code, form.description, form.sourceLanguage)
    ElMessage.success('项目创建成功')
    router.push(`/projects/${encPathParam(p.code || p.id)}`)
  }
  catch {
    ElMessage.error('创建失败')
  }
  finally {
    loading.value = false
  }
}
</script>

<template>
  <div>
    <BasePageHeader title="新建项目" />
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
      <BaseFormItem>
        <BaseButton type="primary" :loading="loading" @click="handleCreate">
          创建
        </BaseButton><BaseButton @click="$router.push('/')">
          取消
        </BaseButton>
      </BaseFormItem>
    </BaseForm>
  </div>
</template>
