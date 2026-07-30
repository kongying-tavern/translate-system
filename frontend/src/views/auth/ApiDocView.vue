<script setup lang="ts">
import type { BaseTableColumnConfig } from '@/components/ui/BaseTable/types'
import { BaseInput, BaseTable } from '@/components/ui'

const headerColumns: BaseTableColumnConfig[] = [
  { dataKey: 'name', title: '参数', width: 180 },
  { dataKey: 'desc', title: '说明' },
]

const paramColumns: BaseTableColumnConfig[] = [
  { dataKey: 'name', title: '参数', width: 150 },
  { dataKey: 'type', title: '类型', width: 100 },
  { dataKey: 'required', title: '必填', width: 60 },
  { dataKey: 'desc', title: '说明' },
]

const headers = [
  { name: 'x-api-key', desc: 'API Key，格式 ak_xxxx，在右上角菜单 → API 密钥 中生成' },
  { name: 'x-api-secret', desc: 'API Secret，生成密钥时一次性返回，需要妥善保管' },
  { name: 'Content-Type', desc: 'application/json' },
]

const params = [
  { name: 'templateId', type: 'string', required: '是', desc: '导出模板 ID，在 导出模板 页面可以查看' },
  { name: 'languageCodes', type: 'string[]', required: '是', desc: '要导出的语言代码列表，如 ["zh-Hans", "en-US"]。语言代码在 语言管理 页面查看' },
  { name: 'filterTags', type: 'string[]', required: '否', desc: '按标签过滤，只导出包含指定标签的行。如 ["urgent"]。不传则导出全部' },
]

const curlExample = `# 导出翻译
curl -X POST http://localhost:8080/api/v1/apikey/projects/项目ID/exports/generate \\
  -H "x-api-key: ak_xxx" \\
  -H "x-api-secret: xxx" \\
  -H "Content-Type: application/json" \\
  -d '{"templateId":"模板ID","languageCodes":["zh-Hans"]}'

# 获取项目翻译列表
curl http://localhost:8080/api/v1/apikey/projects/项目ID/translations \\
  -H "x-api-key: ak_xxx" -H "x-api-secret: xxx"

# 响应格式: { "code": 0, "data": {...} }`
</script>

<template>
  <div>
    <BasePageHeader title="API 文档" />

    <el-card header="导出翻译文件" style="margin-bottom:20px">
      <p style="margin-bottom:12px">
        通过 API Key + Secret 鉴权，代理所有业务接口。只需在原 API 路径前加 <code>/api/v1/apikey</code> 前缀。
      </p>
      <el-descriptions :column="1" border>
        <el-descriptions-item label="端点">
          <code>POST /api/v1/apikey/projects/:projectId/exports/preview</code><br>
          <code>POST /api/v1/apikey/projects/:projectId/exports/generate</code>
        </el-descriptions-item>
        <el-descriptions-item label="鉴权方式">
          请求头 <code>x-api-key</code> + <code>x-api-secret</code>
        </el-descriptions-item>
        <el-descriptions-item label="可用接口">
          <code>/api/v1/apikey/projects/*</code>、<code>/api/v1/apikey/languages/*</code>（等同于内部接口去掉 <code>/apikey</code>）
        </el-descriptions-item>
      </el-descriptions>

      <h4 style="margin:16px 0 8px">
        请求头
      </h4>
      <BaseTable :data="headers" :columns="headerColumns" stripe size="small" />

      <h4 style="margin:16px 0 8px">
        请求体 (JSON)
      </h4>
      <BaseTable :data="params" :columns="paramColumns" stripe size="small" />

      <h4 style="margin:16px 0 8px">
        curl 示例
      </h4>
      <BaseInput :model-value="curlExample" type="textarea" :rows="6" readonly style="font-family:monospace;font-size:13px" />
    </el-card>
  </div>
</template>

<style scoped>
code { background: #f5f7fa; padding: 2px 6px; border-radius: 3px; font-size: 13px; color: #e74c3c; }
</style>
