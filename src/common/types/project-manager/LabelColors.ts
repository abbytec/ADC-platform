/**
 * Paleta arcoíris para labels del Project Manager.
 * Alineada con las variantes Tailwind y expresada en hue oklch.
 * El valor concreto oklch se resuelve en CSS via clases `.adc-label-<name>`.
 */
export const LABEL_COLORS = ["red", "orange", "amber", "yellow", "lime", "green", "teal", "cyan", "blue", "indigo", "purple", "pink"] as const;

export type LabelColor = (typeof LABEL_COLORS)[number];

/** Hue oklch por color (0..360). */
export const LABEL_COLOR_HUES: Record<LabelColor, number> = {
	red: 25,
	orange: 55,
	amber: 80,
	yellow: 95,
	lime: 130,
	green: 155,
	teal: 175,
	cyan: 200,
	blue: 245,
	indigo: 270,
	purple: 295,
	pink: 350,
};

export function isLabelColor(value: string): value is LabelColor {
	return (LABEL_COLORS as readonly string[]).includes(value);
}
