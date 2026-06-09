# AGENTS.md — ShopGenie 项目规则

> **两层规则:**
> - **通用工程规则 → [docs/ENGINEERING_RULES.md](docs/ENGINEERING_RULES.md)**（项目无关、可移植，所有项目通用）。其中 **§1 代码正确性护栏** 是给"无法亲自审代码的 owner"的保险，**最优先遵守**。
> - **本文件 = 本项目专属规则**：契约、模块图、路线图。通用规则不在此重复。
>
> 多个 AI 和人类在同一 repo 协作，本规则的首要目的：**锁住质量底线、定义扩展配方、约束协作纪律**。

---

## 1. 项目定位

**ShopGenie**：电商垂类 AI Agent，面向中小电商商家，通过对话帮商家搞定内容创作、店铺运营、数据分析等工作。

**北极星**：商家打开 ShopGenie，说一句话，就能拿到可直接使用的电商内容（脚本/笔记/文案），不用自己再改。

---

## 2. 质量铁律 [MUST]

1. **前端必须好看** — 打开就有产品感，参考主流 SaaS Chat UI。不接受"能用就行"。
2. **输出必须能直接用** — 生成的内容商家复制就能用，不给废话让用户自己改。
3. **成本必须可控** — 一次完整生成控制在几分钱以内。
4. **后处理兜底** — 违禁词检测、格式校验用确定性代码，不靠 LLM 自律。
5. **平台是强契约** — 会话选定的平台决定最终成品格式；用户消息、历史上下文和外部 Prompt 不得静默覆盖平台。
6. **错误成品不展示** — 成品先通过平台结构校验；失败后最多自动矫正一次，仍失败则明确报错或返回待补充草稿。

---

## 3. 架构原则 [MUST]

1. **简单优先** — 不过度设计。LLM 自己判断该干什么，不需要复杂 Router/编排层。
2. **Prompt 质量是核心** — 不搞花哨的架构，靠 Prompt 质量决定 Agent 能力。
3. **平台规则内嵌 Prompt** — 各平台规则直接写在 `prompts.py` 的 `PLATFORM_PROMPTS` 中，改 prompt 改一处。
4. **记忆持久化** — 用户偏好、品牌信息通过 SQLite 跨会话保存，越用越懂用户。
5. **平台契约由后端执行** — 平台枚举、结构校验和矫正结果由后端统一判断；前端只渲染与当前会话平台匹配的合格成品。

---

## 4. 当前模块结构

### 后端 (`backend/app/`)

| 模块 | 职责 |
|------|------|
| `main.py` | FastAPI 入口，路由：/health、/api/chat、/api/profile |
| `config.py` | Pydantic Settings，从 .env 读取 DeepSeek 配置 |
| `prompts.py` | 系统 Prompt（人设 + 生成策略 + JSON 格式），三平台 Prompt |
| `deepseek.py` | DeepSeek API 客户端，JSON 解析（支持 result/draft/chat/message），markdown 剥离 |
| `schemas.py` | Pydantic 模型：ChatRequest、ChatResponse、GeneratedContent、UserProfile |
| `memory.py` | SQLite 记忆系统：UserProfile CRUD，Prompt 注入 |
| `postprocess.py` | 后处理：违禁词检测（广告法 + 平台规则）、平台内容规范检查 |
| `workspace.py` | 内容工作台：商品事实、内容版本、质量报告、知识来源、Agent 任务、发布效果 |
| `workspace_context.py` | 将商品事实、相关知识与历史效果组装为生成上下文 |
| `knowledge_fetch.py` | 安全抓取指定公开网页，拒绝内网、非文本和超大响应 |
| `web_search.py` | 有界发现最新规则、趋势与竞品公开网页来源 |

### 前端 (`frontend/src/`)

