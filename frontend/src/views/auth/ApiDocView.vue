<template>
  <div>
    <div class="page-header"><h2>API 接口说明</h2></div>

    <el-card header="导出翻译文件" style="margin-bottom:20px">
      <p style="margin-bottom:12px">通过 API Key + Secret 鉴权，代理所有业务接口。只需在原 API 路径前加 <code>/api/v1/apikey</code> 前缀。</p>
      <el-descriptions :column="1" border>
        <el-descriptions-item label="端点">
          <code>POST /api/v1/apikey/projects/:projectId/exports/preview</code><br/>
          <code>POST /api/v1/apikey/projects/:projectId/exports/generate</code>
        </el-descriptions-item>
        <el-descriptions-item label="鉴权方式">请求头 <code>x-api-key</code> + <code>x-api-secret</code></el-descriptions-item>
        <el-descriptions-item label="可用接口"><code>/api/v1/apikey/projects/*</code>、<code>/api/v1/apikey/languages/*</code>（等同于内部接口去掉 <code>/apikey</code>）</el-descriptions-item>
      </el-descriptions>

      <h4 style="margin:16px 0 8px">请求头</h4>
      <el-table :data="headers" stripe size="small"><el-table-column prop="name" label="参数" width="180" /><el-table-column prop="desc" label="说明" /></el-table>

      <h4 style="margin:16px 0 8px">请求体 (JSON)</h4>
      <el-table :data="params" stripe size="small"><el-table-column prop="name" label="参数" width="150" /><el-table-column prop="type" label="类型" width="100" /><el-table-column prop="required" label="必填" width="60" /><el-table-column prop="desc" label="说明" /></el-table>

      <h4 style="margin:16px 0 8px">curl 示例</h4>
      <el-input :model-value="curlExample" type="textarea" :rows="6" readonly style="font-family:monospace;font-size:13px" />
    </el-card>
  </div>
</template>

<script setup lang="ts">
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

<style scoped>
.page-header { margin-bottom: 20px; } .page-header h2 { margin: 0; }
code { background: #f5f7fa; padding: 2px 6px; border-radius: 3px; font-size: 13px; color: #e74c3c; }
</style>
