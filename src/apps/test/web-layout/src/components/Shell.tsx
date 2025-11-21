import React from 'react';
import { Container } from '@ui-library/components/Container.js';
import { Header } from '@ui-library/components/Header.js';
import { Navigation } from './Navigation.tsx';

export function Shell({ children }: { children: React.ReactNode }) {
	return (
		<div style={{ minHeight: '100vh', background: '#f5f5f5' }}>
			<Container>
				<Header 
					title="ADC Platform" 
					subtitle="Sistema de gestión distribuida"
				/>
				<Navigation />
				<main style={{ marginTop: '20px' }}>
					{children}
				</main>
			</Container>
		</div>
	);
}

