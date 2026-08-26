# 代码规范

> 本篇说明代码硬性规范：密码处理、TypeScript 禁 any、行尾与提交要求。

## 密码规范

密码长度 **至少 6 位**，无最大长度限制，无可用字符限制。前后端同时校验，后端所有密码入口（注册、改密、创建用户）统一检查 `password.length < 6`。

## TypeScript

- 禁止使用 `any`；无法确定类型时用 `unknown`
- `catch (e: any)` 一律写成 `catch (e: unknown)`，要访问属性时用类型断言
- `tsconfig.json` 已开启 `strict: true`（含 noImplicitAny）——隐式 `any` 也过不了编译

## 行尾

文本文件统一使用 LF（`\n`）换行，文件末尾保留一个空行。`.gitattributes` 已配置 `* text=auto eol=lf`，新增或修改的文件会自动标准化。

如需手动转换现有文件：
```bash
# 将已跟踪文件的行尾标准化为 LF
git add --renormalize .
```
