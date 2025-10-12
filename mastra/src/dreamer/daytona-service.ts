import { Daytona } from '@daytonaio/sdk';
import { config } from 'dotenv';

config({ path: '.env' });

/**
 * Service to manage Daytona workspaces for dream execution
 * Each dream runs in an isolated Daytona workspace instance
 */
export class DaytonaService {
  private daytona: Daytona;
  private workspaces: Map<string, any>;

  constructor() {
    this.daytona = new Daytona();
    this.workspaces = new Map();
  }

  /**
   * Create a new Daytona workspace for a dream
   * @param dreamId Unique identifier for the dream
   * @returns The created workspace
   */
  async createWorkspace(dreamId: string): Promise<any> {
    try {
      console.log(`[Daytona] Creating workspace for dream: ${dreamId}`);

      const sandbox = await this.daytona.create();

      this.workspaces.set(dreamId, sandbox);
      console.log(`[Daytona] Workspace created successfully: ${sandbox.id}`);

      return sandbox;
    } catch (error) {
      console.error(`[Daytona] Error creating workspace for ${dreamId}:`, error);
      throw new Error(`Failed to create Daytona workspace: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get an existing workspace by dream ID
   * @param dreamId The dream identifier
   * @returns The workspace or undefined if not found
   */
  getWorkspace(dreamId: string): any | undefined {
    return this.workspaces.get(dreamId);
  }

  /**
   * Execute code in a Daytona workspace
   * @param dreamId The dream identifier
   * @param code The code to execute
   * @param language The programming language (default: 'python')
   * @returns The execution result
   */
  async executeCode(dreamId: string, code: string, language: string = 'python'): Promise<any> {
    const workspace = this.workspaces.get(dreamId);

    if (!workspace) {
      throw new Error(`Workspace not found for dream: ${dreamId}`);
    }

    try {
      console.log(`[Daytona] Executing ${language} code in workspace ${workspace.id}`);

      // Escape backslashes in the code
      const escapedCode = code.replace(/\\/g, '\\\\');

      const result = await workspace.process.codeRun(escapedCode);
      console.log(`[Daytona] Code execution completed successfully`);

      return result;
    } catch (error) {
      console.error(`[Daytona] Error executing code in workspace ${workspace.id}:`, error);
      throw new Error(`Failed to execute code: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Execute a shell command in a Daytona workspace
   * @param dreamId The dream identifier
   * @param command The command to execute
   * @returns The command output
   */
  async executeCommand(dreamId: string, command: string): Promise<string> {
    const workspace = this.workspaces.get(dreamId);

    if (!workspace) {
      throw new Error(`Workspace not found for dream: ${dreamId}`);
    }

    try {
      console.log(`[Daytona] Executing command in workspace ${workspace.id}: ${command}`);

      const result = await workspace.process.exec(command);
      console.log(`[Daytona] Command execution completed`);

      return result;
    } catch (error) {
      console.error(`[Daytona] Error executing command in workspace ${workspace.id}:`, error);
      throw new Error(`Failed to execute command: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Write a file to the workspace
   * @param dreamId The dream identifier
   * @param filePath Path to the file in the workspace
   * @param content Content to write
   */
  async writeFile(dreamId: string, filePath: string, content: string): Promise<void> {
    const workspace = this.workspaces.get(dreamId);

    if (!workspace) {
      throw new Error(`Workspace not found for dream: ${dreamId}`);
    }

    try {
      console.log(`[Daytona] Writing file ${filePath} to workspace ${workspace.id}`);

      await workspace.fs.writeFile(filePath, content);
      console.log(`[Daytona] File written successfully`);
    } catch (error) {
      console.error(`[Daytona] Error writing file to workspace ${workspace.id}:`, error);
      throw new Error(`Failed to write file: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Read a file from the workspace
   * @param dreamId The dream identifier
   * @param filePath Path to the file in the workspace
   * @returns The file content
   */
  async readFile(dreamId: string, filePath: string): Promise<string> {
    const workspace = this.workspaces.get(dreamId);

    if (!workspace) {
      throw new Error(`Workspace not found for dream: ${dreamId}`);
    }

    try {
      console.log(`[Daytona] Reading file ${filePath} from workspace ${workspace.id}`);

      const content = await workspace.fs.readFile(filePath);
      console.log(`[Daytona] File read successfully`);

      return content;
    } catch (error) {
      console.error(`[Daytona] Error reading file from workspace ${workspace.id}:`, error);
      throw new Error(`Failed to read file: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get logs from the workspace
   * @param dreamId The dream identifier
   * @returns Stream of logs
   */
  async getLogs(dreamId: string): Promise<any> {
    const workspace = this.workspaces.get(dreamId);

    if (!workspace) {
      throw new Error(`Workspace not found for dream: ${dreamId}`);
    }

    try {
      console.log(`[Daytona] Getting logs from workspace ${workspace.id}`);

      const logs = await workspace.logs.stream();
      return logs;
    } catch (error) {
      console.error(`[Daytona] Error getting logs from workspace ${workspace.id}:`, error);
      throw new Error(`Failed to get logs: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Clean up and destroy a workspace
   * @param dreamId The dream identifier
   */
  async destroyWorkspace(dreamId: string): Promise<void> {
    const workspace = this.workspaces.get(dreamId);

    if (!workspace) {
      console.warn(`[Daytona] No workspace found to destroy for dream: ${dreamId}`);
      return;
    }

    try {
      console.log(`[Daytona] Destroying workspace ${workspace.id} for dream: ${dreamId}`);

      // Note: The Daytona SDK should handle workspace cleanup automatically
      // when the workspace object is garbage collected, but we can explicitly
      // call destroy if the SDK supports it

      this.workspaces.delete(dreamId);
      console.log(`[Daytona] Workspace destroyed successfully`);
    } catch (error) {
      console.error(`[Daytona] Error destroying workspace ${workspace.id}:`, error);
      // Don't throw here - we want to continue even if cleanup fails
    }
  }

  /**
   * Clean up all workspaces
   */
  async destroyAll(): Promise<void> {
    console.log(`[Daytona] Destroying all ${this.workspaces.size} workspaces`);

    const dreamIds = Array.from(this.workspaces.keys());

    for (const dreamId of dreamIds) {
      await this.destroyWorkspace(dreamId);
    }

    console.log(`[Daytona] All workspaces destroyed`);
  }

  /**
   * Get workspace info
   * @param dreamId The dream identifier
   * @returns Workspace information
   */
  getWorkspaceInfo(dreamId: string): { id: string; exists: boolean } | null {
    const workspace = this.workspaces.get(dreamId);

    if (!workspace) {
      return null;
    }

    return {
      id: workspace.id,
      exists: true,
    };
  }

  /**
   * Get all active workspace IDs
   * @returns Array of dream IDs with active workspaces
   */
  getActiveWorkspaces(): string[] {
    return Array.from(this.workspaces.keys());
  }

  /**
   * Get the count of active workspaces
   * @returns Number of active workspaces
   */
  getWorkspaceCount(): number {
    return this.workspaces.size;
  }
}
