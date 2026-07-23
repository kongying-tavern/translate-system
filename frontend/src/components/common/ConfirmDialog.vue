<template>
  <el-dialog v-model="visible" :title="title" width="400px" @close="$emit('cancel')">
    <p>{{ message }}</p>
    <template #footer>
      <el-button @click="$emit('cancel')">取消</el-button>
      <el-button type="danger" @click="$emit('confirm')">确认</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
defineProps<{ visible: boolean; title: string; message: string }>()
defineEmits<{ confirm: []; cancel: [] }>()
</script>
