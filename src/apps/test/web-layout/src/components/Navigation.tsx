import React from 'react';

export function Navigation() {
	// Usar navegación real (con recarga) para evitar conflictos de React
	const handleNavigate = (path: string) => {
		window.location.href = path;
	};

	// Detectar ruta actual para highlight
	const currentPath = typeof window !== 'undefined' ? window.location.pathname : '';

	const buttonStyle = (path: string) => ({
		padding: '8px 16px',
		background: currentPath === path ? '#0052a3' : '#0066cc',
		color: 'white',
		border: 'none',
		borderRadius: '4px',
		cursor: 'pointer',
		fontWeight: currentPath === path ? 'bold' : 'normal',
	});

	return (
		<nav style={{
			display: 'flex',
			gap: '10px',
			padding: '15px 0',
			borderBottom: '2px solid #e0e0e0',
			marginBottom: '20px'
		}}>
			<button
				onClick={() => handleNavigate('/')}
				style={buttonStyle('/')}
			>
				Inicio
			</button>
			<button
				onClick={() => handleNavigate('/users')}
				style={buttonStyle('/users')}
			>
				Usuarios
			</button>
			<button
				onClick={() => handleNavigate('/config')}
				style={buttonStyle('/config')}
			>
				Configuración
			</button>
		</nav>
	);
}

