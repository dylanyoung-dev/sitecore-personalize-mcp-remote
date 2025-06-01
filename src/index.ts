import { McpAgent } from 'agents/mcp';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Client } from 'sitecore-personalize-tenant-sdk';
import { getPersonalizeClient, listPersonalizationExperiences, mapRegion } from './services/Personalize.service';
import { logDebug } from './utils/debug.utils';
import { registerCommonTools } from './tools/common';
import z from 'zod';

// Define our MCP agent with tools
export class McpSession extends McpAgent {
	private personalizeClient: Client | undefined;
	server = new McpServer({
		name: 'Sitecore Personalize (Unofficial)',
		version: '1.0.0',
	});

	async init() {
		this.personalizeClient = getPersonalizeClient(this.props);

		logDebug('McpSession.init START', {
			hasProps: !!this.props,
			propsKeys: this.props ? Object.keys(this.props) : [],
		});

		// Another Attempt - The TypeScript SDK is Garbage
		//registerCommonTools(this.server);
		this.server.tool('echo', { message: z.string() }, async ({ message }) => {
			logDebug('echo tool INVOKED DIRECTLY', { message });
			return {
				content: [{ type: 'text', text: `Echo: ${message}` }],
			};
		});

		//#region list_personalization_experiences
		this.server.tool(
			'list_personalization_experiences',
			{}, // No parameters required based on your original code
			async () => {
				try {
					const experiences = await listPersonalizationExperiences(this.personalizeClient);

					logDebug('list_personalization_experiences tool invoked', JSON.stringify(experiences, null, 2));

					return {
						content: [
							{
								type: 'text',
								text: JSON.stringify(experiences, null, 2),
							},
						],
					};
				} catch (error) {
					logDebug('Error in list_personalization_experiences handler', {
						errorMessage: error instanceof Error ? error.message : 'Unknown error',
						errorStack: error instanceof Error ? error.stack : undefined,
					});

					return {
						content: [
							{
								type: 'text',
								text: `Error listing personalization experiences: ${error instanceof Error ? error.message : 'Unknown error'}`,
							},
						],
					};
				}
			}
		);
		//#endregion
	}
}

export default {
	fetch(request: Request, env: Env, ctx: ExecutionContext) {
		const url = new URL(request.url);
		const requestId = Math.random().toString(36).substring(2, 15);

		logDebug(`[${requestId}] Request received`, {
			method: request.method,
			url: request.url,
			pathname: url.pathname,
			searchParams: Object.fromEntries(url.searchParams),
			headers: [...request.headers.entries()].map(([k, v]) =>
				k.toLowerCase().includes('secret') || k.toLowerCase().includes('token') ? [k, '***'] : [k, v]
			),
		});

		if (url.pathname === '/sse' || url.pathname === '/sse/message') {
			logDebug(`[${requestId}] Handling SSE request`);
			try {
				// Pass Sitecore headers through to the SSE handler
				const clientId = request.headers.get('x-sitecore-client-id');
				const clientSecret = request.headers.get('x-sitecore-client-secret');
				const region = request.headers.get('x-sitecore-region');

				logDebug(`[${requestId}] SSE headers extracted`, {
					clientIdExists: !!clientId,
					clientSecretExists: !!clientSecret,
					regionExists: !!region,
				});

				// Create a new request with the same properties but including auth info
				const mcpRequest = new Request(request);

				// Add auth info to the context
				ctx.props = {
					clientId,
					clientSecret,
					region,
				};

				logDebug(`[${requestId}] Context props set for SSE`, {
					propsKeys: Object.keys(ctx.props),
				});

				logDebug(`[${requestId}] Before calling serveSSE`);
				const response = McpSession.serveSSE('/sse').fetch(mcpRequest, env, ctx);
				logDebug(`[${requestId}] After calling serveSSE, response promise created`);
				return response;
			} catch (error) {
				// Debug: Log any errors
				logDebug(`[${requestId}] Error processing SSE request`, {
					errorMessage: error instanceof Error ? error.message : 'Unknown error',
					errorStack: error instanceof Error ? error.stack : undefined,
				});

				console.error('Error processing SSE request:', error);
				return new Response(`Error processing request: ${error instanceof Error ? error.message : String(error)}`, { status: 500 });
			}
		}

		if (url.pathname === '/mcp') {
			logDebug(`[${requestId}] Handling MCP request`);
			try {
				// Pass Sitecore headers through to the MCP handler
				const clientId = request.headers.get('x-sitecore-client-id');
				const clientSecret = request.headers.get('x-sitecore-client-secret');
				const region = request.headers.get('x-sitecore-region');

				logDebug(`[${requestId}] MCP headers extracted`, {
					clientIdExists: !!clientId,
					clientSecretExists: !!clientSecret,
					regionExists: !!region,
				});

				// Create a new request with the same properties but including auth info
				const mcpRequest = new Request(request, {
					headers: request.headers,
				});

				// Add auth info to the context
				ctx.props = {
					clientId,
					clientSecret,
					region,
				};

				logDebug(`[${requestId}] Context props set for MCP`, {
					ctxProps: ctx.props ? Object.keys(ctx.props) : [],
				});

				logDebug(`[${requestId}] Before calling serve`);
				const response = McpSession.serve('/mcp').fetch(mcpRequest, env, ctx);
				logDebug(`[${requestId}] After calling serve, response promise created`);
				return response;
			} catch (error) {
				logDebug(`[${requestId}] Error in MCP handler`, {
					errorMessage: error instanceof Error ? error.message : 'Unknown error',
					errorStack: error instanceof Error ? error.stack : undefined,
				});
				return new Response(`Error processing request: ${error instanceof Error ? error.message : String(error)}`, { status: 500 });
			}
		}

		logDebug(`[${requestId}] Not found`, { pathname: url.pathname });
		return new Response('Not found', { status: 404 });
	},
};
