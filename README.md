# Fractal Thinking MCP Server

An MCP (Model Context Protocol) server that provides tools and resources for fractal thinking analysis.

## What is Fractal Thinking?

Fractal thinking is an approach to problem-solving that uses recursive, self-similar patterns. It involves breaking down complex problems into smaller, similar sub-problems, and then solving each one. This approach helps:

- Maintain the big picture while exploring details
- Find patterns and connections across different levels of abstraction
- Systematically explore complex problem spaces
- Organize thoughts in a hierarchical yet interconnected way

## Features

This MCP server provides:

### Resources
- **thoughts://tree** - Access the entire fractal thought tree
- **thoughts://thought/{thoughtId}** - Access a specific thought and its sub-thoughts

### Tools
- **breakDownThought** - Decompose a thought into fractal branches using predefined patterns
- **addFractalThought** - Add a new thought to the tree with fractal analysis
- **summarizeFractalAnalysis** - Generate and cache compact summaries of thought analyses
- **analyzeFractalDepth** - Perform detailed fractal pattern analysis

### Analysis Features
- Pattern Recognition: Identifies recursive patterns across different scales
- Emergent Properties: Detects properties that emerge from pattern interactions
- Caching System: Efficient storage and retrieval of analysis results
- Summary Format: D{depth}|C{completion%}|P[patterns]|E[properties]|S{strength%}

### Decomposition Patterns
- Problem-Solution: Analysis, Design, Implementation, Validation
- Concept-Implementation: Core Concept, Requirements, Strategy, Testing
- Abstract-Concrete: Model, Examples, Edge Cases, Integration
- System-Components: Overview, Components, Interactions, Boundaries
- Custom: User-defined decomposition patterns

## Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/fractal-thinking-mcp-server.git
cd fractal-thinking-mcp-server

# Install dependencies
npm install

# Build the server
npm run build
```

## Usage

### Starting the Server

```bash
# Start the server
npm start

# Optionally specify a storage file to persist the fractal tree
FRACTAL_STORAGE_FILE=my-thoughts.json npm start
```

### Connecting to Claude

To use this server with Claude for Desktop, add it to your Claude for Desktop configuration:

```json
{
  "mcpServers": {
    "fractalThinking": {
      "command": "node",
      "args": [
        "/path/to/fractal-thinking-mcp-server/build/index.js"
      ],
      "env": {
        "FRACTAL_STORAGE_FILE": "/path/to/storage/fractal-tree.json"
      }
    }
  }
}
```

### Using with MCP Inspector

For development and testing, you can use the MCP Inspector:

```bash
npx @modelcontextprotocol/inspector node build/index.js
```

### Required Workflow

1. Break down initial thoughts:
```typescript
breakDownThought({
  thought: "Your complex thought",
  decompositionPattern: "system-components" // or other patterns
})
```

2. Add and summarize thoughts (always paired):
```typescript
// First, add the thought
addFractalThought({
  thought: "Your thought",
  isComplete: false,
  needsDeeperAnalysis: true
})

// Immediately summarize using the returned ID
summarizeFractalAnalysis({
  thoughtId: "returned_id",
  forceSummarize: true
})
```

3. Optional deep analysis:
```typescript
analyzeFractalDepth({
  thoughtId: "thought_id"
})
```

## Fractal Thought Structure

Each thought in the fractal tree has the following structure:

```typescript
interface FractalThought {
  thoughtId: string;       // Unique identifier
  thought: string;         // Content of the thought
  depth: number;           // Depth level in the tree
  parentId: string | null; // Parent thought ID (null for root thoughts)
  subThoughts: FractalThought[]; // Sub-thoughts
  isComplete: boolean;     // Whether the thought is resolved
  needsDeeperAnalysis: boolean; // Whether it needs deeper analysis
  createdAt: string;       // Creation timestamp
}
```

## Analysis Caching

The server implements an efficient caching system:
- Full analysis results are cached for 5 minutes
- Summaries are cached for 30 minutes
- Automatic cache cleanup for expired entries
- Force regeneration available when needed

## License

MIT