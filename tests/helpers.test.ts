import { describe, expect, test } from 'vitest';
import type { ModerationResponse } from '#app/types.js';
import { isNSFW, listFlaggedCategories } from '../src/helpers';

const fakeResp = {
	erotica: 0.9,
	gore: { prob: 0.1 },
	'self-harm': { prob: 0.6 },
} as unknown as ModerationResponse;

describe('helpers', () => {
	test('lists flagged categories with defaults', () => {
		const flagged = listFlaggedCategories(fakeResp);
		expect(flagged).toEqual(
			expect.arrayContaining(['erotica', 'self-harm']),
		);
	});

	test('isNSFW returns true', () => {
		expect(isNSFW(fakeResp)).toBe(true);
	});

	test('custom thresholds', () => {
		const flagged = listFlaggedCategories(fakeResp, {
			erotica: 1,
			gore: 0.05,
			'self-harm': 1,
		});
		expect(flagged).toEqual(['gore']);
	});
});
