import { McpAgent } from 'agents/mcp';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { Client, IClientInitOptions } from 'sitecore-personalize-tenant-sdk';
import { listPersonalizationExperiences, mapRegion } from './services/Personalize.service';

function getPersonalizeClient(headers: Headers) {
	const clientId = headers.get('x-sitecore-client-id') || '';
	const clientSecret = headers.get('x-sitecore-client-secret') || '';
	const region = headers.get('x-sitecore-region') || '';

	if (!clientId || !clientSecret || !region) {
		throw new Error('Missing headers: x-sitecore-client-id, x-sitecore-client-secret, x-sitecore-region');
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

	async init() {
		this.server.tool(
			'list_personalization_experiences',
			{}, // No parameters required based on your original code
			async (_params, req) => {
				try {
					const headers = req.authInfo?.extra?.headers;
					const personalizeClient = getPersonalizeClient(headers as any);

					const experiences = await listPersonalizationExperiences(_params, personalizeClient);

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

		this.server.tool('add', { a: z.number(), b: z.number() }, async ({ a, b }) => ({
			content: [{ type: 'text', text: String(a + b) }],
		}));
	}
}

export default {
	fetch(request: Request, env: Env, ctx: ExecutionContext) {
		const url = new URL(request.url);

		if (url.pathname === '/sse' || url.pathname === '/sse/message') {
			return McpSession.serveSSE('/sse').fetch(request, env, ctx);
		}

		if (url.pathname === '/mcp') {
			return McpSession.serve('/mcp').fetch(request, env, ctx);
		}

		return new Response('Not found', { status: 404 });
	},
};
