import { createElement, useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';

// Importar componentes federados desde ui-library
import { PrimaryButton } from '@ui-library/components/PrimaryButton.js';
import { StatCard } from '@ui-library/components/StatCard.js';

// Importar componentes locales
import { StatsGrid } from './components/StatsGrid.tsx';
import { Shell } from './components/Shell.tsx';
import { router } from '@ui-library/utils/router.js';

// Página de inicio/dashboard
function HomePage() {
	const [stats, setStats] = useState<any>(null);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		loadStats();
	}, []);

	async function loadStats() {
		try {
			const response = await fetch('/api/dashboard/stats');
			const result = await response.json();
			if (result.success) {
				setStats(result.data);
			}
		} catch (error) {
			console.error('Error cargando estadísticas:', error);
		} finally {
			setLoading(false);
		}
	}

	if (loading) {
		return createElement('div', { className: 'loading' }, 'Cargando...');
	}

	return createElement('div', null,
		createElement('h2', { style: { marginBottom: '20px' } }, 'Estadísticas del Sistema'),
		
		createElement(PrimaryButton, {
			onClick: () => { loadStats(); }
		}, 'Recargar Estadísticas'),

		stats && createElement(StatsGrid, null,
			createElement(StatCard, {
				title: 'Usuarios Totales',
				value: stats.totalUsers,
				color: '#0066cc'
			}),
			createElement(StatCard, {
				title: 'Usuarios Activos',
				value: stats.activeUsers,
				color: '#10b981'
			}),
			createElement(StatCard, {
				title: 'Roles Diferentes',
				value: stats.totalRoles,
				color: '#f59e0b'
			})
		)
	);
}

import { ConfigPage } from './pages/Config.tsx';

// Aplicación principal con Shell y Router
function App() {
	const [currentComponent, setCurrentComponent] = useState<any>(null);

	useEffect(() => {
		// Configurar rutas
		router.addRoute({
			path: '/dashboard/',
			component: async () => HomePage,
			element: HomePage
		});

		router.addRoute({
			path: '/dashboard/users',
			component: async () => {
				// Cargar sub-app de usuarios (iframe o fetch)
				return () => createElement('div', null,
					createElement('h2', null, 'Gestión de Usuarios'),
					createElement('iframe', {
						src: '/users-management',
						style: { width: '100%', height: '80vh', border: 'none' }
					})
				);
			}
		});

		router.addRoute({
			path: '/dashboard/config',
			component: async () => ConfigPage,
			element: ConfigPage
		});

		// Navegar a la ruta inicial
		router.navigate(router.getCurrentRoute()).then(Component => {
			if (Component) {
				setCurrentComponent(() => Component);
			}
		});

		// Escuchar cambios de ruta
		router.setOnRouteChange(async (path) => {
			const Component = await router.navigate(path);
			if (Component) {
				setCurrentComponent(() => Component);
			}
		});
	}, []);

	const ComponentToRender = currentComponent || HomePage;

	return createElement(Shell, null,
		createElement(ComponentToRender)
	);
}

// Montar la aplicación
const root = createRoot(document.getElementById('root')!);
root.render(createElement(App));

