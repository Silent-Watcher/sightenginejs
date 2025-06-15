import type { Agent } from 'node:http';

export interface ClientOptions {
	apiUser: string;
	apiSecret: string;
	models: string[];
	/** Optional custom HTTP agent (for keep‑alive, pooling) */
	httpAgent?: Agent;
	/** Request timeout in ms */
	timeout?: number;
	/** Number of retry attempts on 5xx */
	retries?: number;
}

export interface RequestMetadata {
	id: string;
	timestamp: number;
	operations: number;
}

export interface ModelScores {
	[key: string]: number | Record<string, unknown>;
}

export interface ModerationResponse {
	status: 'success' | 'failure';
	request: RequestMetadata;
	media: { id: string; uri: string };
	[model: string]: unknown;
}
