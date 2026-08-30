#!/usr/bin/env bun
/**
 * Guard-rail de UI: caza los defectos que no rompen el build ni el typecheck.
 *
 * Las tres reglas salen de bugs reales, y ninguna introduce una fuente de verdad nueva:
 *
 *  A. Clases Tailwind con unidad y sin corchetes (`max-w-70vw`). Tailwind v4 acepta bare values,
 *     pero como **números contra `--spacing`**: con unidad hace falta `max-w-[70vw]`. La forma sin
 *     corchetes no genera ninguna regla y falla en silencio — así el QR del Data Fiscal terminó
 *     encima de los enlaces del pie.
 *  B. Colores crudos de la paleta de Tailwind (`text-green-500`) donde va un token temable. Son
 *     fijos en ambos temas, así que desentonan en claro y se rompen en oscuro.
 *  C. Enlaces cross-app a subdominios o ids de app que no existen (`planes.adigitalcafe.com`).
 *     Sólo fallan en producción, porque en dev todo resuelve contra `localhost:<devPort>`.
 *  D. Tokens semánticos de FONDO usados como color de texto (`text-danger`). `--c-danger` y
 *     compañía son fondos pálidos en tema claro y oscuros en tema oscuro, así que como texto dan
 *     ~1.0 de contraste en AMBOS temas: invisibles. El de texto es el par `t*` (`text-tdanger`,
 *     medido en 7.9 y 12.2). Así estuvieron mudos los errores de validación de los formularios.
 *
 * Uso: `bun scripts/ui-check.ts [--with-css]`  (va dentro de `bun run extra-checks`)
 *
 * `--with-css` suma el cruce exhaustivo contra el CSS que el compilador realmente emitió en
 * `temp/ui-builds`: marca TODA clase que no generó regla, no sólo el patrón de la regla A. Es el
 * método con el que se confirmó el bug del pie, pero necesita un `bun run build:ui` fresco y lee
 * artefactos de build, así que va detrás de un flag y nunca por defecto.
 *
 * Escape hatch: una línea con `ui-check-ignore` se saltea entera. Es inline y no una allowlist
 * central a propósito — la excepción se explica al lado del código que la necesita.
 */

import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import path from "node:path";

const ROOT = path.join(import.meta.dir, "..");
const WITH_CSS = process.argv.includes("--with-css");

interface Finding {
	file: string;
	line: number;
	rule: "A" | "B" | "C" | "D" | "E";
	message: string;
}

const findings: Finding[] = [];
const notes: string[] = [];

/* ------------------------------------------------------------------ recorrido de archivos */

const SKIP_DIRS = new Set(["node_modules", "dist", "dist-ui", "temp", ".git", "www", "loader", "collection", ".stencil", "coverage"]);

/** Generados y gitignored: no son fuente y su contenido no lo decide nadie. */
const SKIP_FILES = [/[\\/]utils[\\/]react-jsx\.ts$/, /[\\/]components\.d\.ts$/, /public-env\.generated\.ts$/];

function walk(dir: string, out: string[] = []): string[] {
	let entries;
	try {
		entries = readdirSync(dir, { withFileTypes: true });
	} catch {
		return out; // preset ausente en un clon parcial
	}
	for (const entry of entries) {
		const full = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			if (!SKIP_DIRS.has(entry.name)) walk(full, out);
			continue;
		}
		if (!/\.tsx?$/.test(entry.name)) continue;
		if (SKIP_FILES.some((re) => re.test(full))) continue;
		out.push(full);
	}
	return out;
}

const sourceFiles = [...walk(path.join(ROOT, "src")), ...walk(path.join(ROOT, "presets"))];

/**
 * `src/apps/test/**` son probes de bundler (vite, astro, layouts de prueba): no consumen la UI
 * library ni el preset de Tailwind, así que juzgarles las clases no dice nada. La regla C sí las
 * mira: un subdominio mal escrito rompe igual.
 */
const isProbe = (file: string) => file.includes(`${path.sep}apps${path.sep}test${path.sep}`);
const styledFiles = sourceFiles.filter((f) => !isProbe(f));

