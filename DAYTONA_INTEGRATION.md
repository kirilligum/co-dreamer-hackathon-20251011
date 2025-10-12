# Daytona Integration for CoDreamer

This document describes the integration of Daytona workspaces into the CoDreamer knowledge graph generation system.

## Overview

Each dream execution now runs in an isolated Daytona workspace instance, providing:

- **Isolated execution environment** for each dream
- **Code execution capabilities** within the workspace
- **File system operations** for storing intermediate results
- **Process management** for running commands
- **Log streaming** for debugging

## Architecture

### Components

1. **DaytonaService** (`mastra/src/dreamer/daytona-service.ts`)
   - Manages workspace lifecycle (create, execute, destroy)
   - Provides file system operations
   - Handles code/command execution
   - Manages workspace cleanup

2. **Dream Workflow with Daytona** (`mastra/src/dreamer/dream-workflow-daytona.ts`)
   - Extended version of the standard dream workflow
   - Creates a Daytona workspace at the start
   - Executes each step within the workspace
   - Stores intermediate results and logs
   - Cleans up workspace at the end

3. **Server Integration** (`mastra/src/dreamer/server.ts`)
   - Supports multiple execution modes:
     - Legacy BFS (no workflow)
     - Mastra Workflow (no Daytona)
     - Mastra Workflow with Daytona

### Workflow Steps

The Daytona-enabled workflow consists of these steps:

1. **Create Daytona Workspace**
   - Provisions a new isolated workspace
   - Sets up the environment
   - Returns workspace ID

2. **Initialize Anchors**
   - Creates Customer Job and Product Feature anchor nodes
   - Saves initial graph state to workspace filesystem

3. **Expand Graph in Daytona**
   - Performs BFS expansion using LLM
   - Logs generation progress to workspace
   - Saves checkpoints after each generation
   - Stores final graph state

4. **Connect to Product**
   - Links leaf nodes to Product Feature anchor
   - Logs connections to workspace

5. **Finalize and Cleanup**
   - Saves final results to workspace
   - Returns metadata including workspace ID
   - Optionally destroys workspace (based on config)

## Configuration

### Environment Variables

Add these to your `.env` file:

```bash
# Daytona API Configuration
DAYTONA_API_KEY=your_daytona_api_key
DAYTONA_API_URL=https://app.daytona.io/api

# Workflow Configuration
USE_WORKFLOW=true          # Enable Mastra workflow (vs legacy BFS)
USE_DAYTONA=true           # Enable Daytona workspace execution
KEEP_DAYTONA_WORKSPACE=true  # Keep workspace after execution for debugging
```

### Execution Modes

Set these environment variables to control execution:

| USE_WORKFLOW | USE_DAYTONA | Mode |
|--------------|-------------|------|
| false | false | Legacy BFS (no workflow, no Daytona) |
| true | false | Mastra Workflow (no Daytona) |
| true | true | Mastra Workflow with Daytona |

## Usage

### Starting the Server

```bash
cd mastra
npm run dreamer
```

The server will start on port 3457.

### Making a Request

```bash
curl -X POST http://localhost:3457/api/v1/dream \
  -H "Content-Type: application/json" \
  -d '{
    "customer": "Enterprise software companies using microservices",
    "product": "Distributed tracing and observability platform",
    "children_count": 2,
    "generations_count_int": 3
  }'
```

### Response

The response includes the knowledge graph nodes and metadata:

```json
{
  "nodes": [...],
  "metadata": {
    "totalNodes": 15,
    "generationTime": 45302,
    "generations": 3,
    "daytonaWorkspaceId": "abc123..."
  }
}
```

## Workspace Contents

When `KEEP_DAYTONA_WORKSPACE=true`, the workspace persists with these files:

```
/workspace/
├── graph-state.json              # Initial graph state
├── generation.log                # Generation progress log
├── errors.log                    # Error log
├── checkpoint-gen1.json          # Checkpoint after generation 1
├── checkpoint-gen2.json          # Checkpoint after generation 2
├── checkpoint-gen3.json          # Checkpoint after generation 3
├── final-graph.json              # Complete graph before product connection
├── connections.log               # Product connection log
└── results.json                  # Final results with metadata
```

## Benefits

1. **Isolation**: Each dream runs in its own container
2. **Debugging**: Full workspace access for troubleshooting
3. **Persistence**: Intermediate results saved for analysis
4. **Scalability**: Daytona handles resource management
5. **Reproducibility**: Consistent execution environment
6. **Extensibility**: Easy to add code execution, tool installation, etc.

## Development

### Running Tests

```bash
cd mastra
npm test
```

### Adding New Workspace Operations

To add new operations to the DaytonaService:

1. Add method to `DaytonaService` class
2. Use the Daytona SDK methods:
   - `workspace.process.exec(command)` - Run shell command
   - `workspace.process.codeRun(code)` - Execute code
   - `workspace.fs.writeFile(path, content)` - Write file
   - `workspace.fs.readFile(path)` - Read file
   - `workspace.logs.stream()` - Stream logs

### Example: Running Custom Code in Workspace

```typescript
const daytonaService = new DaytonaService();
const workspace = await daytonaService.createWorkspace('my-dream');

// Install dependencies
await daytonaService.executeCommand('my-dream', 'pip install pandas numpy');

// Write Python code
const pythonCode = `
import pandas as pd
df = pd.DataFrame({'a': [1, 2, 3]})
print(df.describe())
`;

// Execute code
const result = await daytonaService.executeCode('my-dream', pythonCode, 'python');
console.log(result);

// Cleanup
await daytonaService.destroyWorkspace('my-dream');
```

## Troubleshooting

### Workspace Creation Fails

- Check `DAYTONA_API_KEY` is set correctly
- Verify `DAYTONA_API_URL` points to correct endpoint
- Check Daytona service status

### Workspace Not Cleaned Up

- Set `KEEP_DAYTONA_WORKSPACE=false` to auto-cleanup
- Manually clean up with `daytonaService.destroyAll()`

### File Operations Fail

- Ensure directory exists: `/workspace/` is the default
- Check file permissions
- Verify workspace is still active

## API Reference

### DaytonaService

#### `createWorkspace(dreamId: string): Promise<any>`
Creates a new workspace for the given dream ID.

#### `executeCode(dreamId: string, code: string, language?: string): Promise<any>`
Executes code in the workspace (default: Python).

#### `executeCommand(dreamId: string, command: string): Promise<string>`
Runs a shell command in the workspace.

#### `writeFile(dreamId: string, filePath: string, content: string): Promise<void>`
Writes content to a file in the workspace.

#### `readFile(dreamId: string, filePath: string): Promise<string>`
Reads a file from the workspace.

#### `destroyWorkspace(dreamId: string): Promise<void>`
Destroys a specific workspace.

#### `destroyAll(): Promise<void>`
Destroys all active workspaces.

#### `getWorkspaceInfo(dreamId: string): { id: string; exists: boolean } | null`
Gets information about a workspace.

#### `getActiveWorkspaces(): string[]`
Returns array of dream IDs with active workspaces.

## Future Enhancements

- [ ] Support for multiple concurrent dreams
- [ ] Workspace pooling for better performance
- [ ] Git operations in workspace
- [ ] SSH access to workspace for debugging
- [ ] Workspace templates for faster startup
- [ ] Metrics and monitoring integration
- [ ] Cost tracking per dream execution
- [ ] Workspace snapshots for rollback

## References

- [Daytona Documentation](https://www.daytona.io/docs/)
- [Daytona SDK Reference](https://github.com/daytonaio/sdk)
- [Mastra Workflows](https://docs.mastra.ai/workflows)
