// Catálogo tomado de la hoja "LISTA DESPLEGABLE" del modelo de Blue Travel.
const AIRPORTS = [
  { code: 'IAD', city: 'Washington-Dulles', country: 'EE. UU.', name: 'Aeropuerto Internacional de Washington-Dulles' },
  { code: 'MCO', city: 'Orlando', country: 'EE. UU.', name: 'Aeropuerto Internacional de Orlando' },
  { code: 'GUA', city: 'Ciudad de Guatemala', country: 'Guatemala', name: 'Aeropuerto Internacional La Aurora' },
  { code: 'SAL', city: 'San Salvador', country: 'El Salvador', name: 'Aeropuerto Internacional San Óscar Arnulfo Romero y Galdámez' },
  { code: 'MGA', city: 'Managua', country: 'Nicaragua', name: 'Aeropuerto Internacional Augusto C. Sandino' },
  { code: 'BWI', city: 'Baltimore', country: 'EE. UU.', name: 'Aeropuerto Internacional Thurgood Marshall de Baltimore-Washington' },
  { code: 'DCA', city: 'Washington D.C', country: 'EE. UU.', name: 'Aeropuerto Nacional Ronald Reagan de Washington' },
  { code: 'LAX', city: 'Los Ángeles', country: 'EE. UU.', name: 'Aeropuerto Internacional de Los Ángeles' },
  { code: 'IAH', city: 'Houston', country: 'EE. UU.', name: 'Aeropuerto Intercontinental George Bush' },
  { code: 'BOS', city: 'Boston', country: 'EE. UU.', name: 'Aeropuerto Internacional Logan' },
  { code: 'SAP', city: 'San Pedro Sula', country: 'Honduras', name: 'Aeropuerto Internacional Ramón Villeda Morales' },
  { code: 'PUJ', city: 'Punta Cana', country: 'República Dominicana', name: 'Aeropuerto Internacional de Punta Cana' },
  { code: 'CUN', city: 'Cancún', country: 'México', name: 'Aeropuerto Internacional de Cancún' },
  { code: 'MEX', city: 'Ciudad de México', country: 'México', name: 'Aeropuerto Internacional de la Ciudad de México' },
  { code: 'BOG', city: 'Bogotá', country: 'Colombia', name: 'Aeropuerto Internacional El Dorado' },
  { code: 'XPL', city: 'Tegucigalpa', country: 'Honduras', name: 'Aeropuerto Internacional Palmerola' },
  { code: 'CMB', city: 'Colombo', country: 'Sri Lanka', name: 'Aeropuerto Internacional Bandaranaike' },
  { code: 'MIA', city: 'Miami', country: 'EE. UU.', name: 'Aeropuerto Internacional de Miami' },
  { code: 'PEI', city: 'Pereira', country: 'Colombia', name: 'Aeropuerto Internacional Matecaña' },
  { code: 'CLT', city: 'Charlotte', country: 'EE. UU.', name: 'Aeropuerto Internacional de Charlotte-Douglas' },
  { code: 'SJO', city: 'San José de Costa Rica', country: 'Costa Rica', name: 'Aeropuerto Internacional Juan Santamaría' },
  { code: 'JFK', city: 'Nueva York', country: 'EE. UU.', name: 'Aeropuerto Internacional John F. Kennedy' },
  { code: 'PTY', city: 'Ciudad de Panamá', country: 'Panamá', name: 'Aeropuerto Internacional de Tocumen' },
  { code: 'ORD', city: 'Chicago', country: 'EE. UU.', name: 'Aeropuerto Internacional de Chicago' },
  { code: 'PVR', city: 'Puerto Vallarta', country: 'México', name: 'Aeropuerto Internacional de Puerto Vallarta' },
  { code: 'ATL', city: 'Atlanta', country: 'EE. UU.', name: 'Aeropuerto Internacional Hartsfield-Jackson' },
  { code: 'LIM', city: 'Lima', country: 'Perú', name: 'Aeropuerto Internacional Jorge Chávez' },
  { code: 'SFO', city: 'San Francisco', country: 'EE. UU.', name: 'Aeropuerto Internacional de San Francisco' },
  { code: 'CTG', city: 'Cartagena', country: 'Colombia', name: 'Aeropuerto Internacional Rafael Núñez' },
  { code: 'SCL', city: 'Santiago de Chile', country: 'Chile', name: 'Aeropuerto Internacional Arturo Merino Benítez' },
  { code: 'BDL', city: 'Windsor Locks', country: 'EE. UU.', name: 'Aeropuerto Internacional Bradley' },
  { code: 'CLO', city: 'Cali', country: 'Colombia', name: 'Aeropuerto Internacional Alfonso Bonilla Aragón' },
  { code: 'LIT', city: 'Little Rock', country: 'EE. UU.', name: 'Aeropuerto Nacional Little Rock' },
  { code: 'EZE', city: 'Buenos Aires', country: 'Argentina', name: 'Aeropuerto Internacional Ministro Pistarini' },
  { code: 'TAP', city: 'Tapachula', country: 'México', name: 'Aeropuerto Internacional de Tapachula' },
  { code: 'PHL', city: 'Filadelfia', country: 'EE. UU.', name: 'Aeropuerto Internacional de Filadelfia' },
  { code: 'SJU', city: 'San Juan', country: 'EE. UU.', name: 'Aeropuerto Internacional Luis Muñoz Marín' },
  { code: 'NAS', city: 'Nasáu', country: 'Bahamas', name: 'Aeropuerto Internacional Lynden Pindling' },
  { code: 'DFW', city: 'Dallas', country: 'EE. UU.', name: 'Aeropuerto Internacional de Dallas-Fort Worth' },
  { code: 'BAQ', city: 'Barranquilla', country: 'Colombia', name: 'Aeropuerto Internacional Ernesto Cortissoz' },
  { code: 'SDQ', city: 'Santo Domingo', country: 'República Dominicana', name: 'Aeropuerto Internacional Las Américas' },
  { code: 'DTW', city: 'Detroit', country: 'EE. UU.', name: 'Aeropuerto Internacional de Detroit' },
  { code: 'RDU', city: 'Raleigh-Durham', country: 'EE. UU.', name: 'Aeropuerto Internacional de Raleigh-Durham' },
  { code: 'JAN', city: 'Jackson', country: 'EE. UU.', name: 'Jackson-Medgar Wiley Evers' },
  { code: 'VER', city: 'Veracruz', country: 'México', name: 'Aeropuerto Internacional de Veracruz' },
  { code: 'MDE', city: 'Medellín', country: 'Colombia', name: 'Aeropuerto Internacional José María Córdova' },
  { code: 'MTY', city: 'Monterrey', country: 'México', name: 'Aeropuerto Internacional de Monterrey' },
  { code: 'SLC', city: 'Salt Lake City', country: 'EE. UU.', name: 'Aeropuerto Internacional de Salt Lake City' },
  { code: 'BJX', city: 'Zona metropolitana de León', country: 'México', name: 'Aeropuerto Internacional de Guanajuato' },
  { code: 'VVI', city: 'Santa Cruz de la Sierra', country: 'Bolivia', name: 'Aeropuerto Internacional Viru Viru' },
  { code: 'LPB', city: 'La Paz', country: 'Bolivia', name: 'Aeropuerto Internacional El Alto' },
];

