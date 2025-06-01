import { McpAgent } from 'agents/mcp';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { Client, IClientInitOptions } from 'sitecore-personalize-tenant-sdk';
import { listPersonalizationExperiences, mapRegion } from './services/Personalize.service';

function getPersonalizeClient(clientId: string, clientSecret: string, region: string): Client {
	if (!clientId || !clientSecret || !region) {
		throw new Error('Missing headers or Issue with Durable Object: x-sitecore-client-id, x-sitecore-client-secret, x-sitecore-region');
	}

	return new Client({
		clientId,
		clientSecret,
		region: mapRegion(region),
	} as IClientInitOptions);
}

// Define our MCP agent with tools
export class McpSession extends McpAgent {
	server = new McpServer({
		name: 'Sitecore (Unofficial)',
		version: '1.0.0',
	});

	// Add a class property to store the client
	private personalizeClient: Client | undefined;

	async init() {
		console.log(
			'McpSession.init called with props:',
			JSON.stringify(
				{
					props: this.props,
					clientId: this.props?.clientId ? '***' : undefined,
					clientSecret: this.props?.clientSecret ? '***' : undefined,
					region: this.props?.region,
				},
				null,
				2
			)
		);

		const { clientId, clientSecret, region } = this.props || {};

		try {
			// Assign directly to the class property instead of to a local variable
			this.personalizeClient = getPersonalizeClient(clientId as string, clientSecret as string, region as string);

			if (!this.personalizeClient) {
				throw new Error(
					'Failed to initialize Sitecore Personalize client. Ensure that x-sitecore-client-id, x-sitecore-client-secret, and x-sitecore-region headers are provided.'
				);
			}
		} catch (error) {
			console.error('Error initializing McpSession:', error);
			throw new Error(
				'Failed to initialize McpSession. Ensure that x-sitecore-client-id, x-sitecore-client-secret, and x-sitecore-region headers are provided.'
			);
		}

		this.server.tool(
			'list_personalization_experiences',
			{}, // No parameters required based on your original code
			async (_params, req) => {
				try {
					if (!this.personalizeClient) {
						throw new Error('Personalize client is not initialized.');
					}
					console.log('token: ', this.personalizeClient.options.accessToken);
					console.log('Attempting to call tool: list_personalization_experiences');
					const experiences = await listPersonalizationExperiences(_params, this.personalizeClient);

					return {
						content: [
							{
								type: 'text',
								text: JSON.stringify(experiences, null, 2),
							},
						],
					};
				} catch (error) {
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
	}
}

export default {
	fetch(request: Request, env: Env, ctx: ExecutionContext) {
		const url = new URL(request.url);

		if (url.pathname === '/sse' || url.pathname === '/sse/message') {
			try {
				// Pass Sitecore headers through to the SSE handler
				const clientId = request.headers.get('x-sitecore-client-id');
				const clientSecret = request.headers.get('x-sitecore-client-secret');
				const region = request.headers.get('x-sitecore-region');

				// Create a new request with the same properties but including auth info
				const mcpRequest = new Request(request);

				// Add auth info to the context
				ctx.props = {
					clientId,
					clientSecret,
					region,
				};

				return McpSession.serveSSE('/sse').fetch(mcpRequest, env, ctx);
			} catch (error) {
				// Debug: Log any errors
				console.error('Error processing SSE request:', error);
				return new Response(`Error processing request: ${error instanceof Error ? error.message : String(error)}`, { status: 500 });
			}
		}

		if (url.pathname === '/mcp') {
			// Pass Sitecore headers through to the MCP handler
			const clientId = request.headers.get('x-sitecore-client-id');
			const clientSecret = request.headers.get('x-sitecore-client-secret');
			const region = request.headers.get('x-sitecore-region');

			// Create a new request with the same properties but including auth info
			const mcpRequest = new Request(request, {
				headers: request.headers,
			});

			// Add auth info to the context
			ctx.props = {
				'x-sitecore-client-id': clientId,
				'x-sitecore-client-secret': clientSecret,
				'x-sitecore-region': region,
			};

			return McpSession.serve('/mcp').fetch(mcpRequest, env, ctx);
		}

		return new Response('Not found', { status: 404 });
	},
};
