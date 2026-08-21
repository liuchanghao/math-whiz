# 使用 Zod 共享契约且不生成 OpenAPI

REST JSON API 通过 `packages/contracts` 中的 Zod 4 schema 定义请求、响应和业务枚举，供 API、管理后台和移动应用共享 TypeScript 类型；接口路径使用 `/api/v1/mobile/*` 与 `/api/v1/admin/*`。项目明确不生成 OpenAPI 文档或 Swagger UI，以减少重复描述和文档维护，但接受非 TypeScript 客户端缺少语言无关接口描述的限制；Zod 契约和契约测试成为接口结构的来源。
