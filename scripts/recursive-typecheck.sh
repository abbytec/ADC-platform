#!/bin/bash

echo "🔎 Buscando tsconfig.json en repositorio..."

# Lista todos los archivos NO ignorados por git y filtra tsconfig.json
configs=$(git ls-files -co --exclude-standard | grep "tsconfig.json")

if [[ -z "$configs" ]]; then
  echo "❌ No se encontraron tsconfig.json"
  exit 1
fi

echo "⚙ Ejecutando typecheck por proyecto..."

fail=0

for cfg in $configs; do
  dir=$(dirname "$cfg")
  echo "➡ tsc -p $cfg"
  
  npx tsc -p "$cfg" --noEmit
  if [[ $? -ne 0 ]]; then
    echo "❌ Error en $cfg"
    fail=1
  else
    echo "✅ $cfg OK"
  fi

  echo
done

if [[ $fail -ne 0 ]]; then
  echo "❌ Al menos un proyecto falló"
  exit 1
fi

echo "🎉 Todos los proyectos pasaron el typecheck"
exit 0
