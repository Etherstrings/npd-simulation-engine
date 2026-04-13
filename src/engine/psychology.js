/**
 * Psychology Engine - 心理状态计算模型
 * 基于 NARC 框架的状态转换逻辑
 */

/**
 * Update NPD agent's psychological state based on counter-agent's attack
 */
export function updateNPDState(npdAgent, attackAnalysis, round, totalRounds) {
  const state = { ...npdAgent.state };
  const profile = npdAgent.profile;
  const progressRatio = round / totalRounds;
  
  // 1. Calculate injury from attack
  const baseInjury = attackAnalysis.injuryScore || 0;
  const vulnerabilityMultiplier = 1 + (profile.vulnerability / 100) * 0.5;
  const injuryDelta = baseInjury * vulnerabilityMultiplier;
  
  state.injury = Math.min(100, state.injury + injuryDelta);
  
  // 2. Drain narcissistic supply
  const supplyDrain = attackAnalysis.supplyDrain || 0;
  state.supply = Math.max(0, state.supply - supplyDrain);
  
  // Low supply accelerates all damage
  const supplyFactor = state.supply < 30 ? 1.5 : 1;
  
  // 3. Update defense level
  if (state.injury > 20) {
    state.defenseLevel = Math.min(100, state.defenseLevel + injuryDelta * 0.6 * supplyFactor);
  }
  
  // 4. Calculate rage
  const rageGain = injuryDelta * (1 - profile.rageThreshold / 100) * supplyFactor;
  state.rageLevel = Math.min(100, state.rageLevel + rageGain);
  
  // Rage naturally decays slightly
  if (!attackAnalysis.isEscalation) {
    state.rageLevel = Math.max(0, state.rageLevel - 3);
  }
  
  // 5. Vulnerability exposure
  if (attackAnalysis.targetsWound) {
    npdAgent.woundHitCount = (npdAgent.woundHitCount || 0) + 1;
    state.vulnerabilityExposure = Math.min(100, 
      state.vulnerabilityExposure + 15 * supplyFactor
    );
  }
  
  // Natural vulnerability increase when defenses are overwhelmed
  if (state.defenseLevel > 80 && state.injury > 60) {
    state.vulnerabilityExposure = Math.min(100,
      state.vulnerabilityExposure + 5
    );
  }
  
  // 6. Collapse progress
  const collapseFactors = [
    state.injury > 70 ? 8 : 0,
    state.supply < 20 ? 10 : 0,
    state.vulnerabilityExposure > 80 ? 12 : 0,
    (npdAgent.woundHitCount || 0) >= 3 ? 15 : 0,
    state.rageLevel > 90 ? 5 : 0,
    state.defenseLevel > 90 ? 8 : 0,
  ];
  
  const collapseGain = collapseFactors.reduce((a, b) => a + b, 0) * supplyFactor * 0.3;
  state.collapseProgress = Math.min(100, state.collapseProgress + collapseGain);
  
  // 7. Update active defenses
  const activeDefenses = determineActiveDefenses(state, profile, npdAgent.subtype);
  
  npdAgent.state = state;
  npdAgent.activeDefenses = activeDefenses;
  
  return {
    state,
    activeDefenses,
    status: determineNPDStatus(state, npdAgent.woundHitCount),
  };
}

/**
 * Determine which defense mechanisms are active based on state
 */
function determineActiveDefenses(state, profile, subtype) {
  const defenses = [];
  
  // Always-on defenses for NPD
  if (state.injury > 10) defenses.push('denial');
  if (state.injury > 25) defenses.push('projection');
  if (state.injury > 40) defenses.push('devaluation');
  
  // Subtype-specific
  if (subtype === 'grandiose') {
    if (state.rageLevel > 30) defenses.push('splitting');
    if (state.injury > 50) defenses.push('rationalization');
  } else if (subtype === 'vulnerable') {
    if (state.injury > 20) defenses.push('victimhood');
    if (state.rageLevel > 50) defenses.push('gaslighting');
  } else {
    // Mixed - oscillates between both
    if (state.supply > 40) {
      defenses.push('rationalization');
    } else {
      defenses.push('victimhood');
    }
    if (state.injury > 30) defenses.push('gaslighting');
  }
  
  // High stress defenses
  if (state.vulnerabilityExposure > 50) defenses.push('gaslighting');
  if (state.collapseProgress > 30) defenses.push('idealization');
  if (state.rageLevel > 70) defenses.push('splitting');
  
  return [...new Set(defenses)];
}

/**
 * Determine the overall NPD status
 */
function determineNPDStatus(state, woundHits) {
  if (state.collapseProgress >= 85) return { label: '崩塌 COLLAPSE', class: 'collapsed' };
  if (state.collapseProgress >= 60) return { label: '濒临崩塌', class: 'rage' };
  if (state.rageLevel >= 80) return { label: '🔥 暴怒模式', class: 'rage' };
  if (state.rageLevel >= 50) return { label: '激怒', class: 'rage' };
  if (state.vulnerabilityExposure >= 70) return { label: '脆弱暴露', class: 'rage' };
  if (state.injury >= 60) return { label: '严重受损', class: 'rage' };
  if (state.injury >= 30) return { label: '受到损伤', class: '' };
  if (state.defenseLevel >= 50) return { label: '防御中', class: '' };
  return { label: '稳定', class: '' };
}

/**
 * Update Counter-Agent state
 */
export function updateCounterState(counterAgent, round, totalRounds, npdState) {
  const state = { ...counterAgent.state };
  const profile = counterAgent.profile;
  const progressRatio = round / totalRounds;
  
  // Intensity escalates over time based on escalation willingness
  const baseEscalation = profile.escalationWillingness / 100;
  state.currentIntensity = Math.min(100,
    50 + progressRatio * 50 * baseEscalation + 
    (npdState.rageLevel > 50 ? 15 : 0) // Match NPD's escalation
  );
  
  counterAgent.state = state;
  return state;
}

/**
 * Parse the LLM's analysis metadata from the response
 */
export function parseAttackAnalysis(metadata) {
  return {
    injuryScore: metadata?.injuryScore ?? 15,
    supplyDrain: metadata?.supplyDrain ?? 10,
    targetsWound: metadata?.targetsWound ?? false,
    isEscalation: metadata?.isEscalation ?? false,
    patterns: metadata?.patterns || [],
    strategies: metadata?.strategies || [],
  };
}

/**
 * Calculate escalation level for the meter display
 */
export function calculateEscalation(npdState, counterState, round, totalRounds) {
  const npdFactor = (npdState.injury + npdState.rageLevel + npdState.vulnerabilityExposure) / 300;
  const counterFactor = (counterState.currentIntensity || 50) / 100;
  const timeFactor = round / totalRounds;
  
  return Math.min(100, Math.round((npdFactor * 40 + counterFactor * 30 + timeFactor * 30)));
}
