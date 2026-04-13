/**
 * NPD Agent - 心理模型和状态管理
 * 基于 DSM-5 NPD 诊断标准 + NARC 框架 (Back et al., 2013)
 */

export const NPD_SUBTYPES = {
  grandiose: {
    label: '夸大型 (Grandiose)',
    description: '外显自大、支配性强、攻击性高、暴怒阈值低',
  },
  vulnerable: {
    label: '脆弱型 (Vulnerable)',
    description: '羞耻敏感、被动攻击、防御性强、暴怒阈值高但爆发剧烈',
  },
  mixed: {
    label: '混合型 (Mixed)',
    description: '外显夸大 + 内在脆弱，在两种状态间振荡',
  },
};

export const DEFENSE_MECHANISMS = [
  { id: 'projection', label: '投射', description: '把自己的缺陷归到对方身上' },
  { id: 'denial', label: '否认', description: '否认事实和自己的行为' },
  { id: 'splitting', label: '分裂', description: '非黑即白，全好/全坏' },
  { id: 'devaluation', label: '贬低', description: '贬低对方来维护自尊' },
  { id: 'idealization', label: '理想化', description: '把自己理想化，把对方妖魔化' },
  { id: 'rationalization', label: '合理化', description: '为自己的行为找"合理"解释' },
  { id: 'gaslighting', label: '煤气灯', description: '让对方怀疑自己的现实感知' },
  { id: 'victimhood', label: '受害者化', description: '将自己包装成受害者' },
];

export const COUNTER_STYLES = {
  surgical: {
    label: '精准外科手术式',
    description: '冷静、精确瞄准弱点、不带感情',
  },
  mirror: {
    label: '镜像回击式',
    description: '用对方的逻辑和手法反噬他们',
  },
  escalation: {
    label: '升级对抗式',
    description: '对等或升级攻击强度，以攻对攻',
  },
  exposure: {
    label: '公开揭穿式',
    description: '当众暴露其伪装和真实面目',
  },
  hybrid: {
    label: '混合式',
    description: '灵活组合所有策略',
  },
};

export const ATTACK_PATTERNS = [
  { id: 'gaslighting', label: '煤气灯操控', icon: '🌫️' },
  { id: 'devaluation', label: '贬低/去价值化', icon: '⬇️' },
  { id: 'projection', label: '投射', icon: '🪞' },
  { id: 'blame_shift', label: '责任转移', icon: '👉' },
  { id: 'victim_play', label: '受害者化', icon: '😭' },
  { id: 'rage', label: '自恋暴怒', icon: '🔥' },
  { id: 'triangulation', label: '三角化', icon: '🔺' },
  { id: 'word_salad', label: '逻辑混乱', icon: '🌀' },
  { id: 'silent_treatment', label: '冷暴力', icon: '🧊' },
  { id: 'love_bombing', label: '爱的轰炸', icon: '💣' },
];

export const COUNTER_STRATEGIES = [
  { id: 'expose_pattern', label: '暴露行为模式', icon: '🔍' },
  { id: 'deny_supply', label: '拒绝自恋供给', icon: '🚫' },
  { id: 'name_tactic', label: '命名操控手法', icon: '🏷️' },
  { id: 'mirror_attack', label: '镜像回击', icon: '🪞' },
  { id: 'wound_strike', label: '攻击核心伤口', icon: '🎯' },
  { id: 'public_expose', label: '公开揭穿', icon: '📢' },
  { id: 'status_threat', label: '地位威胁', icon: '👑' },
  { id: 'escalate_verbal', label: '升级言语攻击', icon: '⚡' },
  { id: 'reality_anchor', label: '现实锚定', icon: '⚓' },
  { id: 'cold_dismiss', label: '冷漠无视', icon: '🧊' },
];

/**
 * Creates a default NPD Agent state
 */
export function createNPDAgent(config = {}) {
  return {
    role: 'npd',
    name: config.name || 'Victor',
    background: config.background || '',
    subtype: config.subtype || 'grandiose',
    coreWound: config.coreWound || '',
    
    // Profile parameters (0-100)
    profile: {
      grandiosity: config.grandiosity ?? 85,
      vulnerability: config.vulnerability ?? 70,
      admirationDrive: config.admirationDrive ?? 90,
      rivalryDrive: config.rivalryDrive ?? 80,
      empathyDeficit: config.empathyDeficit ?? 90,
      rageThreshold: config.rageThreshold ?? 40,
    },
    
    // Dynamic state (changes during simulation)
    state: {
      supply: 60,           // 自恋供给 - starts moderate
      injury: 0,            // 自恋损伤 - starts at 0
      defenseLevel: 30,     // 防御激活程度
      rageLevel: 0,         // 暴怒水平
      vulnerabilityExposure: 0, // 脆弱性暴露程度
      collapseProgress: 0,  // 崩塌进度
    },
    
    // Tracking
    activeDefenses: [],
    woundHitCount: 0,  // 核心伤口被攻击次数
    history: [],       // state snapshots per round
  };
}

/**
 * Creates a Counter-Agent state
 */
export function createCounterAgent(config = {}) {
  return {
    role: 'counter',
    name: config.name || 'Diana',
    background: config.background || '',
    style: config.style || 'hybrid',
    
    // Profile parameters
    profile: {
      attackIntensity: config.attackIntensity ?? 75,
      escalationWillingness: config.escalationWillingness ?? 80,
      psychInsight: config.psychInsight ?? 90,
    },
    
    // Dynamic state
    state: {
      currentIntensity: 50,
      strategiesUsed: [],
    },
    
    history: [],
  };
}

/**
 * Takes a state snapshot for history tracking
 */
export function snapshotState(agent) {
  return {
    ...agent.state,
    activeDefenses: [...(agent.activeDefenses || [])],
    timestamp: Date.now(),
  };
}
