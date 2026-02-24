import { Component, Prop, h, Event, EventEmitter, State } from "@stencil/core";

export interface SelectOption {
	label: string;
	value: string;
}

@Component({
	tag: "adc-select",
	shadow: false,
})
export class AdcSelect {
	@Prop() value: string = "";
	@Prop() options: SelectOption[] = [];
	@Prop() placeholder: string = "Seleccione";

	@State() isOpen: boolean = false;

	@Event() adcChange!: EventEmitter<string>;

	private readonly handleToggle = () => {
		this.isOpen = !this.isOpen;
	};

	private readonly handleSelect = (option: SelectOption) => {
		this.adcChange.emit(option.value);
		this.isOpen = false;
	};

	private readonly handleKeyDown = (event: KeyboardEvent) => {
		if (event.key === "Escape") {
			this.isOpen = false;
		}
	};

	private readonly getSelectedLabel = (): string => {
		const selected = this.options.find((opt) => opt.value === this.value);
		return selected ? selected.label : this.placeholder;
	};

	render() {
		return (
			<div class="w-full">
				<button
					type="button"
					class="w-full px-3 py-2 rounded-xxl border border-surface bg-white text-black text-[12px] font-text flex justify-between items-center"
					aria-haspopup="menu"
					aria-expanded={this.isOpen ? "true" : "false"}
					onClick={this.handleToggle}
					onKeyDown={this.handleKeyDown}
				>
					<span>{this.getSelectedLabel()}</span>
					<svg class="h-3.5 w-3.5 text-black" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
						<path
							fill-rule="evenodd"
							d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 10.94l3.71-3.71a.75.75 0 1 1 1.08 1.04l-4.25 4.25a.75.75 0 0 1-1.06 0L5.25 8.27a.75.75 0 0 1-.02-1.06Z"
							clip-rule="evenodd"
						/>
					</svg>
				</button>
				{this.isOpen && (
					<div class="mt-1 bg-white border border-surface rounded-xxl shadow-cozy max-h-60 overflow-auto w-full">
						{this.options.map((option) => (
							<button
								type="button"
								class="px-3 py-1 cursor-pointer hover:bg-surface w-full text-left"
								role="menuitem"
								onClick={() => this.handleSelect(option)}
							>
								{option.label}
							</button>
						))}
					</div>
				)}
			</div>
		);
	}
}
