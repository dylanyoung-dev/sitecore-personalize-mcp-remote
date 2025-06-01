import { McpAgent } from 'agents/mcp';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Client, IFlowDefinition } from 'sitecore-personalize-tenant-sdk';
import {
	createPersonalizationExperience,
	getPersonalizeClient,
	listPersonalizationExperiences,
	mapRegion,
} from './services/Personalize.service';
import { logDebug } from './utils/debug.utils';
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

		// Another Attempt to create a better devex experience - The TypeScript SDK is Garbage
		//registerCommonTools(this.server);

		//#region Common Testing Tool (echo)
		this.server.tool('echo', { message: z.string() }, async ({ message }) => {
			logDebug('echo tool INVOKED DIRECTLY', { message });
			return {
				content: [{ type: 'text', text: `Echo: ${message}` }],
			};
		});
		// #endregion

		//#region list_personalize_experiences
		this.server.tool(
			'list_personalization_experiences',
			'Lists all personalization experiences available in the Sitecore Personalize instance.',
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
						// structuredContent: experiences.data.map((exp: IFlowDefinition) => ({
						// 	name: exp.name,
						// 	friendlyId: exp.friendlyId,
						// 	type: exp.type,
						// 	status: exp.status,
						// })),
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

		//#region create_personalize_experience
		this.server.tool(
			'create_personalize_experience',
			'Creates a new personalization experience in Sitecore Personalize.',
			{
				name: z.string().describe('The name of the personalization experience.'),
				type: z.enum(['Web', 'API', 'Triggered']).describe('The type of the experience.'),
				channels: z
					.array(z.enum(['Call Center', 'Email', 'Mobile App', 'Mobile Web', 'Web', 'SMS']))
					.describe('The channels for the experience.'),
				assets: z
					.object({
						html: z.string().optional().describe('The HTML content for the experience, use pure HTML only.'),
						css: z.string().optional().describe('The CSS content for the experience, do not use precompiled CSS, only pure CSS.'),
						javascript: z
							.string()
							.optional()
							.describe('The JS content for the experience which needs to use Nashorn Engine compatible ES5 Javascript.'),
						freemarker: z
							.string()
							.optional()
							.describe('This is used to define the API response information using free marker syntax for the experience.'),
					})
					.optional()
					.describe('Assets for the personalization experience'),
			},
			async ({ name, type, channels, assets }) => {
				try {
					logDebug('create_personalize_experience tool invoked', { name, type, channels, assetsProvided: !!assets });

					const experienceData = {
						name,
						type,
						channels,
						assets: assets || {},
					};

					const result = await createPersonalizationExperience(experienceData, this.personalizeClient);

					return {
						content: [
							{
								type: 'text',
								text: `Created personalization experience: ${name} (Type: ${type}, Channels: ${channels.join(', ')})`,
							},
						],
						structuredContent: {
							success: result.status === 'success',
							message: result.message,
							data: result.status === 'success' ? result.data : undefined,
							experienceData,
						},
					};
				} catch (error) {
					logDebug('Error in create_personalize_experience handler', {
						errorMessage: error instanceof Error ? error.message : 'Unknown error',
						errorStack: error instanceof Error ? error.stack : undefined,
					});

					return {
						content: [
							{
								type: 'text',
								text: `Error creating personalization experience: ${error instanceof Error ? error.message : 'Unknown error'}`,
							},
						],
						structuredContent: {
							success: false,
							message: error instanceof Error ? error.message : 'Unknown error',
						},
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
