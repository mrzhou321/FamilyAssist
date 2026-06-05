# FamilyAssister 前端代码评审报告

**评审日期**: 2026-06-05  
**评审范围**: `frontend/src/` 全部 TypeScript / CSS 文件  
**代码状态**: MVP 骨架阶段，已有双入口框架 + 移动端三页 + 后台成员页

---

## P0 必修（影响正确性或安全性）

### 1. 硬编码 `member_id=1`，移动端无真实身份

**位置**: `mobile/pages/TodayAdvice.tsx`、`QuickNote.tsx`

移动端所有 API 调用都在用假的 member_id，配对认证（M4 里程碑）完成前会一直是错的。应立刻建一个 `useAuth` hook 持有当前成员身份，所有页面从它取 id，而不是写死。

```ts
// shared/hooks/useAuth.ts（新建）
export function useAuth() {
  const raw = localStorage.getItem('token')
  if (!raw) return { memberId: null }
  const payload = JSON.parse(atob(raw.split('.')[1]))
  return { memberId: payload.member_id as number }
}
```

---

### 2. Mock 数据写死在页面组件里

**位置**: `QuickNote.tsx`、`MemoryVault.tsx`、`admin/pages/Members.tsx`

`SAMPLE_NOTES`、`MEMORIES`、`INITIAL_MEMBERS` 都是写死的测试数据，混在组件内，联调后端时无法干净切换。应集中到 `shared/mocks/index.ts`，生产环境用 `import.meta.env.DEV` 控制是否加载。

---

### 3. SSE stream 错误被完全吞掉

**位置**: `shared/api/index.ts:40`

```ts
}).catch(() => {})  // ← 调用者永远不知道出错了
```

且 `res.body!` 用了非空断言，body 为 null 时直接 crash。至少要：
1. 去掉 `!`，加 null 检查
2. catch 里调用 `onChunk` 传一个错误标记，让 UI 能展示「建议获取失败，请重试」

---

### 4. Token 存 localStorage，XSS 可直接窃取

**位置**: `shared/api/index.ts:4`

localStorage 无法对 XSS 防护，PWA 场景建议两种替代：
- **sessionStorage**（关闭浏览器即清除，稍安全）
- **内存变量 + refresh token 存 HttpOnly cookie**（最安全，需后端配合）

自托管局域网场景风险相对低，但架构层面应留出升级路径。最低修改：加 `KEY` 常量，避免裸字符串 `'token'` 散落多处。

---

## P1 建议（影响可维护性，应在 M4 前修复）

### 5. 类型在组件内重复定义，未复用 `shared/types`

**位置**: `TodayAdvice.tsx:6–10`、`Members.tsx:22–39`

`Recommendation`、`ApiMember` 等类型已在 `shared/types/index.ts` 有定义或可以加进去，但页面组件各自重新定义了一套局部类型。后端 schema 变更时要改多处。

修复方式：删除局部类型定义，从 `@shared/types` import。同时 `shared/types/index.ts` 里的 `Recommendation` 缺少 `basis`、`content` 字段，需补全。

---

### 6. 颜色常量硬编码，与设计 token 脱节

**位置**: `MemoryVault.tsx:5`（`'#C8704F'`）、`TodayAdvice.tsx:23–49`（`'#FDF0E8'`、`'#F0C9A8'` 等）

这些颜色是从设计稿来的，但没有绑定到 `globals.css` 里的 `@theme` 变量。改设计 token 时会遗漏这里。

```ts
// shared/constants/colors.ts（新建）
export const DOMAIN_COLORS = {
  dressing: { bg: 'var(--color-advice-dressing-bg)', border: '...' },
  diet:     { bg: 'var(--color-advice-diet-bg)',     border: '...' },
  exercise: { bg: 'var(--color-advice-exercise-bg)', border: '...' },
} as const
```

对应在 `globals.css @theme` 里补三组变量，颜色值写一处。

---

### 7. 魔法字符串和成员列表散落多处

`['全家', '爸爸', '妈妈', '朵朵']`、`'dressing' | 'diet' | 'exercise'` 在三四个文件里各写了一遍。

```ts
// shared/constants/index.ts（新建）
export const DOMAINS = ['dressing', 'diet', 'exercise'] as const
export type Domain = (typeof DOMAINS)[number]
```

---

### 8. React Query 未在 `QuickNote` 的提交流程中使用

`QuickNote.tsx` 里手动调 `api.post` + 手动管状态，但 `shared/hooks` 里已有 `useCreateNote`。直接用 mutation：提交、loading、error 状态一并处理，且失败后 React Query 会自动重试。

---

### 9. TodayAdvice 并发三个请求，后端应支持批量

```ts
Promise.all(ADVICE_META.map(meta => api.get(`/recommendations/${meta.domain}?member_id=1`)))
```

三个串联请求。后端推荐管线是通用的，建议加一个 `/recommendations?domains=all` 的批量端点，一次返回三域结果，减少 RTT。

---

## P2 优化（体验提升，M7 阶段处理）

### 10. 缺少 Error Boundary

两个入口的 `main.tsx` 都没有 Error Boundary，页面抛异常时白屏无提示。`react-error-boundary` 包 5 行搞定，建议包在 `<Routes>` 外层。

### 11. PWA 配置缺失

`vite.config.ts` 里未加 `vite-plugin-pwa`。M7 阶段要做的，但 `package.json` 现在就可以先装上以免届时版本冲突：`npm install -D vite-plugin-pwa`。

### 12. 离线队列未监听 `online` 事件

`quickNoteQueue.ts` 现在只在提交时检查 `navigator.onLine`，不会在恢复网络后自动重试。需加：
```ts
window.addEventListener('online', flushQueue)
```

---

## 汇总

| 优先级 | 问题 | 修复时机 |
|--------|------|---------|
| P0 | 硬编码 member_id | 联调 M4 前 |
| P0 | Mock 数据混入组件 | 立刻 |
| P0 | SSE 错误吞掉 | 立刻 |
| P0 | Token 存储方式 | M4 认证实现时一并解决 |
| P1 | 类型重复定义 | M4 前 |
| P1 | 颜色常量脱离 token | M5 推荐页开发前 |
| P1 | 魔法字符串 | M4 前 |
| P1 | Query mutation 未用 | M4 前 |
| P1 | 建议接口改批量 | M5 时 |
| P2 | Error Boundary | M7 |
| P2 | PWA 插件 | M7 |
| P2 | 离线队列 online 事件 | M7 |

**最小行动方案（今天）**：修复 SSE 错误处理（3 行）、把 mock 数据移出组件（建 `shared/mocks/index.ts`）、建 `shared/constants/index.ts` 收拢魔法字符串——这三件事改完，后续联调和迭代会顺很多。其余 P0 问题（member_id、token）等 M4 配对认证一起实现。