| 模块 | 职责 |
|------|------|
| `app/page.tsx` | 主页面：渲染 + UI 状态（会话管理逻辑已抽到 useChat hook） |
| `hooks/useChat.ts` | 核心聊天 hook：会话管理、消息收发、AbortController、regenerate、localStorage 持久化 |
| `components/ChatBubble.tsx` | 消息气泡：闲聊/草稿/结果渲染、QuestionChips 多选、WarningBanner |
| `components/ResultCard.tsx` | 生成结果卡片：小红书/抖音/Amazon 高保真预览 |
| `components/InputBar.tsx` | 输入框：发送/停止按钮 |
| `components/ProfilePanel.tsx` | 品牌档案管理面板（模态框） |
| `components/Sidebar.tsx` | 侧栏：会话列表 |
| `components/WelcomeScreen.tsx` | 平台选择页 |
| `components/WorkspacePanel.tsx` | 内容工作台：商品库、版本编辑、知识、任务、效果数据 |
| `lib/api.ts` | API 客户端：sendChat + AbortSignal |
| `lib/platforms.ts` | 平台类型定义 |

### 数据存储

| 存储 | 用途 | 位置 |
|------|------|------|
| SQLite | 用户品牌档案 | `backend/app/shopgenie.db` |
| localStorage | 会话历史（浏览器端） | 浏览器 |

---

## 5. 扩展配方

### 5.1 加一个平台
1. 在 `prompts.py` 的 `PLATFORM_PROMPTS` 中新增条目。
2. 在 `schemas.py` 的 `Platform` 枚举中新增值。
3. 前端 `platforms.ts`、`WelcomeScreen.tsx`、`ResultCard.tsx` 中新增对应 UI。
4. `postprocess.py` 中新增该平台的违禁词、合规规则和确定性结构校验器。
5. 定义与其他平台冲突时的处理方式，以及一次自动矫正后的失败行为。
6. 增加合格结构、结构缺失、跨平台格式污染的回归测试。
7. 完成人工质量抽检后再开放入口。

### 5.2 加一个内容类型
1. 在 `prompts.py` 的 Prompt 中描述新内容类型的格式要求。
2. 如果需要新的 JSON 字段，在 `schemas.py` 中扩展 `GeneratedContent`。
3. 前端 `ResultCard.tsx` 中新增预览模板。
4. `postprocess.py` 中加后处理规则（如有）。
5. 测试。

### 5.3 加一个版本功能（V2/V3/V4）
1. 先更新 PRD 和本文件的路线图。
2. 评估是否需要新的模块/端点。
3. 小步迭代，一个功能做完测完再做下一个。

---

## 6. 编码约定

### 后端（Python）
- [MUST] Python 3.11+，全量 type hints。
- [MUST] 异步优先：I/O 一律 async。
- [SHOULD] 单文件 soft cap ~400 行，函数 ~50 行。
- [MUST] 不吞异常：要么处理，要么向上抛。
- [GUIDE] 配置走 .env 环境变量，不硬编码。

### 前端（TypeScript）
- [MUST] 严格 TS，不许 any。
- [SHOULD] 组件 ~300 行以内。
- [MUST] 响应式设计，移动端可访问。

---

## 7. 测试与完成标准 [MUST]

一个改动算"完成"的标准：
1. 全部测试通过（`backend/.venv/bin/python -m pytest tests/ -v`）。
2. 前端构建无错（`cd frontend && npm run build`）。
3. 改了核心逻辑 → 有覆盖该路径的测试。
4. 生成内容质量可接受（人工抽检）。

---

## 8. 版本控制 [MUST]

1. 动手前先 git init。
2. 小步提交，语义清晰。
3. 功能在分支上做，不直接改主干。
4. 不删除别人的测试来让自己的改动"看起来通过"。

---

## 9. 路线图

| 版本 | 内容 | 进入条件 |
|------|------|---------|
| **V1** | 电商内容生成（抖音脚本 + 小红书笔记 + Amazon Listing + 商品文案 + 记忆系统 + 违禁词检测） | 项目启动 |
| **V2** | 店铺运营助手（Listing优化、竞品自动分析、标题SEO、多平台；优先 TikTok Shop、视频号、淘宝/天猫） | V1 验证通过 |
| **V3** | 数据参谋（店铺数据诊断、趋势洞察、运营建议） | V2 验证通过 |
| **V4** | 直播 & 客服（直播话术、客服模板、售后处理） | V3 验证通过 |

---

## 10. 运行方式

```bash
# 后端
cd backend && .venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

# 前端
cd frontend && npm run dev

# 测试
cd backend && .venv/bin/python -m pytest tests/ -v
```

---

*最后更新：2026-06-08*
