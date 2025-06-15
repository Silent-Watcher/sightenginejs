import type { PRESET_THRESHOLDS, Thresholds } from './thresholds';
import { DEFAULT_THRESHOLDS } from './thresholds';
import type { ModerationResponse } from './types';

export function listFlaggedCategories(
	resp: ModerationResponse,
	thresholds: Thresholds = DEFAULT_THRESHOLDS,
): string[] {
	if (!resp) {
		throw new Error('ModerationResponse is required but was not provided.');
	}

	const flagged: string[] = [];
	for (const [model, threshold] of Object.entries(thresholds)) {
		const score =
			typeof resp[model] === 'object' &&
			resp[model] !== null &&
			'prob' in resp[model]
				? resp[model].prob
				: (resp[model] as number | undefined);
		if (typeof score === 'number' && score > threshold) {
			flagged.push(model);
		}
	}
	return flagged;
}

export function isNSFW(
	resp: ModerationResponse,
	thresholds: Thresholds = DEFAULT_THRESHOLDS,
): boolean {
	return listFlaggedCategories(resp, thresholds).length > 0;
}

export { DEFAULT_THRESHOLDS, type PRESET_THRESHOLDS };
