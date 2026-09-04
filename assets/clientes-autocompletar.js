// Autocompletar clientes que ya estan en la base.
//
// Los mismos clientes vuelven -una familia que viaja cada año, alguien que
// compra para varios-, y hasta ahora tocaba escribir nombre, telefono y correo
// otra vez cada vez. Peor: escribirlos distinto crea un cliente duplicado.
//
// Se usa un <datalist> del navegador y no un desplegable propio: filtra
// mientras se escribe, funciona igual en el telefono, y si no hay clientes
// cargados el campo se comporta como el campo de texto de siempre.

(function () {
  const LISTA = 'listaClientes';

  const lista = document.createElement('datalist');
  lista.id = LISTA;
  document.body.appendChild(lista);

  let clientes = [];

  function pintar(nuevos) {
    clientes = nuevos || [];
    // Sin nombre no sirve para elegir; los repetidos se muestran una vez.
    const nombres = [...new Set(
      clientes.map((c) => (c.nombre || '').trim()).filter(Boolean)
    )].sort((a, b) => a.localeCompare(b, 'es'));

    lista.innerHTML = '';
    const frag = document.createDocumentFragment();
    nombres.forEach((n) => {
      const o = document.createElement('option');
      o.value = n;                      // .value nunca interpreta HTML
      frag.appendChild(o);
    });
    lista.appendChild(frag);
  }

  function buscarPorNombre(nombre) {
    const buscado = String(nombre || '').trim().toLowerCase();
    if (!buscado) return null;
    return clientes.find((c) => (c.nombre || '').trim().toLowerCase() === buscado) || null;
  }

  // El telefono se guarda completo ("+57 300 123 4567") pero el formulario lo
  // pide partido en indicativo y numero. Se separa por el primer espacio, que
  // es como lo arma buildFullClientPhone.
  function partirTelefono(completo) {
    const t = String(completo || '').trim();
    const m = t.match(/^(\+\d{1,4})\s+(.*)$/);
    return m ? { indicativo: m[1], numero: m[2].trim() } : { indicativo: '', numero: t };
  }

  const el = (id) => document.getElementById(id);

  // Conecta un campo de nombre con los campos que debe rellenar.
  //
  // Al reconocer un cliente los campos quedan con SUS datos, incluso vacios.
  // El primer intento fue rellenar solo lo que el cliente tuviera, para no
  // pisar lo escrito a mano; pero entonces elegir a alguien sin telefono
  // dejaba el telefono del cliente anterior, y una cotizacion con el numero de
  // otra persona se ve perfectamente correcta. Un campo vacio se nota; uno
  // equivocado no.
  function conectar(idNombre, campos) {
    const entrada = el(idNombre);
    if (!entrada) return;
    entrada.setAttribute('list', LISTA);
    entrada.setAttribute('autocomplete', 'off');

    const rellenar = () => {
      const c = buscarPorNombre(entrada.value);
      if (!c) return;
      if (campos.telefono && el(campos.telefono)) {
        const { indicativo, numero } = partirTelefono(c.telefono);
        const campoInd = campos.indicativo && el(campos.indicativo);
        // Se elige con elegirIndicativo y no fijando el valor: el +1 lo
        // comparten Estados Unidos y Canada, y a secas quedaba en Canada.
        // Si el guardado no existe en la lista, deja el que estaba.
        if (campoInd && indicativo) elegirIndicativo(campoInd, indicativo);
        el(campos.telefono).value = numero;
      }
      if (campos.correo && el(campos.correo)) el(campos.correo).value = c.correo || '';
      if (campos.aviso && el(campos.aviso)) {
        el(campos.aviso).textContent = `👤 Datos traídos de tu base de clientes.`;
      }
    };

    // `change` cubre el clic en la sugerencia; `input` cubre escribirlo
    // completo a mano, que tambien debe rellenar.
    entrada.addEventListener('change', rellenar);
    entrada.addEventListener('input', rellenar);
  }

  // Los nombres de pasajero solo sugieren: no hay telefono por pasajero.
  // El atributo va en la plantilla, asi que las filas que se agreguen despues
  // lo heredan sin tener que engancharlas una por una.
  function conectarPasajeros() {
    const plantilla = document.getElementById('passengerTemplate');
    if (plantilla) {
      const campo = plantilla.content.querySelector('.p-name');
      if (campo) {
        campo.setAttribute('list', LISTA);
        campo.setAttribute('autocomplete', 'off');
      }
    }
    document.querySelectorAll('.p-name').forEach((c) => {
      c.setAttribute('list', LISTA);
      c.setAttribute('autocomplete', 'off');
    });
  }

  function arrancar() {
    conectarPasajeros();
    conectar('qClientName', {
      indicativo: 'qClientCountryCode', telefono: 'qClientPhone', correo: 'qClientEmail',
    });
    conectar('pkClientName', {
      indicativo: 'pkClientCountryCode', telefono: 'pkClientPhone', correo: 'pkClientEmail',
    });
    conectar('invBuyerName', {});
    if (window.alCambiarClientes) window.alCambiarClientes(pintar);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', arrancar);
  } else {
    arrancar();
  }

  window.autocompletarClientes = { pintar, buscarPorNombre, partirTelefono };
})();
