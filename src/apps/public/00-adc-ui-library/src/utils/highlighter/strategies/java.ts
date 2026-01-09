import { HighlighterStrategy, escapeHtml } from "./types.js";

/**
 * Java syntax highlighter
 */
export class JavaHighlighter implements HighlighterStrategy {
	highlight(code: string): string {
		let escaped = escapeHtml(code);

		const replacements = new Map<string, string>();
		const rawByPlaceholder = new Map<string, string>();
		let placeholderIndex = 0;

		// Strings first
		const doubleRegex = /"(?:\\.|[^"\\])*"/g;
		const singleRegex = /'(?:\\.|[^'\\])*'/g;
		[doubleRegex, singleRegex].forEach((regex) => {
			escaped = escaped.replace(regex, (match) => {
				const placeholder = `__STR_${placeholderIndex++}__`;
				replacements.set(placeholder, `<span class="token string">${match}</span>`);
				rawByPlaceholder.set(placeholder, match);
				return placeholder;
			});
		});

		// Comments
		const lineCommentRegex = /\/\/[^\n]*/g;
		const blockCommentRegex = /\/\*[\s\S]*?\*\//g;
		const neutralizeInsideComment = (text: string): string => text.replace(/__STR_\d+__/g, (ph) => rawByPlaceholder.get(ph) ?? ph);

		escaped = escaped.replace(lineCommentRegex, (match) => {
			const placeholder = `__COMMENT_${placeholderIndex++}__`;
			replacements.set(placeholder, `<span class="token comment">${neutralizeInsideComment(match)}</span>`);
			return placeholder;
		});
		escaped = escaped.replace(blockCommentRegex, (match) => {
			const placeholder = `__COMMENT_${placeholderIndex++}__`;
			replacements.set(placeholder, `<span class="token comment">${neutralizeInsideComment(match)}</span>`);
			return placeholder;
		});

		// new ClassName
		const newClassRegex = /\bnew\s+([A-Za-z_]\w*)\s*(?=\(|&lt;)/g;
		escaped = escaped.replace(newClassRegex, (_, className) => {
			const placeholder = `__NEWCLASS_${placeholderIndex++}__`;
			replacements.set(placeholder, `<span class="token keyword">new</span> <span class="token type">${className}</span>`);
			return placeholder;
		});

		// Functions
		const functionRegex = /\b(?!if\b|else\b|for\b|while\b|do\b|switch\b|catch\b|new\b|__)([A-Za-z_]\w*)\s*(?=\()/g;
		escaped = escaped.replace(functionRegex, (_, func) => {
			const placeholder = `__FUNC_${placeholderIndex++}__`;
			replacements.set(placeholder, `<span class="token function">${func}</span>`);
			return placeholder;
		});

		// Keywords
		const keywordRegexA = /\b(public|private|protected|class|static|final|void|abstract|interface)\b/g;
		const keywordRegexB = /\b(if|else|for|while|do|switch|case|break|continue|default)\b/g;
		const keywordRegexC = /\b(try|catch|finally|throw|throws|return|new|import|package|extends|implements)\b/g;
		[keywordRegexA, keywordRegexB, keywordRegexC].forEach((regex) => {
			escaped = escaped.replace(regex, (_, keyword) => {
				const placeholder = `__KEYWORD_${placeholderIndex++}__`;
				replacements.set(placeholder, `<span class="token keyword">${keyword}</span>`);
				return placeholder;
			});
		});

		// Types
		const typeRegexA = /\b(int|double|float|boolean|char|String|long|short|byte|void)\b/g;
		const typeRegexB = /\b(Integer|Double|Float|Boolean|Character|Long|Short|Byte|Object)\b/g;
		const typeRegexC = /\b(List|Map|Set|ArrayList|HashMap|HashSet|Collection|Iterator)\b/g;
		[typeRegexA, typeRegexB, typeRegexC].forEach((regex) => {
			escaped = escaped.replace(regex, (_, type) => {
				const placeholder = `__TYPE_${placeholderIndex++}__`;
				replacements.set(placeholder, `<span class="token type">${type}</span>`);
				return placeholder;
			});
		});

		// Restore placeholders
		if (replacements.size) {
			const keys = Array.from(replacements.keys());
			let changed = true;
			while (changed) {
				changed = false;
				for (const key of keys) {
					const html = replacements.get(key)!;
					if (escaped.includes(key)) {
						escaped = escaped.replace(key, () => html);
						changed = true;
					}
				}
			}
		}

		return escaped;
	}
}
