import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import z from 'zod';
import { logDebug } from '../utils/debug.utils';

/**
 * Registers all common tools with the provided MCP server
 * @param server The MCP server instance
 */
export function registerCommonTools(server: McpServer): void {
	logDebug('Registering common tools');

	// Register the echo tool
	server.tool(
		'personalize.echo',
		'Echoes back the input data for testing purposes.',
		{ message: z.string() },
		async ({ message }): Promise<CallToolResult> => {
			logDebug('Echo tool called with input', { message });

			return {
				content: [
					{
						type: 'text',
						text: `Echo: ${message}`,
					},
				],
				structuredContent: {
					message,
					echo: `Echo: ${message}`,
				},
			};
		}
	);

	// You can register more tools here as needed

	logDebug('Common tools registered successfully');
}
