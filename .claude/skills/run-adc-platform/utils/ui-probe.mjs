// Sonda de layout que corre DENTRO de la página (via CDP) y devuelve hallazgos.
//
// Existe porque una captura de pantalla sólo sirve si alguien la mira y sabe qué buscar. Cada
// detector es la firma exacta de un bug que ya se nos escapó a producción:
//
//   overflow  -> algo se pasa del ancho del viewport (barra horizontal en móvil).
//   fragment  -> caja `display:inline` con borde/fondo partida en dos renglones: media píldora
//                arriba y media abajo. Fue el botón "Subir acá" del Drive.
//   overlap   -> un `absolute`/`fixed` encima de texto o de un enlace. Fue el QR del Data Fiscal
//                sobre los enlaces del pie.
//   touch     -> control interactivo por debajo de 44×44 en viewport chico (WCAG 2.5.5).
//   clipped   -> texto recortado sin `overflow` declarado. Ruidoso: va aparte, informativo.
//
// Todo es DOM puro: sin dependencias, sin instrumentar la app.

/** Expresión JS lista para `cdp.eval`. Devuelve `{overflow, fragment, overlap, touch, clipped}`. */
export const UI_PROBE = `(() => {
	const MIN_TOUCH = 44;
	// \`innerWidth\` NO sirve acá: bajo emulación móvil, cuando algo se pasa del ancho, Chrome
	// expande el viewport de layout y \`innerWidth\` pasa a valer lo que mide el contenido — o sea,
	// el desborde tapa su propia detección. \`clientWidth\` sigue siendo el ancho real del device.
	const vw = document.documentElement.clientWidth || window.innerWidth;
	const vh = document.documentElement.clientHeight || window.innerHeight;

	const describe = (el) => {
		const id = el.id ? "#" + el.id : "";
		const cls = (typeof el.className === "string" ? el.className : "").trim().split(/\\s+/).filter(Boolean).slice(0, 3).join(".");
		const text = (el.textContent || "").replace(/\\s+/g, " ").trim().slice(0, 40);
		return el.tagName.toLowerCase() + id + (cls ? "." + cls : "") + (text ? \` "\${text}"\` : "");
	};

	const all = Array.from(document.querySelectorAll("body *"));
	const visible = all.filter((el) => {
		const r = el.getBoundingClientRect();
		if (r.width === 0 || r.height === 0) return false;
		const s = getComputedStyle(el);
		return s.visibility !== "hidden" && s.display !== "none" && s.opacity !== "0";
	});

	// --- overflow horizontal -------------------------------------------------
	// Un ancestro que scrollea a lo ancho y entra en pantalla contiene el desborde: eso es el
	// patrón correcto para una tabla o una barra de tabs anchas, no un bug. Sólo importa lo que
	// termina empujando el ancho del documento.
	const containedByScroller = (el) => {
		for (let p = el.parentElement; p && p !== document.documentElement; p = p.parentElement) {
			const s = getComputedStyle(p);
			if (s.overflowX !== "auto" && s.overflowX !== "scroll" && s.overflowX !== "hidden") continue;
			const pr = p.getBoundingClientRect();
			if (pr.right <= vw + 1 && pr.left >= -1) return true;
		}
		return false;
	};

	const overflow = [];
	const docWidth = document.documentElement.scrollWidth;
	if (docWidth > vw + 1) {
		for (const el of visible) {
			const r = el.getBoundingClientRect();
			if (r.right <= vw + 1 && r.left >= -1) continue;
			// Sólo interesa el culpable más externo: si el padre ya se pasa, el hijo es consecuencia.
			if (el.parentElement && el.parentElement !== document.body) {
				const pr = el.parentElement.getBoundingClientRect();
				if (pr.right > vw + 1 || pr.left < -1) continue;
			}
			if (containedByScroller(el)) continue;
			overflow.push({ el: describe(el), right: Math.round(r.right), left: Math.round(r.left) });
		}
	}

	// --- cajas inline fragmentadas -------------------------------------------
	const fragment = [];
	for (const el of visible) {
		const s = getComputedStyle(el);
		if (s.display !== "inline") continue;
		const painted =
			s.borderTopWidth !== "0px" ||
			s.borderBottomWidth !== "0px" ||
			(s.backgroundColor !== "rgba(0, 0, 0, 0)" && s.backgroundColor !== "transparent") ||
			s.backgroundImage !== "none";
		if (!painted) continue;
		const rects = el.getClientRects();
		if (rects.length > 1) fragment.push({ el: describe(el), pieces: rects.length });
	}

	// --- solapamiento de elementos fuera de flujo ----------------------------
	const overlap = [];
	const outOfFlow = visible.filter((el) => {
		const s = getComputedStyle(el);
		if (s.position !== "absolute" && s.position !== "fixed") return false;
		// \`pointer-events: none\` es el marcador de "velo decorativo" (degradés a \`inset-0\` sobre una
		// sección). No intercepta clics y está por diseño encima de todo: contarlo llena el reporte
		// de ruido y esconde los solapamientos reales.
		return s.pointerEvents !== "none";
	});
	// Portadores de contenido: si algo out-of-flow los tapa, se pierde información.
	const carriers = visible.filter((el) => {
		if (!el.matches("a, button, input, label, p, h1, h2, h3, h4, li, span, td, th")) return false;
		return el.children.length === 0 && (el.textContent || "").trim().length > 0;
	});
	const related = (a, b) => a.contains(b) || b.contains(a);
	for (const el of outOfFlow) {
		const r = el.getBoundingClientRect();
		for (const c of carriers) {
			if (related(el, c)) continue;
			const cr = c.getBoundingClientRect();
			const ix = Math.min(r.right, cr.right) - Math.max(r.left, cr.left);
			const iy = Math.min(r.bottom, cr.bottom) - Math.max(r.top, cr.top);
			if (ix <= 1 || iy <= 1) continue;
			// Un overlay a pantalla completa (modal, backdrop) tapa todo a propósito.
			if (r.width >= vw * 0.9 && r.height >= vh * 0.9) continue;
			overlap.push({ over: describe(el), covers: describe(c), area: Math.round(ix * iy) });
		}
	}

	// --- touch targets --------------------------------------------------------
	const touch = [];
	if (vw <= 768) {
		for (const el of visible) {
			if (!el.matches('a[href], button, input:not([type="hidden"]), select, textarea, [role="button"], [role="link"], [role="menuitem"]')) continue;
			if (el.matches('input[type="checkbox"], input[type="radio"]')) continue; // excepción WCAG 2.5.8 documentada
			// Enlace dentro de una oración: WCAG 2.5.5 lo exceptúa explícitamente ("inline"), y
			// agrandarlo rompería el interlineado del párrafo que lo contiene.
			if (el.tagName === "A" && getComputedStyle(el).display === "inline") continue;
			const r = el.getBoundingClientRect();
			if (r.width >= MIN_TOUCH - 0.5 && r.height >= MIN_TOUCH - 0.5) continue;
			touch.push({ el: describe(el), size: Math.round(r.width) + "x" + Math.round(r.height) });
		}
	}

	// --- texto recortado ------------------------------------------------------
	const clipped = [];
	for (const el of visible) {
		if (el.children.length > 0 || !(el.textContent || "").trim()) continue;
		const s = getComputedStyle(el);
		if (s.overflow !== "visible" || s.textOverflow === "ellipsis") continue;
		if (el.scrollWidth > el.clientWidth + 1 && el.clientWidth > 0) {
			clipped.push({ el: describe(el), scroll: el.scrollWidth, client: el.clientWidth });
		}
	}

	const cap = (a, n) => a.slice(0, n);
	return {
		viewport: vw + "x" + vh,
		docWidth,
		overflow: cap(overflow, 10),
		fragment: cap(fragment, 10),
		overlap: cap(overlap, 10),
		touch: cap(touch, 15),
		clipped: cap(clipped, 10),
		truncated: {
			overflow: Math.max(0, overflow.length - 10),
			fragment: Math.max(0, fragment.length - 10),
			overlap: Math.max(0, overlap.length - 10),
			touch: Math.max(0, touch.length - 15),
			clipped: Math.max(0, clipped.length - 10),
		},
	};
})()`;

