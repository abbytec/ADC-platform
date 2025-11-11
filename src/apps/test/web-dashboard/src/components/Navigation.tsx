import React from 'react';

export interface NavigationProps {
	links: Array<{ href: string; label: string }>;
}

export function Navigation({ links }: NavigationProps) {
	return (
		<nav>
			{links.map(link => (
				<a
					key={link.href}
					href={link.href}
					style={{ marginLeft: '15px', color: '#0066cc', textDecoration: 'none' }}
				>
					{link.label}
				</a>
			))}
		</nav>
	);
}