const rel = (file: string) => path.relative(ROOT, file);
const lineOf = (src: string, index: number) => src.slice(0, index).split("\n").length;
const lineText = (src: string, index: number) => src.split("\n")[lineOf(src, index) - 1] ?? "";
/** `ui-check-ignore` vale en la línea misma o en la anterior: en JSX el atributo suele ir solo. */
function ignored(src: string, index: number): boolean {
	const lines = src.split("\n");
	const n = lineOf(src, index);
	return (lines[n - 1] ?? "").includes("ui-check-ignore") || (lines[n - 2] ?? "").includes("ui-check-ignore");
}

/* ------------------------------------------------------ extracción de listas de clases */

/** Lee un literal delimitado desde `i` (que apunta a la comilla/backtick). Devuelve fin exclusivo. */
function endOfLiteral(src: string, i: number): number {
	const quote = src[i];
	for (let j = i + 1; j < src.length; j++) {
		if (src[j] === "\\") {
			j++;
			continue;
		}
		if (src[j] === quote) return j;
	}
	return src.length;
}

/**
 * Las listas de clases aparecen como `class="…"`, `className={`…`}` y, en los componentes Stencil,
 * como constantes (`const baseClass = "…"`). Se recorren los tres casos y de las formas con llaves
 * se extraen todos los literales que haya adentro (las interpolaciones `${…}` quedan afuera solas).
 */
function classLiterals(src: string): { value: string; index: number }[] {
	const out: { value: string; index: number }[] = [];
	const anchors = /(?:\bclass(?:Name)?\s*=\s*)|(?:\bconst\s+\w*[Cc]lass\w*\s*=\s*)/g;

	for (const match of src.matchAll(anchors)) {
		let i = (match.index ?? 0) + match[0].length;
		if (i >= src.length) continue;

		if (src[i] === '"' || src[i] === "'" || src[i] === "`") {
			const end = endOfLiteral(src, i);
			out.push({ value: src.slice(i + 1, end), index: i + 1 });
			continue;
		}
		if (src[i] !== "{") continue;

		// Expresión: recorrer hasta cerrar la llave y juntar todos los literales de adentro.
		let depth = 0;
		for (; i < src.length; i++) {
			const c = src[i];
			if (c === "{") depth++;
			else if (c === "}") {
				if (--depth === 0) break;
			} else if (c === '"' || c === "'" || c === "`") {
				const end = endOfLiteral(src, i);
				out.push({ value: src.slice(i + 1, end), index: i + 1 });
				i = end;
			}
		}
	}
	return out;
}

/** Trocea una lista de clases en tokens, ignorando las interpolaciones. */
function tokensOf(value: string): string[] {
	return value
		.replace(/\$\{[^}]*\}/g, " ")
		.split(/\s+/)
		.filter(Boolean);
}

/** Saca el prefijo de variantes (`sm:`, `hover:`, `dark:`…) y el `!` de importante. */
function baseUtility(token: string): string {
	const withoutVariants = token.slice(token.lastIndexOf(":") + 1);
	return withoutVariants.replace(/^!/, "").replace(/\/\d+$/, ""); // `/50` = opacidad
}

/* ------------------------------------------------------------- Regla A: unidad sin corchetes */

const UNIT_WITHOUT_BRACKETS = /^-?[a-z][a-z-]*-\d+(?:\.\d+)?(vw|vh|vmin|vmax|px|rem|em|ch|ex|pt|cm|mm|in|%)$/;

function checkArbitraryValues(file: string, src: string) {
	for (const literal of classLiterals(src)) {
		if (ignored(src, literal.index)) continue;
		for (const token of tokensOf(literal.value)) {
			const base = baseUtility(token);
			const match = UNIT_WITHOUT_BRACKETS.exec(base);
			if (!match) continue;

			const prefix = base.slice(0, base.lastIndexOf("-"));
			const value = base.slice(base.lastIndexOf("-") + 1);
			findings.push({
				file,
				line: lineOf(src, literal.index),
				rule: "A",
				message:
					`\`${token}\` no genera ninguna regla CSS: Tailwind v4 sólo acepta bare values numéricos ` +
					`(contra \`--spacing\`), no con unidad. Va \`${prefix}-[${value}]\`. ` +
					`Ojo: \`${prefix}-${value.replace(match[1], "")}\` compila pero significa otra cosa.`,
			});
		}
	}
}

