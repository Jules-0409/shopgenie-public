# ShopGenie（商店精灵）

电商垂类 AI Agent，面向中小电商商家，通过对话帮商家搞定内容创作、店铺运营、客服等工作。

## 功能

- **三平台内容生成**：小红书种草笔记、抖音短视频脚本、Amazon Listing
- **客服话术**：售前咨询 + 售后处理的标准化回复模板
- **竞品分析**：生成前自动搜索同类爆款，提取规律
- **记忆系统**：品牌档案 + 风格偏好，越用越懂你
- **内容工作台**：商品事实库、内容版本管理、知识来源、Agent 任务、效果数据
- **质量保障**：违禁词检测、平台结构校验、自动质量评分
- **流式输出**：SSE 实时 token + Agent 状态指示
- **版本对比**：词级别 diff，查看每次修改了什么

## 技术栈

- **后端**：Python 3.11+ / FastAPI / SQLite
- **前端**：Next.js / TypeScript / TailwindCSS
- **LLM**：DeepSeek V4 Pro（OpenAI 兼容格式）
- **测试**：pytest（后端）+ Vitest（前端）

## 快速开始

```bash
# 后端
cd backend
python -m venv .venv
.venv/bin/pip install -r requirements.txt  # 或用 uv
cp .env.example .env  # 填入 DeepSeek API Key
.venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

# 前端
cd frontend
npm install
npm run dev

# 测试
cd backend && .venv/bin/python -m pytest tests/ -v
cd frontend && npm test
```

访问 http://localhost:3000

## 项目结构

```
shopgenie/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI 路由
│   │   ├── deepseek.py          # LLM 客户端 + 流式输出
│   │   ├── prompts.py           # 系统 Prompt（人设 + 平台规则）
│   │   ├── postprocess.py       # 违禁词检测 + 平台规则检查
│   │   ├── platform_validator.py # 平台结构校验
│   │   ├── competitive_analysis.py # 竞品分析
│   │   ├── memory.py            # 品牌档案记忆（SQLite）
│   │   ├── sessions.py          # 会话持久化（SQLite）
│   │   ├── workspace.py         # 内容工作台存储
│   │   ├── workspace_context.py # 生成上下文组装
│   │   ├── knowledge_fetch.py   # 公开网页抓取
│   │   ├── web_search.py        # 公开网页搜索
│   │   ├── stream.py            # SSE 流式端点
│   │   └── schemas.py           # Pydantic 模型
│   └── tests/                   # 62 个测试
├── frontend/
│   ├── src/
│   │   ├── app/page.tsx         # 主页面
│   │   ├── hooks/useChat.ts     # 核心聊天 hook
│   │   ├── components/          # 10 个组件
│   │   ├── lib/api.ts           # API 客户端
│   │   └── __tests__/           # 23 个测试
│   └── package.json
└── AGENTS.md                    # 项目规则
```

## 版本

- **V1.5**（当前）：三平台生成 + 客服话术 + 内容工作台 + 记忆 + 竞品分析
- **V2**（规划）：店铺运营助手（Listing 优化、竞品分析、标题 SEO）
- **V3**（规划）：数据参谋（店铺数据诊断、趋势洞察）
- **V4**（规划）：直播 & 客服（直播话术、客服模板、售后处理）

## License

Private
