// Bloque de vuelos reutilizable: ida y regreso, con escala por tramo y
// multidestino.
//
// Existe porque el mismo bloque hace falta en dos sitios. En Cotizaciones esta
// escrito a mano en el HTML desde el principio; aqui se genera, para que el
// segundo sitio -Paquetes- no sea una copia de noventa lineas que despues haya
// que arreglar dos veces. La escala por tramo, por ejemplo, ya se arreglo una
// vez y no deberia volver a arreglarse en otro lado.
//
// Todo va parametrizado por un prefijo, asi que el bloque de Cotizaciones se
// puede pasar a esta funcion con prefijo "q" sin tocar app.js: los ids que
// genera son los mismos que ya usa.

(function (global) {
  function campoSelect(id, clase, etiqueta) {
    return `<label>${etiqueta}<select id="${id}" class="${clase}"></select></label>`;
  }

  // El marcado de un tramo. `regreso` cambia las etiquetas y agrega los campos
  // de multidestino, que solo tienen sentido en la vuelta.
  function tramo(p, regreso) {
    const n = regreso ? 'Return' : '';
    const c = regreso ? '-return' : '';
    const nombreRadio = `${p}${regreso ? 'Return' : ''}TipoVuelo`;

    const escala = `
      <div class="radio-row">
        <span class="radio-title">Tipo de vuelo</span>
        <label class="radio-label"><input type="radio" name="${nombreRadio}" class="${p}${c}-tipo" value="DIRECTO" checked /> Directo</label>
        <label class="radio-label"><input type="radio" name="${nombreRadio}" class="${p}${c}-tipo" value="ESCALA" /> Con escala</label>
      </div>
      <div class="grid-2 ${p}${c}-escala-fields hidden">
        <label>Tiempo de escala (hh:mm)
          <input type="text" inputmode="numeric" pattern="[0-9]{1,2}:[0-5][0-9]" placeholder="Ej. 01:30" id="${p}${n}EscalaTiempo" />
        </label>
        ${campoSelect(`${p}${n}EscalaLugar`, 'airport-select', 'Lugar de escala')}
      </div>`;

    if (!regreso) {
      return `
      <h4>Vuelo de ida</h4>
      <div class="grid-3">
        ${campoSelect(`${p}Airline`, 'airline-select', 'Aerolínea')}
        <label class="${p}-airline-other-wrap hidden">Especifica la aerolínea
          <input type="text" id="${p}AirlineOther" placeholder="Nombre de la aerolínea" />
        </label>
        ${campoSelect(`${p}Origin`, 'airport-select', 'Origen')}
        ${campoSelect(`${p}Dest`, 'airport-select', 'Destino')}
      </div>
      <div class="grid-3">
        <label>Fecha de salida<input type="date" id="${p}DepartDate" /></label>
        <label>Hora de salida<input type="time" id="${p}DepartTime" /></label>
        <label>Hora de llegada<input type="time" id="${p}ArriveTime" /></label>
      </div>${escala}`;
    }

    return `
      <h4>Vuelo de regreso</h4>
      <p class="hint">Deja la fecha en blanco si el viaje es solo de ida.</p>
      <div class="grid-3">
        <label>Fecha de regreso<input type="date" id="${p}ReturnDate" /></label>
        <label>Hora de salida<input type="time" id="${p}ReturnDepartTime" /></label>
        <label>Hora de llegada<input type="time" id="${p}ReturnArriveTime" /></label>
      </div>
      <label class="checkbox-label toggle-return">
        <input type="checkbox" id="${p}ReturnMultidestino" />
        El regreso es con otra aerolínea u otro aeropuerto (multidestino)
      </label>
      <div class="grid-3 ${p}-return-multi-fields hidden">
        ${campoSelect(`${p}ReturnAirline`, 'airline-select', 'Aerolínea (regreso)')}
        <label class="${p}-return-airline-other-wrap hidden">Especifica la aerolínea
          <input type="text" id="${p}ReturnAirlineOther" placeholder="Nombre de la aerolínea" />
        </label>
        ${campoSelect(`${p}ReturnOrigin`, 'airport-select', 'Origen (regreso)')}
        ${campoSelect(`${p}ReturnDest`, 'airport-select', 'Destino (regreso)')}
      </div>${escala}`;
  }

  // Dibuja el bloque dentro de `contenedor` y deja todo conectado.
  global.crearBloqueVuelos = function crearBloqueVuelos(contenedor, p) {
    if (!contenedor) return;
    contenedor.innerHTML = tramo(p, false) + tramo(p, true);

    const el = (id) => document.getElementById(id);
    contenedor.querySelectorAll('.airline-select').forEach(populateAirlineSelect);
    contenedor.querySelectorAll('.airport-select').forEach(populateAirportSelect);

    // Escala: los campos solo aparecen si se eligio "con escala".
    [['', ''], ['Return', '-return']].forEach(([n, c]) => {
      const campos = contenedor.querySelector(`.${p}${c}-escala-fields`);
      contenedor.querySelectorAll(`.${p}${c}-tipo`).forEach((radio) => {
        radio.addEventListener('change', () => {
          campos.classList.toggle('hidden', radio.value !== 'ESCALA' || !radio.checked);
        });
      });
    });

    // Multidestino: aerolinea y aeropuertos propios para la vuelta.
    const multi = el(`${p}ReturnMultidestino`);
    const camposMulti = contenedor.querySelector(`.${p}-return-multi-fields`);
    multi.addEventListener('change', () => {
      camposMulti.classList.toggle('hidden', !multi.checked);
    });

    // "OTRA" abre el campo de texto para escribir la aerolinea.
    [['Airline', `.${p}-airline-other-wrap`],
     ['ReturnAirline', `.${p}-return-airline-other-wrap`]].forEach(([campo, sel]) => {
      const select = el(`${p}${campo}`);
      const envoltura = contenedor.querySelector(sel);
      select.addEventListener('change', () => {
        envoltura.classList.toggle('hidden', select.value !== 'OTRA');
      });
    });
  };

  // Lee el bloque y devuelve los mismos nombres que ya usa la cotizacion de
  // vuelos, para que el texto se arme igual en los dos sitios.
  global.leerBloqueVuelos = function leerBloqueVuelos(p) {
    const el = (id) => document.getElementById(id);
    const val = (id) => (el(id) ? el(id).value : '');
    const marcado = (clase) => {
      const r = document.querySelector(`.${clase}:checked`);
      return r ? r.value : 'DIRECTO';
    };
    const aerolinea = (campo, otro) =>
      (val(campo) === 'OTRA' ? val(otro).trim() : val(campo));

    const multi = el(`${p}ReturnMultidestino`) && el(`${p}ReturnMultidestino`).checked;
    return {
      airline: aerolinea(`${p}Airline`, `${p}AirlineOther`),
      origin: val(`${p}Origin`),
      dest: val(`${p}Dest`),
      departDate: val(`${p}DepartDate`),
      departTime: val(`${p}DepartTime`),
      arriveTime: val(`${p}ArriveTime`),
      tipoVuelo: marcado(`${p}-tipo`),
      escalaTiempo: val(`${p}EscalaTiempo`).trim(),
      escalaLugar: val(`${p}EscalaLugar`),
      returnDate: val(`${p}ReturnDate`),
      returnDepartTime: val(`${p}ReturnDepartTime`),
      returnArriveTime: val(`${p}ReturnArriveTime`),
      returnMultidestino: !!multi,
      returnAirline: multi ? aerolinea(`${p}ReturnAirline`, `${p}ReturnAirlineOther`) : '',
      returnOrigin: multi ? val(`${p}ReturnOrigin`) : '',
      returnDest: multi ? val(`${p}ReturnDest`) : '',
      returnTipoVuelo: marcado(`${p}-return-tipo`),
      returnEscalaTiempo: val(`${p}ReturnEscalaTiempo`).trim(),
      returnEscalaLugar: val(`${p}ReturnEscalaLugar`),
    };
  };
})(window);
