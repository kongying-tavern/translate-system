<script setup lang="ts">
import type { FormRules } from 'element-plus'
import type { ComponentExposed } from 'vue-component-type-helpers'
import { ElMessage } from 'element-plus'
import { computed, reactive, ref, useTemplateRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { createExportTemplate, getExportTemplate, updateExportTemplate } from '@/api/export'
import { BaseButton, BaseCheckbox, BaseForm, BaseFormItem, BaseInput, BasePageHeader, BaseSelect } from '@/components/ui'
import { EXPORT_FORMAT_MAP, ExportFormat } from '@/data/exportFormats'
import { useProjectPermission } from '@/hooks/useProjectPermission'
import { decPathParam } from '@/utils/path'

const route = useRoute()
const router = useRouter()
const perm = useProjectPermission()
const projectSlug = computed(() => decPathParam(route.params.projectSlug as string) as string)
const templateId = computed(() => decPathParam(route.params.templateId as string) as string)
const isEdit = computed(() => templateId.value && templateId.value !== 'new')
const saving = ref(false)
const formRef = useTemplateRef<ComponentExposed<typeof BaseForm>>('formRef')

const formatOptions = computed(() =>
  Object.entries(EXPORT_FORMAT_MAP).map(([value, meta]) => ({
    value,
    label: `${value} — ${meta.format}`,
    tags: meta.tags.join('、'),
  })),
)

const form: { name: string, code: string, description: string, formatType: ExportFormat } = reactive({ name: '', code: '', description: '', formatType: ExportFormat.NestedJson })
const configForm = reactive({ skipIdentical: false, skipEmpty: false, useCodeKey: false })

const rules: FormRules = {
  name: [
    { required: true, message: '名称不能为空', trigger: 'blur' },
    { max: 50, message: '名称长度不能超过 50 字符', trigger: 'blur' },
  ],
  code: [
    { required: true, message: '标识不能为空', trigger: 'blur' },
    { pattern: /^[a-z0-9][\w.-]*$/i, message: '仅支持字母、数字、中划线、下划线、点', trigger: 'blur' },
  ],
  formatType: [{ required: true, message: '请选择输出格式', trigger: 'change' }],
}

watch(projectSlug, async () => {
  if (!perm.canManageExportTemplates.value) {
    ElMessage.warning('没有权限')
    router.back()
    return
  }
  if (isEdit.value) {
    const { data: res } = await getExportTemplate(projectSlug.value, templateId.value)
    form.name = res.data.name
    form.code = res.data.code || ''
    form.description = res.data.description || ''
    form.formatType = res.data.formatType as ExportFormat
    if (res.data.config) {
      const cfg = res.data.config as Record<string, unknown>
      configForm.skipIdentical = !!cfg.skipIdentical
      configForm.skipEmpty = !!cfg.skipEmpty
      configForm.useCodeKey = !!cfg.useCodeKey
    }
  }
}, { immediate: true })

async function handleSave() {
  if (!formRef.value)
    return
  try {
    await formRef.value.validate()
  }
  catch {
    return
  }
  saving.value = true
  try {
    const config = { ...configForm }
    const data = { ...form, config }
    if (isEdit.value) {
      await updateExportTemplate(projectSlug.value, templateId.value, data)
    }
    else {
      await createExportTemplate(projectSlug.value, data)
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
    <BasePageHeader :title="isEdit ? '编辑导出模板' : '新建导出模板'" />
    <BaseForm ref="formRef" :model="form" :rules="rules" label-width="100px" style="max-width:700px">
      <BaseFormItem label="名称" prop="name">
        <BaseInput v-model="form.name" />
      </BaseFormItem>
      <BaseFormItem label="模板标识" prop="code">
        <BaseInput v-model="form.code" placeholder="英文标识，如 config-json" />
      </BaseFormItem>
      <BaseFormItem label="描述">
        <BaseInput v-model="form.description" type="textarea" />
      </BaseFormItem>
      <BaseFormItem label="输出格式" prop="formatType">
        <BaseSelect v-model="form.formatType" style="width:100%">
          <el-option v-for="fmt in formatOptions" :key="fmt.value" class="base-option" :label="fmt.label" :value="fmt.value">
            <span>{{ fmt.value }}</span>
            <span style="float:right;color:#909399;font-size:12px">{{ fmt.tags }}</span>
          </el-option>
        </BaseSelect>
      </BaseFormItem>
      <BaseFormItem label="配置">
        <div style="display:flex;flex-direction:column;gap:8px">
          <BaseCheckbox v-model="configForm.skipIdentical">
            跳过 Key 和译文相同的行（源语言）
          </BaseCheckbox>
          <BaseCheckbox v-model="configForm.skipEmpty">
            跳过译文为空的行
          </BaseCheckbox>
          <BaseCheckbox v-model="configForm.useCodeKey">
            使用原始语言 Code（不应用别名）
          </BaseCheckbox>
        </div>
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
