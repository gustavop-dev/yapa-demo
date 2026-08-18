/**
 * Vocabulario en espanol para sembrar un venue a mano, mapeado a MCC.
 *
 * Existe porque el formato tiene que ser tipeable desde un telefono caminando un
 * mall. Pedir el MCC de memoria seria garantizar errores; pedir "farmacia" y
 * traducirlo aca es la unica forma de que el dato entre bien.
 *
 * Todos los MCC de este mapa estan verificados contra el Visa Merchant Data
 * Standards Manual, abril 2026.
 */
export const CATEGORY_TO_MCC: Record<string, string> = {
  // Comida
  restaurante: '5812',
  'comida-rapida': '5814',
  cafe: '5814',
  bar: '5813',
  heladeria: '5451',
  panaderia: '5462',
  dulces: '5441',
  carniceria: '5422',
  supermercado: '5411',
  tienda: '5499',
  fruteria: '5499',

  // Ropa y accesorios
  ropa: '5651',
  'ropa-deportiva': '5655',
  zapatos: '5661',
  marroquineria: '5948',
  joyeria: '5944',
  relojeria: '5944',
  cosmeticos: '5977',
  perfumeria: '5977',

  // Tecnologia
  electronica: '5732',
  celulares: '4812',
  telefonia: '4812',
  electrodomesticos: '5722',
  musica: '5733',
  discos: '5735',
  fotografia: '5946',

  // Ocio
  libreria: '5942',
  papeleria: '5943',
  juguetes: '5945',
  videojuegos: '5945',
  regalos: '5947',
  deportes: '5941',
  cine: '7832',
  gimnasio: '7997',
  mascotas: '5995',

  // Servicios
  farmacia: '5912',
  droguería: '5912',
  drogueria: '5912',
  optica: '8043',
  peluqueria: '7230',
  barberia: '7230',
  spa: '7298',
  lavanderia: '7210',
  floristeria: '5992',

  // Hogar
  muebles: '5712',
  ferreteria: '5251',
  materiales: '5200',

  // Mercaderia general
  variedades: '5331',
  departamental: '5311',
  descuento: '5310',
  mayorista: '5300',
  general: '5399',
};

export function knownCategories(): string[] {
  return Object.keys(CATEGORY_TO_MCC).sort();
}
