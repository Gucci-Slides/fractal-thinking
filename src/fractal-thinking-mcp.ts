#!/usr/bin/env node

/*
 * LLM Tool Usage Guide
 * ===================
 * 
 * Required Tool Flow:
 * 
 * 1. Breaking Down Initial Thoughts
 *    - Use breakDownThought to decompose complex thoughts
 *    - Choose appropriate decomposition pattern
 *    - Example:
 *      breakDownThought({
 *        thought: "Complex system design",
 *        decompositionPattern: "system-components"
 *      })
 * 
 * 2. Adding and Summarizing Thoughts (ALWAYS PAIRED)
 *    - MUST follow this two-step process for each thought:
 *      a) First, add the thought:
 *         addFractalThought({
 *           thought: "System component X",
 *           isComplete: false,
 *           needsDeeperAnalysis: true
 *         })
 *      b) Immediately after, summarize the thought using its ID from the response:
 *         summarizeFractalAnalysis({
 *           thoughtId: "returned_id_from_add",
 *           forceSummarize: true
 *         })
 * 
 * 3. Deep Analysis (Optional)
 *    - Use analyzeFractalDepth when more detailed insights are needed
 *    - Example:
 *      analyzeFractalDepth({
 *        thoughtId: "thought_id"
 *      })
 * 
 * Common Patterns:
 * 
 * 1. Complete Thought Processing
 *    breakDownThought -> (addFractalThought -> summarizeFractalAnalysis) for each branch
 *    This ensures each thought is properly analyzed and cached
 * 
 * 2. Pattern Evolution
 *    summarizeFractalAnalysis -> analyzeFractalDepth
 *    When summary shows interesting patterns, get full analysis
 * 
 * 3. Comparative Analysis
 *    summarizeFractalAnalysis(parent) -> summarizeFractalAnalysis(child)
 *    Compare pattern evolution between related thoughts
 * 
 * IMPORTANT:
 * - NEVER add a thought without immediately summarizing it
 * - Use the thoughtId from addFractalThought response in the subsequent summarizeFractalAnalysis call
 * - Set forceSummarize: true to ensure fresh analysis
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema, Tool } from '@modelcontextprotocol/sdk/types.js';
import chalk from 'chalk';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import debug from 'debug';

// Initialize debug logger
const log = debug('mcp:fractal-thinking');

// Enable debug logging
process.env.DEBUG = 'mcp:*';

// Types and interfaces
interface FractalThought {
  thought: string;
  thoughtId: string;
  depth: number;
  parentId: string | null;
  subThoughts: FractalThought[];
  isComplete: boolean;
  needsDeeperAnalysis: boolean;
  createdAt: string;
}

interface FractalAnalysis {
  maxDepth: number;
  unresolvedCount: number;
  totalCount: number;
  completionRatio: number;
  status: 'incomplete' | 'partially_complete' | 'complete';
  needsAttention: boolean;
  fractalMetrics: {
    branchingFactor: number;      // Average number of subthoughts per thought
    depthConsistency: number;     // How consistently patterns repeat at each depth
    crossBranchSimilarity: number; // Similarity between sibling branches
    patternStrength: number;      // How well the pattern propagates down the tree
    recursivePatterns: {          // Patterns that repeat across scales
      type: string;               // Type of pattern identified
      occurrences: number;        // Number of times pattern appears
      scales: number[];           // Depths at which pattern appears
      evolution: Array<{ 
        depth: number; 
        variation: string;
        confidence: number;      // Confidence score for this evolution step
      }>;
      crossBranchOccurrences: number;
      confidence: number;        // Overall confidence score for the pattern
    }[];
    emergentProperties: {         // Properties that emerge from pattern interaction
      property: string;
      strength: number;           // 0-1 measure of property strength
      relatedPatterns: string[];  // Patterns contributing to this property
    }[];
  };
  summary: {
    complexSystems: string;       // How the thought breaks down complex systems
    patternIdentification: string; // Insights from recognized patterns
    forecasting: string;          // Probability forecasts and future implications
    innovation: string;           // Potential for scaling and novel applications
  };
}

interface FractalAnalysisResponse {
  thought: FractalAnalysis;
  parent?: FractalAnalysis;
}

interface ThoughtContext {
  parent?: FractalThought;
  siblings: FractalThought[];
  depth: number;
  pathLength: number;
}

// Add cache interfaces after the existing interfaces
interface CachedAnalysis {
  timestamp: number;
  summary: string;
  key: string;
  fullAnalysis?: FractalAnalysis;
  accessCount?: number;
}

interface AnalysisCache {
  [key: string]: CachedAnalysis;
}

// Add after the AnalysisCache interface
interface AggregateSummary {
  thoughtId: string;
  timestamp: number;
  summary: string;
  childSummaries: { [key: string]: string };
  metrics: {
    totalBranches: number;
    averageDepth: number;
    completionRate: number;
    patternStrength: number;
  };
}

interface AggregateCache {
  [key: string]: AggregateSummary;
}

interface CacheConfig {
  baseExpirationMs: number;
  patternStrengthMultiplier: number;
  depthMultiplier: number;
  maxCacheSize: number;
  minExpirationMs: number;
  maxExpirationMs: number;
}

interface CacheStats {
  hits: number;
  misses: number;
  evictions: number;
  totalSize: number;
}

interface ThoughtChangeTracker {
  lastModified: number;
  subthoughtChanges: boolean;
  lastAnalysis: number;
}

// Add before the FractalThinkingServer class
class AnalysisSummarizer {
  static summarizeAnalysis(analysis: FractalAnalysis): string {
    if (!analysis || !analysis.fractalMetrics) {
      return 'D0|C0%|P[]|E[]|S0%';
    }

    const { recursivePatterns = [], emergentProperties = [] } = analysis.fractalMetrics;
    
    const patterns = recursivePatterns
      .slice(0, 2)
      .map(p => `${p.type}(${p.occurrences})`)
      .join(', ');
    
    const properties = emergentProperties
      .slice(0, 2)
      .map(p => `${p.property}(${(p.strength * 100).toFixed(0)}%)`)
      .join(', ');

    return [
      `D${analysis.maxDepth || 0}`,
      `C${((analysis.completionRatio || 0) * 100).toFixed(0)}%`,
      `P[${patterns}]`,
      `E[${properties}]`,
      `S${((analysis.fractalMetrics.patternStrength || 0) * 100).toFixed(0)}%`
    ].join('|');
  }

  static expandSummary(summary: string): Partial<FractalAnalysis> {
    if (!summary || typeof summary !== 'string') {
      return {
        maxDepth: 0,
        completionRatio: 0,
        fractalMetrics: {
          branchingFactor: 0,
          depthConsistency: 0,
          crossBranchSimilarity: 0,
          patternStrength: 0,
          recursivePatterns: [],
          emergentProperties: []
        }
      };
    }

    const [depth, completion, patterns, properties, strength] = summary.split('|');
    
    const parsedPatterns = patterns?.slice(2, -1).split(',').filter(Boolean) || [];
    const parsedProperties = properties?.slice(2, -1).split(',').filter(Boolean) || [];

    return {
      maxDepth: parseInt(depth?.slice(1) || '0'),
      completionRatio: parseInt(completion?.slice(1) || '0') / 100,
      fractalMetrics: {
        branchingFactor: 0,
        depthConsistency: 0,
        crossBranchSimilarity: 0,
        patternStrength: parseInt(strength?.slice(1) || '0') / 100,
        recursivePatterns: parsedPatterns.map(p => {
          const [type = '', count = '0'] = (p.split('(') || []);
          return {
            type: type.trim(),
            occurrences: parseInt(count?.slice(0, -1) || '0'),
            scales: [],
            evolution: [],
            crossBranchOccurrences: 0,
            confidence: 0  // Add default confidence
          };
        }),
        emergentProperties: parsedProperties.map(p => {
          const [prop = '', strength = '0%'] = (p.split('(') || []);
          return {
            property: prop.trim(),
            strength: parseInt(strength?.slice(0, -2) || '0') / 100,
            relatedPatterns: []
          };
        })
      }
    };
  }
}

// Zod schemas for validation
const ThoughtSchema = z.object({
  thought: z.string().min(1),
  thoughtId: z.string().optional(),
  depth: z.number().int().min(0).optional(),
  parentId: z.string().nullable().optional(),
  isComplete: z.boolean(),
  needsDeeperAnalysis: z.boolean(),
  createdAt: z.string().datetime().optional()
}).transform(data => ({
  ...data,
  thoughtId: data.thoughtId || uuidv4(),
  parentId: data.parentId ?? null,
  createdAt: data.createdAt || new Date().toISOString()
}));

class FractalThinkingServer {
  private thoughtTree: FractalThought[] = [{
    thought: 'Root thought',
    thoughtId: 'root',
    depth: 0,
    parentId: null,
    subThoughts: [],
    isComplete: false,
    needsDeeperAnalysis: false,
    createdAt: new Date().toISOString()
  }];

  private cacheConfig: CacheConfig = {
    baseExpirationMs: 5 * 60 * 1000,  // 5 minutes base
    patternStrengthMultiplier: 2,     // Strong patterns cache longer
    depthMultiplier: 1.5,             // Deeper thoughts cache longer
    maxCacheSize: 1000,               // Maximum cache entries
    minExpirationMs: 1 * 60 * 1000,   // 1 minute minimum
    maxExpirationMs: 30 * 60 * 1000   // 30 minutes maximum
  };

  private cacheStats: CacheStats = {
    hits: 0,
    misses: 0,
    evictions: 0,
    totalSize: 0
  };

  private analysisCache: AnalysisCache = {};
  private aggregateCache: AggregateCache = {};

  // Add to existing properties
  private changeTracker: Map<string, ThoughtChangeTracker> = new Map();

  // Add new methods for change tracking
  private trackThoughtChange(thoughtId: string, includeSubthoughts: boolean = false): void {
    const now = Date.now();
    const current = this.changeTracker.get(thoughtId) || {
      lastModified: now,
      subthoughtChanges: false,
      lastAnalysis: 0
    };
    
    current.lastModified = now;
    if (includeSubthoughts) {
      current.subthoughtChanges = true;
    }
    
    this.changeTracker.set(thoughtId, current);
    
    // Propagate change notification up the tree
    const thought = this.findThought(thoughtId);
    if (thought && thought.parentId) {
      const parentTracker = this.changeTracker.get(thought.parentId) || {
        lastModified: now,
        subthoughtChanges: true,
        lastAnalysis: 0
      };
      parentTracker.subthoughtChanges = true;
      this.changeTracker.set(thought.parentId, parentTracker);
    }
  }

  private hasNodeChanged(node: FractalThought): boolean {
    const tracker = this.changeTracker.get(node.thoughtId);
    if (!tracker) return true; // No tracking info means treat as changed
    
    if (tracker.lastModified > tracker.lastAnalysis) return true;
    if (tracker.subthoughtChanges) return true;
    
    return false;
  }

  private markAnalyzed(thoughtId: string): void {
    const now = Date.now();
    const tracker = this.changeTracker.get(thoughtId);
    if (tracker) {
      tracker.lastAnalysis = now;
      tracker.subthoughtChanges = false;
      this.changeTracker.set(thoughtId, tracker);
    }
  }

  // Find a thought by ID in the tree
  public findThought(id: string | null, nodes: FractalThought[] = this.thoughtTree): FractalThought | null {
    if (!id) return null;
    
    // Special case for root
    if (id === 'root' && nodes === this.thoughtTree) {
      return this.thoughtTree[0];
    }

    for (const node of nodes) {
      if (node.thoughtId === id) return node;
      const found = this.findThought(id, node.subThoughts);
      if (found) return found;
    }
    return null;
  }

  // Get a thought with its context
  private getThoughtWithContext(thoughtId: string): { 
    thought?: FractalThought, 
    parent?: FractalThought,
    siblings?: FractalThought[],
    path?: FractalThought[]
  } {
    const findPath = (
      id: string, 
      nodes: FractalThought[] = this.thoughtTree, 
      path: FractalThought[] = []
    ): FractalThought[] | null => {
      for (const node of nodes) {
        if (node.thoughtId === id) {
          return [...path, node];
        }
        const foundPath = findPath(id, node.subThoughts, [...path, node]);
        if (foundPath) return foundPath;
      }
      return null;
    };

    const path = findPath(thoughtId);
    if (!path) return {};

    const thought = path[path.length - 1];
    const parent = path.length > 1 ? path[path.length - 2] : undefined;
    const siblings = parent ? parent.subThoughts : this.thoughtTree;

    return {
      thought,
      parent,
      siblings,
      path
    };
  }

  // Add a new thought to the tree
  public addThought(params: Omit<FractalThought, 'subThoughts' | 'thoughtId' | 'createdAt' | 'depth'> & { 
    thoughtId?: string; 
    createdAt?: string;
    depth?: number;
  }): {
    success: boolean;
    thought?: FractalThought;
    context?: ThoughtContext;
    analysis?: FractalAnalysisResponse;
    aggregateSummary?: AggregateSummary;
    message?: string;
  } {
    try {
      const validation = ThoughtSchema.safeParse(params);
      if (!validation.success) {
        return {
          success: false,
          message: 'Invalid parameters: ' + validation.error.message
        };
      }

      const { thought, thoughtId, parentId, isComplete, needsDeeperAnalysis, createdAt } = validation.data;
      
      const parent = this.findThought(parentId);
      if (parentId && !parent) {
        return {
          success: false,
          message: `Parent thought not found: ${parentId}`
        };
      }

      const depth = params.depth ?? (parent ? parent.depth + 1 : 0);

      const newThought: FractalThought = {
        thought,
        thoughtId,
        depth,
        parentId,
        isComplete,
        needsDeeperAnalysis,
        createdAt,
        subThoughts: []
      };

      if (parent) {
        parent.subThoughts.push(newThought);
        this.trackThoughtChange(parent.thoughtId, true);
      } else {
        this.thoughtTree.push(newThought);
      }
      
      this.trackThoughtChange(newThought.thoughtId);

      const thoughtContext = this.getThoughtWithContext(thoughtId);
      const context: ThoughtContext = {
        parent: thoughtContext.parent,
        siblings: thoughtContext.siblings || [],
        depth: thoughtContext.path?.length || 0,
        pathLength: thoughtContext.path?.length || 0
      };

      const thoughtAnalysis = this.analyzeDepth(thoughtId);
      const parentAnalysis = parentId ? this.analyzeDepth(parentId) : undefined;

      const thoughtAggregate = this.generateAggregateSummary(thoughtId);
      if (parentId) {
        this.generateAggregateSummary(parentId);
      }

      return {
        success: true,
        thought: newThought,
        context,
        analysis: {
          thought: thoughtAnalysis,
          parent: parentAnalysis
        },
        aggregateSummary: thoughtAggregate
      };
    } catch (error) {
      return {
        success: false,
        message: `Error adding thought: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  private calculateBranchingFactor(node: FractalThought): number {
    if (node.subThoughts.length === 0) return 0;
    const directBranching = node.subThoughts.length;
    const subBranching = node.subThoughts.map(sub => this.calculateBranchingFactor(sub));
    return (directBranching + subBranching.reduce((a, b) => a + b, 0)) / (subBranching.length + 1);
  }

  private calculateDepthConsistency(node: FractalThought): number {
    if (node.subThoughts.length === 0) return 1;
    const depths = node.subThoughts.map(sub => this.getMaxDepth(sub));
    const avgDepth = depths.reduce((a, b) => a + b, 0) / depths.length;
    const variance = depths.reduce((a, b) => a + Math.pow(b - avgDepth, 2), 0) / depths.length;
    return 1 / (1 + variance);
  }

  private getMaxDepth(node: FractalThought): number {
    if (node.subThoughts.length === 0) return node.depth;
    return Math.max(...node.subThoughts.map(sub => this.getMaxDepth(sub)));
  }

  private identifyRecursivePatterns(node: FractalThought): FractalAnalysis['fractalMetrics']['recursivePatterns'] {
    const patterns: Map<string, { 
      occurrences: number; 
      scales: Set<number>;
      evolution: Array<{ depth: number; variation: string }>;
      crossBranchOccurrences: number;
    }> = new Map();

    const analyzePatternRecursively = (
      thought: FractalThought, 
      parentPattern?: string,
      siblingPatterns: Set<string> = new Set()
    ) => {
      // Enhanced pattern types with more variations
      const patternTypes = [
        { 
          type: 'expansion', 
          test: (t: FractalThought) => t.subThoughts.length > 0,
          variations: [
            { name: 'balanced', test: (t: FractalThought) => 
              t.subThoughts.length >= 2 && t.subThoughts.length <= 4 },
            { name: 'broad', test: (t: FractalThought) => 
              t.subThoughts.length > 4 },
            { name: 'focused', test: (t: FractalThought) =>
              t.subThoughts.length === 1 }
          ]
        },
        { 
          type: 'completion', 
          test: (t: FractalThought) => t.isComplete,
          variations: [
            { name: 'terminal', test: (t: FractalThought) => 
              t.isComplete && t.subThoughts.length === 0 },
            { name: 'composite', test: (t: FractalThought) => 
              t.isComplete && t.subThoughts.length > 0 },
            { name: 'partial', test: (t: FractalThought) =>
              t.isComplete && t.subThoughts.some(sub => !sub.isComplete) }
          ]
        },
        { 
          type: 'deepening', 
          test: (t: FractalThought) => t.needsDeeperAnalysis,
          variations: [
            { name: 'active', test: (t: FractalThought) => 
              t.needsDeeperAnalysis && !t.isComplete },
            { name: 'refined', test: (t: FractalThought) => 
              t.needsDeeperAnalysis && t.isComplete },
            { name: 'cascading', test: (t: FractalThought) =>
              t.needsDeeperAnalysis && t.subThoughts.every(sub => sub.needsDeeperAnalysis) }
          ]
        },
        { 
          type: 'branching', 
          test: (t: FractalThought) => t.subThoughts.length > 2,
          variations: [
            { name: 'divergent', test: (t: FractalThought) => 
              t.subThoughts.some(sub => sub.subThoughts.length > 0) },
            { name: 'parallel', test: (t: FractalThought) => 
              t.subThoughts.every(sub => sub.subThoughts.length === 0) },
            { name: 'hybrid', test: (t: FractalThought) =>
              t.subThoughts.some(sub => sub.subThoughts.length === 0) &&
              t.subThoughts.some(sub => sub.subThoughts.length > 0) }
          ]
        },
        {
          type: 'convergence',
          test: (t: FractalThought) => 
            t.subThoughts.length > 1 && 
            t.subThoughts.some(sub => sub.isComplete) && 
            t.subThoughts.some(sub => !sub.isComplete),
          variations: [
            { name: 'early', test: (t: FractalThought) =>
              t.subThoughts.filter(sub => sub.isComplete).length > 
              t.subThoughts.filter(sub => !sub.isComplete).length },
            { name: 'late', test: (t: FractalThought) =>
              t.subThoughts.filter(sub => !sub.isComplete).length >
              t.subThoughts.filter(sub => sub.isComplete).length },
            { name: 'balanced', test: (t: FractalThought) =>
              t.subThoughts.filter(sub => sub.isComplete).length ===
              t.subThoughts.filter(sub => !sub.isComplete).length }
          ]
        },
        {
          type: 'transformation',
          test: (t: FractalThought) =>
            t.subThoughts.length > 0 &&
            t.subThoughts.every(sub => sub.needsDeeperAnalysis),
          variations: [
            { name: 'complete', test: (t: FractalThought) =>
              t.isComplete && t.subThoughts.every(sub => sub.needsDeeperAnalysis) },
            { name: 'partial', test: (t: FractalThought) =>
              !t.isComplete && t.subThoughts.every(sub => sub.needsDeeperAnalysis) },
            { name: 'mixed', test: (t: FractalThought) =>
              t.subThoughts.some(sub => sub.isComplete) &&
              t.subThoughts.every(sub => sub.needsDeeperAnalysis) }
          ]
        }
      ];

      // Enhanced pattern detection with confidence scoring
      patternTypes.forEach(({ type, test, variations }) => {
        if (test(thought)) {
          const variation = variations.find(v => v.test(thought))?.name || 'basic';
          const key = parentPattern ? `${parentPattern}->${type}` : type;
          
          // Calculate pattern confidence based on multiple factors
          const confidenceFactors = {
            depth: Math.min(1, thought.depth / 5),  // Deeper patterns are more significant
            subthoughtRatio: thought.subThoughts.length > 0 ? 
              Math.min(1, thought.subThoughts.length / 4) : 0,
            completionStatus: thought.isComplete ? 1 : 0.5,
            analysisNeed: thought.needsDeeperAnalysis ? 0.7 : 1
          };
          
          const confidence = Object.values(confidenceFactors)
            .reduce((acc, val) => acc + val, 0) / Object.keys(confidenceFactors).length;

          const existing = patterns.get(key) || { 
            occurrences: 0, 
            scales: new Set(),
            evolution: [],
            crossBranchOccurrences: 0
          };

          existing.occurrences++;
          existing.scales.add(thought.depth);
          existing.evolution.push({ 
            depth: thought.depth, 
            variation,
            confidence  // Add confidence to evolution tracking
          } as { depth: number; variation: string; confidence: number });
          
          if (siblingPatterns.has(key)) {
            existing.crossBranchOccurrences++;
          }
          siblingPatterns.add(key);
          
          patterns.set(key, existing);
        }
      });

      // Analyze siblings with enhanced context
      const siblingSet = new Set<string>();
      const siblingContext = {
        totalSiblings: thought.subThoughts.length,
        completedSiblings: thought.subThoughts.filter(t => t.isComplete).length,
        averageDepth: thought.subThoughts.reduce((acc, t) => acc + t.depth, 0) / 
          Math.max(1, thought.subThoughts.length)
      };

      thought.subThoughts.forEach(sub => 
        analyzePatternRecursively(sub, 
          patterns.size > 0 ? Array.from(patterns.keys())[0] : undefined,
          siblingSet
        )
      );
    };

    analyzePatternRecursively(node);

    // Enhanced pattern aggregation with confidence weighting
    return Array.from(patterns.entries())
      .map(([type, data]) => ({
        type,
        occurrences: data.occurrences,
        scales: Array.from(data.scales),
        evolution: data.evolution.map(e => ({
          depth: e.depth,
          variation: e.variation,
          confidence: (e as { depth: number; variation: string; confidence?: number }).confidence ?? 0
        })),
        crossBranchOccurrences: data.crossBranchOccurrences,
        confidence: data.evolution.reduce((acc, e) => 
          acc + ((e as { depth: number; variation: string; confidence?: number }).confidence ?? 0), 0
        ) / Math.max(1, data.evolution.length)  // Average confidence across all occurrences
      }))
      .sort((a, b) => b.confidence - a.confidence);  // Sort by confidence
  }

  private identifyEmergentProperties(
    node: FractalThought, 
    patterns: FractalAnalysis['fractalMetrics']['recursivePatterns']
  ): FractalAnalysis['fractalMetrics']['emergentProperties'] {
    const properties: FractalAnalysis['fractalMetrics']['emergentProperties'] = [];
    const patternTypes = patterns.map(p => p.type);
    
    // Helper to calculate interaction strength
    const calculateInteractionStrength = (
      patterns: FractalAnalysis['fractalMetrics']['recursivePatterns'],
      patternTypes: string[],
      depthRange: number
    ) => {
      const relevantPatterns = patterns.filter(p => 
        patternTypes.some(type => p.type.includes(type)));
      
      const occurrenceStrength = relevantPatterns.reduce((acc, p) => 
        acc + p.occurrences, 0) / (10 * patternTypes.length);
      
      const scaleStrength = relevantPatterns.reduce((acc, p) => 
        acc + p.scales.length, 0) / (depthRange * patternTypes.length);
      
      const crossBranchStrength = relevantPatterns.reduce((acc, p) => 
        acc + p.crossBranchOccurrences, 0) / (5 * patternTypes.length);
      
      const evolutionStrength = relevantPatterns.reduce((acc, p) => 
        acc + new Set(p.evolution.map(e => e.variation)).size, 0) / 
        (3 * patternTypes.length);

      return Math.min(1, (
        occurrenceStrength * 0.3 +
        scaleStrength * 0.3 +
        crossBranchStrength * 0.2 +
        evolutionStrength * 0.2
      ));
    };

    // Enhanced emergent property detection
    const depthRange = Math.max(...patterns.flatMap(p => p.scales)) + 1;

    // Systematic Exploration
    if (patternTypes.some(p => p.includes('expansion')) && 
        patternTypes.some(p => p.includes('deepening'))) {
      const strength = calculateInteractionStrength(
        patterns,
        ['expansion', 'deepening'],
        depthRange
      );
      properties.push({
        property: 'Systematic Exploration',
        strength,
        relatedPatterns: patterns
          .filter(p => p.type.includes('expansion') || p.type.includes('deepening'))
          .map(p => p.type)
      });
    }

    // Iterative Refinement
    if (patternTypes.some(p => p.includes('completion')) && 
        patternTypes.some(p => p.includes('deepening'))) {
      const strength = calculateInteractionStrength(
        patterns,
        ['completion', 'deepening'],
        depthRange
      );
      properties.push({
        property: 'Iterative Refinement',
        strength,
        relatedPatterns: patterns
          .filter(p => p.type.includes('completion') || p.type.includes('deepening'))
          .map(p => p.type)
      });
    }

    // Balanced Development
    if (patternTypes.some(p => p.includes('branching')) && 
        patternTypes.some(p => p.includes('completion'))) {
      const strength = calculateInteractionStrength(
        patterns,
        ['branching', 'completion'],
        depthRange
      );
      properties.push({
        property: 'Balanced Development',
        strength,
        relatedPatterns: patterns
          .filter(p => p.type.includes('branching') || p.type.includes('completion'))
          .map(p => p.type)
      });
    }

    // Pattern Evolution
    if (patterns.some(p => p.evolution.length > 1)) {
      const strength = patterns.reduce((acc, p) => {
        const variations = new Set(p.evolution.map(e => e.variation));
        return acc + variations.size / 3;
      }, 0) / patterns.length;
      
      properties.push({
        property: 'Pattern Evolution',
        strength: Math.min(1, strength),
        relatedPatterns: patterns
          .filter(p => p.evolution.length > 1)
          .map(p => p.type)
      });
    }

    // Cross-Scale Resonance
    if (patterns.some(p => p.scales.length > 1)) {
      const strength = patterns.reduce((acc, p) => {
        const scaleRange = Math.max(...p.scales) - Math.min(...p.scales);
        return acc + (scaleRange > 0 ? p.crossBranchOccurrences / 5 : 0);
      }, 0) / patterns.length;
      
      properties.push({
        property: 'Cross-Scale Resonance',
        strength: Math.min(1, strength),
        relatedPatterns: patterns
          .filter(p => p.scales.length > 1)
          .map(p => p.type)
      });
    }

    return properties;
  }

  private calculatePatternStrength(
    node: FractalThought,
    recursivePatterns: FractalAnalysis['fractalMetrics']['recursivePatterns'],
    emergentProperties: FractalAnalysis['fractalMetrics']['emergentProperties']
  ): number {
    const baseStrength = (this.calculateBranchingFactor(node) * 
      this.calculateDepthConsistency(node) * 
      ((node.subThoughts.length - node.subThoughts.filter(t => !t.isComplete).length) / 
        Math.max(1, node.subThoughts.length)));

    // Calculate pattern diversity score (0-1)
    const patternDiversity = recursivePatterns.length / 4; // Normalize by expected number of pattern types

    // Calculate pattern propagation score (0-1)
    const maxScale = Math.max(...recursivePatterns.flatMap(p => p.scales));
    const scaleScore = maxScale / 5; // Normalize by expected max depth

    // Calculate emergent property strength (0-1)
    const emergentStrength = emergentProperties.reduce((acc, prop) => acc + prop.strength, 0) / 
      Math.max(1, emergentProperties.length);

    // Weighted combination of all factors
    return (
      baseStrength * 0.4 +
      patternDiversity * 0.2 +
      scaleScore * 0.2 +
      emergentStrength * 0.2
    );
  }

  private generateFractalSummary(node: FractalThought): FractalAnalysis['summary'] {
    const recursivePatterns = this.identifyRecursivePatterns(node);
    const emergentProperties = this.identifyEmergentProperties(node, recursivePatterns);
    
    // Find significant patterns and their variations
    const significantPatterns = recursivePatterns
      .sort((a, b) => b.occurrences - a.occurrences)
      .slice(0, 2);
    
    // Analyze pattern evolution across scales
    const patternEvolution = significantPatterns.map(pattern => {
      const variations = pattern.evolution
        .sort((a, b) => a.depth - b.depth)
        .map(e => e.variation);
      return {
        type: pattern.type,
        progression: variations,
        scales: pattern.scales
      };
    });

    // Identify strongest emergent properties
    const strongestProperties = emergentProperties
      .sort((a, b) => b.strength - a.strength)
      .slice(0, 2);

    // Calculate system decomposition metrics
    const decompositionLevels = new Set(recursivePatterns.flatMap(p => p.scales)).size;
    const patternConsistency = this.calculateDepthConsistency(node);
    const systemComplexity = recursivePatterns.length * decompositionLevels;

    // Analyze cross-scale relationships
    const crossScalePatterns = recursivePatterns.filter(p => p.crossBranchOccurrences > 0);
    const scaleInteractions = crossScalePatterns.length / Math.max(1, recursivePatterns.length);

    return {
      complexSystems: 
        `"${node.thought}" demonstrates system decomposition across ${decompositionLevels} levels, ` +
        `revealing ${recursivePatterns.length} distinct patterns with a consistency of ${(patternConsistency * 100).toFixed(0)}%. ` +
        `The system complexity score of ${systemComplexity} suggests ${
          systemComplexity > 10 ? 'rich hierarchical structure' : 
          systemComplexity > 5 ? 'moderate layering' : 'basic decomposition'}.`,
      
      patternIdentification:
        `Analysis reveals ${significantPatterns.map(p => 
          `${p.type} patterns occurring ${p.occurrences} times`
        ).join(' and ')}, with ${crossScalePatterns.length} cross-scale relationships. ` +
        `Pattern evolution shows ${patternEvolution.map(p => 
          `${p.type} progressing through ${p.progression.join(' → ')}`
        ).join('; ')}, indicating ${
          scaleInteractions > 0.7 ? 'strong self-similarity' :
          scaleInteractions > 0.4 ? 'moderate pattern repetition' :
          'emerging self-similarity'}.`,
      
      forecasting:
        `Based on pattern strength (${(this.calculatePatternStrength(node, recursivePatterns, emergentProperties) * 100).toFixed(0)}%) ` +
        `and emergent properties ${strongestProperties.map(p => 
          `${p.property.toLowerCase()} (${(p.strength * 100).toFixed(0)}%)`
        ).join(' and ')}, the system suggests ${
          strongestProperties[0]?.strength > 0.7 ? 'high predictability' :
          strongestProperties[0]?.strength > 0.4 ? 'moderate predictability' :
          'developing predictability'} with ${
          crossScalePatterns.length > 2 ? 'multiple stable trajectories' :
          crossScalePatterns.length > 0 ? 'potential stable patterns' :
          'emerging stability patterns'}.`,
      
      innovation:
        `Pattern analysis reveals scaling opportunities through ${
          recursivePatterns.filter(p => p.scales.length > 1).length
        } multi-scale patterns and ${
          emergentProperties.filter(p => p.strength > 0.6).length
        } strong emergent properties. Innovation potential exists in ${
          strongestProperties.map(p => p.property.toLowerCase()).join(' and ')
        }, with ${
          crossScalePatterns.length > 0 
            ? `cross-scale applications in ${crossScalePatterns.map(p => p.type).join(', ')}`
            : 'opportunities for pattern development'
        }.`
    };
  }

  // Add cache management methods
  private getCacheExpiration(analysis: FractalAnalysis): number {
    const patternFactor = 1 + (analysis.fractalMetrics.patternStrength * this.cacheConfig.patternStrengthMultiplier);
    const depthFactor = 1 + (analysis.maxDepth * this.cacheConfig.depthMultiplier);
    
    // Calculate dynamic expiration
    const expiration = this.cacheConfig.baseExpirationMs * patternFactor * depthFactor;
    
    // Clamp to min/max
    return Math.min(
      Math.max(expiration, this.cacheConfig.minExpirationMs),
      this.cacheConfig.maxExpirationMs
    );
  }

  private evictStaleEntries(): void {
    const now = Date.now();
    let evicted = 0;
    
    // Clean analysis cache
    Object.entries(this.analysisCache).forEach(([key, entry]) => {
      if (now - entry.timestamp > this.getCacheExpiration(entry.fullAnalysis!)) {
        delete this.analysisCache[key];
        evicted++;
      }
    });
    
    // Clean aggregate cache
    Object.entries(this.aggregateCache).forEach(([key, entry]) => {
      if (now - entry.timestamp > this.cacheConfig.maxExpirationMs) {
        delete this.aggregateCache[key];
        evicted++;
      }
    });
    
    if (evicted > 0) {
      this.cacheStats.evictions += evicted;
      this.cacheStats.totalSize = Object.keys(this.analysisCache).length + 
        Object.keys(this.aggregateCache).length;
    }
  }

  private evictLeastUsedEntries(count: number): void {
    // Get all cache entries with their last access time
    const entries = Object.entries(this.analysisCache)
      .map(([key, value]) => ({
        key,
        lastAccess: value.timestamp,
        isAnalysis: true
      }))
      .concat(Object.entries(this.aggregateCache)
        .map(([key, value]) => ({
          key,
          lastAccess: value.timestamp,
          isAnalysis: false
        })));
    
    // Sort by last access time
    entries.sort((a, b) => a.lastAccess - b.lastAccess);
    
    // Remove oldest entries
    entries.slice(0, count).forEach(entry => {
      if (entry.isAnalysis) {
        delete this.analysisCache[entry.key];
      } else {
        delete this.aggregateCache[entry.key];
      }
      this.cacheStats.evictions++;
    });
    
    this.cacheStats.totalSize = Object.keys(this.analysisCache).length + 
      Object.keys(this.aggregateCache).length;
  }

  private manageCacheSize(): void {
    const totalSize = Object.keys(this.analysisCache).length + 
      Object.keys(this.aggregateCache).length;
    
    if (totalSize > this.cacheConfig.maxCacheSize) {
      const excessEntries = totalSize - this.cacheConfig.maxCacheSize;
      this.evictLeastUsedEntries(excessEntries + Math.ceil(this.cacheConfig.maxCacheSize * 0.1));
    }
  }

  // Update existing cache methods
  private cacheAnalysis(thoughtId: string, analysis: FractalAnalysis): void {
    // Manage cache size before adding new entry
    this.manageCacheSize();
    
    this.analysisCache[thoughtId] = {
      timestamp: Date.now(),
      summary: AnalysisSummarizer.summarizeAnalysis(analysis),
      key: thoughtId,
      fullAnalysis: analysis,
      accessCount: 0
    };
    
    this.cacheStats.totalSize = Object.keys(this.analysisCache).length + 
      Object.keys(this.aggregateCache).length;
  }

  private getCachedAnalysis(thoughtId: string): FractalAnalysis | null {
    const cached = this.analysisCache[thoughtId];
    if (!cached) {
      this.cacheStats.misses++;
      return null;
    }

    const expiration = this.getCacheExpiration(cached.fullAnalysis!);
    if (Date.now() - cached.timestamp > expiration) {
      delete this.analysisCache[thoughtId];
      this.cacheStats.misses++;
      return null;
    }

    cached.accessCount = (cached.accessCount || 0) + 1;
    cached.timestamp = Date.now();  // Update last access time
    this.cacheStats.hits++;
    return cached.fullAnalysis || null;
  }

  public getCacheStats(): CacheStats {
    return { ...this.cacheStats };
  }

  public getCacheConfig(): CacheConfig {
    return { ...this.cacheConfig };
  }

  public updateCacheConfig(config: Partial<CacheConfig>): void {
    this.cacheConfig = {
      ...this.cacheConfig,
      ...config
    };
    // Trigger cache cleanup with new config
    this.evictStaleEntries();
  }

  public getCachedSummary(thoughtId: string): string | null {
    const cached = this.analysisCache[thoughtId];
    if (!cached) return null;

    // Summary cache expires after 30 minutes
    if (Date.now() - cached.timestamp > 30 * 60 * 1000) {
      delete this.analysisCache[thoughtId];
      return null;
    }

    return cached.summary;
  }

  // Modify analyzeDepth to use incremental analysis
  private analyzeNodeIncremental(
    node: FractalThought,
    previousAnalysis?: FractalAnalysis | null
  ): {
    maxDepth: number;
    unresolvedCount: number;
    totalCount: number;
    hasUnresolvedWithDeeperAnalysis: boolean;
  } {
    // If node hasn't changed and we have previous analysis, reuse metrics
    if (previousAnalysis && !this.hasNodeChanged(node)) {
      return {
        maxDepth: previousAnalysis.maxDepth,
        unresolvedCount: previousAnalysis.unresolvedCount,
        totalCount: previousAnalysis.totalCount,
        hasUnresolvedWithDeeperAnalysis: previousAnalysis.needsAttention
      };
    }

    let maxDepth = node.depth;
    let unresolvedCount = node.isComplete ? 0 : 1;
    let totalCount = 1;
    let hasUnresolvedWithDeeperAnalysis = false;

    node.subThoughts.forEach(sub => {
      const subAnalysis = this.analyzeNodeIncremental(
        sub,
        this.getCachedAnalysis(sub.thoughtId)
      );
      
      maxDepth = Math.max(maxDepth, subAnalysis.maxDepth);
      unresolvedCount += subAnalysis.unresolvedCount;
      totalCount += subAnalysis.totalCount;
      hasUnresolvedWithDeeperAnalysis = hasUnresolvedWithDeeperAnalysis || 
        subAnalysis.hasUnresolvedWithDeeperAnalysis;
    });

    return {
      maxDepth,
      unresolvedCount,
      totalCount,
      hasUnresolvedWithDeeperAnalysis
    };
  }

  analyzeDepth(thoughtId: string): FractalAnalysis {
    // Try to get from cache first
    const cached = this.getCachedAnalysis(thoughtId);
    if (cached && !this.hasNodeChanged(this.findThought(thoughtId)!)) {
      return cached;
    }

    const thought = this.findThought(thoughtId);
    if (!thought) {
      return {
        maxDepth: 0,
        unresolvedCount: 0,
        totalCount: 0,
        completionRatio: 0,
        status: 'incomplete',
        needsAttention: false,
        fractalMetrics: {
          branchingFactor: 0,
          depthConsistency: 0,
          crossBranchSimilarity: 0,
          patternStrength: 0,
          recursivePatterns: [],
          emergentProperties: []
        },
        summary: {
          complexSystems: 'Thought not found',
          patternIdentification: '',
          forecasting: '',
          innovation: ''
        }
      };
    }

    // Use incremental analysis
    const {
      maxDepth,
      unresolvedCount,
      totalCount,
      hasUnresolvedWithDeeperAnalysis
    } = this.analyzeNodeIncremental(thought, cached);
    
    const completionRatio = (totalCount - unresolvedCount) / totalCount;
    
    let status: 'incomplete' | 'partially_complete' | 'complete';
    if (completionRatio === 1) {
      status = 'complete';
    } else if (completionRatio >= 0.7) {
      status = 'partially_complete';
    } else {
      status = 'incomplete';
    }

    const branchingFactor = this.calculateBranchingFactor(thought);
    const depthConsistency = this.calculateDepthConsistency(thought);
    const crossBranchSimilarity = depthConsistency * completionRatio;
    const recursivePatterns = this.identifyRecursivePatterns(thought);
    const emergentProperties = this.identifyEmergentProperties(thought, recursivePatterns);
    const patternStrength = this.calculatePatternStrength(thought, recursivePatterns, emergentProperties);

    // Mark as analyzed
    this.markAnalyzed(thoughtId);

    // Cache the result before returning
    const analysis = {
      maxDepth,
      unresolvedCount,
      totalCount,
      completionRatio,
      status,
      needsAttention: hasUnresolvedWithDeeperAnalysis,
      fractalMetrics: {
        branchingFactor,
        depthConsistency,
        crossBranchSimilarity,
        patternStrength,
        recursivePatterns,
        emergentProperties
      },
      summary: this.generateFractalSummary(thought)
    };

    this.cacheAnalysis(thoughtId, analysis);
    return this.getCachedAnalysis(thoughtId)!;
  }

  // Get the entire tree
  getTree(): FractalThought[] {
    return this.thoughtTree;
  }

  // Pretty print the tree
  printTree(node: FractalThought = this.thoughtTree[0], indent = ''): void {
    const color = node.isComplete ? chalk.green : chalk.blue;
    console.log(color(`${indent}├── [${node.thoughtId}] ${node.thought}`));
    node.subThoughts.forEach(subThought => {
      this.printTree(subThought, `${indent}│   `);
    });
  }

  // Add after getCachedSummary method
  private generateAggregateSummary(thoughtId: string): AggregateSummary {
    const thought = this.findThought(thoughtId);
    if (!thought) {
      throw new Error(`Thought not found: ${thoughtId}`);
    }

    const analysis = this.analyzeDepth(thoughtId);
    const summary = AnalysisSummarizer.summarizeAnalysis(analysis);
    
    // Recursively get summaries of all children
    const childSummaries: { [key: string]: string } = {};
    const collectChildSummaries = (node: FractalThought) => {
      node.subThoughts.forEach(child => {
        const childSummary = this.getCachedSummary(child.thoughtId) || 
          AnalysisSummarizer.summarizeAnalysis(this.analyzeDepth(child.thoughtId));
        childSummaries[child.thoughtId] = childSummary;
        collectChildSummaries(child);
      });
    };
    collectChildSummaries(thought);

    // Calculate aggregate metrics
    const allNodes = [thought, ...Object.keys(childSummaries).map(id => this.findThought(id)!).filter(Boolean)];
    const metrics = {
      totalBranches: allNodes.length,
      averageDepth: allNodes.reduce((sum, node) => sum + node.depth, 0) / allNodes.length,
      completionRate: allNodes.filter(node => node.isComplete).length / allNodes.length,
      patternStrength: analysis.fractalMetrics.patternStrength
    };

    const aggregateSummary: AggregateSummary = {
      thoughtId,
      timestamp: Date.now(),
      summary,
      childSummaries,
      metrics
    };

    this.aggregateCache[thoughtId] = aggregateSummary;
    return aggregateSummary;
  }

  public getAggregateSummary(thoughtId: string, forceRegenerate: boolean = false): AggregateSummary | null {
    const cached = this.aggregateCache[thoughtId];
    if (!forceRegenerate && cached && (Date.now() - cached.timestamp) < 30 * 60 * 1000) {
      return cached;
    }
    try {
      return this.generateAggregateSummary(thoughtId);
    } catch (error) {
      console.error('Error generating aggregate summary:', error);
      return null;
    }
  }
}

// Define tools
const ADD_FRACTAL_THOUGHT_TOOL: Tool = {
  name: 'addFractalThought',
  description: 'Add a new thought to the fractal tree and analyze its fractal patterns. IMPORTANT: This tool MUST be immediately followed by summarizeFractalAnalysis using the thoughtId from the response. Example workflow:\n' +
    '1. Call addFractalThought\n' +
    '2. Get thoughtId from response\n' +
    '3. Immediately call summarizeFractalAnalysis with that thoughtId\n' +
    'The response includes a detailed fractal analysis showing recursive patterns, emergent properties, and guidance for fractal development.',
  inputSchema: {
    type: 'object',
    properties: {
      thought: { 
        type: 'string',
        description: 'The thought content that will be analyzed for fractal patterns'
      },
      thoughtId: { 
        type: 'string',
        description: 'Optional. A unique identifier for the thought. Will be auto-generated if not provided.'
      },
      parentId: { 
        type: 'string',
        nullable: true,
        description: 'Optional. The ID of the parent thought to connect to. Use "root" for top-level thoughts.'
      },
      isComplete: { 
        type: 'boolean',
        description: 'Whether this thought represents a complete pattern or needs further development'
      },
      needsDeeperAnalysis: { 
        type: 'boolean',
        description: 'Whether this thought needs deeper analysis to reveal more fractal patterns'
      },
      depth: {
        type: 'number',
        description: 'Optional. The depth in the tree. Will be calculated from parent if not provided.'
      }
    },
    required: ['thought', 'isComplete', 'needsDeeperAnalysis']
  }
};

const ANALYZE_FRACTAL_DEPTH_TOOL: Tool = {
  name: 'analyzeFractalDepth',
  description: 'Analyze the fractal patterns, self-similarity, and emergent properties of a thought and its subtree. Returns detailed metrics and natural language insights about the fractal nature of the thinking.',
  inputSchema: {
    type: 'object',
    properties: {
      thoughtId: { 
        type: 'string',
        description: 'The ID of the thought to analyze for fractal patterns'
      }
    },
    required: ['thoughtId']
  }
};

// Add after ANALYZE_FRACTAL_DEPTH_TOOL
const SUMMARIZE_FRACTAL_ANALYSIS_TOOL: Tool = {
  name: 'summarizeFractalAnalysis',
  description: 'Summarize and cache fractal analysis results for a thought. Returns a compact representation of the analysis that can be used to quickly understand the thought structure without loading the full analysis.',
  inputSchema: {
    type: 'object',
    properties: {
      thoughtId: { 
        type: 'string',
        description: 'The ID of the thought to summarize'
      },
      forceSummarize: {
        type: 'boolean',
        description: 'Whether to force a new summary even if one exists in cache'
      }
    },
    required: ['thoughtId']
  }
};

// Add after SUMMARIZE_FRACTAL_ANALYSIS_TOOL
const BREAK_DOWN_THOUGHT_TOOL: Tool = {
  name: 'breakDownThought',
  description: 'Break down a thought into fractal branches based on common decomposition patterns. Returns branch suggestions that can be used with addFractalThought.',
  inputSchema: {
    type: 'object',
    properties: {
      thought: {
        type: 'string',
        description: 'The thought to break down into fractal branches'
      },
      decompositionPattern: {
        type: 'string',
        enum: ['problem-solution', 'concept-implementation', 'abstract-concrete', 'system-components', 'custom'],
        description: 'The pattern to use for breaking down the thought'
      },
      customPattern: {
        type: 'object',
        description: 'Custom decomposition pattern (only used when decompositionPattern is "custom")',
        properties: {
          branchTypes: {
            type: 'array',
            items: { type: 'string' },
            description: 'Types of branches to create'
          }
        }
      }
    },
    required: ['thought', 'decompositionPattern']
  }
};

// Create server instance
const fractalServer = new FractalThinkingServer();
const transport = new StdioServerTransport();

const server = new Server(
  {
    name: 'fractal-thinking-server',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Register tool handlers
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    ADD_FRACTAL_THOUGHT_TOOL,
    BREAK_DOWN_THOUGHT_TOOL,
    ANALYZE_FRACTAL_DEPTH_TOOL,
    SUMMARIZE_FRACTAL_ANALYSIS_TOOL
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  log('Received tool request:', JSON.stringify(request.params, null, 2));
  
  if (!request.params.arguments) {
    return {
      content: [{ type: 'text', text: 'Missing arguments' }],
      isError: true
    };
  }

  switch (request.params.name) {
    case 'addFractalThought': {
      try {
        const params = request.params.arguments as z.infer<typeof ThoughtSchema>;
        log('Processing addFractalThought with params:', JSON.stringify(params, null, 2));
        
        const result = fractalServer.addThought(params);
        if (!result.success || !result.thought) {
          log('Failed to add thought:', result.message);
          return {
            content: [{ 
              type: 'text', 
              text: result.message || 'Failed to add thought'
            }],
            isError: true
          };
        }

        // New streamlined response format
        const analysis = result.analysis?.thought;
        const significantPatterns = analysis?.fractalMetrics.recursivePatterns
          .sort((a, b) => b.occurrences - a.occurrences)
          .slice(0, 3)
          .map(p => ({
            type: p.type,
            strength: p.occurrences / Math.max(1, p.scales.length),
            evolution: p.evolution.map(e => e.variation)
          }));

        const keyEmergentProperties = analysis?.fractalMetrics.emergentProperties
          .filter(p => p.strength > 0.4)
          .map(p => ({
            property: p.property,
            strength: p.strength
          }));

        const recommendations = [];
        if (analysis?.needsAttention) {
          recommendations.push("Needs deeper analysis");
        }
        if ((analysis?.fractalMetrics.crossBranchSimilarity ?? 0) > 0.7) {
          recommendations.push("Consider pattern consolidation");
        }
        if ((analysis?.fractalMetrics.patternStrength ?? 0) < 0.3) {
          recommendations.push("Pattern strength low - consider restructuring");
        }

        return {
          content: [{ 
            type: 'text', 
            text: JSON.stringify({
              thought: {
                id: result.thought.thoughtId,
                content: result.thought.thought,
                depth: result.thought.depth,
                context: {
                  parent_id: result.thought.parentId,
                  siblings: result.context?.siblings.length || 0
                }
              },
              patterns: {
                key_patterns: significantPatterns,
                emergent_properties: keyEmergentProperties,
                overall_strength: analysis?.fractalMetrics.patternStrength || 0
              },
              metrics: {
                completion_ratio: analysis?.completionRatio || 0,
                branching_factor: analysis?.fractalMetrics.branchingFactor || 0,
                depth_consistency: analysis?.fractalMetrics.depthConsistency || 0
              },
              natural_language_summary: {
                system: analysis?.summary.complexSystems,
                patterns: analysis?.summary.patternIdentification,
                forecast: analysis?.summary.forecasting
              },
              recommendations,
              required_next_action: {
                tool: "summarizeFractalAnalysis",
                params: {
                  thoughtId: result.thought.thoughtId,
                  forceSummarize: true
                },
                reason: "IMPORTANT: You must call summarizeFractalAnalysis immediately after adding a thought to ensure proper caching and pattern analysis."
              }
            }, null, 2)
          }]
        };
      } catch (error) {
        log('Error in addFractalThought:', error);
        return {
          content: [{ type: 'text', text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
          isError: true
        };
      }
    }
    case 'analyzeFractalDepth': {
      try {
        const { thoughtId } = request.params.arguments as { thoughtId: string };
        log('Processing analyzeFractalDepth for thought:', thoughtId);
        
        const analysis = fractalServer.analyzeDepth(thoughtId);
        if (!analysis) {
          log('Analysis failed: Thought not found');
          return {
            content: [{ type: 'text', text: 'Thought not found' }],
            isError: true
          };
        }

        // Streamlined analysis response
        const significantPatterns = analysis.fractalMetrics.recursivePatterns
          .sort((a, b) => b.occurrences - a.occurrences)
          .slice(0, 3);

        return {
          content: [{ 
            type: 'text', 
            text: JSON.stringify({
              patterns: {
                key_patterns: significantPatterns.map(p => ({
                  type: p.type,
                  strength: p.occurrences / Math.max(1, p.scales.length),
                  evolution: p.evolution.map(e => e.variation)
                })),
                emergent_properties: analysis.fractalMetrics.emergentProperties
                  .filter(p => p.strength > 0.4)
                  .map(p => ({
                    property: p.property,
                    strength: p.strength
                  })),
                overall_strength: analysis.fractalMetrics.patternStrength || 0
              },
              metrics: {
                completion_ratio: analysis.completionRatio,
                branching_factor: analysis.fractalMetrics.branchingFactor,
                depth_consistency: analysis.fractalMetrics.depthConsistency,
                cross_branch_similarity: analysis.fractalMetrics.crossBranchSimilarity || 0
              },
              insights: {
                system_complexity: analysis.summary.complexSystems,
                pattern_evolution: analysis.summary.patternIdentification,
                future_trajectory: analysis.summary.forecasting,
                innovation_potential: analysis.summary.innovation
              },
              status: {
                completion: analysis.status,
                needs_attention: analysis.needsAttention,
                total_thoughts: analysis.totalCount,
                unresolved_thoughts: analysis.unresolvedCount
              }
            }, null, 2)
          }]
        };
      } catch (error) {
        log('Error in analyzeFractalDepth:', error);
        return {
          content: [{ type: 'text', text: String(error) }],
          isError: true
        };
      }
    }
    case 'summarizeFractalAnalysis': {
      try {
        const { thoughtId, forceSummarize } = request.params.arguments as { 
          thoughtId: string; 
          forceSummarize?: boolean 
        };
        log('Processing summarizeFractalAnalysis for thought:', thoughtId);
        
        // Verify thought exists
        const thought = fractalServer.findThought(thoughtId);
        if (!thought) {
          return {
            content: [{ 
              type: 'text', 
              text: JSON.stringify({
                status: 'error',
                message: `Thought not found: ${thoughtId}`,
                summary: AnalysisSummarizer.summarizeAnalysis(undefined as any)
              }, null, 2)
            }],
            isError: true
          };
        }
        
        // Try to get cached summary first if not forcing
        if (!forceSummarize) {
          const cachedSummary = fractalServer.getCachedSummary(thoughtId);
          if (cachedSummary) {
            return {
              content: [{ 
                type: 'text', 
                text: JSON.stringify({
                  status: 'success',
                  source: 'cache',
                  summary: cachedSummary,
                  expandedSummary: AnalysisSummarizer.expandSummary(cachedSummary)
                }, null, 2)
              }]
            };
          }
        }

        // Generate new summary
        const analysis = fractalServer.analyzeDepth(thoughtId);
        if (!analysis) {
          return {
            content: [{ 
              type: 'text', 
              text: JSON.stringify({
                status: 'error',
                message: 'Failed to analyze thought',
                summary: AnalysisSummarizer.summarizeAnalysis(undefined as any)
              }, null, 2)
            }],
            isError: true
          };
        }

        const summary = AnalysisSummarizer.summarizeAnalysis(analysis);
        
        return {
          content: [{ 
            type: 'text', 
            text: JSON.stringify({
              status: 'success',
              source: 'fresh',
              summary,
              expandedSummary: AnalysisSummarizer.expandSummary(summary)
            }, null, 2)
          }]
        };
      } catch (error) {
        log('Error in summarizeFractalAnalysis:', error);
        return {
          content: [{ 
            type: 'text', 
            text: JSON.stringify({
              status: 'error',
              message: String(error),
              summary: AnalysisSummarizer.summarizeAnalysis(undefined as any)
            }, null, 2)
          }],
          isError: true
        };
      }
    }
    case 'breakDownThought': {
      try {
        const { thought, decompositionPattern, customPattern } = request.params.arguments as {
          thought: string;
          decompositionPattern: string;
          customPattern?: { branchTypes: string[] };
        };

        // Define common decomposition patterns
        const patterns = {
          'problem-solution': [
            { type: 'Problem Analysis', template: 'Analyze: ${thought}' },
            { type: 'Solution Design', template: 'Design solution for: ${thought}' },
            { type: 'Implementation', template: 'Implement: ${thought}' },
            { type: 'Validation', template: 'Validate: ${thought}' }
          ],
          'concept-implementation': [
            { type: 'Core Concept', template: 'Define: ${thought}' },
            { type: 'Requirements', template: 'Requirements for: ${thought}' },
            { type: 'Implementation Strategy', template: 'Strategy for: ${thought}' },
            { type: 'Testing Approach', template: 'Test plan for: ${thought}' }
          ],
          'abstract-concrete': [
            { type: 'Abstract Model', template: 'Model: ${thought}' },
            { type: 'Concrete Examples', template: 'Examples of: ${thought}' },
            { type: 'Edge Cases', template: 'Edge cases in: ${thought}' },
            { type: 'Integration Points', template: 'Integration of: ${thought}' }
          ],
          'system-components': [
            { type: 'System Overview', template: 'Overview: ${thought}' },
            { type: 'Components', template: 'Components of: ${thought}' },
            { type: 'Interactions', template: 'Interactions in: ${thought}' },
            { type: 'Boundaries', template: 'Boundaries of: ${thought}' }
          ]
        };

        // Select pattern or use custom
        const selectedPattern = decompositionPattern === 'custom' && customPattern
          ? customPattern.branchTypes.map(type => ({ type, template: `${type}: \${thought}` }))
          : patterns[decompositionPattern as keyof typeof patterns];

        if (!selectedPattern) {
          throw new Error(`Invalid decomposition pattern: ${decompositionPattern}`);
        }

        // Generate branches
        const branches = selectedPattern.map(({ type, template }) => ({
          type,
          thought: template.replace('${thought}', thought),
          suggestedParams: {
            isComplete: false,
            needsDeeperAnalysis: true,
            parentId: 'root' // Default to root, can be changed when adding
          }
        }));

        return {
          content: [{ 
            type: 'text', 
            text: JSON.stringify({
              status: 'success',
              originalThought: thought,
              pattern: decompositionPattern,
              branches,
              usage: {
                next: 'For each branch, you MUST follow this exact sequence:',
                steps: [
                  '1. Call addFractalThought with the branch',
                  '2. Immediately call summarizeFractalAnalysis with the returned thoughtId',
                  '3. Proceed to the next branch only after completing both steps'
                ],
                example: `// Step 1: Add the thought
addFractalThought({
  thought: "${branches[0].thought}",
  ...branches[0].suggestedParams
})

// Step 2: REQUIRED - Immediately summarize the thought using the ID from step 1
summarizeFractalAnalysis({
  thoughtId: "returned_id_from_step_1",
  forceSummarize: true
})`
              }
            }, null, 2)
          }]
        };
      } catch (error) {
        log('Error in breakDownThought:', error);
        return {
          content: [{ type: 'text', text: String(error) }],
          isError: true
        };
      }
    }
    default:
      log('Unknown tool requested:', request.params.name);
      return {
        content: [{ type: 'text', text: `Unknown tool: ${request.params.name}` }],
        isError: true
      };
  }
});

// Start the server
log('Starting fractal thinking server...');
server.connect(transport).then(() => {
  log('Server connected and ready');
  
  // Keep the process alive and handle signals
  process.stdin.resume();
  process.on('SIGINT', () => {
    log('Received SIGINT, shutting down...');
    process.exit(0);
  });
  process.on('SIGTERM', () => {
    log('Received SIGTERM, shutting down...');
    process.exit(0);
  });
}).catch(error => {
  log('Failed to start server:', error);
  process.exit(1);
});

/* Future enhancements:
 * 1. File System Integration:
 *    - Add methods to save/load tree from JSON file
 *    - Implement auto-save on updates
 *    - Add versioning and history
 *
 * 2. Web Search Integration:
 *    - Add methods to enrich thoughts with web search results
 *    - Implement automatic context gathering for deeper analysis
 *    - Add relevance scoring for search results
 */ 