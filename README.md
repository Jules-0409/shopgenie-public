# ShopGenie（商店精灵）

面向中小电商的 AI 内容运营系统——不止生成文案，而是把「生成 → 质检 → 投放 → 数据回流 → 诊断 → 迭代」连成一个数据驱动的运营闭环。

> **在线体验**：[liujufu.com](https://liujufu.com) · 一条命令灌入演示数据，3 分钟走完核心流程

[English](#english)

---

## 它解决什么问题

中小商家请不起内容团队。市面上的 AI 工具停在「帮你写文案」——写完之后呢？发出去效果怎么样、下一篇该怎么改、哪个商品值得继续投入？没有工具回答这些问题。

ShopGenie 的核心差异是**闭环**：

```
评论反哺 ──→ 内容生成 ──→ 质量门禁 ──→ A/B 变体
    ↑                                      │
    │          运营指挥台 ←── 效果数据 ←────┘
    │               │
    └────── 赢家风格反哺下一轮生成
```

## 核心能力

**多平台内容生成** — 小红书种草笔记、抖音短视频脚本与商品文案、Amazon Listing、客服话术模板。各平台独立结构契约，SSE 流式输出，支持一键全平台批量生成。

**质量门禁** — 每条生成内容必须通过确定性结构校验才能展示给用户。违禁词检测、平台专属规则（标签数量、时间分镜、Bullet Points、语言检查）、失败自动矫正一次、二次失败硬拒绝。多维度质量评分。

**评论反哺** — 粘贴买家评价，提炼高频卖点 / 痛点 / 踩雷词 / 原声金句，自动注入该商品后续所有生成。把模型臆想的卖点换成买家真实在乎的点。

**A/B 实验** — 一键生成多策略标题/钩子变体，回填真实投放数据，达到最小样本量才判定赢家，赢家风格自动反哺后续生成。

**效果数据** — 支持手动录入、CSV 批量导入（带预览校验）、只读平台 API 连接器同步。完整漏斗：曝光 → 点击 → 加购 → 下单 → 转化 → 退款 → 营收。

**运营指挥台** — 每日可执行建议：按资产聚合诊断、平台差异化 CTR 基准、近 7 天趋势告警、按曝光影响排序。每条建议直达对应工具并预填上下文。建议有完整生命周期（待办 → 完成 / 忽略），有新数据自动复活。

**营销日历** — 营销节点提醒 + 按品类的应景选题建议，一键带选题进入创作。

## 设计决策

1. **平台契约是硬门禁，不是建议。** 校验是确定性的——抖音脚本没有时间分镜、Amazon Listing 正文是中文，就不出稿。最多自动矫正一次，仍然失败就明确报错。宁可不出稿，不出错误稿。

2. **商品上下文产生真实消息后锁定。** 会话产出内容后商品绑定不可变，切商品必须新建会话——从机制上杜绝 A 商品历史混入 B 商品事实的串货问题。

3. **不编造数据。** 所有诊断只基于用户录入的真实效果数据。评论洞察必须携带商品归属才会注入。演示数据走独立种子脚本，明确标注。

4. **确定性规则优先于 LLM。** 指挥台诊断、CSV 校验、A/B 判胜全部是可解释的确定性规则。LLM 只用在内容生成环节——该稳定的地方不引入概率。

## 技术栈

| 层 | 技术 |
|---|---|
| 后端 | Python 3.11 · FastAPI · SQLite · SSE |
| 前端 | Next.js 16 · React 19 · TypeScript · SWR · 纯 CSS |
| LLM | DeepSeek（OpenAI 兼容接口） |
| 测试 | pytest 124 tests · vitest 40 tests |

## 快速开始

```bash
# 后端
cd backend
python -m venv .venv && .venv/bin/pip install -r requirements.txt
cp .env.example .env              # 填入 DeepSeek API Key
.venv/bin/python scripts/seed_demo.py   # 可选：灌入演示数据
.venv/bin/uvicorn app.main:app --port 8000 --reload

# 前端
cd frontend && npm install && npm run dev   # http://localhost:3000/shopgenie

# 测试
cd backend && .venv/bin/python -m pytest tests/ -v
cd frontend && npm test
```

## 项目结构

```
backend/app/
├── main.py                  # FastAPI 路由
├── operations.py            # 运营指挥台：确定性诊断 + 建议生命周期
├── review_mining.py         # 评论反哺：买家评价 → 结构化洞察
├── ab_testing.py            # A/B 变体生成 + 最小样本量判胜
├── performance_import.py    # CSV 预览校验 + 原子批量导入
├── platform_connectors.py   # 只读平台 API 效果数据同步
├── platform_validator.py    # 平台结构强校验（硬门禁）
├── postprocess.py           # 违禁词 + 平台规则后处理
├── workspace.py             # 商品 / 内容 / 版本 / 效果 / 实验存储
├── deepseek.py / stream.py  # LLM 客户端 + SSE 流式
└── prompts.py               # System prompt 构建

frontend/src/
├── app/page.tsx             # 单页应用入口
├── components/              # 指挥台 / 工作台 / 聊天 / 批量视图
├── hooks/useChat.ts         # 会话状态 + 流式消费 + 持久化
└── lib/                     # API 客户端 / SWR 数据层 / 平台定义
```

## 开发方式

多 AI agent 并行协作开发，人工负责产品定义（[PRD.md](PRD.md)）、架构决策与代码评审。Git 历史中包含真实评审记录——包括拦下数据污染接口和安全缺陷的案例。

## License

MIT

---

**刘具辅** — 全栈开发 · 产品设计 · AI 应用，独立完成。正在看新机会，联系我：liujufu019@gmail.com

---

<a name="english"></a>

# ShopGenie — English

AI-powered content operations system for e-commerce sellers. A closed-loop system connecting content generation, quality gates, A/B testing, performance tracking, diagnosis, and iteration.

> **Live demo**: [liujufu.com](https://liujufu.com)

## What It Does

Small sellers can't afford content teams. Existing AI tools stop at "here's your copy." ShopGenie closes the loop — from generation through real performance data back to the next iteration.

**Multi-platform generation** — Xiaohongshu posts, Douyin scripts & product copy, Amazon Listings, CS templates. Platform-specific structural contracts, SSE streaming, one-click cross-platform batch.

**Quality gate** — Every piece must pass deterministic structural validation. Banned-word detection, platform rules (tags, time markers, bullet points, language), auto-fix once, hard reject on second failure.

**Review mining** — Paste buyer reviews → extract selling points, pain points, red flags, verbatim quotes → auto-inject into all future generations for that product.

**A/B experiments** — Generate title/hook variants, backfill real data, minimum sample size enforcement, winner style feeds back into generation.

**Performance tracking** — Manual entry, CSV bulk import with validation, or read-only platform API connectors. Full funnel: impressions → clicks → carts → orders → conversions → refunds → revenue.

**Operations hub** — Daily actionable briefing: asset-level diagnosis, platform-specific CTR benchmarks, 7-day trend alerts, impact-sorted recommendations with lifecycle management.

**Marketing calendar** — Event reminders with category-relevant topic suggestions, one-click to create.

## Design Philosophy

1. **Hard gates, not suggestions.** Validation is deterministic — bad output is blocked, not flagged.
2. **Product context locks after first message.** Prevents fact contamination across products.
3. **No fabricated data.** All diagnosis uses real user-submitted performance data.
4. **Deterministic rules over LLM for operations logic.** LLM generates content; everything else is explainable rules.

## Tech Stack

| Layer | Stack |
|-------|-------|
| Backend | Python 3.11 · FastAPI · SQLite · SSE |
| Frontend | Next.js 16 · React 19 · TypeScript · SWR · CSS |
| LLM | DeepSeek (OpenAI-compatible) |
| Tests | pytest (124) · vitest (40) |

## Quick Start

```bash
# Backend
cd backend
python -m venv .venv && .venv/bin/pip install -r requirements.txt
cp .env.example .env              # add your DeepSeek API key
.venv/bin/python scripts/seed_demo.py   # optional: seed demo data
.venv/bin/uvicorn app.main:app --port 8000 --reload

# Frontend
cd frontend && npm install && npm run dev   # http://localhost:3000/shopgenie

# Tests
cd backend && .venv/bin/python -m pytest tests/ -v
cd frontend && npm test
```

## Development

Built with a multi-agent AI workflow: multiple AI coding agents in parallel, with human responsibility for product definition ([PRD.md](PRD.md)), architecture, and code review. Git history includes real review cases — rejected data-pollution endpoints and security flaws.

## License

MIT

---

**Jules Liu (刘具辅)** — Full-stack, product design, and AI integration, built solo. Open to opportunities: liujufu019@gmail.com
