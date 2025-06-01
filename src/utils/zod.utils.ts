import z from 'zod';

/**
 * Converts a Zod schema to a JSON Schema compatible with MCP's inputSchema
 * @param schema The Zod schema to convert
 * @returns A JSON Schema object compatible with MCP SDK requirements
 */
export const zodToMcpSchema = <T extends z.ZodType>(schema: T) => {
	const jsonSchema = generateJsonSchema(schema);

	// Return the parameters structure expected by MCP
	return {
		type: 'object',
		parameters: {
			jsonSchema: {
				...jsonSchema,
				additionalProperties: false,
				$schema: 'http://json-schema.org/draft-07/schema#',
			},
		},
	};
};

/**
 * Internal helper to generate the JSON Schema object
 */
function generateJsonSchema(schema: z.ZodType): any {
	if (schema instanceof z.ZodObject) {
		// For object schemas, create a proper JSON Schema object
		const shape = schema._def.shape();
		const properties: Record<string, unknown> = {};
		const required: string[] = [];

		// Process each field in the object schema
		for (const [key, value] of Object.entries(shape)) {
			// Ensure value is a ZodType before processing
			const zodValue = value as z.ZodType;

			if (zodValue instanceof z.ZodString) {
				const propDefinition: Record<string, unknown> = { type: 'string' };

				// Add description if available
				const description = zodValue._def.description;
				if (description) {
					propDefinition.description = description;
				}

				properties[key] = propDefinition;

				// Check if field is required
				if (!zodValue.isOptional()) {
					required.push(key);
				}
			} else if (zodValue instanceof z.ZodNumber) {
				const propDefinition: Record<string, unknown> = { type: 'number' };

				// Add description if available
				const description = zodValue._def.description;
				if (description) {
					propDefinition.description = description;
				}

				properties[key] = propDefinition;

				if (!zodValue.isOptional()) {
					required.push(key);
				}
			} else if (zodValue instanceof z.ZodBoolean) {
				const propDefinition: Record<string, unknown> = { type: 'boolean' };

				// Add description if available
				const description = zodValue._def.description;
				if (description) {
					propDefinition.description = description;
				}

				properties[key] = propDefinition;

				if (!zodValue.isOptional()) {
					required.push(key);
				}
			} else if (zodValue instanceof z.ZodArray) {
				const arrayItemType = zodValue._def.type;
				properties[key] = {
					type: 'array',
					items: arrayItemType instanceof z.ZodObject ? generateJsonSchema(arrayItemType) : { type: getJsonSchemaType(arrayItemType) },
				};

				if (!zodValue.isOptional()) {
					required.push(key);
				}
			} else if (zodValue instanceof z.ZodObject) {
				// Recursively convert nested objects
				properties[key] = generateJsonSchema(zodValue);

				if (!zodValue.isOptional()) {
					required.push(key);
				}
			} else {
				// Handle other types with basic mapping
				properties[key] = { type: getJsonSchemaType(zodValue) };

				if (!zodValue.isOptional && typeof zodValue.isOptional === 'function' && !zodValue.isOptional()) {
					required.push(key);
				}
			}
		}

		// Return a properly typed schema object
		const result: any = {
			type: 'object',
			properties,
		};

		if (required.length > 0) {
			result.required = required;
		}

		return result;
	}

	// Handle simple types
	return { type: getJsonSchemaType(schema) };
}

/**
 * Helper to convert Zod types to JSON Schema types
 * @param zodType The Zod type to convert
 * @returns The corresponding JSON Schema type string
 */
const getJsonSchemaType = (zodType: z.ZodType): string => {
	if (zodType instanceof z.ZodString) return 'string';
	if (zodType instanceof z.ZodNumber) return 'number';
	if (zodType instanceof z.ZodBoolean) return 'boolean';
	if (zodType instanceof z.ZodArray) return 'array';
	if (zodType instanceof z.ZodObject) return 'object';
	if (zodType instanceof z.ZodEnum) return 'string';
	if (zodType instanceof z.ZodLiteral) {
		const literalValue = zodType._def.value;
		return typeof literalValue === 'string'
			? 'string'
			: typeof literalValue === 'number'
			? 'number'
			: typeof literalValue === 'boolean'
			? 'boolean'
			: 'string';
	}

	// Default fallback
	return 'string';
};
