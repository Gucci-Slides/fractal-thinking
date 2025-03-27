#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema, Tool } from '@modelcontextprotocol/sdk/types.js';
import chalk from 'chalk';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';

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
      evolution: Array<{ depth: number; variation: string }>;
      crossBranchOccurrences: number;
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
  addThought(params: Omit<FractalThought, 'subThoughts' | 'thoughtId' | 'createdAt' | 'depth'> & { 
    thoughtId?: string; 
    createdAt?: string;
    depth?: number;
  }): {
    success: boolean;
    thought?: FractalThought;
    context?: ThoughtContext;
    analysis?: FractalAnalysisResponse;
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
      
      // Find parent first
      const parent = this.findThought(parentId);
      if (parentId && !parent) {
        return {
          success: false,
          message: `Parent thought not found: ${parentId}`
        };
      }

      // Calculate depth based on parent if not provided
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

      // Add to parent or root
      if (parent) {
        parent.subThoughts.push(newThought);
      } else {
        this.thoughtTree.push(newThought);
      }

      const thoughtContext = this.getThoughtWithContext(thoughtId);
      const context: ThoughtContext = {
        parent: thoughtContext.parent,
        siblings: thoughtContext.siblings || [],
        depth: thoughtContext.path?.length || 0,
        pathLength: thoughtContext.path?.length || 0
      };

      const thoughtAnalysis = this.analyzeDepth(thoughtId);
      const parentAnalysis = parentId ? this.analyzeDepth(parentId) : undefined;

      return {
        success: true,
        thought: newThought,
        context,
        analysis: {
          thought: thoughtAnalysis,
          parent: parentAnalysis
        }
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
      // Enhanced pattern types with variations
      const patternTypes = [
        { 
          type: 'expansion', 
          test: (t: FractalThought) => t.subThoughts.length > 0,
          variations: [
            { name: 'balanced', test: (t: FractalThought) => 
              t.subThoughts.length >= 2 && t.subThoughts.length <= 4 },
            { name: 'broad', test: (t: FractalThought) => 
              t.subThoughts.length > 4 }
          ]
        },
        { 
          type: 'completion', 
          test: (t: FractalThought) => t.isComplete,
          variations: [
            { name: 'terminal', test: (t: FractalThought) => 
              t.isComplete && t.subThoughts.length === 0 },
            { name: 'composite', test: (t: FractalThought) => 
              t.isComplete && t.subThoughts.length > 0 }
          ]
        },
        { 
          type: 'deepening', 
          test: (t: FractalThought) => t.needsDeeperAnalysis,
          variations: [
            { name: 'active', test: (t: FractalThought) => 
              t.needsDeeperAnalysis && !t.isComplete },
            { name: 'refined', test: (t: FractalThought) => 
              t.needsDeeperAnalysis && t.isComplete }
          ]
        },
        { 
          type: 'branching', 
          test: (t: FractalThought) => t.subThoughts.length > 2,
          variations: [
            { name: 'divergent', test: (t: FractalThought) => 
              t.subThoughts.some(sub => sub.subThoughts.length > 0) },
            { name: 'parallel', test: (t: FractalThought) => 
              t.subThoughts.every(sub => sub.subThoughts.length === 0) }
          ]
        }
      ];

      // Check each pattern type
      patternTypes.forEach(({ type, test, variations }) => {
        if (test(thought)) {
          const variation = variations.find(v => v.test(thought))?.name || 'basic';
          const key = parentPattern ? `${parentPattern}->${type}` : type;
          const existing = patterns.get(key) || { 
            occurrences: 0, 
            scales: new Set(),
            evolution: [],
            crossBranchOccurrences: 0
          };

          existing.occurrences++;
          existing.scales.add(thought.depth);
          existing.evolution.push({ depth: thought.depth, variation });
          
          // Track cross-branch occurrences
          if (siblingPatterns.has(key)) {
            existing.crossBranchOccurrences++;
          }
          siblingPatterns.add(key);
          
          patterns.set(key, existing);
        }
      });

      // Analyze siblings together
      const siblingSet = new Set<string>();
      thought.subThoughts.forEach(sub => 
        analyzePatternRecursively(sub, 
          patterns.size > 0 ? Array.from(patterns.keys())[0] : undefined,
          siblingSet
        )
      );
    };

    analyzePatternRecursively(node);

    return Array.from(patterns.entries()).map(([type, data]) => ({
      type,
      occurrences: data.occurrences,
      scales: Array.from(data.scales),
      evolution: data.evolution,
      crossBranchOccurrences: data.crossBranchOccurrences
    }));
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

  analyzeDepth(thoughtId: string): FractalAnalysis {
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

    let maxDepth = thought.depth;
    let unresolvedCount = thought.isComplete ? 0 : 1;
    let totalCount = 1;
    let hasUnresolvedWithDeeperAnalysis = false;

    const analyzeNode = (node: FractalThought) => {
      maxDepth = Math.max(maxDepth, node.depth);
      totalCount++;
      
      if (!node.isComplete) {
        unresolvedCount++;
        if (node.needsDeeperAnalysis) {
          hasUnresolvedWithDeeperAnalysis = true;
        }
      }
      
      node.subThoughts.forEach(analyzeNode);
    };

    thought.subThoughts.forEach(analyzeNode);
    
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

    return {
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
}

// Define tools
const ADD_FRACTAL_THOUGHT_TOOL: Tool = {
  name: 'addFractalThought',
  description: 'Add a new thought to the fractal tree and analyze its fractal patterns. The response includes a detailed fractal analysis showing recursive patterns, emergent properties, and guidance for fractal development.',
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
  tools: [ADD_FRACTAL_THOUGHT_TOOL, ANALYZE_FRACTAL_DEPTH_TOOL],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  console.error('Received tool request:', JSON.stringify(request.params, null, 2));
  
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
        console.error('Processing addFractalThought with params:', JSON.stringify(params, null, 2));
        
        const result = fractalServer.addThought(params);
        if (!result.success || !result.thought) {
          console.error('Failed to add thought:', result.message);
          return {
            content: [{ type: 'text', text: result.message || 'Failed to add thought' }],
            isError: true
          };
        }

        // Return a response focused on fractal analysis
        return {
          content: [{ 
            type: 'text', 
            text: JSON.stringify({
              status: 'success',
              message: 'Thought added and analyzed for fractal patterns',
              fractalAnalysis: {
                thoughtPattern: result.analysis?.thought.summary,
                metrics: {
                  recursivePatterns: result.analysis?.thought.fractalMetrics.recursivePatterns,
                  emergentProperties: result.analysis?.thought.fractalMetrics.emergentProperties,
                  patternStrength: result.analysis?.thought.fractalMetrics.patternStrength
                },
                parentContext: result.analysis?.parent ? {
                  patterns: result.analysis.parent.fractalMetrics.recursivePatterns,
                  emergentProperties: result.analysis.parent.fractalMetrics.emergentProperties
                } : null
              },
              thought: {
                id: result.thought.thoughtId,
                content: result.thought.thought,
                parentId: result.thought.parentId,
                depth: result.thought.depth
              }
            }, null, 2)
          }]
        };
      } catch (error) {
        console.error('Error in addFractalThought:', error);
        return {
          content: [{ type: 'text', text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
          isError: true
        };
      }
    }
    case 'analyzeFractalDepth': {
      try {
        const { thoughtId } = request.params.arguments as { thoughtId: string };
        console.error('Processing analyzeFractalDepth for thought:', thoughtId);
        
        const analysis = fractalServer.analyzeDepth(thoughtId);
        if (!analysis) {
          console.error('Analysis failed: Thought not found');
          return {
            content: [{ type: 'text', text: 'Thought not found' }],
            isError: true
          };
        }

        // Return a response focused on fractal patterns
        return {
          content: [{ 
            type: 'text', 
            text: JSON.stringify({
              fractalAnalysis: {
                summary: analysis.summary,
                patterns: {
                  recursive: analysis.fractalMetrics.recursivePatterns,
                  emergent: analysis.fractalMetrics.emergentProperties
                },
                metrics: {
                  branchingFactor: analysis.fractalMetrics.branchingFactor,
                  depthConsistency: analysis.fractalMetrics.depthConsistency,
                  patternStrength: analysis.fractalMetrics.patternStrength
                },
                completion: {
                  ratio: analysis.completionRatio,
                  status: analysis.status,
                  needsAttention: analysis.needsAttention
                }
              }
            }, null, 2)
          }]
        };
      } catch (error) {
        console.error('Error in analyzeFractalDepth:', error);
        return {
          content: [{ type: 'text', text: String(error) }],
          isError: true
        };
      }
    }
    default:
      console.error('Unknown tool requested:', request.params.name);
      return {
        content: [{ type: 'text', text: `Unknown tool: ${request.params.name}` }],
        isError: true
      };
  }
});

// Start the server
console.log('Starting fractal thinking server...');
server.connect(transport).then(() => {
  console.log(chalk.green('Server connected and ready'));
  
  // Keep the process alive and handle signals
  process.stdin.resume();
  process.on('SIGINT', () => {
    console.log(chalk.yellow('\nReceived SIGINT, shutting down...'));
    process.exit(0);
  });
  process.on('SIGTERM', () => {
    console.log(chalk.yellow('\nReceived SIGTERM, shutting down...'));
    process.exit(0);
  });
}).catch(error => {
  console.error(chalk.red('Failed to start server:'), error);
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