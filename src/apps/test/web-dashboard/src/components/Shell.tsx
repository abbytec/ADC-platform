import React, { useState, useEffect } from 'react';
import { Container } from '@ui-library/components/Container.js';
import { Header } from '@ui-library/components/Header.js';
import { Navigation } from './Navigation.tsx';
import { router } from '../router';

interface ShellProps {
	children: React.ReactNode;
}

export function Shell({ children }: ShellProps) {
	const [currentPath, setCurrentPath] = useState(router.getCurrentRoute());

	useEffect(() => {
		router.setOnRouteChange((path) => {
			setCurrentPath(path);
		});
	}, []);

	const navLinks = [
		{ href: '/ui/dashboard/', label: 'Inicio' },
		{ href: '/users', label: 'Usuarios' },
		{ href: '/settings', label: 'Configuración' }
	];

	const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
		// Si es una ruta interna, usar el router
		if (href.startsWith('/') && !href.startsWith('/ui/')) {
			e.preventDefault();
			router.push(href);
		}
	};

	return (
		<div style={{ minHeight: '100vh', background: '#f5f5f5' }}>
			{/* Header compartido */}
			<Container>
				<Header
					title="ADC Platform"
					subtitle={`Ruta actual: ${currentPath}`}
					actions={
						<nav>
							{navLinks.map(link => (
								<a
									key={link.href}
									href={link.href}
									onClick={(e) => handleNavClick(e, link.href)}
									style={{
										marginLeft: '15px',
										color: currentPath === link.href ? '#0066cc' : '#666',
										textDecoration: 'none',
										fontWeight: currentPath === link.href ? 'bold' : 'normal'
									}}
								>
									{link.label}
								</a>
							))}
						</nav>
					}
				/>
			</Container>

			{/* Contenido dinámico */}
			<div style={{ padding: '20px' }}>
				{children}
			</div>

			{/* Footer compartido */}
			<footer style={{
				textAlign: 'center',
				padding: '20px',
				color: '#666',
				borderTop: '1px solid #e5e7eb'
			}}>
				© 2025 ADC Platform - Shell/Router Architecture
			</footer>
		</div>
	);
}

