Usa la herramienta correcta según el tipo de búsqueda:

| Tarea | Herramienta | Ejemplo |
|-------|-------------|---------|
| Buscar **archivos** por nombre/patrón | `fd` | `fd -e tsx` |
| Buscar **texto/strings** en archivos | `rg` (ripgrep) | `rg "TODO" -t ts` |
| Buscar **estructura de código** (AST) | `ast-grep` | `ast-grep -p 'async function $NAME($_)' -l ts` |
| Manipular **JSON** | `jq` | `jq '.dependencies' package.json` |
| Manipular **YAML** | `yq` | `yq '.services' docker-compose.yml` |

### fd - Búsqueda de archivos
```bash
fd pattern                      # Buscar archivos por nombre (regex)
fd -g "*.tsx"                   # Buscar con glob
fd -e ts                        # Por extensión
fd -e ts -e tsx                 # Múltiples extensiones
fd -t f pattern                 # Solo archivos (no directorios)
fd -t d src                     # Solo directorios
fd -H pattern                   # Incluir archivos ocultos
fd config.json                  # Buscar archivos específicos
fd -x echo {}                   # Ejecutar comando por cada resultado
```

### rg (ripgrep) - Búsqueda de texto
```bash
rg "pattern"                    # Buscar en directorio actual
rg "pattern" -t ts              # Solo archivos TypeScript
rg "pattern" -g "*.tsx"         # Solo archivos .tsx
rg "pattern" -l                 # Solo mostrar nombres de archivo
rg "pattern" -c                 # Contar matches por archivo
rg "pattern" -A 3 -B 2          # Contexto: 3 líneas después, 2 antes
```

### ast-grep - Búsqueda por estructura de código
```bash
# Buscar funciones async
ast-grep -p 'async function $NAME($_)' -l ts

# Buscar imports específicos
ast-grep -p 'import { $_ } from "react"' -l tsx

# Buscar clases que extienden BaseApp
ast-grep -p 'class $NAME extends BaseApp' -l ts

# Buscar useEffect con dependencias vacías
ast-grep -p 'useEffect($FN, [])' -l tsx

# Reemplazar (con confirmación interactiva)
ast-grep -p 'console.log($_)' -r '' -l ts -i
```

### jq - Manipulación de JSON
```bash
jq '.'                           # Pretty print
jq '.key'                        # Extraer valor
jq '.array[0]'                   # Primer elemento
jq '.[] | .name'                 # Iterar y extraer
jq 'keys'                        # Listar keys
jq '.dependencies | keys'        # Keys de objeto anidado
jq -r '.name'                    # Output sin comillas
jq 'select(.type == "module")'   # Filtrar
```

### yq - Manipulación de YAML (wrapper de jq)
```bash
yq '.services' file.yml          # Extraer sección
yq -y '.key = "value"' file.yml  # Modificar (output YAML)
yq '.[] | .image' compose.yml    # Iterar servicios
```