# 01 — 工程骨架与健康检查

**What to build:** 建立可持续演进的单仓库基线，使管理后台、API 和移动应用都能在本地启动，并通过一个统一契约的 API 健康检查证明工程、共享类型、数据库连接和基础测试链路可用。

**Blocked by:** None — can start immediately.

**Status:** complete

- [x] 仓库锁定 Node.js 22.x，使用 pnpm Workspaces 和 Turborepo，只保留 pnpm 锁文件。
- [x] Next.js 管理后台、独立 Next.js API 和 Expo React Native 移动应用均可通过仓库脚本独立启动。
- [x] 共享 Zod 4 契约包提供统一成功、错误和分页响应的公开契约，三个应用可正常引用。
- [x] Prisma ORM 7 可在本地连接独立 MySQL 数据库，且不使用 Redis 或 Docker 作为本地运行前置条件。
- [x] API 提供存活和就绪检查；就绪检查能区分数据库可用与不可用，且不泄露敏感配置。
- [x] 格式化、Lint、类型检查、单元测试和三个应用的基础构建可由统一命令执行。
- [x] 基础 CI 在冻结锁文件安装后执行上述检查，任一步失败时整体失败。
- [x] 健康检查和统一响应包装具有公开 API 测试，不依赖内部函数实现细节。