const AIRLINES = [
  'AVIANCA', 'LATAM', 'UNITED', 'VOLARIS', 'SPIRIT', 'COPA AIRLINES', 'DELTA',
  'SOUTH WEST', 'QATAR AIRWAYS', 'AMERICAN AIRLINES', 'ALASKA AIRLINES',
  'AEROMEXICO', 'FRONTIER AIRLINES', 'AIR CANADA', 'ARAJET',
];

// La primera linea decia "La informacion detallada es la correcta". Estaba
// escrita como afirmacion de la agencia, pero el cliente la leia como una
// instruccion y preguntaba donde confirmaba. Ahora dice que revisar, hasta
// cuando, y que pasa si no se hace: las aerolineas solo permiten corregir un
// nombre dentro de las primeras 24 horas, y despues cobran o no lo permiten.
const DEFAULT_TERMS = `Revise que los nombres y apellidos coincidan EXACTAMENTE con el pasaporte o documento con el que va a viajar. Si algo no coincide, avísenos dentro de las próximas 24 horas: pasado ese plazo la aerolínea cobra la corrección o no la permite.
Los boletos aéreos no son reembolsables ni transferibles.
Blue Travel no se hace responsable por cambios que la aerolínea haga en itinerarios y en políticas de equipaje.
Cualquier cambio está sujeto a penalidad de hasta $300 más posible diferencia de tarifa original de la aerolínea.
Haga su check-in con la aerolínea y preséntese 3 horas antes en el aeropuerto el día del viaje.`;

function airportLabel(a) {
  return `${a.code} - ${a.city}, ${a.country}`;
}

function findAirport(code) {
  return AIRPORTS.find(a => a.code === code);
}
