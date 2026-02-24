import { HighlighterStrategy, escapeHtml } from "./types.js";
import { highlightJSFamily } from "./javascript.js";

const keywordPatternA = /\b(function|return|if|else|for|while|class|const|let|var|import|from|export|new|switch|case)\b/g;
const keywordPatternB = /\b(break|try|catch|finally|throw|interface|type|enum|implements|extends|private|public|protected|abstract)\b/g;
const typePattern = /\b(string|number|boolean|any|void|unknown|never|readonly)\b/g;
const functionPattern = /\b(?!if\b|for\b|while\b|switch\b|catch\b|new\b|__)([A-Za-z_]\w*)\s*(?=\()/g;

/** Applies TS-specific keyword, type and function token highlighting (with class/interface name protection) */
function applyTSTokenReplacements(input: string): string {
	let out = input;
	const protectedSpans: [string, string][] = [];
	let protIdx = 0;
	out = out.replaceAll(/\b(class|interface)\s+([A-Za-z_]\w*)/g, (_m: string, kw: string, name: string) => {
		const ph = `__CLSIFC_${protIdx++}__`;
		protectedSpans.push([ph, `<span class="token keyword">${kw}</span> <span class="token type">${name}</span>`]);
		return ph;
	});
	out = out.replace(keywordPatternA, '<span class="token keyword">$1</span>');
	out = out.replace(keywordPatternB, '<span class="token keyword">$1</span>');
	out = out.replace(typePattern, '<span class="token type">$1</span>');
	out = out.replace(functionPattern, '<span class="token function">$1</span>');
	for (const [ph, html] of protectedSpans) {
		out = out.replaceAll(ph, html);
	}
	return out;
}

/**
 * TypeScript syntax highlighter (extends JavaScript with TS-specific tokens)
 */
export class TypeScriptHighlighter implements HighlighterStrategy {
	highlight(code: string): string {
		return highlightJSFamily(escapeHtml(code), applyTSTokenReplacements, [
			{
				regex: /\bnew\s+([A-Za-z_]\w*)\s*(?=\(|&lt;)/g,
				replacer: (_match: string, className: string) =>
					`<span class="token keyword">new</span> <span class="token type">${className}</span>`,
			},
		]);
	}
}
