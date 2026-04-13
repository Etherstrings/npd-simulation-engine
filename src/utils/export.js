/**
 * Export utilities - JSON/CSV export for research analysis
 */

/**
 * Export simulation data as JSON
 */
export function exportJSON(simulationData) {
  const blob = new Blob([JSON.stringify(simulationData, null, 2)], { type: 'application/json' });
  downloadBlob(blob, `npd-simulation-${Date.now()}.json`);
}

/**
 * Export simulation data as CSV
 */
export function exportCSV(simulationData) {
  const rows = [];
  
  // Header
  rows.push([
    'round',
    'speaker',
    'dialogue',
    'patterns_used',
    'strategies_used',
    'npd_supply',
    'npd_injury',
    'npd_defense',
    'npd_rage',
    'npd_vulnerability',
    'npd_collapse',
    'npd_status',
    'npd_active_defenses',
    'counter_intensity',
    'escalation_level',
    'targets_wound',
    'injury_score',
    'supply_drain',
  ].join(','));
  
  // Data rows
  simulationData.rounds.forEach(round => {
    // NPD message
    rows.push(csvRow([
      round.round,
      'NPD',
      escapeCSV(round.npdMessage?.dialogue || ''),
      escapeCSV((round.npdMessage?.metadata?.patterns_used || []).join('; ')),
      '',
      round.npdState?.supply,
      round.npdState?.injury,
      round.npdState?.defenseLevel,
      round.npdState?.rageLevel,
      round.npdState?.vulnerabilityExposure,
      round.npdState?.collapseProgress,
      round.npdStatus?.label || '',
      escapeCSV((round.npdActiveDefenses || []).join('; ')),
      '',
      round.escalation,
      '',
      '',
      '',
    ]));
    
    // Counter message
    rows.push(csvRow([
      round.round,
      'Counter',
      escapeCSV(round.counterMessage?.dialogue || ''),
      '',
      escapeCSV((round.counterMessage?.metadata?.strategies_used || []).join('; ')),
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      round.counterIntensity,
      '',
      round.counterMessage?.metadata?.targets_wound || false,
      round.counterMessage?.metadata?.injury_score || 0,
      round.counterMessage?.metadata?.supply_drain || 0,
    ]));
  });
  
  const blob = new Blob(['\uFEFF' + rows.join('\n')], { type: 'text/csv;charset=utf-8' });
  downloadBlob(blob, `npd-simulation-${Date.now()}.csv`);
}

/**
 * Export full report
 */
export function exportFullReport(simulationData) {
  const report = generateReportMarkdown(simulationData);
  const blob = new Blob([report], { type: 'text/markdown;charset=utf-8' });
  downloadBlob(blob, `npd-simulation-report-${Date.now()}.md`);
}

function generateReportMarkdown(data) {
  let md = `# NPD 对抗模拟报告\n\n`;
  md += `**生成时间**: ${new Date().toISOString()}\n`;
  md += `**总回合数**: ${data.config.maxRounds}\n`;
  md += `**升级速度**: ${data.config.escalationRate}\n`;
  md += `**语言**: ${data.config.language}\n\n`;
  
  md += `## 场景\n${data.config.scenario}\n\n`;
  
  md += `## NPD Agent: ${data.config.npdAgent.name}\n`;
  md += `- 亚型: ${data.config.npdAgent.subtype}\n`;
  md += `- 核心伤口: ${data.config.npdAgent.coreWound}\n`;
  md += `- 背景: ${data.config.npdAgent.background}\n\n`;
  
  md += `## Counter-Agent: ${data.config.counterAgent.name}\n`;
  md += `- 风格: ${data.config.counterAgent.style}\n`;
  md += `- 背景: ${data.config.counterAgent.background}\n\n`;
  
  md += `## 对话记录\n\n`;
  
  data.rounds.forEach(round => {
    md += `### 回合 ${round.round}\n\n`;
    
    if (round.npdMessage) {
      md += `**${data.config.npdAgent.name}** (NPD):\n> ${round.npdMessage.dialogue}\n\n`;
      md += `- 攻击模式: ${(round.npdMessage.metadata?.patterns_used || []).join(', ')}\n`;
      md += `- NPD状态: 供给=${round.npdState?.supply}, 损伤=${round.npdState?.injury}, 暴怒=${round.npdState?.rageLevel}, 崩塌=${round.npdState?.collapseProgress}\n\n`;
    }
    
    if (round.counterMessage) {
      md += `**${data.config.counterAgent.name}** (Counter):\n> ${round.counterMessage.dialogue}\n\n`;
      md += `- 策略: ${(round.counterMessage.metadata?.strategies_used || []).join(', ')}\n`;
      md += `- 伤害值: ${round.counterMessage.metadata?.injury_score || 0}\n`;
      md += `- 供给削减: ${round.counterMessage.metadata?.supply_drain || 0}\n`;
      md += `- 命中核心伤口: ${round.counterMessage.metadata?.targets_wound ? '是' : '否'}\n\n`;
    }
    
    md += `---\n\n`;
  });
  
  // Summary statistics
  md += `## 统计分析\n\n`;
  const stats = calculateStats(data);
  md += `| 指标 | 值 |\n|---|---|\n`;
  Object.entries(stats).forEach(([key, value]) => {
    md += `| ${key} | ${value} |\n`;
  });
  
  return md;
}

function calculateStats(data) {
  const allPatterns = {};
  const allStrategies = {};
  let totalInjury = 0;
  let totalDrain = 0;
  let woundHits = 0;
  let collapseRound = null;
  
  data.rounds.forEach(round => {
    const npdPatterns = round.npdMessage?.metadata?.patterns_used || [];
    npdPatterns.forEach(p => { allPatterns[p] = (allPatterns[p] || 0) + 1; });
    
    const counterStrats = round.counterMessage?.metadata?.strategies_used || [];
    counterStrats.forEach(s => { allStrategies[s] = (allStrategies[s] || 0) + 1; });
    
    totalInjury += round.counterMessage?.metadata?.injury_score || 0;
    totalDrain += round.counterMessage?.metadata?.supply_drain || 0;
    
    if (round.counterMessage?.metadata?.targets_wound) woundHits++;
    
    if (!collapseRound && round.npdState?.collapseProgress >= 85) {
      collapseRound = round.round;
    }
  });
  
  return {
    '总回合数': data.rounds.length,
    '累计自恋损伤': totalInjury,
    '累计供给削减': totalDrain,
    '核心伤口命中次数': woundHits,
    '崩塌回合': collapseRound || '未崩塌',
    '最终崩塌进度': data.rounds[data.rounds.length - 1]?.npdState?.collapseProgress || 0,
    '使用最多的攻击模式': Object.entries(allPatterns).sort((a, b) => b[1] - a[1])[0]?.[0] || '-',
    '使用最多的对抗策略': Object.entries(allStrategies).sort((a, b) => b[1] - a[1])[0]?.[0] || '-',
  };
}

function escapeCSV(str) {
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function csvRow(values) {
  return values.join(',');
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export { calculateStats };
