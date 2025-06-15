import fs from 'node:fs';
import { Readable } from 'node:stream';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';
import { SightEngineClient } from '../src/client.js';

declare global {
	//@ts-ignore
	var fetch: unknown;
}

// Setup dummy response
type DummyResponse = {
	ok: boolean;
	status: number;
	json: () => Promise<unknown>;
};

const dummyJson = { status: { nudity: 0.1 } };

// Helper to create dummy fetch response
function createDummyResponse(
	ok = true,
	status = 200,
	json = dummyJson,
): DummyResponse {
	return {
		ok,
		status,
		json: () => Promise.resolve(json),
	};
}

describe('SightEngineClient', () => {
	// @ts-ignore
	// biome-ignore lint/suspicious/noExplicitAny: <explanation>
	let fetchMock: any;

	beforeEach(() => {
		fetchMock = vi.fn();
		// @ts-ignore
		global.fetch = fetchMock;
	});

	afterEach(() => {
		vi.resetAllMocks();
	});

	it('throws if apiUser or apiSecret is missing', () => {
		expect(
			//@ts-ignore
			() => new SightEngineClient({ apiUser: '', apiSecret: 'secret' }),
		).toThrow(TypeError);
		expect(
			//@ts-ignore
			() => new SightEngineClient({ apiUser: 'user', apiSecret: '' }),
		).toThrow(TypeError);
	});

	it('sets default options correctly', () => {
		//@ts-ignore
		const client: SightEngineClient = new SightEngineClient({
			apiUser: 'user',
			apiSecret: 'secret',
		});
		//@ts-ignore
		expect(client.models).toEqual(['nudity-2.1', 'self-harm']);
		//@ts-ignore
		expect(client.timeout).toBe(15000);
		//@ts-ignore
		expect(client.retries).toBe(2);
	});

	it('moderate calls fetch and returns json', async () => {
		//@ts-ignore
		fetchMock.mockResolvedValue(createDummyResponse());
		//@ts-ignore
		const client = new SightEngineClient({ apiUser: 'u', apiSecret: 's' });
		const buffer = Buffer.from('test');
		const response = await client.moderate(buffer, 'test.png');
		expect(response).toEqual(dummyJson);
		//@ts-ignore
		expect(fetchMock).toHaveBeenCalledTimes(1);
		//@ts-ignore
		const [url, options] = fetchMock.mock.calls[0];
		expect(url).toContain('https://api.sightengine.com/1.0/check.json');
		expect(options.method).toBe('POST');
		// headers come from form.getHeaders()
	});

	it('moderateUrl calls correct endpoint', async () => {
		//@ts-ignore
		fetchMock.mockResolvedValue(createDummyResponse());
		//@ts-ignore
		const client = new SightEngineClient({ apiUser: 'u', apiSecret: 's' });
		const urlToCheck = 'http://example.com/image.jpg';
		const response = await client.moderateUrl(urlToCheck);
		expect(response).toEqual(dummyJson);
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it('moderateBase64 decodes and calls moderate', async () => {
		//@ts-ignore
		fetchMock.mockResolvedValue(createDummyResponse());
		//@ts-ignore
		const client = new SightEngineClient({ apiUser: 'u', apiSecret: 's' });
		const b64 = Buffer.from('hello').toString('base64');
		const response = await client.moderateBase64(b64, 'file.txt');
		expect(response).toEqual(dummyJson);
		expect(fetchMock).toHaveBeenCalledOnce();
	});

	it('moderateStream returns a readable with json event', async () => {
		//@ts-ignore
		fetchMock.mockResolvedValue(createDummyResponse());
		//@ts-ignore
		const client = new SightEngineClient({ apiUser: 'u', apiSecret: 's' });
		const input = Readable.from(['data']);
		const out = client.moderateStream(input);
		const chunks: unknown[] = [];
		out.on('data', (data: unknown) => {
			chunks.push(data);
		});
		out.on('end', () => {
			expect(chunks).toEqual([dummyJson]);
		});
	});

	describe('feedback', () => {
		it('sends string source', async () => {
			//@ts-ignore
			fetchMock.mockResolvedValue(createDummyResponse());
			//@ts-ignore
			const client = new SightEngineClient({
				apiUser: 'u',
				apiSecret: 's',
			});
			const res = await client.feedback(
				'mod',
				'cls',
				'http://example.com',
			);
			expect(res).toEqual(dummyJson);
			expect(fetchMock).toHaveBeenCalledOnce();
		});

		it('sends buffer source', async () => {
			//@ts-ignore
			fetchMock.mockResolvedValue(createDummyResponse());
			//@ts-ignore
			const client = new SightEngineClient({
				apiUser: 'u',
				apiSecret: 's',
			});
			const buf = Buffer.from('x');
			const res = await client.feedback('mod', 'cls', buf);
			expect(res).toEqual(dummyJson);
			expect(fetchMock).toHaveBeenCalledOnce();
		});

		it('sends stream source', async () => {
			//@ts-ignore
			fetchMock.mockResolvedValue(createDummyResponse());
			//@ts-ignore
			const client = new SightEngineClient({
				apiUser: 'u',
				apiSecret: 's',
			});
			const stream = Readable.from(['y']);
			const res = await client.feedback('mod', 'cls', stream);
			expect(res).toEqual(dummyJson);
			expect(fetchMock).toHaveBeenCalledOnce();
		});
	});
});
