// Catalogo de Europamundo: encontrar el circuito para un cliente y saltar a
// la pagina de Europamundo a cotizarlo.
//
// La idea de trabajo: aqui se explora ("que hay a Italia en mayo de 10 dias
// por menos de US$2.000") y la cotizacion exacta se hace en europamundo.com,
// que es donde estan la disponibilidad y el precio de cada fecha. Ese
// presupuesto despues se carga en Paquetes.
//
// Noviembre 2026, segunda version. La primera se sentia imprecisa: buscar
// "Praga" traia 249 circuitos ordenados por precio, y solo 84 eran de Praga;
// el resto pasaba por ahi de camino. Ahora:
//   - se ordena por RELEVANCIA (nombre > empieza/termina > pais > pasa por) y
//     cada ficha dice por que salio ("Empieza en Praga", "Pasa por Praga");
//   - las variantes de un mismo circuito ("Andalucia", "Andalucia con
//     Madrid"...) se agrupan en una ficha;
//   - hay filtro por mes de salida, ciudad de inicio y de fin reales, region
//     y pais; los minipaquetes quedan fuera salvo que se pidan.
//
// Los datos viven en assets/catalogo-europamundo.js, que genera
// bin/actualizar_catalogo.py. No se cargan con la app: se piden la primera
// vez que se abre el modulo.

