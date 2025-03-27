# Fractal Thinking MCP Server - Usage Examples

This document provides examples of how to use the Fractal Thinking MCP server with Claude.

## Example 1: Breaking Down a Complex Problem

### Step 1: Initial Breakdown

Ask Claude to break down a complex thought:

```
I want to analyze "improving online education engagement" using fractal thinking. Can you help me break this down?
```

Claude will use the `breakDownThought` tool with an appropriate pattern:

```typescript
breakDownThought({
  thought: "improving online education engagement",
  decompositionPattern: "system-components"
})
```

This will return suggested branches like:
- System Overview: Understanding the online education ecosystem
- Components: Key elements affecting engagement
- Interactions: How different factors influence each other
- Boundaries: Scope and limitations of improvements

### Step 2: Adding and Analyzing Branches

For each branch, Claude will follow the required two-step process:

1. Add the thought:
```typescript
addFractalThought({
  thought: "Understanding the online education ecosystem",
  isComplete: false,
  needsDeeperAnalysis: true,
  parentId: "root"
})
```

2. Immediately summarize it:
```typescript
summarizeFractalAnalysis({
  thoughtId: "returned_id",
  forceSummarize: true
})
```

## Example 2: Pattern Evolution Analysis

### Step 1: Break Down Initial Concept

```
Let's analyze "AI-driven personalized learning" using the concept-implementation pattern.
```

Claude will use:
```typescript
breakDownThought({
  thought: "AI-driven personalized learning",
  decompositionPattern: "concept-implementation"
})
```

### Step 2: Systematic Branch Development

For each branch (Core Concept, Requirements, Strategy, Testing), Claude will:

1. Add the thought with context:
```typescript
addFractalThought({
  thought: "Core concept: AI adapting to individual learning patterns",
  parentId: "root",
  isComplete: false,
  needsDeeperAnalysis: true
})
```

2. Get immediate analysis:
```typescript
summarizeFractalAnalysis({
  thoughtId: "new_thought_id",
  forceSummarize: true
})
```

### Step 3: Deep Pattern Analysis

For branches showing interesting patterns:
```typescript
analyzeFractalDepth({
  thoughtId: "thought_id"
})
```

## Example 3: Using Custom Decomposition

### Step 1: Define Custom Pattern

```
I want to analyze "sustainable urban development" using a custom pattern focusing on environmental, social, and economic aspects.
```

Claude will use:
```typescript
breakDownThought({
  thought: "sustainable urban development",
  decompositionPattern: "custom",
  customPattern: {
    branchTypes: [
      "Environmental Impact",
      "Social Integration",
      "Economic Viability",
      "Policy Framework"
    ]
  }
})
```

### Step 2: Systematic Analysis

For each custom branch, follow the standard process:
1. Add thought
2. Get immediate summary
3. Analyze patterns if needed

## Tips for Effective Usage

1. **Always Follow the Two-Step Process**
   - Never add a thought without immediately summarizing it
   - Use `forceSummarize: true` for fresh analysis

2. **Choose Appropriate Patterns**
   - Problem-Solution: For concrete challenges
   - Concept-Implementation: For new ideas
   - Abstract-Concrete: For theoretical concepts
   - System-Components: For complex systems
   - Custom: For specialized domains

3. **Leverage Caching**
   - Summaries are cached for 30 minutes
   - Full analyses are cached for 5 minutes
   - Use `forceSummarize: true` when fresh analysis is needed

4. **Pattern Analysis**
   - Watch for emerging patterns in summaries
   - Use deep analysis for promising branches
   - Compare patterns across related thoughts

5. **Summary Format Understanding**
   Example: `D3|C80%|P[expansion(4), completion(2)]|E[Systematic(80%), Evolution(60%)]|S75%`
   - D3: Depth of 3 levels
   - C80%: 80% completion ratio
   - P[...]: Top 2 patterns with occurrences
   - E[...]: Top 2 emergent properties with strengths
   - S75%: Overall pattern strength of 75%