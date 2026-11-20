// Catalogo de Europamundo: buscar entre los circuitos vigentes y saltar a su
// pagina para cotizar.
//
// La idea de trabajo: aqui se explora (que hay a Turquia de 10 dias por menos
// de US$1.500, que sale los sabados), y la cotizacion exacta se hace en
// europamundo.com, que es donde estan la disponibilidad y el precio de cada
// fecha. Ese presupuesto despues se carga en Paquetes.
//
// Los datos viven en assets/catalogo-europamundo.js, que genera
// bin/actualizar_catalogo.py. Pesan ~400 KB, asi que no se cargan con la app:
// se piden la primera vez que se abre el modulo.

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

  const POR_PAGINA = 40;
  const DIAS_SEMANA = { L: 'lunes', M: 'martes', X: 'miércoles', J: 'jueves', V: 'viernes', S: 'sábados', D: 'domingos' };
  const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

  let datos = null;
  let cargando = null;
  let filtrados = [];
  let mostrados = 0;

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

  function preparar(crudo) {
    crudo.viajes.forEach((v) => {
      v.paisesTexto = v.pa.map((p) => crudo.paises[p]).filter(Boolean);
      v.ruta = v.c.map((c) => crudo.ciudades[c]).filter(Boolean);
      v.serieNombre = crudo.series[v.s] || v.s;
      v.buscable = normalizar([v.n, v.serieNombre, v.paisesTexto.join(' '), v.ruta.join(' '), v.i, v.ip || ''].join(' '));
    });
    return crudo;
  }

  // ---------- Textos ----------

  function dolares(n) {
    return `US$ ${Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
  }

  // "S" -> "Sale los sábados"; "LV" -> "Sale los lunes y viernes"
  function textoSalidas(sa) {
    const letras = String(sa || '').split('').filter((l) => DIAS_SEMANA[l]);
    if (!letras.length) return '';
    if (letras.length === 7) return 'Sale todos los días';
    // Siempre en plural: "los sábados", "los lunes y viernes".
    const dias = letras.map((l) => DIAS_SEMANA[l]);
    if (dias.length === 1) return `Sale los ${dias[0]}`;
    return `Sale los ${dias.slice(0, -1).join(', ')} y ${dias[dias.length - 1]}`;
  }

  // La temporada 2026 va de abril de 2026 a marzo de 2027.
  function textoTemporada(t) {
    return (datos && datos.temporadas[t]) || t;
  }

  // La pagina de Europamundo se arma con el numero de ruta y la temporada.
  // Un circuito con ID de la proxima temporada (v.ip) es la misma ruta.
  function linkCotizar(v, temporada) {
    return `https://www.europamundo.com/itinerario_cotizar.aspx?rutaid=${encodeURIComponent(v.r)}&temp=${encodeURIComponent(temporada || v.t)}`;
  }

  function linkItinerario(v, temporada) {
    return `https://www.europamundo.com/itinerario_detallado.aspx?rutaid=${encodeURIComponent(v.r)}&temp=${encodeURIComponent(temporada || v.t)}`;
  }

  function proximaTemporada(v) {
    return v.ip ? String(Number(v.t) + 1) : '';
  }

  function escapar(t) {
    return String(t == null ? '' : t)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function fechaCorta(iso) {
    const [a, m, d] = String(iso || '').split('-').map(Number);
    return a ? `${d} ${MESES[m - 1]} ${a}` : '';
  }

  // ---------- Filtros ----------

  function llenarFiltros() {
    const series = [...new Set(datos.viajes.map((v) => v.s))]
      .map((s) => ({ s, nombre: datos.series[s] || s, cuantos: datos.viajes.filter((v) => v.s === s).length }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
    el('catSerie').innerHTML = '<option value="">Todas</option>'
      + series.map((x) => `<option value="${escapar(x.s)}">${escapar(x.nombre)} (${x.cuantos})</option>`).join('');

    const temporadas = [...new Set(datos.viajes.map((v) => v.t))].sort();
    el('catTemporada').innerHTML = '<option value="">Las dos</option>'
      + temporadas.map((t) => {
        const anio = Number(t);
        return `<option value="${escapar(t)}">${escapar(textoTemporada(t))} (abr ${anio} – mar ${anio + 1})</option>`;
      }).join('');

    el('catActualizado').textContent = `${datos.viajes.length.toLocaleString('es-CO')} circuitos · `
      + `precios del ${fechaCorta(datos.actualizado)}`;
  }

  function filtrar() {
    const palabras = normalizar(el('catBuscar').value).split(/\s+/).filter(Boolean);
    const serie = el('catSerie').value;
    const [dMin, dMax] = (el('catDias').value || '0-999').split('-').map(Number);
    const tope = Number(el('catPrecio').value) || 0;
    const temporada = el('catTemporada').value;
    const salida = el('catSalida').value;
    const orden = el('catOrden').value;

    filtrados = datos.viajes.filter((v) => (!serie || v.s === serie)
      && v.d >= dMin && v.d <= dMax
      && (!tope || v.p <= tope)
      && (!temporada || v.t === temporada || proximaTemporada(v) === temporada)
      && (!salida || v.sa.includes(salida))
      && palabras.every((p) => v.buscable.includes(p)));

    const porNombre = (a, b) => a.n.localeCompare(b.n, 'es') || a.t.localeCompare(b.t);
    const criterios = {
      precio: (a, b) => a.p - b.p || porNombre(a, b),
      dias: (a, b) => a.d - b.d || a.p - b.p,
      nombre: porNombre,
    };
    filtrados.sort(criterios[orden] || criterios.precio);
    mostrados = 0;
    el('catLista').innerHTML = '';
    pintarMas();
  }

  // ---------- Lista ----------

  function tarjeta(v) {
    const prox = proximaTemporada(v);
    const datosLinea = [
      `${v.d} días`,
      escapar(v.serieNombre),
      escapar(textoSalidas(v.sa)),
      prox ? `Temporadas ${escapar(textoTemporada(v.t))} y ${escapar(textoTemporada(prox))}`
        : `Temporada ${escapar(textoTemporada(v.t))}`,
      prox ? `ID ${escapar(v.i)} / ${escapar(v.ip)}` : `ID ${escapar(v.i)}`,
    ].filter(Boolean).join(' · ');
    const externo = window.icono ? window.icono('externo') : '';
    // Con dos temporadas, un boton por cada una: el precio y las fechas
    // cambian de una a otra y Europamundo las cotiza por separado.
    const cotizar = prox
      ? `<a class="btn-add btn-compact" href="${linkCotizar(v)}" target="_blank" rel="noopener noreferrer">Cotizar ${escapar(textoTemporada(v.t))} ${externo}</a>
        <a class="btn-add btn-compact" href="${linkCotizar(v, prox)}" target="_blank" rel="noopener noreferrer">Cotizar ${escapar(textoTemporada(prox))} ${externo}</a>`
      : `<a class="btn-add btn-compact" href="${linkCotizar(v)}" target="_blank" rel="noopener noreferrer">Cotizar en Europamundo ${externo}</a>`;
    return `<article class="cat-item">
      <div class="cat-cabeza">
        <strong>${escapar(v.n)}</strong>
        <span class="cat-precio" title="Precio desde de la temporada ${escapar(textoTemporada(v.t))}, por persona">desde ${dolares(v.p)}</span>
      </div>
      <p class="cat-datos">${datosLinea}</p>
      <p class="cat-ruta"><span class="cat-etiqueta">Recorre</span> ${v.ruta.map(escapar).join(' · ')}</p>
      <p class="cat-paises">${escapar(v.paisesTexto.join(', '))}</p>
      <div class="cat-acciones">
        ${cotizar}
        <a class="btn-secondary btn-compact" href="${linkItinerario(v, prox || v.t)}" target="_blank" rel="noopener noreferrer">Ver itinerario ${externo}</a>
        <button type="button" class="btn-secondary btn-compact" data-usar="${escapar(v.i)}">Usar en Paquetes</button>
      </div>
    </article>`;
  }

  function pintarMas() {
    const lista = el('catLista');
    const total = filtrados.length;
    if (!total) {
      lista.innerHTML = window.vacio
        ? window.vacio('catalogo', 'Ningún circuito coincide.', 'Prueba con menos palabras o quita algún filtro.')
        : '<p class="hint">Ningún circuito coincide.</p>';
      el('catConteo').textContent = '';
      el('catMasBtn').classList.add('hidden');
      return;
    }
    const siguiente = filtrados.slice(mostrados, mostrados + POR_PAGINA);
    lista.insertAdjacentHTML('beforeend', siguiente.map(tarjeta).join(''));
    mostrados += siguiente.length;
    el('catConteo').textContent = total === 1 ? '1 circuito'
      : `${total.toLocaleString('es-CO')} circuitos${mostrados < total ? ` · ves ${mostrados}` : ''}`;
    const quedan = total - mostrados;
    el('catMasBtn').textContent = `Ver ${Math.min(quedan, POR_PAGINA)} más`;
    el('catMasBtn').classList.toggle('hidden', quedan <= 0);
  }

  // ---------- Pasar a Paquetes ----------
  //
  // Llena lo que el catalogo sabe: nombre, codigo, serie, dias, paises y
  // ciudad de inicio. El precio NO: el "desde" es el mas barato de toda la
  // temporada y cotizar con el seria prometer lo que no es.
  //
  // La ciudad de FIN tampoco: la lista de Europamundo trae cada ciudad una
  // sola vez, asi que un circuito que vuelve a Estambul "termina" en Bursa.
  // El fin exacto llega con el presupuesto.

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

    poner('pkNombre', v.n);
    poner('pkOperador', 'Europamundo');
    poner('pkCodigo', String(v.i));
    poner('pkCategoria', v.serieNombre);
    poner('pkPaises', v.paisesTexto.join(', '));
    poner('pkDias', String(v.d));
    poner('pkCiudadInicio', v.ruta[0] || '');

    const estado = el('pkArchivoEstado');
    if (estado) {
      estado.innerHTML = `✅ Se llenó desde el Catálogo: <strong>${escapar(v.n)}</strong> (${v.d} días). `
        + 'Falta el precio de tu fecha y el día a día: '
        + `<a href="${linkCotizar(v)}" target="_blank" rel="noopener noreferrer">cotízalo en Europamundo</a>`
        + ' y carga aquí el presupuesto en PDF.';
    }
    const boton = document.querySelector('.tab-btn[data-tab="packagesPanel"]');
    if (boton) boton.click();
  }

  // ---------- Arranque ----------

  // Los datos pueden haber llegado antes desde Paquetes (al leer un
  // presupuesto): por eso se lleva aparte si la pantalla ya se armo.
  let armado = false;

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
  el('catBuscar').addEventListener('input', () => {
    clearTimeout(espera);
    espera = setTimeout(() => { if (armado) filtrar(); }, 150);
  });
  ['catSerie', 'catDias', 'catTemporada', 'catSalida', 'catOrden'].forEach((id) => {
    el(id).addEventListener('change', () => { if (armado) filtrar(); });
  });
  el('catPrecio').addEventListener('input', () => {
    clearTimeout(espera);
    espera = setTimeout(() => { if (armado) filtrar(); }, 250);
  });
  el('catMasBtn').addEventListener('click', pintarMas);

  el('catLista').addEventListener('click', (ev) => {
    const boton = ev.target.closest('[data-usar]');
    if (!boton || !datos) return;
    const v = datos.viajes.find((x) => String(x.i) === boton.dataset.usar);
    if (v) usarEnPaquetes(v);
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