/* ------------------------------------------------------------------- Regla B: colores crudos */

const RAW_COLOR =
	/^(text|bg|border|ring|fill|stroke|from|via|to|decoration|outline|divide|accent|caret|shadow)-(red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|slate|gray|zinc|neutral|stone)-\d{2,3}$/;

/** Token temable sugerido por familia de color. */
const TOKEN_HINT: Record<string, string> = {
	red: "`danger`/`tdanger`",
	rose: "`danger`/`tdanger`",
	pink: "`danger`/`tdanger`",
	orange: "`warn`/`twarn` (o `accentorange`)",
	amber: "`warn`/`twarn`",
	yellow: "`warn`/`twarn`",
	lime: "`success`/`tsuccess`",
	green: "`success`/`tsuccess` (o `accentgreen` para acento decorativo)",
	emerald: "`success`/`tsuccess`",
	teal: "`success`/`tsuccess`",
	cyan: "`info`/`tinfo` (o `accentcyan`)",
	sky: "`info`/`tinfo`",
	blue: "`info`/`tinfo`",
	indigo: "`info`/`tinfo`",
	violet: "`accentpurple`",
	purple: "`accentpurple`",
	fuchsia: "`accentpurple`",
	slate: "`muted`/`text`/`surface`/`divider`",
	gray: "`muted`/`text`/`surface`/`divider`",
	zinc: "`muted`/`text`/`surface`/`divider`",
	neutral: "`muted`/`text`/`surface`/`divider`",
	stone: "`muted`/`text`/`surface`/`divider`",
};

function checkRawColors(file: string, src: string) {
	for (const literal of classLiterals(src)) {
		if (ignored(src, literal.index)) continue;
		for (const token of tokensOf(literal.value)) {
			const match = RAW_COLOR.exec(baseUtility(token));
			if (!match) continue;
			findings.push({
				file,
				line: lineOf(src, literal.index),
				rule: "B",
				message:
					`\`${token}\` es un color crudo de Tailwind: fijo en ambos temas y ajeno a la paleta. ` +
					`Usar el token ${TOKEN_HINT[match[2]] ?? "semántico correspondiente"} ` +
					`(o consumirlo vía \`adc-badge\`/\`adc-callout\`).`,
			});
		}
	}
}

/* ------------------------------------------------- Regla D: token de fondo como color de texto */

const SEMANTIC = ["danger", "warn", "success", "info"] as const;

function checkSemanticTextTokens(file: string, src: string) {
	for (const literal of classLiterals(src)) {
		if (ignored(src, literal.index)) continue;
		const tokens = tokensOf(literal.value);
		for (const token of tokens) {
			const base = baseUtility(token);
			const semantic = SEMANTIC.find((s) => base === `text-${s}`);
			if (!semantic) continue;
			// Inversión legítima: fondo fuerte + texto pálido en el MISMO elemento (un botón de
			// peligro relleno, un aviso sobre `bg-twarn`). Ahí el contraste existe y va al revés.
			if (tokens.some((t) => baseUtility(t) === `bg-t${semantic}`)) continue;
			findings.push({
				file,
				line: lineOf(src, literal.index),
				rule: "D",
				message:
					`\`${token}\`: \`--c-${semantic}\` es un token de **fondo** (pálido en claro, oscuro en oscuro). ` +
					`Como color de texto queda en ~1.0 de contraste en los dos temas. Va \`text-t${semantic}\`, ` +
					`salvo que el mismo elemento pinte \`bg-t${semantic}\` (ahí la inversión es correcta).`,
			});
		}
	}
}

/* ------------------------------------------------ Regla E: alias de color que no existe */

