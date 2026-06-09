# ShopGenie — 竞品与参考项目

> 整理时间：2026-06-07
> 目的：了解现有电商 AI 项目，找差异化方向，参考技术实现

---

## 一、直接竞品 — 电商内容生成

这类项目跟 ShopGenie V1 方向最接近，重点研究。

### 1. 302.AI 电商文案助手
- **链接**：https://github.com/302ai/302_e_commerce_copywriting_assistant
- **Stars**：⭐6（低，但 302.AI 平台本身有用户）
- **技术栈**：Next.js + LLM API
- **功能**：AI 电商文案生成，支持多场景多受众定制
- **参考价值**：前端交互设计、文案模板结构
- **不足**：功能单一，没有记忆系统，不是 Agent 架构

### 2. 小红书 AI 内容助手 (xhs_content_agent)
- **链接**：https://github.com/hl897tech/xhs_content_agent
- **Stars**：⭐8
- **技术栈**：FastAPI + LangChain + OpenAI
- **功能**：竞品数据爬取 → 爆款规律分析 → AI 生成文案与配图 → 一键发布
- **参考价值**：完整的"分析→生成→发布"闭环思路
- **不足**：只覆盖小红书，依赖爬虫（不稳定），没有多平台

### 3. Social Agent（小红书+抖音管理）
- **链接**：https://github.com/chenfjm/social-agent
- **Stars**：待确认（GitHub 页面可访问）
- **功能**：一键管理小红书、抖音，AI 内容创作、自动获客、智能运营
- **参考价值**：多平台管理的思路，跟 ShopGenie 方向接近
- **不足**：需要实际体验才知道质量和完成度

### 4. 小红书 AI 运营助手 (rednote_agent)
- **链接**：https://github.com/CiaranYoung/rednote_agent
- **Stars**：待确认
- **功能**：小红书风格内容生成（含图片）+ Selenium 自动发布
- **参考价值**：内容生成 + RPA 自动发布的组合模式
- **不足**：只覆盖小红书，Selenium 方式不稳定

### 5. 高适 Gaoshi Agent
- **链接**：https://github.com/Feng-apikey/gaoshi-agent
- **Stars**：⭐0（刚开始，今天还在提交代码）
- **技术栈**：MCP + LangGraph + Playwright（TypeScript）
- **功能**：小红书/抖音/B站 三平台文案生成与一键分发
- **参考价值**：三平台覆盖思路 + MCP 协议使用 + 拟人化操作
- **不足**：非常早期，还没什么代码

---

## 二、电商 Listing 优化工具

这类偏"交易平台"（淘宝/Amazon），跟 ShopGenie V2 方向相关。

### 6. Product Listing AI
- **链接**：https://github.com/KemiZHANG/product-listing-ai
- **Stars**：⭐1
- **技术栈**：React + Vite
- **功能**：AI 驱动的电商 listing 工作台——商品数据管理、文案生成、图片生成、SEO 关键词库、内容规则管理
- **参考价值**：工作台概念（不只是生成，还有管理），SEO 关键词库设计
- **不足**：功能偏基础，更像是个人项目

### 7. Amazon Listing Optimizer
- **链接**：https://github.com/vipinbailwal/amazon-listing-optimizer
- **Stars**：待确认
- **功能**：AI 驱动的 Amazon listing 优化——爬虫 + LLM 改写 + SEO 关键词生成
- **参考价值**：爬虫→分析→优化的流程，SEO 关键词生成逻辑
- **不足**：只针对 Amazon

### 8. E-commerce Listing Optimizer
- **链接**：https://github.com/faahee/ecommerce-listing-optimizer
- **Stars**：待确认
- **功能**：RL 基准测试——AI agent 作为电商运营，通过模拟转化漏斗优化 listing
- **参考价值**：用 RL 评估 listing 质量的思路（可以借鉴评分系统）

---

## 三、电商 AI Agent 框架/平台

这类是更大的框架或工具集，可以参考架构思路。

