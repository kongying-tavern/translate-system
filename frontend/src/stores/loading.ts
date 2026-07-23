import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useLoadingStore = defineStore('loading', () => {
  const loading = ref(false)
  let count = 0
  function start() { count++; loading.value = true }
  function stop() { count--; if (count <= 0) { count = 0; loading.value = false } }
  return { loading, start, stop }
})
