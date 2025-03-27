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
- **addFractalThought** - Add a new thought to the tree
- **updateFractalThought** - Update an existing thought
- **analyzeFractalDepth** - Analyze the depth and completeness of thoughts
- **clearFractalTree** - Clear the entire fractal thought tree
- **saveFractalTree** - Save the tree to a file
- **loadFractalTree** - Load the tree from a file

### Prompts
- **start-fractal-analysis** - Begin a fractal thinking process for a problem
- **expand-fractal-thought** - Guide expansion of an existing thought

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

## Example Workflow

1. Start a new fractal analysis with the `start-fractal-analysis` prompt
2. Add a root thought using `addFractalThought`
3. Expand the thought with `expand-fractal-thought` prompt 
4. Add sub-thoughts with `addFractalThought` (setting the parentId)
5. Analyze the fractal structure with `analyzeFractalDepth`
6. Save your work with `saveFractalTree`
7. Continue expanding and refining thoughts

## License

MIT