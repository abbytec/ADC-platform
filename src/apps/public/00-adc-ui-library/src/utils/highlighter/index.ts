/**
 * Code syntax highlighting system
 * Ports the highlighter from temp-ui with strategies for different languages
 */

export interface HighlighterStrategy {
	highlight(code: string): string;
}

export function escapeHtml(code: string): string {
	return code.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Decodes unicode escape sequences stored to bypass XSS validators
 * e.g., \u003C -> <, \u003E -> >, \u0026 -> &
 */
export function decodeEscapes(s?: string): string {
	if (typeof s !== "string") return s ?? "";
	return s
		.replace(/\\u003C/g, "<")
		.replace(/\\u003E/g, ">")
		.replace(/\\u0026/g, "&");
}

// =============================================================================
// JavaScript Highlighter
// =============================================================================
class JavaScriptHighlighter implements HighlighterStrategy {
	highlight(code: string): string {
		let escaped = escapeHtml(code);

		const keywordPatternA = /\b(function|return|if|else|for|while|class|const|let|var)\b/g;
		const keywordPatternB = /\b(import|from|export|new|switch|case|break|try|catch|finally|throw)\b/g;
		const typePattern = /\b(string|number|boolean|any|void|unknown|never)\b/g;
		const functionPattern = /\b(?!if\b|for\b|while\b|switch\b|catch\b)([A-Za-z_]\w*)\s*(?=\()/g;

		const applyTokenReplacements = (input: string): string => {
			let out = input;
			out = out.replace(keywordPatternA, '<span class="token keyword">$1</span>');
			out = out.replace(keywordPatternB, '<span class="token keyword">$1</span>');
			out = out.replace(typePattern, '<span class="token type">$1</span>');
			out = out.replace(functionPattern, '<span class="token function">$1</span>');
			return out;
		};

		const replacements = new Map<string, string>();
		const rawByPlaceholder = new Map<string, string>();
		let placeholderIndex = 0;

		// Template literals with ${} interpolation
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

// =============================================================================
// TypeScript Highlighter (extends JavaScript with TS-specific tokens)
// =============================================================================
class TypeScriptHighlighter implements HighlighterStrategy {
	highlight(code: string): string {
		let escaped = escapeHtml(code);

		const keywordPatternA = /\b(function|return|if|else|for|while|class|const|let|var|import|from|export|new|switch|case)\b/g;
		const keywordPatternB = /\b(break|try|catch|finally|throw|interface|type|enum|implements|extends|private|public|protected)\b/g;
		const typePattern = /\b(string|number|boolean|any|void|unknown|never|readonly)\b/g;
		const functionPattern = /\b(?!if\b|for\b|while\b|switch\b|catch\b|new\b|__)([A-Za-z_]\w*)\s*(?=\()/g;

		const applyTokenReplacements = (input: string): string => {
			let out = input;
			out = out.replace(/\b(class|interface)\s+([A-Za-z_]\w*)/g, '<span class="token keyword">$1</span> <span class="token type">$2</span>');
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

// =============================================================================
// Python Highlighter
// =============================================================================
class PythonHighlighter implements HighlighterStrategy {
	highlight(code: string): string {
		let escaped = escapeHtml(code);

		const keywordPattern = /\b(def|return|if|elif|else|for|while|class|import|from|as|pass|lambda|try|except|finally|with|yield|raise)\b/g;
		const typePattern = /\b(int|float|str|bool|list|dict|set|tuple)\b/g;
		const functionPattern = /\b(?!if\b|for\b|while\b|class\b|def\b|with\b|lambda\b|try\b|except\b)([A-Za-z_]\w*)\s*(?=\()/g;

		const replacements = new Map<string, string>();
		let placeholderIndex = 0;

		// Strings (with prefixes like f, r, b)
		const doubleStrRegex = /(?:[rRuUbBfF]{0,2})"(?:\\.|[^"\\])*"/g;
		const singleStrRegex = /(?:[rRuUbBfF]{0,2})'(?:\\.|[^'\\])*'/g;
		[doubleStrRegex, singleStrRegex].forEach((regex) => {
			escaped = escaped.replace(regex, (match) => {
				const ph = `__STR_${placeholderIndex++}__`;
				replacements.set(ph, `<span class="token string">${match}</span>`);
				return ph;
			});
		});

		// Triple-quoted strings (docstrings) as comments
		const tripleDoubleRegex = /(?:[rRuUbBfF]{0,2})"""[\s\S]*?"""/g;
		const tripleSingleRegex = /(?:[rRuUbBfF]{0,2})'''[\s\S]*?'''/g;
		[tripleDoubleRegex, tripleSingleRegex].forEach((regex) => {
			escaped = escaped.replace(regex, (match) => {
				const ph = `__COMMENT_${placeholderIndex++}__`;
				replacements.set(ph, `<span class="token comment">${match}</span>`);
				return ph;
			});
		});

		// Line comments
		const lineCommentRegex = /#.*$/gm;
		escaped = escaped.replace(lineCommentRegex, (match) => {
			const ph = `__COMMENT_${placeholderIndex++}__`;
			replacements.set(ph, `<span class="token comment">${match}</span>`);
			return ph;
		});

		// Apply token replacements
		escaped = escaped.replace(keywordPattern, '<span class="token keyword">$1</span>');
		escaped = escaped.replace(typePattern, '<span class="token type">$1</span>');
		escaped = escaped.replace(functionPattern, '<span class="token function">$1</span>');

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

// =============================================================================
// Java Highlighter
// =============================================================================
class JavaHighlighter implements HighlighterStrategy {
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
		const neutralizeInsideComment = (text: string): string =>
			text.replace(/__STR_\d+__/g, (ph) => rawByPlaceholder.get(ph) ?? ph);

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

// =============================================================================
// C++ Highlighter
// =============================================================================
class CppHighlighter implements HighlighterStrategy {
	highlight(code: string): string {
		let escaped = escapeHtml(code);

		const replacements = new Map<string, string>();
		let placeholderIndex = 0;

		// Comments
		const lineCommentRegex = /\/\/.*$/gm;
		const blockCommentRegex = /\/\*[\s\S]*?\*\//g;
		escaped = escaped.replace(lineCommentRegex, (match) => {
			const placeholder = `__COMMENT_${placeholderIndex++}__`;
			replacements.set(placeholder, `<span class="token comment">${match}</span>`);
			return placeholder;
		});
		escaped = escaped.replace(blockCommentRegex, (match) => {
			const placeholder = `__COMMENT_${placeholderIndex++}__`;
			replacements.set(placeholder, `<span class="token comment">${match}</span>`);
			return placeholder;
		});

		// Functions
		const functionRegex = /\b(main|printf|scanf|cout|cin|endl|malloc|free|strlen|strcpy|strcmp|sizeof)\b(?=\s*\()/g;
		escaped = escaped.replace(functionRegex, (_, func) => {
			const placeholder = `__FUNC_${placeholderIndex++}__`;
			replacements.set(placeholder, `<span class="token function">${func}</span>`);
			return placeholder;
		});

		// Keywords
		const keywordRegexA = /\b(auto|break|case|catch|class|const|continue|default|delete|do|else|enum|explicit|extern)\b/g;
		const keywordRegexB = /\b(false|for|friend|goto|if|inline|mutable|namespace|new|nullptr|operator|private)\b/g;
		const keywordRegexC = /\b(protected|public|register|return|sizeof|static|struct|switch|template|this|throw)\b/g;
		const keywordRegexD = /\b(true|try|typedef|typename|union|using|virtual|void|volatile|while)\b/g;
		[keywordRegexA, keywordRegexB, keywordRegexC, keywordRegexD].forEach((regex) => {
			escaped = escaped.replace(regex, (_, keyword) => {
				const placeholder = `__KEYWORD_${placeholderIndex++}__`;
				replacements.set(placeholder, `<span class="token keyword">${keyword}</span>`);
				return placeholder;
			});
		});

		// Types
		const typeRegex = /\b(bool|char|double|float|int|long|short|signed|unsigned|wchar_t|string|vector|map|set|list|queue|stack|array|pair)\b/g;
		escaped = escaped.replace(typeRegex, (_, type) => {
			const placeholder = `__TYPE_${placeholderIndex++}__`;
			replacements.set(placeholder, `<span class="token type">${type}</span>`);
			return placeholder;
		});

		// Preprocessor
		const preprocessorRegex = /^#include\b|^#define\b/gm;
		escaped = escaped.replace(preprocessorRegex, (match) => {
			const placeholder = `__PREPROC_${placeholderIndex++}__`;
			replacements.set(placeholder, `<span class="token preprocessor">${match}</span>`);
			return placeholder;
		});

		// Operators
		const operatorRegex = /(&lt;&lt;|&gt;&gt;|::)/g;
		escaped = escaped.replace(operatorRegex, (match) => {
			const placeholder = `__OP_${placeholderIndex++}__`;
			replacements.set(placeholder, `<span class="token operator">${match}</span>`);
			return placeholder;
		});

		// Restore placeholders
		for (const [placeholder, html] of replacements) {
			escaped = escaped.replace(placeholder, () => html);
		}

		return escaped;
	}
}

// =============================================================================
// Highlighter Registry
// =============================================================================
const strategies: Map<string, HighlighterStrategy> = new Map([
	["javascript", new JavaScriptHighlighter()],
	["js", new JavaScriptHighlighter()],
	["typescript", new TypeScriptHighlighter()],
	["ts", new TypeScriptHighlighter()],
	["python", new PythonHighlighter()],
	["py", new PythonHighlighter()],
	["java", new JavaHighlighter()],
	["cpp", new CppHighlighter()],
	["c++", new CppHighlighter()],
	["c", new CppHighlighter()],
]);

export function getHighlighter(language: string): HighlighterStrategy | undefined {
	return strategies.get(language.toLowerCase());
}