/**
 * Nombres que suenan a token de la paleta y no lo son. La regla A no los ve: sólo juzga clases con
 * valor numérico, porque un nombre suelto puede ser una clase propia de `@layer components`. Estos
 * están enumerados justamente porque no lo son — el build no emite nada y el elemento hereda el
 * color de arriba, que es un fallo mudo.
 */
const DEAD_ALIASES: Record<string, string> = {
	warning: "warn (fondo) / twarn (texto)",
	twarning: "twarn",
	error: "danger (fondo) / tdanger (texto)",
	terror: "tdanger",
	"surface-2": "surface",
	"surface-hover": "surface (o `hover:bg-text/5`)",
};

const COLOR_PREFIXES = ["text", "bg", "border", "ring", "fill", "stroke", "decoration", "outline", "shadow", "from", "via", "to"];

function checkDeadAliases(file: string, src: string) {
	for (const literal of classLiterals(src)) {
		if (ignored(src, literal.index)) continue;
		for (const token of tokensOf(literal.value)) {
			const base = baseUtility(token);
			for (const prefix of COLOR_PREFIXES) {
				if (!base.startsWith(`${prefix}-`)) continue;
				// El `/opacity` de Tailwind no cambia si el color existe.
				const alias = base.slice(prefix.length + 1).split("/")[0];
				const replacement = DEAD_ALIASES[alias];
				if (!replacement) continue;
				findings.push({
					file,
					line: lineOf(src, literal.index),
					rule: "E",
					message:
						`\`${token}\`: \`${alias}\` no existe en la paleta, así que el build no emite ninguna regla y ` +
						`el elemento hereda el color de su contenedor sin avisar. Va \`${replacement}\`.`,
				});
			}
		}
	}
}

/* --------------------------------------------------------------- Regla C: enlaces cross-app */

interface DeclaredApp {
	name: string;
	devPort?: number;
	subdomains: string[];
	configPath: string;
}

/** Lee los `config.json` con `uiModule`, que es lo que el kernel registra como vhost. */
function declaredApps(): DeclaredApp[] {
	const roots = [path.join(ROOT, "src", "apps"), path.join(ROOT, "presets")];
	const apps: DeclaredApp[] = [];

	const visit = (dir: string, depth: number) => {
		if (depth > 4) return;
		let entries;
		try {
			entries = readdirSync(dir, { withFileTypes: true });
		} catch {
			return;
		}
		for (const entry of entries) {
			if (!entry.isDirectory() || SKIP_DIRS.has(entry.name)) continue;
			const full = path.join(dir, entry.name);
			const config = path.join(full, "config.json");
			if (existsSync(config)) {
				try {
					const parsed = JSON.parse(readFileSync(config, "utf8"));
					const ui = parsed.uiModule;
					if (ui) {
						apps.push({
							name: ui.name ?? entry.name,
							devPort: typeof ui.devPort === "number" ? ui.devPort : undefined,
							subdomains: (ui.hosting ?? []).flatMap((h: { subdomains?: string[] }) => h.subdomains ?? []),
							configPath: rel(config),
						});
					}
				} catch {
					notes.push(`No se pudo parsear ${rel(config)}.`);
				}
			}
			visit(full, depth + 1);
		}
	};

	for (const root of roots) visit(root, 0);
	return apps;
}

const PLATFORM_LINKS = path.join(ROOT, "src/apps/public/00-adc-ui-library/utils/platform-links.ts");

