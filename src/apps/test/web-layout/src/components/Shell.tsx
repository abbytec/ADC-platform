import React, { memo } from 'react';
import '@ui-library/loader';
import { Navigation } from './Navigation.tsx';

interface ShellProps {
	children: React.ReactNode;
	currentPath: string;
}

export const Shell = memo(function Shell({ children, currentPath }: ShellProps) {
	return (
		<div className="min-h-screen bg-gray-100">
			<adc-container>
				<adc-header 
					header-title="ADC Platform" 
					subtitle="Sistema de gestión distribuida"
				/>
				<Navigation currentPath={currentPath} />
				<main className="mt-5 animate-slide-in">
					{children}
				</main>
			</adc-container>
		</div>
	);
});

