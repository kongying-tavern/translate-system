# 部署指南（Docker）

> Docker 部署与大文件上传调优。

## 快速部署

```bash
cp .env.example .env      # 至少修改 POSTGRES_PASSWORD、JWT_SECRET
docker compose up -d --build
```

- 改过 `Dockerfile` / `startup.sh` / `pnpm-lock.yaml` / 后端源码后，需要加 `--build`
- 数据库迁移随启动自动执行（prisma migrate deploy），新迁移必须随代码提交

## 端口（跟随根 `.env`）

| 服务 | 默认端口 | 配置项 |
|------|:---:|------|
| 前端入口 | 21010 | FRONTEND_PORT |
| 后端 API | 21080 | BACKEND_PORT |
| PostgreSQL | 21432 | POSTGRES_PORT |

## 大文件导入调优

后端已放开 **200MB 请求体 / 10 分钟超时**。前面的反向代理不同步放行会报 **413**（请求体超限）或 **504**（超时）：

| 链路 | 要改的配置 |
|------|-----------|
| nginx（含自带 frontend/nginx.conf） | `client_max_body_size 200m` + `proxy_read/send_timeout 600s` |
| Caddy | `request_body { max_size 200MB }` |
| Nginx Ingress (k8s) | annotation `proxy-body-size: "200m"` + 调大 timeout 注解 |
| 云 LB / 宝塔面板 | 调大「上传大小」和「代理超时」两项 |

> 前端 axios 的导入请求已设 `timeout: 600000`，无需处理。

## Node 内存

大文件导入会占用数 GB 堆内存：

- Docker：`.env` 里 `NODE_MEMORY_MB=4096` 已自动拼进容器的 NODE_OPTIONS
- 本地开发 OOM 时：先 `export NODE_OPTIONS=--max-old-space-size=4096` 再 `pnpm dev`

## 相关文档

- [本地开发指南](development.md)
- [API 文档](api-docs.md)
