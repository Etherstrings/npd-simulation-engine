/**
 * NPD 对抗模拟引擎 — Main Application
 * Entry point for the simulation UI
 */

import './style.css';
import { SimulationEngine } from './engine/simulation.js';
import { getScenarios, buildScannerPrompt, buildCritiquePrompt } from './engine/prompts.js';
import { DEFENSE_MECHANISMS, ATTACK_PATTERNS, COUNTER_STRATEGIES } from './engine/agent.js';
import { loadSettings, saveSettings, callLLM, parseLLMResponse } from './utils/api.js';
import { exportJSON, exportCSV, exportFullReport, calculateStats } from './utils/export.js';

// ============================================
// State
// ============================================
let engine = null;
let currentView = 'setup';
let simulationData = null;

// ============================================
// Initialize
// ============================================
document.addEventListener('DOMContentLoaded', () => {
  engine = new SimulationEngine();
  engine.onUpdate = handleEngineEvent;
  
  initScenarios();
  initPresets();
  initSliders();
  initSettings();
  initButtons();
  initRadar();
  initExport();
  
  // Check if API key already set
  const settings = loadSettings();
  if (!settings?.apiKey) {
    showSettings();
  }
});

// ============================================
// Scenarios
// ============================================
function initScenarios() {
  const grid = document.getElementById('scenario-grid');
  const scenarios = getScenarios();
  
  scenarios.forEach((s, i) => {
    const card = document.createElement('div');
    card.className = `scenario-card${i === 0 ? ' selected' : ''}`;
    card.dataset.id = s.id;
    card.innerHTML = `
      <h4>${s.icon} ${s.title}</h4>
      <p>${s.description}</p>
    `;
    card.addEventListener('click', () => {
      grid.querySelectorAll('.scenario-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
    });
    grid.appendChild(card);
  });
}

// ============================================
// Presets
// ============================================
const agentPresets = {
  boss: {
    name: 'Richard', background: '公司空降高管，认为自己是来拯救这群废物的。极度迷恋权力和地位。',
    wound: '极度害怕失去控制权和权威形象，害怕被人看出他的业务能力其实很差。', subtype: 'grandiose',
    grandiosity: 95, vulnerability: 30, admiration: 80, rivalry: 90, empathy: 85, rage: 60
  },
  partner: {
    name: 'Sarah', background: '相恋3年的伴侣。表面上付出很多，但实际上把伴侣当成自己的情绪垃圾桶和附属品。',
    wound: '害怕被抛弃，害怕自己变成"施虐者"的真实面目被揭穿。', subtype: 'vulnerable',
    grandiosity: 60, vulnerability: 95, admiration: 70, rivalry: 50, empathy: 80, rage: 50
  },
  parent: {
    name: 'Mother/Father', background: '控制欲极强的传统长辈。在亲戚面前表现得像模范父母，关起门来对孩子极其刻薄。',
    wound: '害怕失去对孩子命运的掌控，害怕孩子超越自己，失去"家长"绝对支配特权。', subtype: 'mixed',
    grandiosity: 80, vulnerability: 75, admiration: 90, rivalry: 60, empathy: 95, rage: 65
  },
  artist: {
    name: 'Vincent', background: '自命不凡的小众艺术家。认为全世界都不懂他，其他成功的人都是俗气的垃圾。',
    wound: '内心深处知道自己的才华不足以支撑野心，极度嫉妒比自己更有成就的人。', subtype: 'grandiose',
    grandiosity: 90, vulnerability: 80, admiration: 95, rivalry: 85, empathy: 100, rage: 40
  }
};

function initPresets() {
  const presetSelect = document.getElementById('agent-a-preset');
  if (presetSelect) {
    presetSelect.addEventListener('change', (e) => {
      const p = agentPresets[e.target.value];
      if (!p) return;
      document.getElementById('agent-a-name').value = p.name;
      document.getElementById('agent-a-background').value = p.background;
      document.getElementById('agent-a-wound').value = p.wound;
      document.getElementById('agent-a-subtype').value = p.subtype;
      document.getElementById('agent-a-grandiosity').value = p.grandiosity;
      document.getElementById('agent-a-vulnerability').value = p.vulnerability;
      document.getElementById('agent-a-admiration').value = p.admiration;
      document.getElementById('agent-a-rivalry').value = p.rivalry;
      document.getElementById('agent-a-empathy').value = p.empathy;
      document.getElementById('agent-a-rage').value = p.rage;
      
      document.getElementById('v-grandiosity').textContent = p.grandiosity;
      document.getElementById('v-vulnerability').textContent = p.vulnerability;
      document.getElementById('v-admiration').textContent = p.admiration;
      document.getElementById('v-rivalry').textContent = p.rivalry;
      document.getElementById('v-empathy').textContent = p.empathy;
      document.getElementById('v-rage').textContent = p.rage;
    });
  }
}

// ============================================
// Sliders
// ============================================
function initSliders() {
  const sliderIds = [
    'agent-a-grandiosity', 'agent-a-vulnerability', 'agent-a-admiration',
    'agent-a-rivalry', 'agent-a-empathy', 'agent-a-rage',
    'agent-b-attack', 'agent-b-escalation', 'agent-b-insight',
  ];
  
  const valueMap = {
    'agent-a-grandiosity': 'v-grandiosity',
    'agent-a-vulnerability': 'v-vulnerability',
    'agent-a-admiration': 'v-admiration',
    'agent-a-rivalry': 'v-rivalry',
    'agent-a-empathy': 'v-empathy',
    'agent-a-rage': 'v-rage',
    'agent-b-attack': 'v-attack',
    'agent-b-escalation': 'v-escalation',
    'agent-b-insight': 'v-insight',
  };
  
  sliderIds.forEach(id => {
    const slider = document.getElementById(id);
    if (slider) {
      slider.addEventListener('input', () => {
        const valueEl = document.getElementById(valueMap[id]);
        if (valueEl) valueEl.textContent = slider.value;
      });
    }
  });
}

// ============================================
// Settings
// ============================================
function initSettings() {
  const modal = document.getElementById('settings-modal');
  const closeBtn = document.getElementById('close-settings');
  const saveBtn = document.getElementById('save-settings');
  const providerSelect = document.getElementById('api-provider');
  const backdrop = modal.querySelector('.modal-backdrop');
  
  document.getElementById('btn-settings').addEventListener('click', showSettings);
  
  closeBtn.addEventListener('click', () => modal.classList.add('hidden'));
  backdrop.addEventListener('click', () => modal.classList.add('hidden'));
  
  providerSelect.addEventListener('change', () => {
    const isCustom = providerSelect.value === 'custom';
    document.getElementById('custom-url-group').style.display = isCustom ? 'flex' : 'none';
    document.getElementById('custom-model-group').style.display = 
      (isCustom || providerSelect.value === 'openai' || providerSelect.value === 'claude') ? 'flex' : 'none';
  });
  
  saveBtn.addEventListener('click', () => {
    const settings = {
      provider: providerSelect.value,
      apiKey: document.getElementById('api-key').value,
      apiUrl: document.getElementById('api-url').value,
      model: document.getElementById('api-model').value,
    };
    saveSettings(settings);
    modal.classList.add('hidden');
  });
  
  // Pre-fill settings
  const saved = loadSettings();
  if (saved) {
    providerSelect.value = saved.provider || 'openai';
    document.getElementById('api-key').value = saved.apiKey || '';
    document.getElementById('api-url').value = saved.apiUrl || '';
    document.getElementById('api-model').value = saved.model || '';
    providerSelect.dispatchEvent(new Event('change'));
  }
}

function showSettings() {
  document.getElementById('settings-modal').classList.remove('hidden');
}

// ============================================
// Buttons
// ============================================
function initButtons() {
  document.getElementById('btn-start').addEventListener('click', startSimulation);
  document.getElementById('btn-new').addEventListener('click', resetToSetup);
  document.getElementById('btn-radar').addEventListener('click', () => {
    showView('radar');
  });
  document.getElementById('btn-pause').addEventListener('click', togglePause);
  document.getElementById('btn-step').addEventListener('click', () => {
    if (engine.isPaused) {
      engine.resume();
      setTimeout(() => engine.pause(), 100);
    }
  });
  document.getElementById('btn-stop').addEventListener('click', () => {
    engine.stop();
  });
  
  const humanToggle = document.getElementById('human-mode-toggle');
  if (humanToggle) {
    humanToggle.addEventListener('change', (e) => {
      const isHuman = e.target.checked;
      document.getElementById('agent-b-style').disabled = isHuman;
      document.getElementById('agent-b-attack').disabled = isHuman;
      document.getElementById('agent-b-escalation').disabled = isHuman;
    });
  }
  
  document.getElementById('btn-human-send').addEventListener('click', () => {
    const input = document.getElementById('human-input-text');
    const text = input.value.trim();
    if (text) {
      document.getElementById('human-input-area').classList.add('hidden');
      input.value = '';
      if (engine) engine.submitHumanInput(text);
    }
  });
  document.getElementById('human-input-text').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      document.getElementById('btn-human-send').click();
    }
  });
}

