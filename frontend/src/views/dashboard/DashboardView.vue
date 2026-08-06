<script setup lang="ts">
import type { Project } from '@/types/models'
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { BaseButton } from '@/components/ui'
import { useAuthStore } from '@/stores/auth'
import { useProjectStore } from '@/stores/project'
import { projectRoleLabel, SystemRole } from '@/utils/roles'
import { encSlug } from '@/utils/slug'

const router = useRouter()
const auth = useAuthStore()
const store = useProjectStore()
const loading = ref(true)

onMounted(async () => {
  await store.fetchProjects()
  loading.value = false
  if (store.projects.length === 0)
    auth.setActiveProject('')
})

function goProject(p: Project): void {
  router.push(`/projects/${encSlug(p.code || p.id)}`)
}
</script>

<template>
  <div>
    <div v-if="loading" class="home-loading">
      加载中...
    </div>
    <div v-else-if="store.projects.length === 0" class="home-empty">
      <p class="home-empty__text">
        暂无可用项目
      </p>
      <BaseButton v-if="auth.role === SystemRole.SuperAdmin" type="primary" @click="$router.push('/projects/new')">
        创建第一个项目
      </BaseButton>
      <p v-else class="home-empty__hint">
        请联系管理员添加你为项目成员
      </p>
    </div>
    <div v-else class="project-grid">
      <div
        v-for="p in store.projects" :key="p.id"
        class="project-card" @click="goProject(p)"
      >
        <div class="project-card__top">
          <span class="project-card__name">{{ p.name }}</span>
          <span v-if="p.projectRole" class="project-card__role">{{ projectRoleLabel(p.projectRole) }}</span>
        </div>
        <code v-if="p.code" class="project-card__code">{{ p.code }}</code>
        <p
          v-if="p.description"
          class="project-card__desc"
        >
          {{ p.description }}
        </p>
        <div class="project-card__bottom">
          <span>源语言：{{ p.sourceLanguage }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.home-loading {
  text-align: center;
  padding: 80px 0;
  color: #909399;
}

.home-empty {
  text-align: center;
  padding: 80px 0;

  &__text {
    font-size: 16px;
    color: #909399;
    margin-bottom: 20px;
  }

  &__hint {
    font-size: 14px;
    color: #c0c4cc;
  }
}

.project-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
}

.project-card {
  display: flex;
  flex-direction: column;
  background: #fff;
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  padding: 16px;
  cursor: pointer;
  transition: box-shadow 0.2s, border-color 0.2s;

  &:hover {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
    border-color: #c6e2ff;
  }

  &__top {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  &__name {
    font-size: 16px;
    font-weight: 600;
    color: #303133;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__role {
    flex-shrink: 0;
    font-size: 12px;
    color: #409eff;
    background: #ecf5ff;
    border-radius: 4px;
    padding: 2px 6px;
  }

  &__code {
    margin-top: 10px;
    display: inline-block;
    align-self: flex-start;
    max-width: 100%;
    font-family: 'JetBrains Mono', Consolas, Menlo, monospace;
    font-size: 12px;
    line-height: 1.6;
    color: #476582;
    background: #f6f8fa;
    border: 1px solid #e1e4e8;
    border-radius: 4px;
    padding: 1px 8px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__desc {
    flex: 1;
    margin-top: 12px;
    font-size: 13px;
    line-height: 1.6;
    color: #606266;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    word-break: break-word;
  }

  &__bottom {
    margin-top: 12px;
    padding-top: 10px;
    border-top: 1px solid #f0f2f5;
    display: flex;
    justify-content: space-between;
    font-size: 12px;
    color: #909399;
  }
}
</style>
