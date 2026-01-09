import { HighlighterStrategy, escapeHtml } from "./types.js";

/**
 * TypeScript syntax highlighter (extends JavaScript with TS-specific tokens)
 */
export class TypeScriptHighlighter implements HighlighterStrategy {
	highlight(code: string): string {
		let escaped = escapeHtml(code);

		const keywordPatternA = /\b(function|return|if|else|for|while|class|const|let|var|import|from|export|new|switch|case)\b/g;
		const keywordPatternB = /\b(break|try|catch|finally|throw|interface|type|enum|implements|extends|private|public|protected)\b/g;
		const typePattern = /\b(string|number|boolean|any|void|unknown|never|readonly)\b/g;
		const functionPattern = /\b(?!if\b|for\b|while\b|switch\b|catch\b|new\b|__)([A-Za-z_]\w*)\s*(?=\()/g;

		const applyTokenReplacements = (input: string): string => {
			let out = input;
			out = out.replace(
				/\b(class|interface)\s+([A-Za-z_]\w*)/g,
				'<span class="token keyword">$1</span> <span class="token type">$2</span>'
			);
			out = out.replace(keywordPatternA, '<span class="token keyword">$1</span>');
			out = out.replace(keywordPatternB, '<span class="token keyword">$1</span>');
			out = out.replace(typePattern, '<span class="token type">$1</span>');
			out = out.replace(functionPattern, '<span class="token function">$1</span>');
			return out;
		};

		const replacements = new Map<string, string>();
		const rawByPlaceholder = new Map<string, string>();
		let placeholderIndex = 0;

		// Template literals
		const tplRegex = /`(?:\\.|[\s\S])*?`/g;
		escaped = escaped.replace(tplRegex, (match) => {
			const inner = match.slice(1, -1);
			const exprRe = /\$\{([\s\S]*?)\}/g;
			let out = '<span class="token string">`</span>';
			let last = 0;
			let m: RegExpExecArray | null;
			while ((m = exprRe.exec(inner))) {
				if (m.index > last) out += `<span class="token string">${inner.slice(last, m.index)}</span>`;
				out += '<span class="token punctuation">${</span>';
				out += applyTokenReplacements(m[1] ?? "");
				out += '<span class="token punctuation">}</span>';
				last = exprRe.lastIndex;
			}
			if (last < inner.length) out += `<span class="token string">${inner.slice(last)}</span>`;
			out += '<span class="token string">`</span>';
			const placeholder = `__TPL_${placeholderIndex++}__`;
			replacements.set(placeholder, out);
			rawByPlaceholder.set(placeholder, match);
			return placeholder;
		});

		// Strings
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
		const neutralizeInsideComment = (text: string): string =>
			text.replace(/__TPL_\d+__|__STR_\d+__/g, (ph) => rawByPlaceholder.get(ph) ?? ph);

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
		escaped = escaped.replace(newClassRegex, () => {
			const placeholder = `__NEWCLASS_${placeholderIndex++}__`;
			return placeholder;
		});

		// Apply token replacements
		escaped = applyTokenReplacements(escaped);

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
