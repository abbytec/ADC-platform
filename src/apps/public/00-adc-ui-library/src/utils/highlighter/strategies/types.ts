/**
 * Interface for syntax highlighter strategies
 */
export interface HighlighterStrategy {
	highlight(code: string): string;
}

/**
 * Escapes HTML special characters to prevent XSS
 */
export function escapeHtml(code: string): string {
	return code.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
