/**
 * Simulation Engine - 模拟循环核心
 * Manages the turn-by-turn dialogue generation
 */

import { createNPDAgent, createCounterAgent, snapshotState } from './agent.js';
import { updateNPDState, updateCounterState, parseAttackAnalysis, calculateEscalation } from './psychology.js';
import { buildNPDPrompt, buildCounterPrompt, buildScenarioContext } from './prompts.js';
import { callLLM, parseLLMResponse } from '../utils/api.js';

export class SimulationEngine {
  constructor() {
    this.npdAgent = null;
    this.counterAgent = null;
    this.scenario = '';
    this.config = {};
    this.conversationHistory = {
      npd: [],     // For NPD agent's conversation context
      counter: [], // For Counter agent's conversation context
    };
    this.rounds = [];
    this.currentRound = 0;
    this.isRunning = false;
    this.isPaused = false;
    this.onUpdate = null; // Callback for UI updates
    this.onComplete = null;
    this.onError = null;
  }
  
  /**
   * Initialize simulation with config
   */
  init(config) {
    this.config = config;
    
    this.npdAgent = createNPDAgent({
      name: config.npdAgent.name,
      background: config.npdAgent.background,
      subtype: config.npdAgent.subtype,
      coreWound: config.npdAgent.coreWound,
      grandiosity: config.npdAgent.grandiosity,
      vulnerability: config.npdAgent.vulnerability,
      admirationDrive: config.npdAgent.admiration,
      rivalryDrive: config.npdAgent.rivalry,
      empathyDeficit: config.npdAgent.empathy,
      rageThreshold: config.npdAgent.rage,
    });
    
    this.counterAgent = createCounterAgent({
      name: config.counterAgent.name,
      background: config.counterAgent.background,
      style: config.counterAgent.style,
      attackIntensity: config.counterAgent.attack,
      escalationWillingness: config.counterAgent.escalation,
      psychInsight: config.counterAgent.insight,
    });
    
    this.scenario = buildScenarioContext(config.scenario, config.customScenario);
    this.conversationHistory = { npd: [], counter: [] };
    this.rounds = [];
    this.currentRound = 0;
    this.isRunning = false;
    this.isPaused = false;
  }
  
  /**
   * Get full simulation data for export
   */
  getSimulationData() {
    return {
      config: this.config,
      scenario: this.scenario,
      rounds: this.rounds,
      npdFinalState: this.npdAgent?.state,
      counterFinalState: this.counterAgent?.state,
      timestamp: Date.now(),
    };
  }
  
  /**
   * Run the full simulation
   */
  async run() {
    this.isRunning = true;
    const maxRounds = this.config.maxRounds || 15;
    
    // Emit start event
    this.emit('start', { maxRounds });
    
    // Initial scenario setup message
    this.emit('system', { 
      message: `📋 场景: ${this.scenario.substring(0, 100)}... | ⚔️ ${this.npdAgent.name} (NPD) vs ${this.counterAgent.name} (Counter)` 
    });
    
    try {
      for (let round = 1; round <= maxRounds; round++) {
        if (!this.isRunning) break;
        
        // Wait if paused
        while (this.isPaused) {
          await new Promise(r => setTimeout(r, 200));
          if (!this.isRunning) return;
        }
        
        this.currentRound = round;
        await this.executeRound(round, maxRounds);
        
        // Check for collapse
        if (this.npdAgent.state.collapseProgress >= 95) {
          this.emit('system', { 
            message: `💀 ${this.npdAgent.name} 在第 ${round} 回合彻底崩塌！自恋防御体系完全瓦解。` 
          });
          break;
        }
      }
    } catch (error) {
      this.emit('error', { message: error.message });
    }
    
    this.isRunning = false;
    this.emit('complete', { 
      data: this.getSimulationData(),
      npdAgent: this.npdAgent,
      counterAgent: this.counterAgent,
    });
  }
  
