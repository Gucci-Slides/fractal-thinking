# Fractal Thinking MCP Server - Usage Examples

This document provides examples of how to use the Fractal Thinking MCP server with Claude.

## Example 1: Starting a New Fractal Analysis

### Step 1: Initiate the analysis

Ask Claude to start a new fractal analysis:

```
I want to use fractal thinking to analyze the problem of "improving online education engagement." Can you help me start a fractal analysis of this problem?
```

Claude will use the `start-fractal-analysis` prompt and guide you through creating the root thought.

### Step 2: Create the root thought

Claude will suggest creating a root thought using the `addFractalThought` tool:

```
Root Thought: "Improving online education engagement requires addressing multiple interconnected factors spanning technology, pedagogy, content design, and human motivation."
```

### Step 3: Expand the root thought

Ask Claude to help you expand this thought:

```
That's a good start. Can you help me expand this root thought into several fractal sub-thoughts?
```

Claude will use the `expand-fractal-thought` prompt and suggest several sub-thoughts to add.

## Example 2: Analyzing an Existing Fractal Tree

### Step 1: Analyze the tree

Ask Claude to analyze the current fractal tree:

```
Can you analyze the fractal tree we've created so far? I'd like to know the depth and completeness.
```

Claude will use the `analyzeFractalDepth` tool and provide insights about:
- Total number of thoughts
- Maximum depth of the tree
- Number of thoughts that need deeper analysis
- Completion rate of the overall tree

### Step 2: Focus on incomplete areas

Based on the analysis, you can ask Claude to help you focus on the incomplete areas:

```
I see we have several incomplete thoughts. Let's focus on the "technology factors" branch. Can you help me expand that further?
```

Claude will help you identify the specific thought ID and expand it.

### Step 3: Update thoughts as you progress

As you make progress, update the completion status:

```
We've made good progress on understanding the technology factors. Can you mark the "Interactive tools for virtual classrooms" thought as complete?
```

Claude will use the `updateFractalThought` tool to update the status.

## Example 3: Saving and Loading Your Work

### Step 1: Save your current tree

When you want to save your work for later:

```
Can you save our current fractal thought tree to a file called "education-engagement.json"?
```

Claude will use the `saveFractalTree` tool to persist your work.

### Step 2: Load your previous work

When you return to continue your analysis:

```
I'd like to continue working on my education engagement analysis. Can you load the fractal tree from "education-engagement.json"?
```

Claude will use the `loadFractalTree` tool to restore your previous session.

## Example 4: Deep Fractal Analysis

### Step 1: Identify a thought needing deeper analysis

```
The thought about "student motivation factors" needs deeper analysis. Can you mark it accordingly?
```

Claude will use `updateFractalThought` to flag this for deeper analysis.

### Step 2: Perform iterative refinement

```
Let's do a deeper analysis of the student motivation factors. Can you help me expand this in more detail?
```

Claude will help you add more sub-thoughts with increasing depth and specificity.

### Step 3: Analyze the enriched structure

```
Now that we've expanded the motivation branch, can you analyze the entire tree again to see our progress?
```

Claude will use `analyzeFractalDepth` to show how the fractal structure has evolved.

## Example 5: Practical Application

### Step 1: Create an action plan based on the fractal tree

```
Based on our fractal analysis of online education engagement, can you help me create an action plan that addresses the key insights we've discovered?
```

Claude can help you convert the fractal structure into practical next steps.

### Step 2: Prioritize actions based on the fractal structure

```
Looking at our fractal tree, which areas should we prioritize first for maximum impact on student engagement?
```

Claude can analyze the tree to identify high-leverage points.

### Step 3: Identify connections across branches

```
Can you help me identify connections between the "technology" branch and the "pedagogy" branch in our fractal tree?
```

Claude can help you find cross-cutting themes and interdependencies in your fractal analysis.

## Tips for Effective Fractal Thinking

1. **Start broad, then go deep**: Begin with general thoughts and iteratively add detail
2. **Maintain self-similarity**: Each sub-thought should reflect the pattern of its parent
3. **Look for connections**: Identify relationships between branches at the same depth
4. **Balance breadth and depth**: Expand both horizontally (new branches) and vertically (deeper analysis)
5. **Revisit incomplete thoughts**: Regularly analyze your tree to find gaps
6. **Update completion status**: Mark thoughts as complete when sufficiently explored
7. **Save regularly**: Persist your fractal tree to avoid losing insights of incomplete thoughts
- Number