/**
 * Utility function for standardized debug logging with timestamps
 * @param message The debug message to log
 * @param data Optional data object to stringify and log
 */
const logDebug = (message: string, data?: any): void => {
	const timestamp = new Date().toISOString();
	console.log(`[${timestamp}] DEBUG: ${message}`, data ? JSON.stringify(data, null, 2) : '');
};

export { logDebug };
