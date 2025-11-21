import { Component, Prop, h, Event, EventEmitter, Host } from '@stencil/core';

@Component({
	tag: 'adc-button',
	shadow: true,
})
export class AdcButton {
	@Prop() disabled: boolean = false;
	@Prop() buttonType: 'button' | 'submit' | 'reset' = 'button';
	@Prop() variant: 'primary' | 'secondary' = 'primary';
	
	@Event() adcClick: EventEmitter<MouseEvent>;

	private handleClick = (event: MouseEvent) => {
		if (!this.disabled) {
			this.adcClick.emit(event);
		}
	};

	render() {
		const isPrimary = this.variant === 'primary';
		const backgroundColor = this.disabled ? '#ccc' : (isPrimary ? '#0066cc' : '#6b7280');
		const hoverColor = isPrimary ? '#0052a3' : '#4b5563';

		return (
			<Host>
				<button
					type={this.buttonType}
					onClick={this.handleClick}
					disabled={this.disabled}
					class="adc-button"
					style={{
						backgroundColor,
						color: 'white',
						padding: '0.75rem 1.5rem',
						border: 'none',
						borderRadius: '0.375rem',
						fontSize: '1rem',
						fontWeight: '500',
						cursor: this.disabled ? 'not-allowed' : 'pointer',
						transition: 'background-color 0.2s',
						'--hover-color': hoverColor,
					}}
					onMouseEnter={(e) => {
						if (!this.disabled) {
							(e.target as HTMLElement).style.backgroundColor = hoverColor;
						}
					}}
					onMouseLeave={(e) => {
						if (!this.disabled) {
							(e.target as HTMLElement).style.backgroundColor = backgroundColor;
						}
					}}
				>
					<slot></slot>
				</button>
			</Host>
		);
	}
}