/** Registro que consume el front (`DEFAULT_APPS`), leído por texto para no ejecutar el módulo. */
function registryApps(): { id: string; devPort?: number; subdomain: string; prodHostname?: string }[] {
	if (!existsSync(PLATFORM_LINKS)) return [];
	const src = readFileSync(PLATFORM_LINKS, "utf8");
	const block = /const DEFAULT_APPS[^=]*=\s*\[([\s\S]*?)\n\];/.exec(src);
	if (!block) {
		notes.push("No se pudo localizar `DEFAULT_APPS` en platform-links.ts (¿cambió la forma?).");
		return [];
	}
	const out: { id: string; devPort?: number; subdomain: string; prodHostname?: string }[] = [];
	for (const entry of block[1].split(/\},\s*\{|\},\s*$/)) {
		const id = /\bid:\s*"([^"]*)"/.exec(entry);
		if (!id) continue;
		const port = /\bdevPort:\s*(\d+)/.exec(entry);
		const sub = /\bsubdomain:\s*"([^"]*)"/.exec(entry);
		const prod = /\bprodHostname:\s*([A-Z_]+|"[^"]*")/.exec(entry);
		out.push({
			id: id[1],
			devPort: port ? Number(port[1]) : undefined,
			subdomain: sub ? sub[1] : "",
			prodHostname: prod ? prod[1].replaceAll('"', "") : undefined,
		});
	}
	return out;
}

function baseDomain(): string {
	if (!existsSync(PLATFORM_LINKS)) return "adigitalcafe.com";
	const match = /PROD_BASE_DOMAIN\s*=\s*"([^"]+)"/.exec(readFileSync(PLATFORM_LINKS, "utf8"));
	return match ? match[1] : "adigitalcafe.com";
}

