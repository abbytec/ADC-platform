import { Component, Prop, h, Host } from '@stencil/core';

@Component({
	tag: 'adc-stat-card',
	shadow: true,
})
export class AdcStatCard {
	@Prop() cardTitle!: string;
	@Prop() value!: string | number;
	@Prop() description?: string;
	@Prop() color: string = '#0066cc';

	render() {
		return (
			<Host>
				<div
					style={{
						background: '#f9fafb',
						padding: '20px',
						borderRadius: '8px',
						border: '1px solid #e5e7eb',
					}}
				>
					<h3
						style={{
							margin: '0 0 10px 0',
							fontSize: '32px',
							color: this.color,
							fontWeight: 'bold',
						}}
					>
						{this.value}
					</h3>
					<p style={{ margin: '0', color: '#6b7280', fontWeight: '500' }}>
						{this.cardTitle}
					</p>
					{this.description && (
						<p style={{ margin: '8px 0 0 0', fontSize: '0.875rem', color: '#9ca3af' }}>
							{this.description}
						</p>
					)}
				</div>
			</Host>
		);
	}
}

