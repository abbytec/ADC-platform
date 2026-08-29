/**
 * Mantiene dentro de la pantalla un panel `position: absolute; right: 0` colgado de su
 * disparador (menú de apps, campana de notificaciones).
 *
 * En desktop el disparador está lo bastante a la derecha y el panel entra solo. En mobile el
 * header apila varios botones, así que el borde derecho de uno del medio queda a ~250px del
 * izquierdo: un panel más ancho que eso se sale por la izquierda y se ve recortado.
 *
 * Corre el panel hacia adentro con `right` negativo — no con `transform`, que lo volvería
 * bloque contenedor de cualquier descendiente `fixed` (ver utils/fixed-anchor.ts) — y nunca
 * más allá de lo que hay libre a la derecha, así el arreglo no lo recorta del otro lado.
 * Sigue siendo `absolute`, con lo que acompaña al header cuando éste se esconde al scrollear.
 */

/** Aire mínimo contra cada borde de la pantalla. */
const MARGIN = 8;

function clamp(anchor: HTMLElement, panel: HTMLElement): void {
	const viewport = window.innerWidth;

	// Un panel flexible se achica solo; uno de ancho fijo lo ignora y sólo lo salva el corrimiento.
	const maxWidth = `${Math.max(0, viewport - MARGIN * 2)}px`;
	if (panel.style.maxWidth !== maxWidth) panel.style.maxWidth = maxWidth;

	const anchorRight = anchor.getBoundingClientRect().right;
	const overflowLeft = MARGIN - (anchorRight - panel.offsetWidth);
	const room = Math.max(0, viewport - MARGIN - anchorRight);
	const shift = Math.min(Math.max(overflowLeft, 0), room);

	const right = shift > 0 ? `${-shift}px` : "";
	if (panel.style.right !== right) panel.style.right = right;
}

/**
 * Aplica el ajuste y lo mantiene al día. El `ResizeObserver` no es un lujo: el menú de
 * notificaciones es un módulo federado que monta asincrónico, así que su ancho recién existe
 * varios frames después de abrirlo.
 *
 * @returns Disposer; llamarlo al cerrar el panel o al desmontar el componente.
 */
export function trackPanelClamp(anchor: HTMLElement, panel: HTMLElement): () => void {
	let raf = 0;
	const update = () => {
		raf = 0;
		clamp(anchor, panel);
	};
	const schedule = () => {
		if (!raf) raf = requestAnimationFrame(update);
	};

	clamp(anchor, panel);
	const observer = new ResizeObserver(schedule);
	observer.observe(panel);
	window.addEventListener("resize", schedule);

	return () => {
		observer.disconnect();
		window.removeEventListener("resize", schedule);
		if (raf) cancelAnimationFrame(raf);
	};
}
