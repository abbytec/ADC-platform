import { Component, Prop, Event, EventEmitter } from "@stencil/core";

export interface SegmentedItem {
	value: string;
	label: string;
	/** Tag de un icono de la UI library (ej: "adc-icon-cursor"). Si falta, se muestra el label. */
	icon?: string;
}

/**
 * Switch segmentado (toggle de una sola selección): todas las opciones dentro de
 * un borde primary global; la activa va con fondo primary. Emite `adcChange` con el `value` elegido.
 *
 * Un item con `icon` ocupa un cuadrado; uno sin icono se ancha con su rótulo. Los segmentos eran
 * cuadrados siempre, y eso recortaba cualquier texto que no fueran dos letras — tres paneles
 * terminaron usando `adc-select` para un grupo de tres opciones por ese motivo.
 */
@Component({
	tag: "adc-segmented",
	shadow: false,
})
export class AdcSegmented {
	/** Opciones (array u objeto JSON serializado). */
	@Prop() items: SegmentedItem[] | string = [];
	/** Valor seleccionado. */
	@Prop() value: string = "";
	/** Alto de los segmentos: alineado con `adc-button` (`small` ≈ 36px). */
	@Prop() size: "small" | "normal" = "normal";

	@Event() adcChange!: EventEmitter<string>;

	private get parsed(): SegmentedItem[] {
		if (typeof this.items === "string") {
			try {
				return JSON.parse(this.items);
			} catch {
				return [];
			}
		}
		return this.items || [];
	}

	render() {
		const height = this.size === "small" ? "h-9" : "h-11";
		// Cuadrado para iconos; para texto, el ancho lo pone el rótulo y el mínimo evita que una
		// opción de una sola letra quede más angosta que sus vecinas.
		const square = this.size === "small" ? "w-9" : "w-11";
		const text = this.size === "small" ? "min-w-9 px-3" : "min-w-11 px-4";
		const iconSize = this.size === "small" ? "1.2rem" : "1.4rem";
		return (
			<div class="inline-flex items-center gap-0.5 rounded-full border-2 border-primary p-0.5" role="group">
				{this.parsed.map((it) => {
					const active = it.value === this.value;
					const Icon = it.icon as unknown as string;
					return (
						<button
							type="button"
							title={it.label}
							aria-label={it.label}
							aria-pressed={active ? "true" : "false"}
							class={`inline-flex ${height} ${it.icon ? square : text} cursor-pointer items-center justify-center rounded-full transition-colors ${
								active ? "bg-primary text-tprimary" : "text-text hover:bg-primary/10"
							}`}
							onClick={() => this.adcChange.emit(it.value)}
						>
							{it.icon ? <Icon size={iconSize} /> : <span class="font-text text-xs font-semibold whitespace-nowrap">{it.label}</span>}
						</button>
					);
				})}
			</div>
		);
	}
}
