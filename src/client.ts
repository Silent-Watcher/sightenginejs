import { createReadStream } from 'node:fs';
import { basename } from 'node:path';
import { Readable } from 'node:stream';
import FormData from 'form-data';
import type { ClientOptions, ModerationResponse } from './types';

export class SightEngineClient {
	private user: string;
	private secret: string;
	private models: string[];
	private agent?: ClientOptions['httpAgent'];
	private timeout?: number;
	private retries?: number;

	constructor(opts: ClientOptions) {
		if (!opts.apiUser?.trim() || !opts.apiSecret?.trim()) {
			throw new TypeError(
				'[SightEngineClient] initialization error: both apiUser and apiSecret are required.',
			);
		}

		this.user = opts.apiUser;
		this.secret = opts.apiSecret;
		this.models = opts.models || ['nudity-2.1', 'self-harm'];
		this.agent = opts.httpAgent;
		this.timeout = opts.timeout ?? 15_000;
		this.retries = opts.retries ?? 2;
	}

	/** Core POST helper, with retry+timeout */
	private async postForm(
		form: FormData,
		endpoint = 'https://api.sightengine.com/1.0/check.json',
	): Promise<ModerationResponse> {
		let attempts = 0;
		const headers = form.getHeaders();
		while (true) {
			try {
				const res = await fetch(endpoint, {
					method: 'POST',
					body: form,
					headers,
					agent: this.agent,
					// @ts-ignore node-fetch typings
					timeout: this.timeout,
				} as RequestInit);
				if (!res.ok) throw new Error(`HTTP ${res.status}`);
				return (await res.json()) as ModerationResponse;
			} catch (error) {
				if (++attempts > (this.retries ?? 2)) throw error;
			}
		}
	}

	/** 1. Buffer or Stream */
	public async moderate(
		buffer: Buffer,
		filename = 'file',
	): Promise<ModerationResponse> {
		const form = new FormData();
		form.append('models', this.models.join(','));
		form.append('api_user', this.user);
		form.append('api_secret', this.secret);
		form.append('media', buffer, { filename });
		return this.postForm(form);
	}

	/** 2. Readable stream variant */
	public moderateStream(input: Readable): Readable {
		const out = new Readable({ objectMode: true, read() {} });
		const form = new FormData();

		form.append('models', this.models.join(','));
		form.append('api_user', this.user);
		form.append('api_secret', this.secret);
		form.append('media', input, { filename: 'file' });

		this.postForm(form)
			.then((json) => {
				out.push(json);
				out.push(null);
			})
			.catch((err) => out.destroy(err));

		return out;
	}

	/** 3. URL moderation */
	public async moderateUrl(url: string): Promise<ModerationResponse> {
		const form = new FormData();
		form.append('models', this.models.join(','));
		form.append('api_user', this.user);
		form.append('api_secret', this.secret);
		form.append('url', url);
		return this.postForm(form);
	}

	/** 4. Local file path moderation */
	public async moderateFile(filePath: string): Promise<ModerationResponse> {
		const stream = createReadStream(filePath);
		const form = new FormData();
		form.append('models', this.models.join(','));
		form.append('api_user', this.user);
		form.append('api_secret', this.secret);
		form.append('media', stream, { filename: basename(filePath) });
		return this.postForm(form);
	}

	async moderateBase64(
		b64: string,
		filename = 'file',
	): Promise<ModerationResponse> {
		const buffer = Buffer.from(b64, 'base64');
		return this.moderate(buffer, filename);
	}

	async feedback(
		model: string,
		clazz: string,
		source: string | Buffer | Readable,
	): Promise<ModerationResponse> {
		const form = new FormData();
		form.append('model', model);
		form.append('class', clazz);
		form.append('api_user', this.user);
		form.append('api_secret', this.secret);

		if (typeof source === 'string') {
			form.append('source', source);
		} else if (Buffer.isBuffer(source)) {
			form.append('source', source, { filename: 'file' });
		} else {
			form.append('source', source, { filename: 'file' });
		}

		return this.postForm(
			form,
			'https://api.sightengine.com/1.0/feedback.json',
		);
	}
}