function checkCrossAppLinks() {
	const apps = declaredApps();
	const registry = registryApps();
	const domain = baseDomain();

	const validSubdomains = new Set(apps.flatMap((a) => a.subdomains).filter((s) => s && s !== "*"));
	const portOfSubdomain = new Map<string, number>();
	for (const app of apps) {
		for (const sub of app.subdomains) if (app.devPort) portOfSubdomain.set(sub, app.devPort);
	}
	const registryIds = new Set(registry.map((r) => r.id));

	// El apex (home) no tiene subdominio: se referencia por `prodHostname`.
	const apexHosts = new Set(registry.filter((r) => !r.subdomain && r.prodHostname).map(() => domain));

	const hostLiteral = new RegExp(String.raw`"([a-z0-9-]*)\.?${domain.replaceAll(".", "\\.")}"`, "g");

	for (const file of sourceFiles) {
		const src = readFileSync(file, "utf8");

		// C.1 — cualquier host de la plataforma escrito a mano.
		for (const match of src.matchAll(hostLiteral)) {
			const index = match.index ?? 0;
			if (ignored(src, index)) continue;
			const sub = match[1];
			if (!sub) {
				if (!apexHosts.has(domain)) continue;
				continue; // el apex es válido
			}
			if (validSubdomains.has(sub)) continue;
			const suggestion = [...validSubdomains].sort().join(", ");
			findings.push({
				file,
				line: lineOf(src, index),
				rule: "C",
				message:
					`El subdominio \`${sub}\` no está declarado en ningún \`config.json\` (\`uiModule.hosting\`), ` +
					`así que en producción no resuelve. Mejor no escribir el host: usar ` +
					`\`resolvePlatformPath("<id>", path)\` de \`@ui-library/utils/platform-links\`. ` +
					`Declarados: ${suggestion}.`,
			});
		}

		// C.2 — `getUrl(<port>, "<host>")` con literales: el puerto tiene que ser el de ese subdominio.
		for (const match of src.matchAll(/getUrl\(\s*(\d+)\s*,\s*"([a-z0-9-]+)\.[^"]+"/g)) {
			const index = match.index ?? 0;
			if (ignored(src, index)) continue;
			const port = Number(match[1]);
			const sub = match[2];
			const expected = portOfSubdomain.get(sub);
			if (expected === undefined || expected === port) continue;
			findings.push({
				file,
				line: lineOf(src, index),
				rule: "C",
				message: `\`getUrl(${port}, "${sub}.…")\`: el subdominio \`${sub}\` corre en el puerto ${expected} en dev.`,
			});
		}

		// C.3 — ids del registro usados por nombre.
		for (const match of src.matchAll(/\b(?:resolvePlatformPath|getPlatformApp)\(\s*"([^"]+)"/g)) {
			const index = match.index ?? 0;
			if (ignored(src, index)) continue;
			if (registryIds.has(match[1])) continue;
			findings.push({
				file,
				line: lineOf(src, index),
				rule: "C",
				message:
					`\`"${match[1]}"\` no es un id de \`DEFAULT_APPS\`, así que la llamada devuelve \`null\` **siempre** ` +
					`y el enlace nunca se renderiza. Ids válidos: ${[...registryIds].sort((a, b) => a.localeCompare(b)).join(", ")}.`,
			});
		}
	}

	// C.4 — deriva del registro del front respecto de los `config.json`.
	for (const entry of registry) {
		if (!entry.subdomain) continue; // apex
		const app = apps.find((a) => a.subdomains.includes(entry.subdomain));
		if (!app) {
			findings.push({
				file: PLATFORM_LINKS,
				line: 1,
				rule: "C",
				message: `\`DEFAULT_APPS["${entry.id}"]\` apunta al subdominio \`${entry.subdomain}\`, que ningún \`config.json\` declara.`,
			});
			continue;
		}
		if (entry.devPort && app.devPort && entry.devPort !== app.devPort) {
			findings.push({
				file: PLATFORM_LINKS,
				line: 1,
				rule: "C",
				message: `\`DEFAULT_APPS["${entry.id}"].devPort\` es ${entry.devPort} pero ${app.configPath} declara ${app.devPort}.`,
			});
		}
	}

	// C.5 — ports.csv, que es lo que leen el driver de la skill y `bun run cleanup`.
	const portsCsv = path.join(ROOT, "docs/guides/ports.csv");
	if (existsSync(portsCsv)) {
		const declared = new Map<number, string>();
		for (const line of readFileSync(portsCsv, "utf8").split("\n")) {
			if (!line.trim() || line.startsWith("#") || line.startsWith("port,")) continue;
			const [port, app] = line.split(",");
			if (port && app) declared.set(Number(port), app.trim());
		}
		for (const app of apps) {
			if (!app.devPort) continue;
			if (!declared.has(app.devPort)) {
				findings.push({
					file: portsCsv,
					line: 1,
					rule: "C",
					message: `El puerto ${app.devPort} (${app.name}) no está en ports.csv, que es la fuente única de puertos.`,
				});
			}
		}
	}

	notes.push(
		`Apps con \`uiModule\`: ${apps.length} · subdominios declarados: ${validSubdomains.size} · ids en \`DEFAULT_APPS\`: ${registryIds.size}.`
	);
}

/* ------------------------------------------------- Modo profundo: cruce contra el CSS emitido */

function checkAgainstEmittedCss() {
	const buildsDir = path.join(ROOT, "temp/ui-builds");
	if (!existsSync(buildsDir)) {
		notes.push("`--with-css`: no hay `temp/ui-builds`. Correr `bun run build:ui` primero.");
		return;
	}

	// Todo lo que el compilador emitió, sin importar en qué chunk quedó.
	const emitted = new Set<string>();
	let newest = 0;
	const collect = (dir: string) => {
		let entries;
		try {
			entries = readdirSync(dir, { withFileTypes: true });
		} catch {
			return;
		}
		for (const entry of entries) {
			const full = path.join(dir, entry.name);
			if (entry.isDirectory()) {
				collect(full);
				continue;
			}
			if (!/\.(css|js)$/.test(entry.name)) continue;
			newest = Math.max(newest, statSync(full).mtimeMs);
			const content = readFileSync(full, "utf8");
			for (const match of content.matchAll(/\.((?:\\.|[-\w])+)\s*(?=[{,:])/g)) {
				emitted.add(match[1].replaceAll("\\", ""));
			}
		}
	};
	collect(buildsDir);

	if (emitted.size === 0) {
		notes.push("`--with-css`: no se encontró CSS emitido en `temp/ui-builds`.");
		return;
	}
	notes.push(
		`\`--with-css\`: ${emitted.size} selectores emitidos, build más reciente ${new Date(newest).toISOString().slice(0, 16).replace("T", " ")}.`
	);

	for (const file of sourceFiles) {
		const src = readFileSync(file, "utf8");
		for (const literal of classLiterals(src)) {
			if (ignored(src, literal.index)) continue;
			for (const token of tokensOf(literal.value)) {
				const base = baseUtility(token);
				// Sólo se juzga lo que parece una utilidad con valor: lo demás puede ser una clase
				// propia de `@layer components` o una clase de un tercero.
				if (!/-\d/.test(base) && !/\[/.test(base)) continue;
				if (emitted.has(base) || emitted.has(token)) continue;
				if (UNIT_WITHOUT_BRACKETS.test(base)) continue; // ya lo reportó la regla A
				findings.push({
					file,
					line: lineOf(src, literal.index),
					rule: "A",
					message: `\`${token}\`: el build no emitió ninguna regla para esta clase.`,
				});
			}
		}
	}
}

/* --------------------------------------------------------------------------------- baseline */

/**
 * Los colores crudos que ya estaban cuando se escribió el check. Bloquear los ~15 de golpe habría
 * significado rediseñar componentes ajenos al cambio que lo destapó, así que se congelan: **lo
 * nuevo falla, lo viejo queda listado** para ir bajándolo. Misma lógica que el baseline de knip.
 *
 * La clave es archivo + clase (no la línea, que se mueve con cualquier edición). Efecto lateral
 * asumido: reintroducir esa misma clase en otro punto del mismo archivo no se detecta.
 */
const BASELINE_PATH = path.join(ROOT, "scripts/ui-check-baseline.json");

function loadBaseline(): Set<string> {
	if (!existsSync(BASELINE_PATH)) return new Set();
	try {
		return new Set(JSON.parse(readFileSync(BASELINE_PATH, "utf8")).rawColors ?? []);
	} catch {
		notes.push("No se pudo leer el baseline: se juzga todo como nuevo.");
		return new Set();
	}
}

const baselineKey = (f: Finding) => `${rel(f.file)}::${/`([^`]+)`/.exec(f.message)?.[1] ?? ""}`;

/* ------------------------------------------------------------------------------- ejecución */

for (const file of styledFiles) {
	const src = readFileSync(file, "utf8");
	checkArbitraryValues(file, src);
	checkRawColors(file, src);
	checkSemanticTextTokens(file, src);
	checkDeadAliases(file, src);
}
checkCrossAppLinks();
if (WITH_CSS) checkAgainstEmittedCss();

const baseline = loadBaseline();
const known = findings.filter((f) => f.rule === "B" && baseline.has(baselineKey(f)));
const blocking = findings.filter((f) => !(f.rule === "B" && baseline.has(baselineKey(f))));

console.log(
	`🔎 UI verificada: ${styledFiles.length} archivos con estilos (+${sourceFiles.length - styledFiles.length} probes sólo para enlaces).`
);
for (const note of notes) console.log(`   ${note}`);
if (known.length > 0) {
	console.log(
		`   ${known.length} color(es) crudo(s) en el baseline (\`scripts/ui-check-baseline.json\`): no bloquean, conviene ir bajándolos.`
	);
}

if (blocking.length === 0) {
	console.log("\n✅ Sin clases muertas, alias inexistentes, enlaces cross-app rotos, tokens invisibles ni colores crudos nuevos.");
	process.exit(0);
}

const RULE_TITLES: Record<Finding["rule"], string> = {
	A: "Clases que no generan CSS",
	B: "Colores crudos en vez de tokens",
	C: "Enlaces cross-app rotos",
	D: "Token de fondo usado como color de texto (invisible)",
	E: "Alias de color inexistente (el build no emite nada)",
};

console.error("");
for (const rule of ["C", "D", "E", "A", "B"] as const) {
	const group = blocking.filter((f) => f.rule === rule);
	if (group.length === 0) continue;
	console.error(`❌ ${RULE_TITLES[rule]} (${group.length}):\n`);
	for (const finding of group) {
		console.error(`  · ${rel(finding.file)}:${finding.line}`);
		console.error(`    ${finding.message}\n`);
	}
}
console.error(`Total: ${blocking.length}. Una línea con \`ui-check-ignore\` se saltea (explicá por qué al lado).`);
process.exit(1);
