# ADC Platform

ADC Platform es un kernel de software modular y dinámico construido sobre Node.js y TypeScript. Su arquitectura está diseñada para permitir la creación de aplicaciones complejas y escalables a través de la composición de módulos independientes: **Providers**, **Middlewares**, **Presets** y **Apps**.

El objetivo principal del proyecto es ofrecer una base sólida y flexible que desacopla la lógica de negocio de las capas de infraestructura, permitiendo un desarrollo ágil y un alto grado de reutilización de código. La plataforma está pensada para evolucionar y soportar funcionalidades avanzadas como:

-   **Pipelines automáticos:** Creación de flujos de trabajo que se actualizan y despliegan de forma automática.
-   **Clusterización:** Orquestación de múltiples instancias de la plataforma para lograr alta disponibilidad y balanceo de carga.
-   **Aplicaciones Cloud:** Proveer caracteristicas típicas de servicios en la nube.
-   **Sistemas multi-tenant:** Una sola instancia de la plataforma sirviendo a múltiples clientes con configuraciones y datos aislados.

## Características Principales

-   **Carga Dinámica de Módulos:** El kernel carga y enlaza módulos en tiempo de ejecución desde el sistema de archivos.
-   **Gestión de Dependencias Aislada:** Gracias a los [npm workspaces](https://docs.npmjs.com/cli/v7/using-npm/workspaces), cada módulo gestiona sus propias dependencias sin interferir con el resto del sistema.
-   **Hot Reloading:** En modo de desarrollo, los cambios en el código fuente o en los archivos de configuración de las apps recargan automáticamente los componentes afectados sin necesidad de reiniciar todo el sistema.
-   **Soporte Multi-lenguaje (Futuro):** La arquitectura está preparada para cargar módulos escritos en otros lenguajes, como Python.
-   **Instancias Múltiples de Apps:** Una misma base de código de una aplicación puede ejecutarse en múltiples instancias con diferentes configuraciones, permitiendo una gran flexibilidad para distintos entornos o clientes.

Para una descripción técnica detallada sobre la arquitectura, los componentes y el flujo de trabajo, consulta el documento [ARCHITECTURE.md](./ARCHITECTURE.md).
