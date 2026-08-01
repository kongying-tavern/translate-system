<script setup lang="ts">
import { Avatar, Collection, Document, Download, Monitor, Upload, User } from '@element-plus/icons-vue'
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { BaseIcon } from '@/components/ui'
import { useProjectPermission } from '@/hooks/useProjectPermission'
import { useAuthStore } from '@/stores/auth'

const route = useRoute()
const auth = useAuthStore()
const perm = useProjectPermission()
const projectSlug = computed(() => (route.params.projectSlug as string) || auth.activeProjectSlug || undefined)
const appName = import.meta.env.VITE_APP_NAME || '翻译管理平台'
</script>

<template>
  <div class="sidebar">
    <div class="sidebar-logo">
      {{ appName }}
    </div>
    <el-menu :default-active="route.path" router background-color="#1d1e2c" text-color="#bfcbd9" active-text-color="#409eff" class="sidebar-menu">
      <el-menu-item v-if="perm.canSeeUserManagement.value" index="/users">
        <BaseIcon><User /></BaseIcon><span>用户管理</span>
      </el-menu-item>
      <template v-if="projectSlug">
        <el-sub-menu index="projects">
          <template #title>
            <BaseIcon><Monitor /></BaseIcon><span>项目管理</span>
          </template>
          <el-menu-item :index="`/projects/${projectSlug}/translations`">
            <BaseIcon><Document /></BaseIcon><span>翻译管理</span>
          </el-menu-item>
          <el-menu-item v-if="perm.canSeeMemberManagement.value" :index="`/projects/${projectSlug}/members`">
            <BaseIcon><Avatar /></BaseIcon><span>项目成员</span>
          </el-menu-item>
          <el-menu-item v-if="perm.canSeeLanguageManagement.value" :index="`/projects/${projectSlug}/languages`">
            <BaseIcon><Collection /></BaseIcon><span>语言管理</span>
          </el-menu-item>
          <el-menu-item v-if="perm.canSeeImportManagement.value" :index="`/projects/${projectSlug}/imports`">
            <BaseIcon><Upload /></BaseIcon><span>导入管理</span>
          </el-menu-item>
          <el-menu-item v-if="perm.canSeeExportManagement.value" :index="`/projects/${projectSlug}/exports`">
            <BaseIcon><Download /></BaseIcon><span>导出模板</span>
          </el-menu-item>
        </el-sub-menu>
      </template>
    </el-menu>
    <div class="sidebar-bottom">
      <el-menu :default-active="route.path" router background-color="#1d1e2c" text-color="#bfcbd9" active-text-color="#409eff">
        <el-menu-item index="/api-doc">
          <BaseIcon><Document /></BaseIcon><span>开放接口说明</span>
        </el-menu-item>
      </el-menu>
    </div>
  </div>
</template>

<style scoped>
.sidebar { height: 100%; display: flex; flex-direction: column; }
.sidebar-logo { color: #fff; font-size: 18px; font-weight: bold; text-align: center; padding: 18px 0; border-bottom: 1px solid rgba(255,255,255,.08); }
.sidebar-menu { flex: 1; border-right: none; }
.sidebar-bottom { border-top: 1px solid rgba(255,255,255,.08); }
.el-menu { border-right: none; }
</style>
