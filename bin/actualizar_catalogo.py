#!/usr/bin/env python3
"""Baja el catalogo vigente de Europamundo y lo deja listo para la app.

Uso:  python3 -I bin/actualizar_catalogo.py
      (y despues bin/publicar.sh "Catalogo Europamundo actualizado")

De donde sale: el buscador de europamundo.com ("Multifiltro") carga un archivo
con todos los circuitos que se pueden vender HOY, de la temporada en curso y de
la siguiente. Es la misma informacion de los folletos PDF, pero ordenada: con
precio desde, dias, paises, ciudades en orden y dias de salida. Europamundo lo
actualiza a diario.

Por que un script y no leerlo directo desde la app: Europamundo solo deja que
ese archivo lo lea su propia pagina (CORS). Asi que se baja aqui, se recorta a
lo que la app usa y se guarda en assets/catalogo-europamundo.js.

Que se guarda: ficha corta (nombre, serie, dias, precio desde, paises, ruta de
ciudades, dias de salida). NO se guardan los textos de Europamundo: el
itinerario detallado llega con el presupuesto, o se abre en su pagina.
"""

import json
import sys
import urllib.request
from datetime import date
from pathlib import Path

FUENTE = 'https://www.cloud-europamundo.com/json/dolares_full.json.txt'
DESTINO = Path(__file__).resolve().parent.parent / 'assets' / 'catalogo-europamundo.js'

# El archivo trae los paises en mayusculas y sin tildes ("REPUBLICA CHECA").
# Para mostrarlos al cliente se corrigen los que lo necesitan; el resto se
# pasa a tipo titulo.
PAISES_BIEN_ESCRITOS = {
    'BELGICA': 'Bélgica', 'BUTAN': 'Bután', 'CANADA': 'Canadá', 'EMIRATOS ARABES UNIDOS':
    'Emiratos Árabes Unidos', 'HUNGRIA': 'Hungría', 'IRAN': 'Irán', 'JAPON': 'Japón',
    'LIBANO': 'Líbano', 'MEXICO': 'México', 'MONACO': 'Mónaco', 'OMAN': 'Omán',
    'REPUBLICA CHECA': 'República Checa', 'REPUBLICA DOMINICANA': 'República Dominicana',
    'RUMANIA': 'Rumania', 'SUDAFRICA': 'Sudáfrica', 'TIBET': 'Tíbet', 'TUNEZ': 'Túnez',
    'TURQUIA': 'Turquía', 'UZBEQUISTAN': 'Uzbekistán', 'BOSNIA-HERZEGOVINA': 'Bosnia-Herzegovina',
    'COREA DEL SUR': 'Corea del Sur', 'ESTADOS UNIDOS': 'Estados Unidos',
    'IRLANDA DEL NORTE': 'Irlanda del Norte', 'NUEVA ZELANDA': 'Nueva Zelanda',
    'SRI LANKA': 'Sri Lanka', 'ARABIA SAUDITA': 'Arabia Saudita', 'BAHREIN': 'Baréin',
    'PAISES BAJOS': 'Países Bajos',
}

PEQUENAS = {'de', 'del', 'la', 'las', 'el', 'los', 'y', 'en', 'sur', 'am', 'an', 'der', 'di', 'da', 'do', 'sul', 'sur'}


def titulo(texto):
    """'SANTIAGO DE COMPOSTELA' -> 'Santiago de Compostela'."""
    palabras = str(texto).strip().lower().split()
    salida = []
    for i, p in enumerate(palabras):
        if i and p in PEQUENAS:
            salida.append(p)
        else:
            # Respeta los guiones: "baden-baden" -> "Baden-Baden"
            salida.append('-'.join(t[:1].upper() + t[1:] for t in p.split('-')))
    return ' '.join(salida)


def bajar():
    pedido = urllib.request.Request(FUENTE, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(pedido, timeout=60) as r:
        return json.loads(r.read().decode('utf-8-sig'))


def armar(crudo):
    paises = {p['id']: PAISES_BIEN_ESCRITOS.get(p['p'].strip(), titulo(p['p'])) for p in crudo['paises']}
    ciudades_todas = {c['id']: titulo(c['c']) for c in crudo['ciudades']}
    series = dict(crudo['series'])
    estado = crudo.get('estado', {})
    temporadas = {
        estado.get('temporada', ''): estado.get('temporada_desc', ''),
        estado.get('proxima_temporada', ''): estado.get('proxima_temporada_desc', ''),
    }

    viajes = []
    usadas = set()
    for v in crudo['viajes']:
        # La ruta trae a veces la misma ciudad seguida (llega y sale de ahi):
        # para leerla basta una vez.
        ruta = []
        for c in v.get('c', []):
            if c in ciudades_todas and (not ruta or ruta[-1] != c):
                ruta.append(c)
        usadas.update(ruta)
        viajes.append({
            'i': v['id'],                 # ID de Europamundo (el del folleto y el presupuesto)
            'r': v.get('cte'),            # numero de ruta: arma el link a su pagina
            'n': v['n'].strip(),
            's': v.get('s', ''),          # serie
            't': v.get('t', ''),          # temporada: 2026 = abril 2026 a marzo 2027
            'd': v.get('d'),              # dias
            'p': v.get('v'),              # precio desde, US$ por persona
            'pa': [p for p in v.get('pa', []) if p in paises],
            'c': ruta,
            'sa': v.get('sa', ''),        # dias de salida: L M X J V S D
        })
        # Casi todos los circuitos de esta temporada siguen la proxima con
        # otro ID (2600086 -> 2700086), y ese segundo ID no viene como viaje
        # aparte. Es el que trae el presupuesto de una salida de la proxima
        # temporada, asi que hay que guardarlo para poder encontrarlo.
        if v.get('idp'):
            viajes[-1]['ip'] = v['idp']

    viajes.sort(key=lambda x: (x['n'].lower(), x['t']))
    return {
        'actualizado': date.today().isoformat(),
        'fuente': 'europamundo.com (Multifiltro)',
        'temporadas': temporadas,
        'series': series,
        'paises': paises,
        'ciudades': {c: ciudades_todas[c] for c in sorted(usadas)},
        'viajes': viajes,
    }


def main():
    try:
        crudo = bajar()
    except Exception as e:  # noqa: BLE001 - se explica y se sale
        sys.exit(f'No se pudo bajar el catalogo de Europamundo: {e}')
    datos = armar(crudo)
    if len(datos['viajes']) < 500:
        # Si un dia Europamundo cambia el archivo, mejor no pisar el catalogo
        # bueno con uno roto.
        sys.exit(f"Llegaron solo {len(datos['viajes'])} circuitos; no se guarda nada.")
    cuerpo = json.dumps(datos, ensure_ascii=False, separators=(',', ':'))
    DESTINO.write_text(
        '// Catalogo de Europamundo. NO se edita a mano: lo genera\n'
        '// bin/actualizar_catalogo.py a partir del buscador de europamundo.com.\n'
        f'window.CATALOGO_EM = {cuerpo};\n',
        encoding='utf-8',
    )
    por_temporada = {}
    for v in datos['viajes']:
        por_temporada[v['t']] = por_temporada.get(v['t'], 0) + 1
    print(f"Listo: {len(datos['viajes'])} circuitos {por_temporada}, "
          f"{len(datos['ciudades'])} ciudades, {DESTINO.stat().st_size // 1024} KB.")


if __name__ == '__main__':
    main()
