import { Component, Prop, h, Event, EventEmitter, State, Element, Watch } from "@stencil/core";

export interface ComboboxOption {
	label: string;
	value: string;
}

@Component({
	tag: "adc-combobox",
	shadow: false,
})
export class AdcCombobox {
	/** Currently selected value */
	@Prop() value: string = "";

	/** Available options — accepts an array or a JSON string */
	@Prop() options: ComboboxOption[] | string = [];

	/** Placeholder text when nothing is selected */
	@Prop() placeholder: string = "";

	/** Debounce delay in ms for search input */
	@Prop() debounce: number = 200;

	/** Whether the combobox is disabled */
	@Prop() disabled: boolean = false;

	/** Normalizes options prop — handles both array and JSON string */
	private get parsedOptions(): ComboboxOption[] {
		if (typeof this.options === "string") {
			try {
				return JSON.parse(this.options);
			} catch {
				return [];
			}
		}
		return this.options || [];
	}

	@State() isOpen: boolean = false;
	@State() searchQuery: string = "";
	@State() highlightedIndex: number = -1;

	@Element() el!: HTMLElement;

	@Event() adcChange!: EventEmitter<string>;

	private debounceTimer?: ReturnType<typeof setTimeout>;
	private inputEl?: HTMLInputElement;

	@Watch("value")
	onValueChange() {
		// Sync display text when value changes externally
		this.searchQuery = "";
	}

	connectedCallback() {
		document.addEventListener("click", this.handleClickOutside);
	}

	disconnectedCallback() {
		document.removeEventListener("click", this.handleClickOutside);
		if (this.debounceTimer) clearTimeout(this.debounceTimer);
	}

	private readonly handleClickOutside = (e: MouseEvent) => {
		if (!this.el.contains(e.target as Node)) {
			this.isOpen = false;
			this.searchQuery = "";
		}
	};

	private get filteredOptions(): ComboboxOption[] {
		if (!this.searchQuery) return this.parsedOptions;
		const q = this.searchQuery.toLowerCase();
		return this.parsedOptions.filter((opt) => opt.label.toLowerCase().includes(q));
	}

	private get selectedLabel(): string {
		const selected = this.parsedOptions.find((opt) => opt.value === this.value);
		return selected ? selected.label : "";
	}

	private readonly handleInputFocus = () => {
		if (this.disabled) return;
		this.isOpen = true;
		this.highlightedIndex = -1;
	};

	private readonly handleInput = (e: InputEvent) => {
		const target = e.target as HTMLInputElement;
		if (this.debounceTimer) clearTimeout(this.debounceTimer);
		this.debounceTimer = setTimeout(() => {
			this.searchQuery = target.value;
			this.isOpen = true;
			this.highlightedIndex = -1;
		}, this.debounce);
	};

	private readonly handleSelect = (option: ComboboxOption) => {
		this.adcChange.emit(option.value);
		this.searchQuery = "";
		this.isOpen = false;
		this.inputEl?.blur();
	};

	private readonly handleClear = (e: MouseEvent) => {
		e.stopPropagation();
		this.adcChange.emit("");
		this.searchQuery = "";
		this.isOpen = false;
	};

	private readonly handleKeyDown = (e: KeyboardEvent) => {
		const opts = this.filteredOptions;
		switch (e.key) {
			case "ArrowDown":
				e.preventDefault();
				this.isOpen = true;
				this.highlightedIndex = Math.min(this.highlightedIndex + 1, opts.length - 1);
				break;
			case "ArrowUp":
				e.preventDefault();
				this.highlightedIndex = Math.max(this.highlightedIndex - 1, 0);
				break;
			case "Enter":
				e.preventDefault();
				if (this.highlightedIndex >= 0 && opts[this.highlightedIndex]) {
					this.handleSelect(opts[this.highlightedIndex]);
				}
				break;
			case "Escape":
				this.isOpen = false;
				this.searchQuery = "";
				this.inputEl?.blur();
				break;
		}
	};

	// Unique ID for linking input ↔ listbox
	private readonly listboxId = `adc-cb-list-${Math.random().toString(36).slice(2, 7)}`;
	private readonly inputId = `adc-cb-input-${Math.random().toString(36).slice(2, 7)}`;

	render() {
		const filtered = this.filteredOptions;
		const displayValue = this.isOpen || this.searchQuery ? undefined : this.selectedLabel || undefined;

		return (
			<div class="relative w-full">
				<div class="relative">
					<input
						ref={(el) => (this.inputEl = el)}
						id={this.inputId}
						type="text"
						class="w-full px-3 py-2 pr-8 rounded-lg border border-border bg-surface text-text text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 placeholder:text-muted disabled:opacity-40 disabled:cursor-not-allowed"
						placeholder={displayValue || this.placeholder}
						value={this.searchQuery}
						onFocus={this.handleInputFocus}
						onInput={this.handleInput}
						onKeyDown={this.handleKeyDown}
						disabled={this.disabled}
						role="combobox"
						aria-expanded={this.isOpen ? "true" : "false"}
						aria-haspopup="listbox"
						aria-autocomplete="list"
						aria-controls={this.listboxId}
						autocomplete="off"
					/>
					{/* Chevron or clear button */}
					{this.value ? (
						<button
							type="button"
							class="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-text transition-colors cursor-pointer"
							onClick={this.handleClear}
							aria-label="Clear"
							tabindex={-1}
						>
							<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
								<path d="M18 6L6 18M6 6l12 12" />
							</svg>
						</button>
					) : (
						<svg
							class={`absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none transition-transform ${this.isOpen ? "rotate-180" : ""}`}
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
						>
							<path d="M6 9l6 6 6-6" />
						</svg>
					)}
				</div>

				{this.isOpen && (
					<div
						class="absolute z-20 left-0 right-0 mt-1 bg-background border border-surface rounded-xl shadow-lg max-h-48 overflow-y-auto"
						role="listbox"
						id={this.listboxId}
						aria-labelledby={this.inputId}
					>
						{filtered.length === 0 ? (
							<div class="px-3 py-2 text-sm text-muted">{this.placeholder || "—"}</div>
						) : (
							filtered.map((option, idx) => (
								<button
									type="button"
									key={`cb-${option.value}`}
									class={`w-full text-left px-3 py-2 text-sm cursor-pointer transition-colors ${
										idx === this.highlightedIndex ? "bg-surface/80 text-primary" : "hover:bg-surface/50 text-text"
									} ${option.value === this.value ? "font-semibold" : ""}`}
									role="option"
									aria-selected={option.value === this.value ? "true" : "false"}
									onClick={() => this.handleSelect(option)}
								>
									{option.label}
								</button>
							))
						)}
					</div>
				)}
			</div>
		);
	}
}
