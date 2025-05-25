import {
	Client,
	FlowChannel,
	FlowScheduleType,
	FlowStatus,
	FlowType,
	IClientInitOptions,
	IFlowDefinition,
	RegionOptions,
} from "sitecore-personalize-tenant-sdk";

export const createPersonalizationExperience = async (args: any, client: Client) => {
	if (args == undefined || client == undefined)
		return {
			status: "error",
			message: "Invalid arguments or clients.",
		};

	const flowTypeMapping = mapFlowType(args.type);

	console.log(args);

	if (!flowTypeMapping) {
		console.log(flowTypeMapping);
		return {
			status: "error",
			message: `Invalid flow type: ${args.type} it should match one of the following: Web, API, Triggered`,
		};
	}

	const experience: IFlowDefinition = {
		name: args.name,
		friendlyId: args.name.toLowerCase().replace(/\s+/g, "_"),
		type: flowTypeMapping,
		channels: args.channels.map(
			(channel: string) => FlowChannel[channel as keyof typeof FlowChannel],
		),
		status: FlowStatus.Draft,
		schedule: {
			type: FlowScheduleType.Simple,
			startDate: new Date().toISOString(),
		},
	};

	// Check if any of the fields in assets are provided
	if (
		args.assets &&
		(args.assets.html || args.assets.javascript || args.assets.freemarker || args.assets.css)
	) {
		experience.variants = [
			{
				name: "Default Variant",
				assets: {
					html: args.assets.html || "",
					js: args.assets.javascript || "",
					css: args.assets.css || "",
				},
				templateVariables: {},
				...(args.assets.freemarker && {
					tasks: [client.Flows.CreateTemplateRenderTaskInput(args.assets.freemarker)],
				}),
			},
		];
	}

	try {
		console.log("Creating personalization experience:", experience);
		let response = await client.Flows.CreateExperience(experience);

		return {
			status: "success",
			message: "Personalization experience created successfully.",
		};
	} catch (error: any) {
		return {
			status: "error",
			message: `Failed to create personalization experience: ${error.message}`,
		};
	}
};

export const getFlows = async (args: any, client: Client) => {
	if (args == undefined || client == undefined)
		return {
			status: "error",
			message: "Invalid arguments or clients.",
		};

	try {
		let response = await client.Flows.GetByRef(args.ref);

		console.log("Getting Flow Definition:", response);

		return {
			status: "success",
			message: "Found your experience or experiment successfully.",
			data: response,
		};
	} catch (error: any) {
		return {
			status: "error",
			message: `Failed to create personalization experience: ${error.message}`,
		};
	}
};

export const listPersonalizationExperiences = async (args: any, client: Client) => {
	if (args == undefined || client == undefined)
		return {
			status: "error",
			message: "Invalid arguments or clients.",
		};

	try {
		const response = await client.Flows.GetAll(2, 0);

		console.log("Getting All Flows:", response);

		const result = {
			status: "success",
			message: "Found your experiences successfully.",
			data: response,
		};

		console.log("status", result);

		return result;
	} catch (error: any) {
		console.error("Error retrieving personalization experiences:", error);
		return {
			status: "error",
			message: `Failed to retrieve personalization experiences: ${error.message}`,
		};
	}
};

export const mapFlowType = (type: string): FlowType | undefined => {
	let response: FlowType | undefined;
	switch (type) {
		case "Web":
			response = FlowType.WebFlow;
			break;
		case "API":
			response = FlowType.ApiFlow;
			break;
		case "Triggered":
			response = FlowType.Triggered;
			break;
		default:
			response = undefined;
	}

	return response;
};

export const mapRegion = (regionKey: string | undefined): RegionOptions => {
	if (!regionKey) {
		switch (regionKey?.toUpperCase()) {
			case "EU":
				return RegionOptions.EU;
			case "US":
				return RegionOptions.US;
			case "AP":
				return RegionOptions.APJ;
		}
	}

	return RegionOptions.EU;
};
