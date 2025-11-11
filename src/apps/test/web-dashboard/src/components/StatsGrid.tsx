import React from 'react';

export interface StatsGridProps {
	children: React.ReactNode;
}

export function StatsGrid({ children }: StatsGridProps) {
	return (
		<div
			style={{
				display: 'grid',
				gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
				gap: '20px',
				marginTop: '30px'
			}}
		>
			{children}
		</div>
	);
}

