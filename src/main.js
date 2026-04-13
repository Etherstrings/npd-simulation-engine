/**
 * NPD 对抗模拟引擎 — Main Application
 * Entry point for the simulation UI
 */

import './style.css';
import { SimulationEngine } from './engine/simulation.js';
import { getScenarios } from './engine/prompts.js';
import { DEFENSE_MECHANISMS, ATTACK_PATTERNS, COUNTER_STRATEGIES } from './engine/agent.js';
import { loadSettings, saveSettings } from './utils/api.js';
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
  initSliders();
  initSettings();
  initButtons();
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
}

// ============================================
// Export
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
