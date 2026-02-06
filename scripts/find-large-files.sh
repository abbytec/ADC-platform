#!/bin/bash
# Guardar como find_large_files.sh

MIN_LINES=130
EXTENSIONS="py|js|cpp|c|html|ts"
EXCLUDE_DIRS="node_modules|\.git|dist|build|vendor|\.next|\.nuxt|\.cache|coverage|\.idea|\.vscode"

echo "Buscando archivos con más de $MIN_LINES líneas..."
echo "Extensiones: $EXTENSIONS"
echo "Excluyendo: $EXCLUDE_DIRS"
echo "----------------------------------------"

# Crear lista temporal de archivos
TEMP_FILES=$(mktemp)
TEMP_FILTERED=$(mktemp)
TEMP_RESULTS=$(mktemp)

# Buscar archivos excluyendo directorios comunes
find . -type f -regextype posix-extended -regex ".*\.($EXTENSIONS)$" 2>/dev/null | \
  grep -vE "/($EXCLUDE_DIRS)/" | \
  grep -vE "^\./($EXCLUDE_DIRS)/" > "$TEMP_FILES"

# Verificar si hay archivos
if [[ ! -s "$TEMP_FILES" ]]; then
    echo "No se encontraron archivos con las extensiones especificadas."
    rm -f "$TEMP_FILES" "$TEMP_FILTERED"
    exit 0
fi

# Filtrar archivos ignorados por git (si estamos en repositorio git)
if git rev-parse --git-dir > /dev/null 2>&1; then
    git check-ignore --stdin < "$TEMP_FILES" > "$TEMP_FILTERED"
    grep -vFf "$TEMP_FILTERED" "$TEMP_FILES"
else
    cat "$TEMP_FILES"
fi | \
  # Procesar archivos y contar líneas (excluir components.d.ts)
  while read -r file; do
    if [[ -f "$file" ]] && [[ ! "$file" =~ components\.d\.ts$ ]]; then
        lines=$(wc -l < "$file" 2>/dev/null)
        if [[ "$lines" -gt "$MIN_LINES" ]]; then
            printf "%6d lines: %s\n" "$lines" "${file#./}"
        fi
    fi
  done | sort -nr | tee "$TEMP_RESULTS"

# Contar estadísticas
TOTAL_FILES=$(cat "$TEMP_FILES" | while read -r file; do
    if [[ -f "$file" ]] && [[ ! "$file" =~ components\.d\.ts$ ]]; then
        echo "1"
    fi
done | wc -l)

LARGE_FILES=$(wc -l < "$TEMP_RESULTS")

if [[ "$TOTAL_FILES" -gt 0 ]]; then
    PERCENTAGE=$(awk "BEGIN {printf \"%.2f\", ($LARGE_FILES / $TOTAL_FILES) * 100}")
    echo "----------------------------------------"
    echo "Total de archivos analizados: $TOTAL_FILES"
    echo "Archivos que superan $MIN_LINES líneas: $LARGE_FILES ($PERCENTAGE%)"
else
    echo "----------------------------------------"
    echo "No se analizaron archivos."
fi

# Limpiar archivos temporales
rm -f "$TEMP_FILES" "$TEMP_FILTERED" "$TEMP_RESULTS"