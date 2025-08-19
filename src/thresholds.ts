export interface Thresholds {
	[model: string]: number;
}

export const DEFAULT_THRESHOLDS: Thresholds = {
	nudity: 0.85,
	offensive: 0.5,
	gore: 0.5,
	violence: 0.5,
	'self-harm': 0.5,
};

export const PRESET_THRESHOLDS: Record<
	'strict' | 'moderate' | 'lenient',
	Thresholds
> = {
	strict: { ...DEFAULT_THRESHOLDS, nudity: 0.7, gore: 0.3 },
	moderate: { ...DEFAULT_THRESHOLDS },
	lenient: { ...DEFAULT_THRESHOLDS, nudity: 0.95, gore: 0.7, violence: 0.7 },
};
