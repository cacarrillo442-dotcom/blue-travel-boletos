#!/bin/sh
# Publica un cambio: sella la version, confirma y sube.
#
# Existe porque el numero de version de cada archivo se ponia a mano, uno por
# uno, y eran 21. Olvidar uno hace que el navegador siga usando el archivo
# viejo, y eso ya causo un error que tardo dias en encontrarse. Aqui todos
# reciben el MISMO numero, generado solo, asi que no hay nada que recordar.
#
#   Uso:  bin/publicar.sh "mensaje del commit"

set -e
cd "$(dirname "$0")/.."

if [ -z "$1" ]; then
  echo "Falta el mensaje. Uso: bin/publicar.sh \"mensaje del commit\"" >&2
  exit 1
fi

BUILD="$(date +%Y%m%d-%H%M%S)"

# Un solo numero en las 21 referencias
perl -pi -e "s/\?v=[0-9A-Za-z.-]+/?v=$BUILD/g" index.html

# Y el mismo en la etiqueta que la app lee para saber que version corre
perl -pi -e "s{(<meta name=\"app-version\" content=\")[^\"]*}{\${1}$BUILD}" index.html

# El archivo que la app consulta para saber si hay algo mas nuevo publicado
printf '{ "build": "%s" }\n' "$BUILD" > version.json

git add -A
git commit -q -m "$1"
git push -q origin main

echo "Publicado  $BUILD"
echo "Verificando el despliegue…"
i=0
while [ $i -lt 24 ]; do
  if curl -fsS "https://cacarrillo442-dotcom.github.io/blue-travel-boletos/version.json" 2>/dev/null | grep -q "$BUILD"; then
    echo "Ya está en línea."
    exit 0
  fi
  sleep 10
  i=$((i + 1))
done
echo "Aún no aparece en línea; GitHub Pages suele tardar un minuto."
