import { Component, Prop, h, Event, EventEmitter, State } from "@stencil/core";

@Component({
	tag: "adc-star-rating",
	shadow: false,
})
export class AdcStarRating {
	@Prop() average?: number | null;
	@Prop() count?: number | null;
	@Prop() myRating?: number | null;
	@Prop() canRate: boolean = false;
	@Prop() pending: boolean = false;

	@State() mounted: boolean = false;

	@Event() adcRate!: EventEmitter<number>;

	componentDidLoad() {
		this.mounted = true;
	}

	private handleClick = (rating: number) => {
		if (!this.canRate || this.pending || !this.mounted) return;
		this.adcRate.emit(rating);
	};

	private isDisabled(): boolean {
		return !this.canRate || this.pending || !this.mounted;
	}

	private getDisplayRating(): number {
		return this.myRating ?? this.average ?? 0;
	}

	render() {
		const disabled = this.isDisabled();
		const displayRating = this.getDisplayRating();

		return (
			<div class="flex items-center gap-1" role={disabled ? undefined : "radiogroup"}>
				{[1, 2, 3, 4, 5].map((i) => (
					<button
						key={`star-${i}`}
						type="button"
						class={`text-4xl leading-none focus:outline-none ${disabled ? "cursor-default" : "cursor-pointer"}`}
						aria-label={disabled ? undefined : `Calificar con ${i} estrellas`}
						aria-hidden={disabled ? "true" : undefined}
						disabled={disabled}
						role={disabled ? undefined : "radio"}
						onClick={() => this.handleClick(i)}
					>
						<span class={displayRating >= i ? "text-yellow-400" : "text-gray-300"}>★</span>
					</button>
				))}
				<span class="ml-2 text-sm text-black" aria-label="Calificación promedio">
					{typeof this.average === "number" ? this.average.toFixed(1) : "0.0"} ({this.count ?? 0})
				</span>
			</div>
		);
	}
}
