# ADC Platform - Project Overview

## Purpose
ADC Platform is a modular kernel that dynamically loads apps, services, providers, and utilities. It supports:
- Semantic versioning
- Hot reload in development
- Multi-language support (TypeScript/Python via IPC)
- Distributed execution with workers
- UI federation with multiple frameworks

## Tech Stack
- **Runtime**: Node.js with ESM modules
- **Language**: TypeScript (strict mode)
- **Bundler**: tsx for execution, Rspack for module federation
- **UI Frameworks**: React, Vue, Stencil (Web Components), Astro, Vite
- **HTTP Servers**: Express (dev), Fastify (production)
- **Package Management**: npm workspaces
- **Styling**: Tailwind CSS, PostCSS

## Key Technologies
- Module Federation (Rspack)
- Web Components (Stencil)
- IPC for cross-language communication
- Service Workers for caching
- Docker Compose for automatic provisioning

## Programming Languages
- TypeScript (primary)
- Python (via IPC for specific modules)
- JavaScript/JSX/TSX for UI

## Entry Point
`src/index.ts` → `src/kernel.ts`
