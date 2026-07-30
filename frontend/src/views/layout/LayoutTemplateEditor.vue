<script setup lang="ts">
import { ElMessage } from 'element-plus'
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { createTemplate, getTemplate, updateTemplate } from '@/api/layout'
import { BaseButton, BaseForm, BaseFormItem, BaseInput, BasePageHeader } from '@/components/ui'

const route = useRoute()
const router = useRouter()
const projectSlug = computed(() => route.params.projectSlug as string)
const templateId = computed(() => route.params.templateId as string)
const isEdit = computed(() => templateId.value && templateId.value !== 'new')
const saving = ref(false)

const form = reactive({ name: '', description: '', thumbnailUrl: '', isDefault: false })
const configStr = ref('{}')

onMounted(async () => {
  if (isEdit.value) {
    const { data: res } = await getTemplate(projectSlug.value, templateId.value)
    const t = res.data
    form.name = t.name
    form.description = t.description || ''
    form.thumbnailUrl = t.thumbnailUrl || ''
    form.isDefault = t.isDefault
    configStr.value = JSON.stringify(t.config, null, 2)
  }
})

async function handleSave() {
  saving.value = true
  try {
    let config: unknown
    try {
      config = JSON.parse(configStr.value)
    }
    catch {
      ElMessage.error('JSON格式错误')
      saving.value = false
      return
    }

    const data = { ...form, config }
    if (isEdit.value) {
      await updateTemplate(projectSlug.value, templateId.value, data)
    }
    else {
      await createTemplate(projectSlug.value, data)
    }
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
    <BasePageHeader :title="isEdit ? '编辑模板' : '新建模板'" />
    <BaseForm :model="form" label-width="100px" style="max-width:700px">
      <BaseFormItem label="名称">
        <BaseInput v-model="form.name" />
      </BaseFormItem>
      <BaseFormItem label="描述">
        <BaseInput v-model="form.description" type="textarea" />
      </BaseFormItem>
      <BaseFormItem label="缩略图URL">
        <BaseInput v-model="form.thumbnailUrl" />
      </BaseFormItem>
      <BaseFormItem label="是否为默认">
        <el-switch v-model="form.isDefault" />
      </BaseFormItem>
      <BaseFormItem label="配置 (JSON)">
        <BaseInput v-model="configStr" type="textarea" :rows="12" placeholder="输入JSON配置..." />
      </BaseFormItem>
      <BaseFormItem>
        <BaseButton type="primary" :loading="saving" @click="handleSave">
          保存
        </BaseButton>
        <BaseButton @click="$router.back()">
          取消
        </BaseButton>
      </BaseFormItem>
    </BaseForm>
  </div>
</template>
