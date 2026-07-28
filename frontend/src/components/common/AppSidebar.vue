<script setup lang="ts">
import { Avatar, Collection, Document, Download, Monitor, Upload, User } from '@element-plus/icons-vue'
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { SystemRole } from '@/utils/roles'

const route = useRoute()
const auth = useAuthStore()
const projectSlug = computed(() => (route.params.projectSlug as string) || auth.activeProjectSlug || undefined)
</script>

<template>
  <div class="sidebar">
    <div class="sidebar-logo">
      空荧酒馆译站
    </div>
    <el-menu :default-active="route.path" router background-color="#1d1e2c" text-color="#bfcbd9" active-text-color="#409eff" class="sidebar-menu">
      <el-menu-item v-if="auth.role === SystemRole.SuperAdmin || auth.role === SystemRole.Admin" index="/users">
        <el-icon><User /></el-icon><span>用户管理</span>
      </el-menu-item>
      <template v-if="projectSlug">
        <el-sub-menu index="projects">
          <template #title>
            <el-icon><Monitor /></el-icon><span>项目管理</span>
          </template>
          <el-menu-item :index="`/projects/${projectSlug}/translations`">
            <el-icon><Document /></el-icon><span>翻译管理</span>
          </el-menu-item>
          <el-menu-item v-if="auth.role !== SystemRole.User" :index="`/projects/${projectSlug}/members`">
            <el-icon><Avatar /></el-icon><span>项目成员</span>
          </el-menu-item>
          <el-menu-item v-if="auth.role !== SystemRole.User" :index="`/projects/${projectSlug}/languages`">
            <el-icon><Collection /></el-icon><span>语言管理</span>
          </el-menu-item>
          <el-menu-item v-if="auth.role !== SystemRole.User" :index="`/projects/${projectSlug}/imports`">
            <el-icon><Upload /></el-icon><span>导入管理</span>
          </el-menu-item>
          <el-menu-item v-if="auth.role !== SystemRole.User" :index="`/projects/${projectSlug}/exports`">
            <el-icon><Download /></el-icon><span>导出模板</span>
          </el-menu-item>
        </el-sub-menu>
      </template>
    </el-menu>
    <div v-if="auth.role !== SystemRole.User" class="sidebar-bottom">
      <el-menu :default-active="route.path" router background-color="#1d1e2c" text-color="#bfcbd9" active-text-color="#409eff">
        <el-menu-item index="/api-doc">
          <el-icon><Document /></el-icon><span>API 说明</span>
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
