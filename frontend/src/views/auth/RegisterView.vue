<template>
  <div class="login-wrap">
    <div class="input-group">
      <el-icon class="input-icon"><User /></el-icon>
      <input v-model="form.username" placeholder="用户名" class="dark-input" />
    </div>
    <div class="input-group">
      <el-icon class="input-icon"><Message /></el-icon>
      <input v-model="form.email" placeholder="邮箱" class="dark-input" />
    </div>
    <div class="input-group">
      <el-icon class="input-icon"><Lock /></el-icon>
      <input v-model="form.password" :type="showPwd ? 'text' : 'password'" placeholder="密码（至少6位）" class="dark-input" />
      <el-icon class="input-icon toggle-pwd" @click="showPwd = !showPwd"><View v-if="!showPwd" /><Hide v-else /></el-icon>
    </div>
    <button class="login-btn" :disabled="loading" @click="handleRegister">
      <span v-if="loading">注册中...</span><span v-else>注 册</span>
    </button>
    <div class="login-footer">
      <router-link to="/auth/login">已有账号？立即登录</router-link>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { ElMessage } from 'element-plus'
import { User, Message, Lock, View, Hide } from '@element-plus/icons-vue'

const auth = useAuthStore()
const router = useRouter()
const loading = ref(false)
const showPwd = ref(false)
const form = reactive({ username: '', email: '', password: '' })

async function handleRegister() {
  if (!form.username || !form.email || !form.password) { ElMessage.warning('请填写完整信息'); return }
  if (form.username.length < 3) { ElMessage.warning('用户名至少3个字符'); return }
  if (form.password.length < 6) { ElMessage.warning('密码至少6位'); return }
  loading.value = true
  try { await auth.register(form.username, form.email, form.password); ElMessage.success('注册成功'); router.push('/') } catch (e: any) { ElMessage.error(e.response?.data?.message || '注册失败') }
  finally { loading.value = false }
}
</script>

<style scoped>
.login-wrap { display: flex; flex-direction: column; gap: 16px; }
.input-group { position: relative; display: flex; align-items: center; }
.input-icon { position: absolute; left: 14px; color: #909399; font-size: 18px; z-index: 1; }
.toggle-pwd { left: auto; right: 14px; cursor: pointer; }
.dark-input {
  width: 100%; height: 46px; padding: 0 42px; background: #f5f7fa;
  border: 1px solid #e4e7ed; border-radius: 10px; color: #303133;
  font-size: 14px; outline: none; transition: border-color .2s;
}
.dark-input::placeholder { color: #c0c4cc; }
.dark-input:focus { border-color: #409eff; background: #fff; }
.login-btn {
  width: 100%; height: 46px; background: #409eff; color: #fff; border: none;
  border-radius: 10px; font-size: 15px; font-weight: 600; letter-spacing: 4px;
  cursor: pointer; transition: background .2s;
}
.login-btn:hover { background: #337ecc; }
.login-btn:disabled { opacity: .6; cursor: not-allowed; }
.login-footer { text-align: center; margin-top: 4px; }
.login-footer a { color: #909399; font-size: 13px; text-decoration: none; }
.login-footer a:hover { color: #409eff; }
</style>
