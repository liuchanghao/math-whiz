# 使用 Prisma ORM 7 和 Prisma Migrate

独立 Next.js API 使用 Prisma ORM 7 访问阿里云 RDS MySQL 8.4，并使用 Prisma Migrate 维护提交到仓库的 SQL 迁移历史。本地通过 `prisma migrate dev` 创建和验证迁移，线上只执行 `prisma migrate deploy`，禁止使用 `db push` 直接改变生产结构。这一选择以 Prisma 的类型安全、MySQL 8.4 支持和统一迁移工作流换取对 Prisma schema、生成客户端及迁移工具链的依赖。