(function () {
  const el = (id) => document.getElementById(id);
  const panel = el('catalogoPanel');
  if (!panel) return;

  // El archivo de datos sale con la misma version que este script: si se
  // publica un catalogo nuevo, el navegador no se queda con el viejo.
  const ESTE_SCRIPT = document.currentScript && document.currentScript.src;
  const URL_DATOS = ESTE_SCRIPT
    ? ESTE_SCRIPT.replace(/catalogo\.js/, 'catalogo-europamundo.js')
    : 'assets/catalogo-europamundo.js';

  const POR_PAGINA = 30;
  const DIAS_SEMANA = { L: 'lunes', M: 'martes', X: 'miércoles', J: 'jueves', V: 'viernes', S: 'sábados', D: 'domingos' };
  const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  const MESES_LARGOS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto',
    'septiembre', 'octubre', 'noviembre', 'diciembre'];
  // Las regiones como las agrupa Europamundo, con el nombre bien escrito.
  const REGIONES = [
    ['', 'Todas'], ['Europa', 'Europa'], ['America', 'América'],
    ['Oriente Medio y Africa', 'Medio Oriente y África'], ['Asia y Oceanía', 'Asia y Oceanía'],
  ];
  const RAPIDAS = ['Italia', 'España', 'Francia', 'Turquía', 'Grecia', 'Egipto', 'Japón', 'Marruecos'];

  let datos = null;
  let cargando = null;
  let armado = false;
  let grupos = [];       // resultado filtrado y agrupado
  let mostrados = 0;
  let region = '';

  // ---------- Carga ----------

  function cargar() {
    if (datos) return Promise.resolve(datos);
    if (cargando) return cargando;
    cargando = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = URL_DATOS;
      s.onload = () => {
        if (!window.CATALOGO_EM) { reject(new Error('El archivo del catálogo llegó vacío.')); return; }
        datos = preparar(window.CATALOGO_EM);
        resolve(datos);
      };
      s.onerror = () => {
        cargando = null;   // que se pueda reintentar
        reject(new Error('No se pudo cargar el catálogo. Revisa la conexión.'));
      };
      document.head.appendChild(s);
    });
    return cargando;
  }

  // Sin tildes y en minusculas: "Múnich" se encuentra escribiendo "munich".
  function normalizar(t) {
    return String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  }

  // "Andalucía con Madrid ROT" y "Andalucía fin Sevilla" son variantes de
  // "Andalucía": comparten la clave y se muestran en una sola ficha.
  function claveDeGrupo(nombre) {
    return normalizar(nombre)
      .replace(/\s*\+i\b/g, '')
      .replace(/\s+rot\b/g, '')
      .replace(/\s+(fin|con|desde)\s.*$/, '')
      .replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  }

  function preparar(crudo) {
    const [ab, mb] = String(crudo.mesBase || '').split('-').map(Number);
    crudo.mesBaseNum = ab ? ab * 12 + (mb - 1) : 0;
    crudo.viajes.forEach((v) => {
      v.paisesTexto = v.pa.map((p) => crudo.paises[p]).filter(Boolean);
      v.ruta = v.c.map((c) => crudo.ciudades[c]).filter(Boolean);
      v.inicio = v.ruta[0] || '';
      v.fin = (v.cf && crudo.ciudades[v.cf]) || '';
      v.paisPrincipal = crudo.paises[v.pm] || '';
      v.serieNombre = crudo.series[v.s] || v.s;
      v.mini = v.s === 'MPQ' || /minipaquete|extienda su viaje|extensi[oó]n/i.test(v.n);
      v.grupo = claveDeGrupo(v.n);
      v.nN = normalizar(v.n);
      // El nombre sin su cola ("Italia Esencial fin Roma" -> "italia esencial"):
      // lo que va antes es de lo que trata el circuito.
      v.nPrincipal = v.nN.split(/\s+(?:fin|con|desde)\s/)[0];
      v.inicioN = normalizar(v.inicio);
      v.finN = normalizar(v.fin);
      v.rutaN = v.ruta.map(normalizar);
      v.paisesN = v.paisesTexto.map(normalizar);
      v.paisPrincipalN = normalizar(v.paisPrincipal);
      v.meses = new Set(v.m || []);
    });
    return crudo;
  }

  // ---------- Textos ----------

  function dolares(n) {
    return `US$ ${Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
  }

  function escapar(t) {
    return String(t == null ? '' : t)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function textoSalidas(sa) {
    const dias = String(sa || '').split('').filter((l) => DIAS_SEMANA[l]).map((l) => DIAS_SEMANA[l]);
    if (!dias.length) return '';
    if (dias.length === 7) return 'Sale todos los días';
    if (dias.length === 1) return `Sale los ${dias[0]}`;
    return `Sale los ${dias.slice(0, -1).join(', ')} y ${dias[dias.length - 1]}`;
  }

  // Mes numero n (0 = mesBase) -> {anio, mes 0-11}
  function mesReal(n) {
    const t = datos.mesBaseNum + n;
    return { anio: Math.floor(t / 12), mes: t % 12 };
  }

  // [5,6,7,8,9,10] -> "abr – oct 2027"; casi todo el calendario -> "todo el año"
  function resumenMeses(v) {
    const lista = [...v.meses].sort((a, b) => a - b);
    if (!lista.length) return '';
    if (lista.length >= 12) return 'todo el año';
    const tramos = [];
    let ini = lista[0]; let ant = lista[0];
    lista.slice(1).concat([null]).forEach((n) => {
      if (n !== null && n === ant + 1) { ant = n; return; }
      tramos.push([ini, ant]);
      ini = n; ant = n;
    });
    const fmt = ([a, b]) => {
      const x = mesReal(a); const y = mesReal(b);
      if (a === b) return `${MESES[x.mes]} ${x.anio}`;
      return x.anio === y.anio ? `${MESES[x.mes]} – ${MESES[y.mes]} ${y.anio}`
        : `${MESES[x.mes]} ${x.anio} – ${MESES[y.mes]} ${y.anio}`;
    };
    const texto = tramos.slice(0, 2).map(fmt).join(', ');
    return tramos.length > 2 ? `${texto} y otras fechas` : texto;
  }

  // La temporada de Europamundo va de abril a marzo: una salida en mayo de
  // 2027 es de la temporada 2027; una en febrero de 2027, de la 2026.
  function temporadaDeMes(n) {
    const { anio, mes } = mesReal(n);
    return String(mes >= 3 ? anio : anio - 1);
  }

  function temporadasDe(v) {
    return v.ip ? [v.t, String(Number(v.t) + 1)] : [v.t];
  }

  function textoTemporada(t) {
    return (datos && datos.temporadas[t]) || t;
  }

  function linkCotizar(v, temporada) {
    return `https://www.europamundo.com/itinerario_cotizar.aspx?rutaid=${encodeURIComponent(v.r)}&temp=${encodeURIComponent(temporada || v.t)}`;
  }

  function linkItinerario(v, temporada) {
    return `https://www.europamundo.com/itinerario_detallado.aspx?rutaid=${encodeURIComponent(v.r)}&temp=${encodeURIComponent(temporada || v.t)}`;
  }

  // Con mes elegido, se cotiza la temporada de ese mes; si no, la actual.
  function temporadaParaCotizar(v) {
    const mes = el('catMes').value;
    if (mes !== '') {
      const t = temporadaDeMes(Number(mes));
      if (temporadasDe(v).includes(t)) return t;
    }
    return v.t;
  }

  function fechaCorta(iso) {
    const [a, m, d] = String(iso || '').split('-').map(Number);
    return a ? `${d} ${MESES[m - 1]} ${a}` : '';
  }

  // ---------- Filtros ----------

  function contar(lista) {
    const c = new Map();
    lista.forEach((x) => { if (x) c.set(x, (c.get(x) || 0) + 1); });
    return [...c.entries()];
  }

  function llenarFiltros() {
    // Region: botones tipo pestaña
    el('catRegiones').innerHTML = REGIONES.map(([valor, nombre]) =>
      `<button type="button" class="cat-region${valor === region ? ' activa' : ''}" data-region="${escapar(valor)}" aria-pressed="${valor === region}">${escapar(nombre)}</button>`).join('');

    // Busquedas rapidas
    el('catRapidas').innerHTML = '<span class="cat-rapidas-titulo">Ideas:</span>'
      + RAPIDAS.map((r) => `<button type="button" class="cat-rapida" data-rapida="${escapar(r)}">${escapar(r)}</button>`).join('');

    // Mes: los que tienen salidas, con cuantas
    const porMes = new Map();
    datos.viajes.forEach((v) => { if (!v.mini) v.meses.forEach((n) => porMes.set(n, (porMes.get(n) || 0) + 1)); });
    el('catMes').innerHTML = '<option value="">Cualquier mes</option>'
      + [...porMes.keys()].sort((a, b) => a - b).map((n) => {
        const { anio, mes } = mesReal(n);
        return `<option value="${n}">${MESES_LARGOS[mes].replace(/^./, (c) => c.toUpperCase())} ${anio}</option>`;
      }).join('');

    // Pais
    const paises = contar(datos.viajes.flatMap((v) => v.paisesTexto)).sort((a, b) => a[0].localeCompare(b[0], 'es'));
    el('catPais').innerHTML = '<option value="">Cualquier país</option>'
      + paises.map(([p, n]) => `<option value="${escapar(p)}">${escapar(p)} (${n})</option>`).join('');

    // Ciudades de inicio y fin: las mas frecuentes primero
    const ciudades = (campo) => contar(datos.viajes.map((v) => v[campo]))
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'es'))
      .map(([c]) => `<option value="${escapar(c)}"></option>`).join('');
    el('catListaInicio').innerHTML = ciudades('inicio');
    el('catListaFin').innerHTML = ciudades('fin');

    el('catActualizado').textContent = `${datos.viajes.length.toLocaleString('es-CO')} circuitos · precios del ${fechaCorta(datos.actualizado)}`;
  }

  // Puntaje de una palabra contra un circuito y por que coincide.
  // 0 = no coincide. Las senales SE SUMAN: un circuito que se llama "Praga,
  // Viena", empieza en Praga y pasa por Praga vale mas que uno que solo la
  // nombra al final ("Noruega... fin Praga"). Asi el primero de la lista es lo
  // que el cliente quiso decir.
  function puntuar(v, palabra) {
    if (/^\d{5,}$/.test(palabra)) {
      return String(v.i).includes(palabra) || String(v.ip || '').includes(palabra) ? { p: 1000, motivo: '' } : { p: 0 };
    }
    let p = 0;
    const motivos = [];
    if (v.nPrincipal.includes(palabra)) p += v.nPrincipal.startsWith(palabra) ? 120 : 100;
    else if (v.nN.includes(palabra)) p += 40;              // solo en "fin X" / "con X"
    if (v.inicioN.includes(palabra)) { p += 50; motivos.push(`Empieza en ${v.inicio}`); }
    if (v.finN.includes(palabra)) { p += 40; motivos.push(`Termina en ${v.fin}`); }
    if (v.paisPrincipalN.includes(palabra)) { p += 45; motivos.push(`Principalmente en ${v.paisPrincipal}`); } else {
      const iPais = v.paisesN.findIndex((x) => x.includes(palabra));
      if (iPais >= 0) { p += 25; motivos.push(`Incluye ${v.paisesTexto[iPais]}`); }
    }
    const iCiudad = v.rutaN.findIndex((c) => c.includes(palabra));
    if (iCiudad >= 0) { p += 15; motivos.push(`Pasa por ${v.ruta[iCiudad]}`); }
    if (normalizar(v.serieNombre).includes(palabra)) p += 10;
    return { p, motivo: motivos[0] || '' };
  }

  function leerFiltros() {
    const [dMin, dMax] = (el('catDias').value || '0-999').split('-').map(Number);
    return {
      palabras: normalizar(el('catBuscar').value).split(/[\s,]+/).filter((p) => p.length > 1 || /\d/.test(p)),
      region,
      mes: el('catMes').value === '' ? null : Number(el('catMes').value),
      dMin, dMax,
      tope: Number(el('catPrecio').value) || 0,
      pais: el('catPais').value,
      inicio: normalizar(el('catInicio').value.trim()),
      fin: normalizar(el('catFin').value.trim()),
      salida: el('catSalida').value,
      novedad: el('catNovedad').checked,
      rotativo: el('catRotativo').checked,
      mini: el('catMini').checked,
      orden: el('catOrden').value,
    };
  }

  function filtrar() {
    const f = leerFiltros();
    const encontrados = [];
    datos.viajes.forEach((v) => {
      if (v.mini && !f.mini) return;
      if (f.region && v.rg !== f.region) return;
      if (f.mes !== null && !v.meses.has(f.mes)) return;
      if (v.d < f.dMin || v.d > f.dMax) return;
      if (f.tope && v.p > f.tope) return;
      if (f.pais && !v.paisesTexto.includes(f.pais)) return;
      if (f.inicio && !v.inicioN.includes(f.inicio)) return;
      if (f.fin && !v.finN.includes(f.fin)) return;
      if (f.salida && !v.sa.includes(f.salida)) return;
      if (f.novedad && !v.nv) return;
      if (f.rotativo && !v.ro) return;
      let puntos = 0;
      let motivo = '';
      for (let i = 0; i < f.palabras.length; i += 1) {
        const r = puntuar(v, f.palabras[i]);
        if (!r.p) return;           // todas las palabras tienen que estar
        puntos += r.p;
        if (!motivo && r.motivo) motivo = r.motivo;
      }
      encontrados.push({ v, puntos, motivo });
    });

    // Agrupar variantes: la ficha la encabeza la mas relevante (o la mas
    // barata si empatan); las demas quedan desplegables debajo.
    const mapa = new Map();
    encontrados.forEach((x) => {
      const g = mapa.get(x.v.grupo);
      if (g) g.push(x); else mapa.set(x.v.grupo, [x]);
    });
    const porPrecio = (a, b) => a.v.p - b.v.p || a.v.d - b.v.d;
    grupos = [...mapa.values()].map((lista) => {
      lista.sort((a, b) => b.puntos - a.puntos || porPrecio(a, b));
      return { cabeza: lista[0], otras: lista.slice(1).sort(porPrecio), puntos: lista[0].puntos };
    });

    const porNombre = (a, b) => a.cabeza.v.n.localeCompare(b.cabeza.v.n, 'es');
    const criterios = {
      relevancia: (a, b) => b.puntos - a.puntos || (b.cabeza.v.nv - a.cabeza.v.nv) || a.cabeza.v.p - b.cabeza.v.p,
      precio: (a, b) => a.cabeza.v.p - b.cabeza.v.p,
      dias: (a, b) => a.cabeza.v.d - b.cabeza.v.d || a.cabeza.v.p - b.cabeza.v.p,
      nombre: porNombre,
    };
    grupos.sort(criterios[f.orden] || criterios.relevancia);

    pintarActivos(f, encontrados.length);
    mostrados = 0;
    el('catLista').innerHTML = '';
    pintarMas();
  }

  // ---------- Filtros activos (etiquetas con x) ----------

  function pintarActivos(f, total) {
    const etiquetas = [];
    const add = (texto, quitar) => etiquetas.push({ texto, quitar });
    if (f.palabras.length) add(`«${el('catBuscar').value.trim()}»`, () => { el('catBuscar').value = ''; });
    if (f.region) add(REGIONES.find((r) => r[0] === f.region)[1], () => { region = ''; pintarRegiones(); });
    if (f.mes !== null) add(el('catMes').selectedOptions[0].textContent, () => { el('catMes').value = ''; });
    if (el('catDias').value) add(el('catDias').selectedOptions[0].textContent, () => { el('catDias').value = ''; });
    if (f.tope) add(el('catPrecio').selectedOptions[0].textContent, () => { el('catPrecio').value = ''; });
    if (f.pais) add(f.pais, () => { el('catPais').value = ''; });
    if (f.inicio) add(`Empieza en ${el('catInicio').value.trim()}`, () => { el('catInicio').value = ''; });
    if (f.fin) add(`Termina en ${el('catFin').value.trim()}`, () => { el('catFin').value = ''; });
    if (f.salida) add(`Sale los ${DIAS_SEMANA[f.salida]}`, () => { el('catSalida').value = ''; });
    if (f.novedad) add('Novedades', () => { el('catNovedad').checked = false; });
    if (f.rotativo) add('Rotativos', () => { el('catRotativo').checked = false; });
    if (f.mini) add('Con minipaquetes', () => { el('catMini').checked = false; });
    quitadores = etiquetas.map((e) => e.quitar);

    const caja = el('catActivos');
    caja.classList.toggle('hidden', !etiquetas.length);
    caja.innerHTML = etiquetas.map((e, i) =>
      `<button type="button" class="cat-chip" data-quitar="${i}" aria-label="Quitar filtro ${escapar(e.texto)}">${escapar(e.texto)} <span aria-hidden="true">×</span></button>`).join('')
      + (etiquetas.length > 1 ? '<button type="button" class="cat-limpiar" data-quitar="todo">Limpiar todo</button>' : '');

    // Cuantos filtros hay escondidos en "Más filtros"
    const escondidos = [f.pais, f.inicio, f.fin, f.salida, f.novedad, f.rotativo, f.mini].filter(Boolean).length;
    el('catMasConteo').textContent = escondidos || '';
    el('catMasConteo').classList.toggle('hidden', !escondidos);

    el('catTitulo').textContent = f.palabras.length ? `Circuitos para «${el('catBuscar').value.trim()}»` : 'Circuitos';
    el('catConteo').textContent = total
      ? `${grupos.length.toLocaleString('es-CO')} ${grupos.length === 1 ? 'circuito' : 'circuitos'}`
        + (total > grupos.length ? ` · ${total.toLocaleString('es-CO')} con sus variantes` : '')
      : '';
  }
  let quitadores = [];

  function pintarRegiones() {
    el('catRegiones').querySelectorAll('.cat-region').forEach((b) => {
      const activa = b.dataset.region === region;
      b.classList.toggle('activa', activa);
      b.setAttribute('aria-pressed', String(activa));
    });
  }

  function limpiarTodo() {
    ['catBuscar', 'catMes', 'catDias', 'catPrecio', 'catPais', 'catInicio', 'catFin', 'catSalida'].forEach((id) => { el(id).value = ''; });
    ['catNovedad', 'catRotativo', 'catMini'].forEach((id) => { el(id).checked = false; });
    el('catOrden').value = 'relevancia';
    region = '';
    pintarRegiones();
  }

  // ---------- Fichas ----------

  const ic = (n) => (window.icono ? window.icono(n) : '');

  function botones(v) {
    const temp = temporadaParaCotizar(v);
    const otra = temporadasDe(v).find((t) => t !== temp);
    return `<div class="cat-acciones">
        <a class="btn-primary btn-compact" href="${linkCotizar(v, temp)}" target="_blank" rel="noopener noreferrer">Cotizar ${ic('externo')}</a>
        <a class="btn-secondary btn-compact" href="${linkItinerario(v, temp)}" target="_blank" rel="noopener noreferrer">Itinerario ${ic('externo')}</a>
        <button type="button" class="btn-secondary btn-compact" data-usar="${escapar(v.i)}">Usar en Paquetes</button>
      </div>
      <p class="cat-temporada">Temporada ${escapar(textoTemporada(temp))}${otra
        ? ` · <a href="${linkCotizar(v, otra)}" target="_blank" rel="noopener noreferrer">cotizar ${escapar(textoTemporada(otra))}</a>` : ''}</p>`;
  }

  function insignias(v) {
    return (v.nv ? '<span class="cat-insignia nueva">Novedad</span>' : '')
      + (v.ro ? '<span class="cat-insignia" title="Se puede empezar en cualquier ciudad de la ruta">Rotativo</span>' : '')
      + (v.mini ? '<span class="cat-insignia">Minipaquete</span>' : '');
  }

  function tarjeta(g) {
    const { v, motivo } = g.cabeza;
    const noches = Math.max(v.d - 1, 0);
    const salida = [textoSalidas(v.sa), resumenMeses(v)].filter(Boolean).join(' · ');
    const trayecto = v.fin && v.fin !== v.inicio ? `${escapar(v.inicio)} → ${escapar(v.fin)}` : `Ida y vuelta a ${escapar(v.inicio)}`;
    const variantes = g.otras.length
      ? `<details class="cat-variantes">
          <summary>${g.otras.length === 1 ? '1 variante más' : `${g.otras.length} variantes más`} de este circuito</summary>
          ${g.otras.map(({ v: o }) => `<div class="cat-variante">
              <div><strong>${escapar(o.n)}</strong> ${insignias(o)}
                <small>${o.d} días · ${escapar(o.inicio)} → ${escapar(o.fin || o.inicio)} · ${escapar(textoSalidas(o.sa))}</small></div>
              <div class="cat-variante-precio"><strong>desde ${dolares(o.p)}</strong>
                <a href="${linkCotizar(o, temporadaParaCotizar(o))}" target="_blank" rel="noopener noreferrer">Cotizar ${ic('externo')}</a>
                <button type="button" class="cat-enlace" data-usar="${escapar(o.i)}">Usar</button></div>
            </div>`).join('')}
        </details>`
      : '';
    return `<article class="cat-item">
      <div class="cat-item-cuerpo">
        <div class="cat-item-titulo"><h3>${escapar(v.n)}</h3>${insignias(v)}</div>
        ${motivo ? `<p class="cat-motivo">${ic('ruta')}${escapar(motivo)}</p>` : ''}
        <ul class="cat-datos">
          <li>${ic('calendario')}<span><strong>${v.d} ${v.d === 1 ? 'día' : 'días'}</strong>${noches ? ` · ${noches} ${noches === 1 ? 'noche' : 'noches'}` : ''}</span></li>
          <li>${ic('viajes')}<span>${trayecto}</span></li>
          ${salida ? `<li>${ic('reloj')}<span>${escapar(salida)}</span></li>` : ''}
        </ul>
        <p class="cat-ruta"><span class="cat-etiqueta">Recorre</span> ${v.ruta.map(escapar).join(' · ')}</p>
        <p class="cat-paises">${escapar(v.paisesTexto.join(' · '))} <span class="cat-id">ID ${escapar(v.i)}${v.ip ? ` / ${escapar(v.ip)}` : ''}</span></p>
      </div>
      <div class="cat-item-precio">
        <span class="cat-desde">desde</span>
        <strong class="cat-monto">${dolares(v.p)}</strong>
        <span class="cat-por-dia">por persona · ${dolares(v.p / v.d)} por día</span>
        ${botones(v)}
      </div>
      ${variantes}
    </article>`;
  }

  function pintarMas() {
    const lista = el('catLista');
    const total = grupos.length;
    if (!total) {
      lista.innerHTML = `<div class="cat-vacio">
          ${ic('catalogo')}
          <p class="vacio-titulo">Ningún circuito coincide.</p>
          <p class="vacio-pista">Prueba con menos palabras o quita algún filtro.</p>
          <button type="button" class="btn-secondary btn-compact" data-quitar="todo">Quitar todos los filtros</button>
        </div>`;
      el('catMasBtn').classList.add('hidden');
      return;
    }
    const siguiente = grupos.slice(mostrados, mostrados + POR_PAGINA);
    lista.insertAdjacentHTML('beforeend', siguiente.map(tarjeta).join(''));
    mostrados += siguiente.length;
    const quedan = total - mostrados;
    el('catMasBtn').textContent = `Ver ${Math.min(quedan, POR_PAGINA)} más (quedan ${quedan})`;
    el('catMasBtn').classList.toggle('hidden', quedan <= 0);
  }

  // ---------- Pasar a Paquetes ----------
  //
  // Llena lo que el catalogo sabe: nombre, codigo, serie, dias, paises y
  // ciudades de inicio y fin. El precio NO: el "desde" es el mas barato de
  // toda la temporada y cotizar con el seria prometer lo que no es.

  function poner(id, valor) {
    const campo = el(id);
    if (!campo || valor == null) return;
    campo.value = valor;
    // Los listeners de Paquetes (fecha de fin, avisos) escuchan "input".
    campo.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function usarEnPaquetes(v) {
    const actual = (el('pkNombre') && el('pkNombre').value.trim()) || '';
    if (actual && actual !== v.n
      && !window.confirm(`En Paquetes ya tienes «${actual}». ¿Lo cambio por «${v.n}»? Se borran su itinerario y sus precios; el cliente se queda.`)) return;
    if (window.paquetes && window.paquetes.limpiarCircuito) window.paquetes.limpiarCircuito();

    const temp = temporadaParaCotizar(v);
    poner('pkNombre', v.n);
    poner('pkOperador', 'Europamundo');
    poner('pkCodigo', String(temp !== v.t && v.ip ? v.ip : v.i));
    poner('pkCategoria', v.serieNombre);
    poner('pkPaises', v.paisesTexto.join(', '));
    poner('pkDias', String(v.d));
    poner('pkCiudadInicio', v.inicio);
    poner('pkCiudadFin', v.fin || v.inicio);

    const estado = el('pkArchivoEstado');
    if (estado) {
      estado.innerHTML = `✅ Se llenó desde el Catálogo: <strong>${escapar(v.n)}</strong> (${v.d} días). `
        + 'Falta el precio de tu fecha y el día a día: '
        + `<a href="${linkCotizar(v, temp)}" target="_blank" rel="noopener noreferrer">cotízalo en Europamundo</a>`
        + ' y carga aquí el presupuesto en PDF.';
    }
    const boton = document.querySelector('.tab-btn[data-tab="packagesPanel"]');
    if (boton) boton.click();
  }

  // ---------- Arranque ----------

  function abrir() {
    if (armado) return;
    if (!datos) el('catConteo').textContent = 'Cargando el catálogo…';
    cargar().then(() => {
      if (armado) return;
      armado = true;
      llenarFiltros();
      filtrar();
    }).catch((e) => {
      el('catConteo').textContent = '';
      el('catLista').innerHTML = `<p class="aviso-permiso">${escapar(e.message)}</p>`;
    });
  }

  const botonModulo = document.querySelector('.tab-btn[data-tab="catalogoPanel"]');
  if (botonModulo) botonModulo.addEventListener('click', abrir);

  // Escribir filtra al vuelo, pero sin recalcular 2.000 circuitos por tecla.
  let espera = null;
  const filtrarPronto = (ms) => {
    clearTimeout(espera);
    espera = setTimeout(() => { if (armado) filtrar(); }, ms);
  };
  ['catBuscar', 'catInicio', 'catFin'].forEach((id) => el(id).addEventListener('input', () => filtrarPronto(180)));
  ['catMes', 'catDias', 'catPrecio', 'catOrden', 'catPais', 'catSalida', 'catNovedad', 'catRotativo', 'catMini']
    .forEach((id) => el(id).addEventListener('change', () => { if (armado) filtrar(); }));
  el('catMasBtn').addEventListener('click', pintarMas);

  panel.addEventListener('click', (ev) => {
    if (!armado) return;
    const reg = ev.target.closest('[data-region]');
    if (reg) { region = reg.dataset.region; pintarRegiones(); filtrar(); return; }
    const rap = ev.target.closest('[data-rapida]');
    if (rap) { el('catBuscar').value = rap.dataset.rapida; filtrar(); return; }
    const q = ev.target.closest('[data-quitar]');
    if (q) {
      if (q.dataset.quitar === 'todo') limpiarTodo();
      else if (quitadores[Number(q.dataset.quitar)]) quitadores[Number(q.dataset.quitar)]();
      filtrar();
      return;
    }
    const usar = ev.target.closest('[data-usar]');
    if (usar) {
      const v = datos.viajes.find((x) => String(x.i) === usar.dataset.usar);
      if (v) usarEnPaquetes(v);
    }
  });

  // Paquetes lo usa al leer un presupuesto: con el ID completa paises y ruta.
  window.Catalogo = {
    cargar,
    porId(id) {
      if (!datos) return null;
      const n = Number(id);
      return datos.viajes.find((v) => v.i === n || v.ip === n) || null;
    },
    linkCotizar,
  };
})();
