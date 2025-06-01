import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { logDebug } from './debug.utils';

// Explicitly define the type for the execute function
type ToolExecuteFunction = (args: any, extra: any) => Promise<any> | any;

/**
 * Registers a tool with the MCP server
 * @param server The MCP server instance
 * @param tool The tool to register
 */
export function registerTool(server: McpServer, tool: Tool): void {
	logDebug(`Registering tool: ${tool.name}`);

	// Type assertion for the execute function
	const execute = tool.execute as ToolExecuteFunction;

	// Use a type-safe approach that works with the MCP server's tool method
	if (typeof tool.inputSchema === 'object') {
		server.tool(tool.name, tool.inputSchema, (args, extra) => execute(args, extra));
	} else {
		// Fallback for tools that might have a different schema format
		server.tool(
			tool.name,
			{}, // Empty schema
			(_, extra) => execute({}, extra)
		);
	}
}

/**
 * Registers multiple tools with the MCP server
 * @param server The MCP server instance
 * @param tools Array of tools to register
 */
export function registerTools(server: McpServer, tools: Tool[]): void {
	logDebug(`Registering ${tools.length} tools`);
	tools.forEach((tool) => registerTool(server, tool));
}
