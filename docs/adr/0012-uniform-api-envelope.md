# API 使用统一响应包装

所有成功操作统一返回 HTTP 200 和 `{ status: 200, message, data }`，包括创建、修改和删除；错误同时使用对应的 HTTP 状态与相同数值的响应体 `status`，并在 `data.errorCode` 提供机器可读错误码。无业务数据时返回 `data: null`，分页数据固定为 `{ items, page, pageSize, total }`。这一约定牺牲了 201、204 等更细的 HTTP 成功语义，但让移动应用和管理后台只需维护一种成功包装；HTTP 与响应体状态仍保持一致，以保留网关、日志和监控对错误的正确识别。
