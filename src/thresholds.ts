export interface Thresholds {
	[model: string]: number;
}

export const DEFAULT_THRESHOLDS: Thresholds = {
	erotica: 0.85,
	sexual_display: 0.85,
	sexual_activity: 0.85,
	gore: 0.5,
	weapon: 0.5,
	offensive: 0.5,
	'self-harm': 0.5,
	// add more as desired
};

export const PRESET_THRESHOLDS: Record<
	'strict' | 'moderate' | 'lenient',
	Thresholds
> = {
	strict: { ...DEFAULT_THRESHOLDS, erotica: 0.7, gore: 0.3 },
	moderate: { ...DEFAULT_THRESHOLDS },
	lenient: { ...DEFAULT_THRESHOLDS, erotica: 0.95, gore: 0.7, weapon: 0.7 },
};
