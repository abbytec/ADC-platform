import React, { memo } from 'react';
import '@ui-library/loader';
import { Navigation } from './Navigation.tsx';

interface ShellProps {
	children: React.ReactNode;
	currentPath: string;
}

export const Shell = memo(function Shell({ children, currentPath }: ShellProps) {
	return (
		<div style={{ minHeight: '100vh', background: '#f5f5f5' }}>
			<adc-container>
				<adc-header 
					header-title="ADC Platform" 
					subtitle="Sistema de gestión distribuida"
				/>
				<Navigation currentPath={currentPath} />
				<main style={{ marginTop: '20px' }}>
					{children}
				</main>
			</adc-container>
		</div>
	);
});