/**
 * Imprime el reporte. Devuelve la cantidad de hallazgos **bloqueantes** (todo menos `clipped`,
 * que es informativo porque un `scrollWidth` mayor también aparece en contenedores scrolleables
 * legítimos).
 */
export function reportUiFindings(result) {
	if (!result || typeof result !== "object") {
		console.log("ui-check: la sonda no devolvió nada (¿la página no cargó?)");
		return 0;
	}

	console.log(`ui-check @ ${result.viewport} (documento ${result.docWidth}px de ancho)`);

	const sections = [
		["overflow", "se pasan del viewport", (f) => `${f.el} → izq ${f.left}px, der ${f.right}px`],
		["fragment", "cajas inline partidas en varios renglones", (f) => `${f.el} → ${f.pieces} pedazos`],
		["overlap", "elementos fuera de flujo tapando contenido", (f) => `${f.over} tapa ${f.covers} (${f.area}px²)`],
		["touch", "controles por debajo de 44×44", (f) => `${f.el} → ${f.size}`],
	];

	let blocking = 0;
	for (const [key, title, fmt] of sections) {
		const items = result[key] ?? [];
		if (items.length === 0) continue;
		blocking += items.length;
		const extra = result.truncated?.[key] ? ` (+${result.truncated[key]} más)` : "";
		console.log(`\n✗ ${items.length} ${title}${extra}:`);
		for (const item of items) console.log(`    · ${fmt(item)}`);
	}

	const clipped = result.clipped ?? [];
	if (clipped.length > 0) {
		console.log(`\n· ${clipped.length} con texto recortado (informativo, puede ser un scroll legítimo):`);
		for (const item of clipped) console.log(`    · ${item.el} → ${item.scroll}px en ${item.client}px`);
	}

	if (blocking === 0) console.log("\n✓ sin overflow, cajas partidas, solapamientos ni targets chicos");
	return blocking;
}
