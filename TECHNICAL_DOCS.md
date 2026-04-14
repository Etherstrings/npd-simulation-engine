# 技术架构与机制文档 (Technical Docs)

本文档旨在解释 NPD 对抗模拟引擎 v2.0 的底层工作原理极其数学评估逻辑。

## 1. 架构概览

本项目采用典型的 Vanilla JS + Vite 模块化架构。没有任何复杂的第三方状态管理库（如 React/Vuex），极大幅度地降低了对项目理解的门槛。

### 目录结构核心文件
- `src/main.js`: 核心入口及 UI 交互（MVC 中的 View 层 & Controller 层结合）。
- `src/engine/simulation.js`: 核心主循环模块（SimulationEngine）。负责控制回合流转、管理历史对话（Conversation Context），以及触发人类输入评价流。
- `src/engine/psychology.js`: 状态机与物理模型层。定义核心公式以计算每一回合言论所造成的供血削弱及防卫机制反弹。
- `src/engine/prompts.js`: 工程化 Prompt 层。包含各类设定和评估员角色。
- `src/engine/agent.js`: 数据定义层，声明 NARC 模型需要的预设词汇和分类。

## 2. 交互流控制机制

### 自动推演流 (AI vs AI)
1. **R1**: NPD 抛出开场白设下局。
2. **循环**: Counter-Agent 请求 LLM => 返回 JSON 包含话术与对 NPD 的估算伤害。
3. **状态计算**: `psychology.js` 结算这一轮 Counter 的伤害，扣除 NPD Supply，增加 NPD Rage/Injury 等。
4. **反弹计算**: NPD 携带受损状态请求 LLM => 返回暴怒的反击言论与自身激活的防御阵型。
5. 直到达到回合上限或 NPD Collapse 到达极限。

### 玩家介入流 (Human vs AI)
当开启“手动扮演”时，拦截 Counter-Agent 自动构建步骤。
- 采用一个单独且对用户不可见的“裁判模式 LLM”。
- 当人类发送话术后，引擎将其封入一个独立 Prompt（`buildHumanEvaluationPrompt`），指示模型充当裁判来量化人类这句话的物理攻击属性。
- 裁判计算完成后，模拟引擎拿着结果调用 `psychology.js` 去真实地攻击 NPD 代理，从而将真实的互动体验与抽象的状态参数完美衔接起来。

## 3. NARC 理论的状态机算式

NPD 的“破防”并非通过 LLM 的自由发挥得来，而是一套写死在业务代码里的数值算法。

**状态改变的核心公式简述**：
- **自恋供给流失 (`SupplyDrain`)**:
  当 Counter-Agent 实施攻击后（或人类玩家被裁判裁定实施了攻击）：
  `Supply = Math.max(0, Supply - Attack_SupplyDrain * Multiplier)`
- **自恋损伤 (`Injury`)**:
  如果 `targets_wound` (击中核心伤口) 为 `true`，则造成的伤害享受 2.0 倍暴击系数。
  `Injury = Math.min(100, Injury + Base_Injury * Vulnerability_Factor)`
- **暴怒生成 (`Rage`)**:
  自恋者面对自恋损伤的最初反应通常是防御性暴怒（Narcissistic Rage）。这取决于该 NPD 的原发暴怒阈值。当阈值高时，需要大量损伤才会爆发；阈值低则一碰就炸。
- **心理防线崩塌 (`CollapseProgress`)**:
  只有在满足特定条件时（无底线地剥夺供给且暴怒开始反噬自身），崩塌阈值才会不可逆地升高。当 `Collapse > 85%` 时，触发临床所称的“失认/彻底崩塌”。

## 4. 未来拓展建议
开发者可通过重写 `callLLM`（在 `src/utils/api.js` 中）将其连接到自定义量化模型库或甚至流式响应通道中去以实现界面特效（如边打字边掉血效果）。
