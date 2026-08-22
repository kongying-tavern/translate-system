<script setup lang="ts">
import type { LayoutTemplate } from '@/types/models'
import { ElMessage } from 'element-plus'
import { computed, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { createConfig, getConfig, getTemplates, updateConfig } from '@/api/layout'
import { BaseButton, BaseForm, BaseFormItem, BaseInput, BasePageHeader, BaseSelect } from '@/components/ui'
import { decPathParam } from '@/utils/path'

const route = useRoute()
const router = useRouter()
const projectSlug = computed(() => decPathParam(route.params.projectSlug as string) as string)
const configId = computed(() => decPathParam(route.params.configId as string) as string)
const isEdit = computed(() => configId.value && configId.value !== 'new')
const saving = ref(false)
const templates = ref<LayoutTemplate[]>([])

const form = reactive({ name: '', templateId: '' as string | null })
const overrideStr = ref('{}')

watch(projectSlug, async () => {
  const { data: tRes } = await getTemplates(projectSlug.value)
  templates.value = tRes.data
  if (isEdit.value) {
    const { data: res } = await getConfig(projectSlug.value, configId.value)
    form.name = res.data.name
    form.templateId = res.data.templateId
    overrideStr.value = JSON.stringify(res.data.overrideConfig, null, 2)
  }
}, { immediate: true })

async function handleSave() {
  saving.value = true
  try {
    let override: unknown
    try {
      override = JSON.parse(overrideStr.value)
    }
    catch {
      ElMessage.error('JSON格式错误')
      saving.value = false
      return
    }

    const data = { name: form.name, templateId: form.templateId || '', overrideConfig: override }
    if (isEdit.value) {
      await updateConfig(projectSlug.value, configId.value, data)
    }
    else {
      await createConfig(projectSlug.value, data)
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
    <BasePageHeader :title="isEdit ? '编辑配置' : '新建配置'" />
    <BaseForm :model="form" label-width="100px" style="max-width:700px">
      <BaseFormItem label="名称">
        <BaseInput v-model="form.name" />
      </BaseFormItem>
      <BaseFormItem label="引用模板">
        <BaseSelect v-model="form.templateId" clearable placeholder="可选" style="width:100%">
          <el-option v-for="t in templates" :key="t.id" class="base-option" :label="t.name" :value="t.id" />
        </BaseSelect>
      </BaseFormItem>
      <BaseFormItem label="覆盖配置 (JSON)">
        <BaseInput v-model="overrideStr" type="textarea" :rows="12" placeholder="输入JSON覆盖配置..." style="font-family:monospace;font-size:13px" />
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
