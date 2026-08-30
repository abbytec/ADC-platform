import { Component, Prop, State, Element, Host } from "@stencil/core";

let inputUid = 0;

/**
 * Rótulo del botón de revelar. Va con tabla de fallback y no sólo con `t()` porque el átomo puede
 * renderizarse antes de que el cliente i18n esté listo — mismo criterio que `adc-site-footer`.
 */
const REVEAL_LABELS = {
	es: { show: "Mostrar contraseña", hide: "Ocultar contraseña" },
	en: { show: "Show password", hide: "Hide password" },
};

interface ADCGlobal {
	t?: (key: string, params?: Record<string, string> | null, namespace?: string) => string;
	getLocale?: () => string;
}

const adcI18n = globalThis as typeof globalThis & ADCGlobal;

function revealLabel(revealed: boolean): string {
	const key = revealed ? "hide" : "show";
	const translationKey = `input.${revealed ? "hidePassword" : "showPassword"}`;
	const translated = adcI18n.t?.(translationKey, null, "adc-ui-library");
	if (translated && translated !== translationKey) return translated;

	const language = (adcI18n.getLocale?.() || globalThis.document?.documentElement?.lang || "").toLowerCase();
	return REVEAL_LABELS[language.startsWith("en") ? "en" : "es"][key];
}

@Component({
	tag: "adc-input",
	shadow: false,
})
export class AdcInput {
	@Element() el!: HTMLElement;

	@Prop() value: string = "";
	@Prop() placeholder?: string = "";
	@Prop() inputId?: string = "";
	@Prop() name?: string = "";
	@Prop() type?: string = "text";
	@Prop() autocomplete?: string = "off";
	@Prop() ariaLabel?: string = "";
	@Prop() disabled?: boolean = false;
	/** Cantidad máxima de caracteres. */
	@Prop() maxLength?: number;
	/** Cantidad mínima de caracteres. Sólo valida al enviar el formulario, como el atributo nativo. */
	@Prop() minLength?: number;
	/** Mínimo / máximo / paso (para `type="number"`). */
	@Prop() min?: number | string;
	@Prop() max?: number | string;
	@Prop() step?: number | string;
	/** Marca el campo como requerido en su formulario. */
	@Prop() required?: boolean = false;
	/** Campo de solo lectura. */
	@Prop() readOnly?: boolean = false;
	/** Foca el input al montar (equivalente al `autoFocus` de un input nativo). */
	@Prop() autoFocus?: boolean = false;
	/** Sugerencia de teclado virtual en móvil (`numeric`, `email`, …). */
	@Prop() inputMode?: string;
	/** Patrón de validación HTML. */
	@Prop() pattern?: string;
	/** Mensaje de error inline; activa el estado inválido (borde danger + aria-invalid). */
	@Prop() error?: string;
	/** Marca el campo como inválido sin texto (borde danger + aria-invalid). */
	@Prop() invalid?: boolean = false;
	/** Mensaje de éxito inline (borde success). Se ignora si hay `error`. */
	@Prop() success?: string;
	/** Texto de ayuda neutro bajo el campo. Se ignora si hay `error`/`success`. */
	@Prop() hint?: string;
	/** Ojo para mostrar/ocultar el valor. Sólo tiene efecto con `type="password"`. */
	@Prop() revealToggle?: boolean = false;

	@State() private revealed = false;

	private readonly uid = `adc-input-${inputUid++}`;

	componentDidLoad() {
		// `autofocus` nativo no dispara en elementos insertados por script: lo hacemos a mano.
		if (this.autoFocus) this.el.querySelector("input")?.focus();
	}

	private get isInvalid(): boolean {
		return this.invalid || !!this.error;
	}

	private get messageId(): string | undefined {
		if (!this.error && !this.success && !this.hint) return undefined;
		return `${this.inputId || this.name || this.uid}-msg`;
	}

	private get hasReveal(): boolean {
		return !!this.revealToggle && this.type === "password";
	}

	/**
	 * El ojo va DENTRO del campo, absoluto sobre él. No se usa `adc-button` a propósito: su `small`
	 * ya mide 36px y con el mínimo táctil de `accessibility.css` no entra en un campo de 44px sin
	 * desbordarlo. El ancho y el `pr` del campo van en **px y no en la escala de spacing**: el
	 * `--spacing` de la plataforma es 3.25px (el root font-size no es 16), así que `w-11`/`pr-11`
	 * daban 35.75px mientras `accessibility.css` inflaba el botón a 44 y el texto se le metía debajo.
	 */
	private renderRevealButton() {
		const label = revealLabel(this.revealed);
		return (
			<button
				type="button"
				class="absolute inset-y-0 right-0 grid w-11 place-items-center text-muted hover:text-text disabled:opacity-50"
				aria-label={label}
				aria-pressed={this.revealed ? "true" : "false"}
				title={label}
				disabled={this.disabled}
				onClick={() => (this.revealed = !this.revealed)}
			>
				<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						d="M2.036 12.322a1 1 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178a1 1 0 0 1 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.964-7.178Z"
					/>
					<circle cx="12" cy="12" r="3" />
					{this.revealed && <path stroke-linecap="round" d="M3 3l18 18" />}
				</svg>
			</button>
		);
	}

	private borderClass(): string {
		if (this.isInvalid) return "border-danger";
		if (this.success) return "border-success";
		return "border-text/15";
	}

	private renderMessage(messageId: string | undefined) {
		if (this.error) {
			return (
				<span id={messageId} role="alert" class="mt-1 block font-text text-[11px] text-tdanger">
					{this.error}
				</span>
			);
		}
		if (this.success) {
			return (
				<span id={messageId} class="mt-1 block font-text text-[11px] text-tsuccess">
					{this.success}
				</span>
			);
		}
		if (this.hint) {
			return (
				<span id={messageId} class="mt-1 block font-text text-[11px] text-muted">
					{this.hint}
				</span>
			);
		}
		return null;
	}

	render() {
		const messageId = this.messageId;
		const reveal = this.hasReveal;
		// El envoltorio va acá y no en el `<Host>`: el mensaje de error/hint también cuelga del host,
		// y anclando ahí el botón quedaría centrado respecto del conjunto y no del campo.
		return (
			<Host class="block">
				<div class="relative flex items-center">
					<input
						id={this.inputId}
						value={this.value}
						placeholder={this.placeholder}
						name={this.name}
						type={reveal && this.revealed ? "text" : this.type}
						autocomplete={this.autocomplete}
						disabled={this.disabled}
						maxlength={this.maxLength}
						minlength={this.minLength}
						min={this.min}
						max={this.max}
						step={this.step}
						required={this.required}
						readonly={this.readOnly}
						inputmode={this.inputMode}
						pattern={this.pattern}
						aria-label={this.ariaLabel || this.placeholder || this.name}
						aria-invalid={this.isInvalid ? "true" : undefined}
						aria-describedby={messageId}
						class={`w-full px-3 py-2 rounded-xxl border bg-surface font-text text-[12px] text-text disabled:opacity-50 disabled:cursor-not-allowed ${
							reveal ? "pr-11 " : ""
						}${this.borderClass()}`}
					/>
					{reveal && this.renderRevealButton()}
				</div>
				{this.renderMessage(messageId)}
			</Host>
		);
	}
}
