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

		const clasification = (
			<span class="ml-2 text-sm" aria-label="Calificación promedio">
				{typeof this.average === "number" ? this.average.toFixed(1) : "0.0"} ({this.count ?? 0})
			</span>
		);

		const displayStarRating = (i: number) => <span class={displayRating >= i ? "text-yellow-400" : "text-gray-300"}>★</span>;

		return disabled ? (
			<div class="flex items-center gap-1">
				{[1, 2, 3, 4, 5].map((i) => (
					<span
						key={`star-${i}`}
						class={`text-4xl leading-none focus:outline-none cursor-default`}
						aria-hidden
						onClick={() => this.handleClick(i)}
					>
						{displayStarRating(i)}
					</span>
				))}
				{clasification}
			</div>
		) : (
			<div class="flex items-center gap-1" role={"radiogroup"}>
				{[1, 2, 3, 4, 5].map((i) => (
					<button
						key={`star-${i}`}
						type="button"
						class={`text-4xl leading-none focus:outline-none cursor-pointer`}
						aria-label={`Calificar con ${i} estrellas`}
						role={"radio"}
						aria-checked={this.myRating === i ? "true" : "false"}
						onClick={() => this.handleClick(i)}
					>
						{displayStarRating(i)}
					</button>
				))}
				{clasification}
			</div>
		);
	}
}
