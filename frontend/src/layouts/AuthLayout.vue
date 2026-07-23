<template>
  <div class="auth-layout">
    <div class="auth-bg"><div class="bg-circle c1" /><div class="bg-circle c2" /></div>
    <div class="auth-card">
      <h1 class="auth-title">空荧酒馆译站</h1>
      <router-view />
    </div>
  </div>
</template>

<style scoped>
.auth-layout {
  min-height: 100vh; display: flex; align-items: center; justify-content: center;
  background: linear-gradient(135deg, #e8edf5 0%, #dce3f0 50%, #e3e8f5 100%);
  overflow: hidden; position: relative;
}
.auth-bg { position: absolute; inset: 0; }
.bg-circle { position: absolute; border-radius: 50%; opacity: .25; }
.c1 { width: 600px; height: 600px; background: #409eff; top: -250px; right: -120px; }
.c2 { width: 400px; height: 400px; background: #6366f1; bottom: -120px; left: -80px; }
.auth-card {
  background: rgba(255,255,255,.55);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255,255,255,.6);
  padding: 52px 48px; border-radius: 20px;
  width: 400px; position: relative; z-index: 1;
  box-shadow: 0 8px 40px rgba(0,0,0,.08);
}
.auth-title { text-align: center; color: #1a1a2e; font-size: 28px; font-weight: 700; margin: 0 0 40px; letter-spacing: 2px; }
</style>