  /**
   * Execute a single round
   */
  async executeRound(round, maxRounds) {
    const roundData = {
      round,
      npdMessage: null,
      counterMessage: null,
      npdState: null,
      counterState: null,
      npdStatus: null,
      npdActiveDefenses: null,
      escalation: 0,
      counterIntensity: 0,
    };
    
    // === Counter-Agent speaks first (to provoke NPD) ===
    // Exception: round 1, NPD speaks first to set the tone
    
    if (round === 1) {
      // Round 1: NPD opens
      this.emit('typing', { agent: 'npd' });
      
      const npdPrompt = buildNPDPrompt(
        this.npdAgent, this.scenario, round, maxRounds, this.config.escalationRate
      );
      
      const npdRaw = await callLLM(npdPrompt, this.conversationHistory.npd);
      const npdParsed = parseLLMResponse(npdRaw);
      roundData.npdMessage = npdParsed;
      roundData.npdState = { ...this.npdAgent.state };
      roundData.npdStatus = { label: '稳定', class: '' };
      roundData.npdActiveDefenses = [...this.npdAgent.activeDefenses];
      
      // Save NPD message to conversation history
      this.conversationHistory.npd.push({ role: 'assistant', content: npdParsed.dialogue });
      this.conversationHistory.counter.push({ role: 'user', content: npdParsed.dialogue });
      
      this.npdAgent.history.push(snapshotState(this.npdAgent));
      
      this.emit('npdMessage', { round, ...npdParsed, state: this.npdAgent.state, status: roundData.npdStatus, defenses: roundData.npdActiveDefenses });
    }
    
    // === Counter-Agent responds ===
    this.emit('typing', { agent: 'counter' });
    
    // Update counter state before generating
    const counterState = updateCounterState(
      this.counterAgent, round, maxRounds, this.npdAgent.state
    );
    
    const counterPrompt = buildCounterPrompt(
      this.counterAgent, this.npdAgent, this.scenario, round, maxRounds, this.config.escalationRate
    );
    
    const counterRaw = await callLLM(counterPrompt, this.conversationHistory.counter);
    const counterParsed = parseLLMResponse(counterRaw);
    roundData.counterMessage = counterParsed;
    roundData.counterIntensity = counterState.currentIntensity;
    
    // Add to conversation history
    this.conversationHistory.counter.push({ role: 'assistant', content: counterParsed.dialogue });
    this.conversationHistory.npd.push({ role: 'user', content: counterParsed.dialogue });
    
    this.counterAgent.history.push(snapshotState(this.counterAgent));
    
    // Track strategies used
    const strategies = counterParsed.metadata?.strategies_used || [];
    this.counterAgent.state.strategiesUsed = [
      ...new Set([...(this.counterAgent.state.strategiesUsed || []), ...strategies])
    ];
    
    this.emit('counterMessage', { round, ...counterParsed, state: counterState });
    
    // === Update NPD psychological state ===
    const attackAnalysis = parseAttackAnalysis({
      injuryScore: counterParsed.metadata?.injury_score ?? 15,
      supplyDrain: counterParsed.metadata?.supply_drain ?? 10,
      targetsWound: counterParsed.metadata?.targets_wound ?? false,
      isEscalation: counterParsed.metadata?.is_escalation ?? false,
      patterns: counterParsed.metadata?.strategies_used || [],
      strategies: strategies,
    });
    
    const npdUpdate = updateNPDState(this.npdAgent, attackAnalysis, round, maxRounds);
    
    // === NPD responds (from round 2 onwards) ===
    if (round > 1 || round === 1) {
      if (round > 1) {
        this.emit('typing', { agent: 'npd' });
        
        const npdPrompt = buildNPDPrompt(
          this.npdAgent, this.scenario, round, maxRounds, this.config.escalationRate
        );
        
        const npdRaw = await callLLM(npdPrompt, this.conversationHistory.npd);
        const npdParsed = parseLLMResponse(npdRaw);
        roundData.npdMessage = npdParsed;
        
        this.conversationHistory.npd.push({ role: 'assistant', content: npdParsed.dialogue });
        this.conversationHistory.counter.push({ role: 'user', content: npdParsed.dialogue });
        
        this.npdAgent.history.push(snapshotState(this.npdAgent));
        
        this.emit('npdMessage', { 
          round, ...npdParsed, 
          state: this.npdAgent.state, 
          status: npdUpdate.status, 
          defenses: npdUpdate.activeDefenses 
        });
      }
    }
    
    // Record final state for this round
    roundData.npdState = { ...this.npdAgent.state };
    roundData.counterState = { ...this.counterAgent.state };
    roundData.npdStatus = npdUpdate.status;
    roundData.npdActiveDefenses = [...npdUpdate.activeDefenses];
    roundData.escalation = calculateEscalation(
      this.npdAgent.state, this.counterAgent.state, round, maxRounds
    );
    
    this.emit('roundComplete', roundData);
    this.rounds.push(roundData);
    
    // Small delay between rounds
    await new Promise(r => setTimeout(r, 500));
  }
  
  /**
   * Pause / resume
   */
  pause() {
    this.isPaused = true;
  }
  resume() {
    this.isPaused = false;
  }
  
  /**
   * Stop simulation
   */
  stop() {
    this.isRunning = false;
    this.isPaused = false;
  }
  
  /**
   * Event emitter
   */
  emit(event, data) {
    if (this.onUpdate) {
      this.onUpdate(event, data);
    }
  }
}
