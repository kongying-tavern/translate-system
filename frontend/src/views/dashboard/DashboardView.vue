<script setup lang="ts">
import type { Project } from '@/types/models'
import { Delete, Edit } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { BaseButton, BaseIcon } from '@/components/ui'
import { useProjectPermission } from '@/hooks/useProjectPermission'
import { useAuthStore } from '@/stores/auth'
import { useProjectStore } from '@/stores/project'
import { useTabsStore } from '@/stores/tabs'
import { encPathParam } from '@/utils/path'
import { projectRoleLabel } from '@/utils/roles'

const router = useRouter()
const auth = useAuthStore()
const store = useProjectStore()
const tabsStore = useTabsStore()
const perm = useProjectPermission()
const loading = ref(true)

onMounted(async () => {
  await store.fetchProjects()
  loading.value = false
  if (store.projects.length === 0)
    auth.setActiveProject('')
})

function goProject(p: Project): void {
  router.push(`/projects/${encPathParam(p.code || p.id)}`)
}

function editProject(p: Project): void {
  router.push(`/projects/${encPathParam(p.code || p.id)}/edit`)
}

async function deleteProject(p: Project): Promise<void> {
  try {
    await ElMessageBox.confirm(`确定删除项目「${p.name}」吗？该操作不可恢复。`, '删除项目', { type: 'warning' })
  }
  catch {
    return
  }
  try {
    const slug = p.code || p.id
    await store.remove(slug)
    if (auth.activeProjectSlug === slug)
      auth.setActiveProject('')
    tabsStore.removeProjectTabs(slug)
    ElMessage.success('项目已删除')
  }
  catch {
    ElMessage.error('删除失败')
  }
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
      <BaseButton v-if="perm.canCreateProject.value" type="primary" @click="$router.push('/projects/new')">
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
          <span class="project-card__lang">
            源语言：<code class="project-card__lang-code">{{ p.sourceLanguage }}</code>
          </span>
          <div v-if="perm.canEditProject.value" class="project-card__actions" @click.stop>
            <BaseButton link size="small" class="project-card__action" title="编辑" @click.stop="editProject(p)">
              <BaseIcon size="16">
                <Edit />
              </BaseIcon>
            </BaseButton>
            <BaseButton link type="danger" size="small" class="project-card__action" title="删除" @click.stop="deleteProject(p)">
              <BaseIcon size="16">
                <Delete />
              </BaseIcon>
            </BaseButton>
          </div>
        </div>
      </div>
      <div
        v-if="perm.canCreateProject.value"
        class="project-card project-card--add" @click="$router.push('/projects/new')"
      >
        <span class="project-card--add__icon">+</span>
        <span class="project-card--add__text">新建项目</span>
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
  padding: 12px 16px;
  cursor: pointer;
  min-height: 163px;
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
    margin-top: auto;
    padding-top: 6px;
    border-top: 1px solid #f0f2f5;
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 12px;
    color: #909399;
  }

  &__lang {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }

  &__lang-code {
    font-family: 'JetBrains Mono', Consolas, Menlo, monospace;
    font-size: 12px;
    line-height: 1.6;
    color: #476582;
    background: #f6f8fa;
    border: 1px solid #e1e4e8;
    border-radius: 4px;
    padding: 0 6px;
  }

  &__actions {
    display: flex;
    align-items: center;
    gap: 2px;
  }

  &__action {
    padding: 0 2px;
    height: auto;
  }

  &--add {
    align-items: center;
    justify-content: center;
    border-style: dashed;
    color: #909399;

    &:hover {
      border-color: #409eff;
      color: #409eff;
      box-shadow: none;
    }

    &__icon {
      font-size: 28px;
      line-height: 1;
    }

    &__text {
      margin-top: 8px;
      font-size: 14px;
    }
  }
}
</style>
