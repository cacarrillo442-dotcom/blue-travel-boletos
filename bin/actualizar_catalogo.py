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
import time
import urllib.request
from datetime import date
from pathlib import Path

FUENTE = 'https://www.cloud-europamundo.com/json/dolares_full.json.txt'
# Su buscador pregunta aqui que circuitos salen entre dos fechas. Se consulta
# una vez por mes para saber en que meses sale cada uno.
SALIDAS = 'https://www.europamundo.com/multibuscador.aspx/GetViajesSalidas'
# Hasta donde vende Europamundo (su calendario llega a marzo de 2028).
ULTIMO_MES = (2028, 3)
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


def bajar_meses():
    """{id de viaje: ['2027-04', ...]} desde el mes actual hasta ULTIMO_MES.

    Son ~17 consultas pequenas, una por mes, con una pausa entre cada una
    para no cargar su servidor. Si alguna falla se sigue sin ese mes: el
    filtro por mes es una ayuda, no un dato del que dependa la cotizacion.
    """
    hoy = date.today()
    a, m = hoy.year, hoy.month
    meses = {}
    while (a, m) <= ULTIMO_MES:
        fin = date(a + (m == 12), m % 12 + 1, 1)
        cuerpo = json.dumps({'FechaIni': f'{a}-{m:02d}-01',
                             'FechaFin': (date.fromordinal(fin.toordinal() - 1)).isoformat()}).encode()
        pedido = urllib.request.Request(SALIDAS, data=cuerpo, method='POST', headers={
            'User-Agent': 'Mozilla/5.0', 'Content-Type': 'application/json; charset=utf-8'})
        try:
            with urllib.request.urlopen(pedido, timeout=60) as r:
                ids = json.loads(r.read().decode('utf-8')).get('d', [])
            for i in ids:
                meses.setdefault(i, []).append(f'{a}-{m:02d}')
            print(f'  salidas {a}-{m:02d}: {len(ids)}')
        except Exception as e:  # noqa: BLE001
            print(f'  salidas {a}-{m:02d}: no se pudo ({e})')
        time.sleep(0.5)
        a, m = (a + 1, 1) if m == 12 else (a, m + 1)
    return meses


def mes_a_numero(mes, base):
    a, m = map(int, mes.split('-'))
    return (a - base[0]) * 12 + (m - base[1])


def armar(crudo, meses_por_id):
    hoy = date.today()
    base = (hoy.year, hoy.month)
    paises = {p['id']: PAISES_BIEN_ESCRITOS.get(p['p'].strip(), titulo(p['p'])) for p in crudo['paises']}
    ciudades_todas = {c['id']: titulo(c['c']) for c in crudo['ciudades']}
    series = dict(crudo['series'])
    estado = crudo.get('estado', {})
    temporadas = {
        estado.get('temporada', ''): estado.get('temporada_desc', ''),
        estado.get('proxima_temporada', ''): estado.get('proxima_temporada_desc', ''),
    }

    # Region de cada serie, como la agrupa Europamundo (Europa, America...).
    region_de_serie = {}
    for area in crudo.get('areas', []):
        for s in area.get('series', []):
            region_de_serie[s] = area['a']

    viajes = []
    usadas = set()
    for v in crudo['viajes']:
        # La ruta trae a veces la misma ciudad seguida (llega y sale de ahi):
        # para leerla basta una vez.
        ruta = []
        for c in v.get('c', []):
            if c in ciudades_todas and (not ruta or ruta[-1] != c):
                ruta.append(c)
        fin = v.get('cf')
        if fin in ciudades_todas:
            usadas.add(fin)
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
            # Donde termina DE VERDAD. La lista de ciudades no lo dice: trae
            # cada ciudad una vez, y un circuito que vuelve a Madrid "acaba"
            # en la ultima que visito.
            'cf': fin if fin in ciudades_todas else None,
            'rg': region_de_serie.get(v.get('s', ''), ''),
            # Marcas de Europamundo (campo f): 1 rotativo, 8 novedad.
            'nv': 1 if (v.get('f', 0) & 8) else 0,
            'ro': 1 if (v.get('f', 0) & 1) else 0,
            # Pais donde pasa mas tiempo: ordena mejor una busqueda por pais.
            'pm': max((v.get('pp') or {}).items(), key=lambda x: x[1])[0] if v.get('pp') else '',
            # Meses con salida, de las dos temporadas (su ID y el de la proxima).
            # Como numeros contados desde mesBase (0 = mesBase): ocupa la
            # tercera parte que escribir '2027-04' en cada circuito.
            'm': sorted({mes_a_numero(x, base) for x in
                         meses_por_id.get(v['id'], []) + meses_por_id.get(v.get('idp') or 0, [])}),
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
        'conMeses': bool(meses_por_id),
        'mesBase': f'{base[0]}-{base[1]:02d}',
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
    print('Consultando los meses de salida…')
    datos = armar(crudo, bajar_meses())
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
