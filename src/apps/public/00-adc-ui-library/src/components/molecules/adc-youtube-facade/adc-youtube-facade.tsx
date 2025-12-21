import { Component, Prop, State, h } from "@stencil/core";

/**
 * Componente YouTube Facade para carga perezosa de videos
 * Muestra una thumbnail clickeable en lugar de cargar el iframe inmediatamente
 * Mejora performance al evitar cargar el player de YouTube hasta que sea necesario
 */
@Component({
	tag: "adc-youtube-facade",
	shadow: false,
})
export class AdcYoutubeFacade {
	/** ID del video de YouTube (extraído de la URL) */
	@Prop() videoId!: string;

	/** Título del video para accesibilidad */
	@Prop() title: string = "Video de YouTube";

	/** Ancho del contenedor (opcional, por defecto responsive) */
	@Prop() width?: string;

	/** Alto del contenedor (opcional, por defecto responsive 16:9) */
	@Prop() height?: string;

	/** Estado que controla si el iframe está activo */
	@State() activated: boolean = false;

	/**
	 * Activa el iframe cuando el usuario hace click
	 */
	private activate = () => {
		this.activated = true;
	};

	/**
	 * Maneja el evento de teclado para accesibilidad
	 */
	private handleKeyPress = (event: KeyboardEvent) => {
		if (event.key === "Enter" || event.key === " ") {
			event.preventDefault();
			this.activate();
		}
	};

	render() {
		if (this.activated) {
			// Renderizar iframe cuando está activado
			return (
				<iframe
					width="560"
					height="315"
					src={`https://www.youtube.com/embed/${this.videoId}?autoplay=1`}
					title={this.title}
					allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
					allowFullScreen
					class="rounded-xxl max-w-full"
					loading="lazy"
				/>
			);
		}

		// URL de la thumbnail de YouTube (calidad hqdefault para consistencia con temp-ui)
		const thumbnailUrl = `https://i.ytimg.com/vi/${this.videoId}/hqdefault.jpg`;

		// Renderizar facade (thumbnail clickeable con dimensiones fijas 480x320)
		return (
			<div
				class="relative overflow-hidden cursor-pointer group mx-auto rounded-xxl shadow-cozy bg-gray-100"
				style={{ width: "480px", height: "320px" }}
				onClick={this.activate}
				onKeyPress={this.handleKeyPress}
				role="button"
				tabIndex={0}
				aria-label={`Reproducir video: ${this.title}`}
			>
				{/* Imagen de fondo (thumbnail) */}
				<img src={thumbnailUrl} alt={this.title} class="absolute inset-0 w-full h-full object-cover" loading="lazy" />

				{/* Overlay oscuro */}
				<span class="absolute inset-0 bg-black/30 group-hover:bg-black/20 transition-colors" />

				{/* Botón de play centrado */}
				<span class="absolute inset-0 flex items-center justify-center">
					<span class="inline-flex items-center justify-center h-16 w-16 rounded-full bg-primary/90 text-white shadow">
						{/* Ícono de play SVG */}
						<svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
							<path d="M8 5v14l11-7z" />
						</svg>
					</span>
				</span>
			</div>
		);
	}
}