### 9. AccioWork Agent Skills（跨境电商 AI 技能集）
- **链接**：https://github.com/AccioWork/agent-skills
- **Stars**：待确认（Anthropic 官方相关）
- **功能**：跨境电商 AI agent 技能——关税计算、供应商查找、产品研究等
- **参考价值**：Agent Skills 的设计模式，技能拆分方式

### 10. Nexscope eCommerce Skills
- **链接**：https://github.com/nexscope-ai/eCommerce-Skills
- **Stars**：待确认
- **功能**：电商 AI agent 技能集——产品研究、营销自动化、供应链优化、商业分析，覆盖 Amazon/Shopify/Etsy/TikTok Shop
- **参考价值**：电商技能分类体系、多平台覆盖方式

### 11. Cross-Border E-Commerce Skills
- **链接**：https://github.com/noique/cross-border-ecommerce-skills
- **Stars**：待确认
- **功能**：42 个跨境电商 AI agent 技能——品牌策略、市场研究、选品、listing 优化、广告、独立站运营、社媒、红人营销
- **参考价值**：42 个技能的分类方式，可以参考 ShopGenie 的功能扩展方向

### 12. AI Agents for E-commerce（PydanticAI）
- **链接**：https://github.com/ruizguille/ai-agents-ecommerce
- **Stars**：待确认
- **技术栈**：Python + PydanticAI
- **功能**：用 PydanticAI 构建电商客服和订单管理 agent
- **参考价值**：PydanticAI 的 agent 构建方式，客服场景的实现

---

## 四、通用参考 — AI 内容生成工具

### 13. Description Generator
- **链接**：https://github.com/Nutlope/description-generator
- **Stars**：待确认
- **功能**：从商品图片生成多语言描述
- **参考价值**：图片→文案的多模态思路（V2/V3 可以考虑）

### 14. Marketing Skills for Claude
- **链接**：https://github.com/coreyhaines31/marketingskills
- **Stars**：待确认
- **功能**：Claude Code 的营销技能集——转化优化、文案写作、SEO、数据分析、增长工程
- **参考价值**：营销文案的 prompt 设计，可以借鉴到 ShopGenie 的 prompt

---

## 五、Awesome 列表（综合参考）

### 15. Awesome AI E-Commerce Tools
- **链接**：https://github.com/xinpengdr/awesome-ai-ecommerce-tools
- **功能**：跨境电商 AI 工具大全——SEO、广告文案、邮件营销、履约、Agent 等
- **参考价值**：全面的工具分类，可以发现新的竞品和方向

### 16. Awesome AI Agents 2026
- **链接**：https://github.com/caramaschiHG/awesome-ai-agents-2026
- **功能**：2026 年最全 AI Agent 列表，300+ 资源，20+ 分类
- **参考价值**：了解 Agent 生态全貌，找灵感

### 17. 500 AI Agents Projects
- **链接**：https://github.com/ashishpatel26/500-AI-Agents-Projects
- **功能**：500+ AI agent 项目案例库，按行业分类
- **参考价值**：零售/电商分类下的项目参考

---

## 六、关键发现 & 差异化机会

### 现有项目的共同问题
1. **大多只覆盖单一平台**（只做小红书或只做 Amazon）
2. **工具型居多，Agent 型很少** — 没有记忆、没有对话、不能主动建议
3. **完成度普遍低** — 很多是个人项目或学习项目，星数很低
4. **国内项目偏爬虫+自动发布**，内容生成质量参差不齐
5. **没有"电商垂类 Agent"的成熟产品** — 这是 ShopGenie 的机会

### ShopGenie 的差异化方向
1. **多平台 Agent** — 不是单一平台工具，而是覆盖抖音+小红书+淘宝的统一 Agent
2. **记忆系统** — 记住商家偏好、品牌调性，越用越懂
3. **对话式交互** — 不是填表单，而是像跟同事聊天
4. **可扩展架构** — V1 内容生成 → V2 运营 → V3 数据 → V4 直播客服
5. **输出质量优先** — 不只是"能生成"，而是"生成的能直接用"

---

*最后更新：2026-06-07*