// ============================================
// Radar / Find Poseur Mode
// ============================================
function initRadar() {
  const btn = document.getElementById('btn-scan-radar');
  if(!btn) return;
  
  const chatLogInput = document.getElementById('chat-log-input');
  const statusSpan = document.getElementById('radar-status');

  // Auto Extract Logic (wechat-cli)
  const btnAutoExtract = document.getElementById('btn-auto-extract');
  const inputTargetName = document.getElementById('wechat-target-name');
  const selectTargetLimit = document.getElementById('wechat-target-limit');

  if(btnAutoExtract) {
    btnAutoExtract.addEventListener('click', async () => {
      const targetName = inputTargetName.value.trim();
      const targetLimit = selectTargetLimit.value;

      if (!targetName) {
        statusSpan.textContent = "⚠️ 请先写上你要查的群名或者人名！";
        return;
      }

      btnAutoExtract.disabled = true;
      btnAutoExtract.textContent = "⏳ 正在突破底层数据库...";
      statusSpan.textContent = "正在调用 wechat-cli 从本机抽取...";
      chatLogInput.value = "";

      try {
        const response = await fetch(`/api/wechat-history?name=${encodeURIComponent(targetName)}&limit=${targetLimit}`);
        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || result.details || "未知抽取错误");
        }

        if (!result.data || result.data.trim() === '') {
          statusSpan.textContent = `⚠️ 未找到名为 [${targetName}] 的聊天记录，请检查名称是否完全匹配。`;
        } else {
          chatLogInput.value = result.data;
          statusSpan.textContent = `✅ 自动获取成功！(查获 ${result.data.split('\n').length} 行数据)`;
        }
      } catch (err) {
        alert(
          "🚨 底层提取失败！\n\n" +
          "系统必须要借助 wechat-cli 才能阅读被加密的信源。\n" +
          "请打开你的电脑终端 (Terminal) 执行以下两段命令：\n\n" +
          "1. npm i -g @canghe_ai/wechat-cli\n" +
          "2. sudo wechat-cli init\n\n" +
          "按提示授权盘符读取后，刷新本页面再试一次！\n\n错误信息：" + err.message
        );
        statusSpan.textContent = `❌ 提取失败：${err.message}`;
      } finally {
        btnAutoExtract.disabled = false;
        btnAutoExtract.textContent = "⚡️ 一键提取并拉取";
      }
    });
  }

  // Clipboard Button
  const btnClipboard = document.getElementById('btn-clipboard');
  if(btnClipboard) {
    btnClipboard.addEventListener('click', async () => {
      try {
        const text = await navigator.clipboard.readText();
        if(text) {
          chatLogInput.value = text;
          statusSpan.textContent = '✅ 已成功吸附剪贴板聊天记录';
        } else {
          statusSpan.textContent = '⚠️ 剪贴板为空或不是文本';
        }
      } catch (err) {
        statusSpan.textContent = '❌ 无法读取剪贴板，请允许浏览器权限或手动粘贴';
      }
    });
  }


  btn.addEventListener('click', async () => {
    const text = document.getElementById('chat-log-input').value.trim();
    if (!text) return;
    
    // Check API
    const settings = loadSettings();
    if (!settings?.apiKey) {
      showSettings();
      return;
    }
    
    document.getElementById('radar-status').textContent = '扫描中，请稍候...';
    document.getElementById('btn-scan-radar').disabled = true;
    
    try {
      const prompt = buildScannerPrompt();
      const history = [{ role: 'user', content: text }];
      const resultRaw = await callLLM(prompt, history);
      
      let jsonStr = resultRaw.match(/\[[\s\S]*\]/)?.[0] || '[]';
      let scannedUsers = [];
      try {
        scannedUsers = JSON.parse(jsonStr);
      } catch (e) {
        throw new Error('解析失败。LLM 没有返回标准的 JSON 数组。');
      }
      
      document.getElementById('radar-status').textContent = \`扫描完成！发现 \${scannedUsers.length} 位疑似目标。\`;
      renderRadarResults(scannedUsers);
    } catch (e) {
      document.getElementById('radar-status').textContent = \`错误: \${e.message}\`;
    } finally {
      document.getElementById('btn-scan-radar').disabled = false;
    }
  });
}

function renderRadarResults(users) {
  const container = document.getElementById('radar-results');
  container.innerHTML = '';
  
  if (users.length === 0) {
    container.innerHTML = '<div style="color:#aaa; text-align:center; padding: 2rem;">没有在样本中扫描出明显的 Cluster-B 毒性人格。你可以尝试上传更具争议性的聊天记录。</div>';
    return;
  }
  
  users.forEach((u, index) => {
    const card = document.createElement('div');
    card.className = 'radar-target-card';
    card.style.cssText = 'background: #1a1a2e; border: 1px solid #ff3366; border-radius: 8px; padding: 1.5rem; display: flex; flex-direction: column; gap: 1rem;';
    
    card.innerHTML = \`
      <div style="display: flex; justify-content: space-between; align-items: flex-start;">
        <div>
          <h3 style="color: #ff3366; margin: 0 0 0.5rem 0;">🎯 锁定目标: \${escapeHTML(u.username)}</h3>
          <span class="tag tag-npd">\${escapeHTML(u.disorder_type)}</span>
        </div>
        <button class="btn btn-sm btn-danger btn-generate-critique" data-idx="\${index}">🔪 生成致命锐评</button>
      </div>
      <div style="background: rgba(0,0,0,0.3); padding: 1rem; border-radius: 6px; border-left: 3px solid #ff3366;">
        <div style="font-size: 0.85rem; color: #888; margin-bottom: 0.3rem;">典型症状原话:</div>
        <div style="font-style: italic; color: #ccc;">"\${escapeHTML(u.evidence)}"</div>
      </div>
      <div>
        <div style="font-size: 0.85rem; color: #888; margin-bottom: 0.3rem;">推测核心伤口 (Core Wound):</div>
        <div style="color: #ffcc00;">\${escapeHTML(u.core_wound_guess)}</div>
      </div>
      <div class="critique-output hidden" style="margin-top: 1rem; padding-top: 1rem; border-top: 1px dashed #2a2a45;">
        <div style="font-size: 0.85rem; color: #888; margin-bottom: 0.5rem; display:flex; justify-content: space-between;">
          <span>生成的反击话术 (可直接复制发到群里):</span>
          <button class="btn btn-sm btn-ghost btn-copy">📋 复制</button>
        </div>
        <textarea class="critique-text" rows="4" style="width: 100%; background: #12121a; color: #fff; border: 1px solid #666; padding: 0.8rem; border-radius: 4px;" readonly></textarea>
      </div>
    \`;
    
    container.appendChild(card);
    
    const generateBtn = card.querySelector('.btn-generate-critique');
    const outputArea = card.querySelector('.critique-output');
    const textArea = card.querySelector('.critique-text');
    const copyBtn = card.querySelector('.btn-copy');
    
    generateBtn.addEventListener('click', async () => {
      generateBtn.disabled = true;
      generateBtn.textContent = '生成中...';
      try {
        const prompt = buildCritiquePrompt(u);
        const resultRaw = await callLLM(prompt, []); // No history needed for single shot
        
        // Remove reasoning block if present (<think>...</think>)
        let finalOutput = resultRaw.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
        
        outputArea.classList.remove('hidden');
        textArea.value = finalOutput;
      } catch (e) {
        alert('生成锐评失败: ' + e.message);
      } finally {
        generateBtn.disabled = false;
        generateBtn.textContent = '🔪 刷新致命锐评';
      }
    });
    
    copyBtn.addEventListener('click', () => {
      textArea.select();
      document.execCommand('copy');
      copyBtn.textContent = '✅ 已复制';
      setTimeout(() => copyBtn.textContent = '📋 复制', 2000);
    });
  });
}

// ============================================
// ============================================
function initExport() {
  document.getElementById('btn-export').addEventListener('click', () => {
    if (simulationData) showView('analysis');
  });
  
  document.getElementById('btn-export-json').addEventListener('click', () => {
    if (simulationData) exportJSON(simulationData);
  });
  
  document.getElementById('btn-export-csv').addEventListener('click', () => {
    if (simulationData) exportCSV(simulationData);
  });
  
  document.getElementById('btn-export-full').addEventListener('click', () => {
    if (simulationData) exportFullReport(simulationData);
  });
}

// ============================================
// View Switching
// ============================================
function showView(viewName) {
  document.querySelectorAll('.view').forEach(v => {
    v.classList.remove('active');
    v.classList.add('hidden');
  });
  const target = document.getElementById(`view-${viewName}`);
  if (target) {
    target.classList.remove('hidden');
    target.classList.add('active');
  }
  currentView = viewName;
}

function resetToSetup() {
  showView('setup');
  document.getElementById('btn-export').disabled = true;
  simulationData = null;
}

// ============================================
// Start Simulation
// ============================================
function startSimulation() {
  // Check API settings
  const settings = loadSettings();
  if (!settings?.apiKey) {
    showSettings();
    return;
  }
  
  // Gather config
  const selectedScenario = document.querySelector('.scenario-card.selected');
  const config = {
    scenario: selectedScenario?.dataset.id || 'business_betrayal',
    customScenario: document.getElementById('custom-scenario').value.trim(),
    maxRounds: parseInt(document.getElementById('max-rounds').value) || 15,
    escalationRate: document.getElementById('escalation-rate').value,
    language: document.getElementById('language').value,
    humanMode: document.getElementById('human-mode-toggle')?.checked || false,
    npdAgent: {
      name: document.getElementById('agent-a-name').value || 'Victor',
      background: document.getElementById('agent-a-background').value || '',
      coreWound: document.getElementById('agent-a-wound').value || '',
      subtype: document.getElementById('agent-a-subtype').value,
      grandiosity: parseInt(document.getElementById('agent-a-grandiosity').value),
      vulnerability: parseInt(document.getElementById('agent-a-vulnerability').value),
      admiration: parseInt(document.getElementById('agent-a-admiration').value),
      rivalry: parseInt(document.getElementById('agent-a-rivalry').value),
      empathy: parseInt(document.getElementById('agent-a-empathy').value),
      rage: parseInt(document.getElementById('agent-a-rage').value),
    },
    counterAgent: {
      name: document.getElementById('agent-b-name').value || 'Diana',
      background: document.getElementById('agent-b-background').value || '',
      style: document.getElementById('agent-b-style').value,
      attack: parseInt(document.getElementById('agent-b-attack').value),
      escalation: parseInt(document.getElementById('agent-b-escalation').value),
      insight: parseInt(document.getElementById('agent-b-insight').value),
    },
  };
  
  // Initialize engine
  engine.init(config);
  
  // Setup simulation UI
  setupSimulationUI(config);
  showView('simulation');
  
  // Enable controls
  document.getElementById('btn-pause').disabled = false;
  document.getElementById('btn-step').disabled = false;
  document.getElementById('btn-stop').disabled = false;
  
  // Run
  engine.run();
}

// ============================================
// Setup Simulation UI
// ============================================
function setupSimulationUI(config) {
  // Set names
  document.getElementById('state-a-name').textContent = config.npdAgent.name;
  document.getElementById('state-b-name').textContent = config.counterAgent.name;
  document.getElementById('total-rounds').textContent = config.maxRounds;
  document.getElementById('current-round').textContent = '0';
  
  // Clear messages
  document.getElementById('dialogue-messages').innerHTML = '';
  
  // Setup state bars for NPD
  const npdBars = document.getElementById('state-bars-a');
  npdBars.innerHTML = '';
  const npdMetrics = [
    { id: 'supply', label: '自恋供给', class: 'supply', value: 60 },
    { id: 'injury', label: '自恋损伤', class: 'injury', value: 0 },
    { id: 'defense', label: '防御激活', class: 'defense', value: 30 },
    { id: 'rage', label: '暴怒水平', class: 'rage', value: 0 },
    { id: 'vulnerability', label: '脆弱暴露', class: 'vulnerability', value: 0 },
    { id: 'collapse', label: '崩塌进度', class: 'collapse', value: 0 },
  ];
  npdMetrics.forEach(m => {
    npdBars.appendChild(createStateBar(m, 'a'));
  });
  
  // Setup state bars for Counter
  const counterBars = document.getElementById('state-bars-b');
  counterBars.innerHTML = '';
  const counterMetrics = [
    { id: 'attack', label: '攻击强度', class: 'attack', value: 50 },
    { id: 'insight', label: '心理洞察', class: 'insight', value: config.counterAgent.insight },
    { id: 'escalation', label: '升级程度', class: 'escalation', value: 0 },
  ];
  counterMetrics.forEach(m => {
    counterBars.appendChild(createStateBar(m, 'b'));
  });
  
  // Clear defense/attack tags
  document.getElementById('defense-tags-a').innerHTML = '';
  document.getElementById('attack-tags-b').innerHTML = '';
  
  // Reset status
  document.getElementById('status-value-a').textContent = '稳定';
  document.getElementById('status-value-a').className = 'status-value';
  document.getElementById('status-value-b').textContent = '就绪';
  
  // Reset escalation meter
  document.getElementById('escalation-fill').style.width = '0%';
  document.getElementById('escalation-value').textContent = '0%';
}

function createStateBar(metric, agentPrefix) {
  const div = document.createElement('div');
  div.className = 'state-bar';
  div.id = `bar-${agentPrefix}-${metric.id}`;
  div.innerHTML = `
    <div class="state-bar-label">
      <span>${metric.label}</span>
      <span id="val-${agentPrefix}-${metric.id}">${metric.value}</span>
    </div>
    <div class="state-bar-track">
      <div class="state-bar-fill ${metric.class}" style="width: ${metric.value}%"></div>
    </div>
  `;
  return div;
}

// ============================================
// Engine Event Handler
// ============================================
function handleEngineEvent(event, data) {
  switch (event) {
    case 'start':
      break;
      
    case 'system':
      addSystemMessage(data.message);
      break;
      
    case 'waitForUser':
      document.getElementById('human-input-area').classList.remove('hidden');
      document.getElementById('human-input-text').focus();
      break;
      
    case 'typing':
      showTyping(data.agent);
      break;
      
    case 'npdMessage':
      removeTyping();
      addDialogueMessage('npd', data);
      updateNPDStateUI(data.state, data.status, data.defenses);
      break;
      
    case 'counterMessage':
      removeTyping();
      addDialogueMessage('counter', data);
      updateCounterStateUI(data.state, data.metadata);
      break;
      
    case 'roundComplete':
      document.getElementById('current-round').textContent = data.round;
      updateEscalation(data.escalation);
      break;
      
    case 'error':
      addSystemMessage(`❌ 错误: ${data.message}`);
      break;
      
    case 'complete':
      handleComplete(data);
      break;
  }
}

// ============================================
// Dialogue UI
// ============================================
function addSystemMessage(text) {
  const container = document.getElementById('dialogue-messages');
  const div = document.createElement('div');
  div.className = 'message-system';
  div.textContent = text;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

function showTyping(agent) {
  removeTyping();
  const container = document.getElementById('dialogue-messages');
  const div = document.createElement('div');
  div.className = `message ${agent} typing-message`;
  div.innerHTML = `
    <div class="message-header">
      <span class="message-name">${agent === 'npd' ? engine.npdAgent.name : engine.counterAgent.name} 正在输入...</span>
    </div>
    <div class="message-body">
      <div class="typing-indicator">
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
      </div>
    </div>
  `;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

function removeTyping() {
  const typing = document.querySelectorAll('.typing-message');
  typing.forEach(t => t.remove());
}

function addDialogueMessage(agent, data) {
  const container = document.getElementById('dialogue-messages');
  const div = document.createElement('div');
  div.className = `message ${agent}`;
  
  const name = agent === 'npd' ? engine.npdAgent.name : engine.counterAgent.name;
  const metaHTML = buildMessageMeta(agent, data.metadata);
  
  let collapseHTML = '';
  if (agent === 'npd' && engine.npdAgent.state.collapseProgress >= 85) {
    collapseHTML = `<div class="message-collapse-alert">💀 NARCISSISTIC COLLAPSE — 自恋防御体系崩塌</div>`;
  }
  
  div.innerHTML = `
    <div class="message-header">
      <span class="message-name">${name}</span>
      <span class="message-round">R${data.round}</span>
    </div>
    <div class="message-body">${escapeHTML(data.dialogue)}</div>
    <div class="message-meta">${metaHTML}</div>
    ${collapseHTML}
  `;
  
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

function buildMessageMeta(agent, metadata) {
  if (!metadata) return '';
  
  const tags = [];
  
  if (agent === 'npd') {
    const patterns = metadata.patterns_used || [];
    patterns.forEach(p => {
      const pattern = ATTACK_PATTERNS.find(ap => ap.id === p);
      tags.push(`<span class="message-annotation defense">${pattern?.icon || '🔹'} ${pattern?.label || p}</span>`);
    });
    
    const defenses = metadata.defense_triggered || [];
    defenses.forEach(d => {
      const def = DEFENSE_MECHANISMS.find(dm => dm.id === d);
      tags.push(`<span class="message-annotation injury">🛡️ ${def?.label || d}</span>`);
    });
  } else {
    const strategies = metadata.strategies_used || [];
    strategies.forEach(s => {
      const strat = COUNTER_STRATEGIES.find(cs => cs.id === s);
      tags.push(`<span class="message-annotation strategy">${strat?.icon || '⚔️'} ${strat?.label || s}</span>`);
    });
    
    if (metadata.injury_score > 20) {
      tags.push(`<span class="message-annotation injury">💥 高伤害 ${metadata.injury_score}</span>`);
    }
    if (metadata.targets_wound) {
      tags.push(`<span class="message-annotation rage">🎯 命中核心伤口</span>`);
    }
  }
  
  return tags.join('');
}

// ============================================
// State Panel Updates
// ============================================
function updateNPDStateUI(state, status, defenses) {
  if (!state) return;
  
  // Update bars
  updateBar('a', 'supply', state.supply);
  updateBar('a', 'injury', state.injury);
  updateBar('a', 'defense', state.defenseLevel);
  updateBar('a', 'rage', state.rageLevel);
  updateBar('a', 'vulnerability', state.vulnerabilityExposure);
  updateBar('a', 'collapse', state.collapseProgress);
  
  // Update defense tags
  if (defenses) {
    const container = document.getElementById('defense-tags-a');
    container.innerHTML = '';
    defenses.forEach(d => {
      const def = DEFENSE_MECHANISMS.find(dm => dm.id === d);
      const tag = document.createElement('span');
      tag.className = 'tag-pattern active';
      tag.textContent = def?.label || d;
      container.appendChild(tag);
    });
  }
  
  // Update status
  if (status) {
    const el = document.getElementById('status-value-a');
    el.textContent = status.label;
    el.className = `status-value ${status.class}`;
  }
}

function updateCounterStateUI(state, metadata) {
  if (!state) return;
  
  updateBar('b', 'attack', state.currentIntensity || 50);
  updateBar('b', 'escalation', state.currentIntensity || 0);
  
  // Update attack tags
  if (metadata?.strategies_used) {
    const container = document.getElementById('attack-tags-b');
    container.innerHTML = '';
    const allUsed = engine.counterAgent.state.strategiesUsed || [];
    allUsed.forEach(s => {
      const strat = COUNTER_STRATEGIES.find(cs => cs.id === s);
      const tag = document.createElement('span');
      tag.className = 'tag-pattern active';
      tag.textContent = strat?.label || s;
      container.appendChild(tag);
    });
  }
}

function updateBar(prefix, metric, value) {
  const val = Math.round(Math.max(0, Math.min(100, value)));
  const valEl = document.getElementById(`val-${prefix}-${metric}`);
  if (valEl) valEl.textContent = val;
  
  const bar = document.querySelector(`#bar-${prefix}-${metric} .state-bar-fill`);
  if (bar) {
    bar.style.width = `${val}%`;
    if (val > 80) {
      bar.classList.add('critical');
    } else {
      bar.classList.remove('critical');
    }
  }
}

function updateEscalation(value) {
  const fill = document.getElementById('escalation-fill');
  const valEl = document.getElementById('escalation-value');
  if (fill) fill.style.width = `${value}%`;
  if (valEl) valEl.textContent = `${value}%`;
}

// ============================================
// Pause/Resume
// ============================================
function togglePause() {
  if (engine.isPaused) {
    engine.resume();
    document.getElementById('btn-pause').textContent = '⏸️ 暂停';
  } else {
    engine.pause();
    document.getElementById('btn-pause').textContent = '▶️ 继续';
  }
}

// ============================================
// Complete
// ============================================
function handleComplete(data) {
  simulationData = data.data;
  
  document.getElementById('btn-export').disabled = false;
  document.getElementById('btn-pause').disabled = true;
  document.getElementById('btn-step').disabled = true;
  document.getElementById('btn-stop').disabled = true;
  
  addSystemMessage('✅ 模拟完成！点击"导出数据"查看分析报告。');
  
  // Build analysis
  buildAnalysis(simulationData);
}

function buildAnalysis(data) {
  // Summary
  const stats = calculateStats(data);
  const summaryEl = document.getElementById('analysis-summary-content');
  summaryEl.innerHTML = '';
  Object.entries(stats).forEach(([key, value]) => {
    const row = document.createElement('div');
    row.className = 'stat-row';
    row.innerHTML = `
      <span class="stat-label">${key}</span>
      <span class="stat-value">${value}</span>
    `;
    summaryEl.appendChild(row);
  });
  
  // Pattern stats
  const patternsEl = document.getElementById('analysis-patterns-content');
  patternsEl.innerHTML = '';
  
  const patternCounts = {};
  const strategyCounts = {};
  data.rounds.forEach(r => {
    (r.npdMessage?.metadata?.patterns_used || []).forEach(p => {
      patternCounts[p] = (patternCounts[p] || 0) + 1;
    });
    (r.counterMessage?.metadata?.strategies_used || []).forEach(s => {
      strategyCounts[s] = (strategyCounts[s] || 0) + 1;
    });
  });
  
  const maxCount = Math.max(...Object.values(patternCounts), ...Object.values(strategyCounts), 1);
  
  // NPD patterns
  const npdTitle = document.createElement('h5');
  npdTitle.textContent = 'NPD 攻击模式';
  npdTitle.style.marginBottom = '0.5rem';
  patternsEl.appendChild(npdTitle);
  
  Object.entries(patternCounts).sort((a, b) => b[1] - a[1]).forEach(([name, count]) => {
    const pattern = ATTACK_PATTERNS.find(p => p.id === name);
    patternsEl.appendChild(createPatternBar(pattern?.label || name, count, maxCount));
  });
  
  // Counter strategies
  const counterTitle = document.createElement('h5');
  counterTitle.textContent = 'Counter 对抗策略';
  counterTitle.style.marginTop = '1rem';
  counterTitle.style.marginBottom = '0.5rem';
  patternsEl.appendChild(counterTitle);
  
  Object.entries(strategyCounts).sort((a, b) => b[1] - a[1]).forEach(([name, count]) => {
    const strat = COUNTER_STRATEGIES.find(s => s.id === name);
    patternsEl.appendChild(createPatternBar(strat?.label || name, count, maxCount));
  });
  
  // Breakdown analysis
  const breakdownEl = document.getElementById('analysis-breakdown-content');
  breakdownEl.innerHTML = '';
  
  const lastRound = data.rounds[data.rounds.length - 1];
  const collapsed = lastRound?.npdState?.collapseProgress >= 85;
  
  const breakdownInfo = [
    { label: '最终崩塌进度', value: `${lastRound?.npdState?.collapseProgress || 0}%`, highlight: collapsed },
    { label: '最终自恋供给', value: `${lastRound?.npdState?.supply || 0}%` },
    { label: '最终暴怒水平', value: `${lastRound?.npdState?.rageLevel || 0}%` },
    { label: '最终脆弱暴露', value: `${lastRound?.npdState?.vulnerabilityExposure || 0}%` },
    { label: '是否完全崩塌', value: collapsed ? '✅ 是' : '❌ 否', highlight: collapsed },
  ];
  
  breakdownInfo.forEach(info => {
    const row = document.createElement('div');
    row.className = 'stat-row';
    row.innerHTML = `
      <span class="stat-label">${info.label}</span>
      <span class="stat-value ${info.highlight ? 'highlight-npd' : ''}">${info.value}</span>
    `;
    breakdownEl.appendChild(row);
  });
  
  // Draw timeline chart
  drawTimelineChart(data);
}

function createPatternBar(label, count, maxCount) {
  const div = document.createElement('div');
  div.className = 'pattern-bar-row';
  div.innerHTML = `
    <span class="pattern-bar-label">${label}</span>
    <div class="pattern-bar-track">
      <div class="pattern-bar-fill" style="width: ${(count / maxCount * 100)}%"></div>
    </div>
    <span class="pattern-bar-count">${count}</span>
  `;
  return div;
}

function drawTimelineChart(data) {
  const canvas = document.getElementById('state-chart');
  if (!canvas) return;
  
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  const padding = 40;
  
  ctx.clearRect(0, 0, w, h);
  
  // Background
  ctx.fillStyle = '#12121a';
  ctx.fillRect(0, 0, w, h);
  
  const rounds = data.rounds;
  if (rounds.length === 0) return;
  
  const xStep = (w - padding * 2) / Math.max(rounds.length - 1, 1);
  
  // Draw grid
  ctx.strokeStyle = '#2a2a45';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = padding + (h - padding * 2) * i / 4;
    ctx.beginPath();
    ctx.moveTo(padding, y);
    ctx.lineTo(w - padding, y);
    ctx.stroke();
    
    ctx.fillStyle = '#5a5a78';
    ctx.font = '10px JetBrains Mono';
    ctx.fillText(`${100 - i * 25}`, 5, y + 4);
  }
  
  // Draw lines
  const metrics = [
    { key: 'supply', color: '#00ff88', label: '供给' },
    { key: 'injury', color: '#ff3366', label: '损伤' },
    { key: 'rageLevel', color: '#ff2222', label: '暴怒' },
    { key: 'vulnerabilityExposure', color: '#cc44ff', label: '脆弱' },
    { key: 'collapseProgress', color: '#ff6633', label: '崩塌' },
  ];
  
  metrics.forEach(metric => {
    ctx.strokeStyle = metric.color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    
    rounds.forEach((r, i) => {
      const x = padding + i * xStep;
      const val = r.npdState?.[metric.key] ?? 0;
      const y = padding + (h - padding * 2) * (1 - val / 100);
      
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    
    ctx.stroke();
  });
  
  // Legend
  let legendX = padding;
  metrics.forEach(metric => {
    ctx.fillStyle = metric.color;
    ctx.fillRect(legendX, h - 15, 12, 3);
    ctx.fillStyle = '#9898b0';
    ctx.font = '10px Inter';
    ctx.fillText(metric.label, legendX + 16, h - 10);
    legendX += 70;
  });
}

// ============================================
// Helpers
// ============================================
function escapeHTML(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
