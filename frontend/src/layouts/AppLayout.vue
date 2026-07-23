<template>
  <el-container class="app-layout">
    <el-aside width="220px"><AppSidebar /></el-aside>
    <el-container>
      <el-header height="56px"><AppHeader /></el-header>
      <el-main style="position:relative">
        <router-view />
        <div v-if="loadingStore.loading" class="loading-overlay"><el-icon class="loading-icon" :size="40"><Loading /></el-icon></div>
      </el-main>
    </el-container>
  </el-container>
</template>

<script setup lang="ts">
import { Loading } from '@element-plus/icons-vue'
import { useLoadingStore } from '@/stores/loading'
import AppHeader from '@/components/common/AppHeader.vue'
import AppSidebar from '@/components/common/AppSidebar.vue'

const loadingStore = useLoadingStore()
</script>

<style scoped>
.app-layout { height: 100vh; }
.el-aside { background: #1d1e2c; overflow-x: hidden; }
.el-header { background: #fff; border-bottom: 1px solid #e4e7ed; display: flex; align-items: center; padding: 0 20px; }
.el-main { background: #f5f7fa; padding: 20px; }
.loading-overlay { position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: rgba(255,255,255,.7); display: flex; align-items: center; justify-content: center; z-index: 1000; }
.loading-icon { animation: spin 1s linear infinite; color: #409eff; }
@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
</style>
