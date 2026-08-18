import type { Mcc } from './types';

/**
 * Titulos tomados del Visa Merchant Data Standards Manual, abril 2026.
 *
 * Regla de asignacion, seccion 1 del manual:
 * "The MCC is a four-digit number assigned to describe a Merchant's primary
 * business based on annual sales volume."
 *
 * Esa frase es el porque de todo el producto: Walmart vende comida, pero su
 * negocio primario no es comida, asi que no codifica como supermercado.
 *
 * Cada titulo fue verificado uno por uno contra el PDF del manual el 18 de agosto
 * de 2026. Ninguno viene de memoria ni de un resumen de terceros.
 */
export const MCC_CATALOG: Record<string, Mcc> = {
  // Mercaderia general. Aca viven las exclusiones que rompen las categorias
  // de supermercado de las tarjetas premium.
  '5200': { code: '5200', title: 'Home Supply Warehouse Stores' },
  '5251': { code: '5251', title: 'Hardware Stores' },
  '5300': {
    code: '5300',
    title: 'Wholesale Clubs',
    note: 'Costco, BJ\'s, PriceSmart. Excluidos de la categoria de supermercados.',
  },
  '5310': {
    code: '5310',
    title: 'Discount Stores',
    note: 'Walmart y Target. Es la exclusion mas conocida entre usuarios de tarjetas en USA.',
  },
  '5311': { code: '5311', title: 'Department Stores' },
  '5331': { code: '5331', title: 'Variety Stores' },
  '5399': { code: '5399', title: 'Miscellaneous General Merchandise' },

  // Alimentos. La frontera entre 5411 y todo lo demas es donde se decide la plata.
  '5411': {
    code: '5411',
    title: 'Grocery Stores and Supermarkets',
    note: 'El manual exige que los perecederos sean al menos el 45% del volumen mensual de ventas.',
  },
  '5422': {
    code: '5422',
    title: 'Freezer and Locker Meat Provisioners',
    note: 'Carnicerias y meat markets. No es 5411 aunque venda comida.',
  },
  '5441': { code: '5441', title: 'Candy, Nut, and Confectionery Stores' },
  '5451': {
    code: '5451',
    title: 'Dairy Products Stores',
    note: 'El manual incluye heladerias: "butter, cheese, ice cream, milk, and other dairy".',
  },
  '5462': { code: '5462', title: 'Bakeries' },
  '5499': {
    code: '5499',
    title: 'Miscellaneous Food Stores - Convenience Stores and Specialty Markets',
    note:
      'Amex nombra explicitamente a las convenience stores como excluidas de la ' +
      'categoria de supermercados. Un 7-Eleven no es un 5411.',
  },

  // Combustible. El par 5541 y 5542 cambia segun donde pagues, no segun donde estes.
  '5541': {
    code: '5541',
    title: 'Service Stations (With or without Ancillary Services)',
    note: 'Cita del manual: "Excluded from this category code are Automated Fuel Dispensers, MCC 5542".',
  },
  '5542': {
    code: '5542',
    title: 'Automated Fuel Dispensers',
    note: 'Surtidor desatendido. Misma gasolinera que 5541, distinto MCC segun donde pagues.',
  },

  // Retail de mall.
  '4812': { code: '4812', title: 'Telecommunication Equipment and Telephone Sales' },
  '5651': { code: '5651', title: 'Family Clothing Stores' },
  '5655': { code: '5655', title: 'Sports and Riding Apparel Stores' },
  '5661': { code: '5661', title: 'Shoe Stores' },
  '5712': {
    code: '5712',
    title: 'Furniture, Home Furnishings, and Equipment Stores, Except Appliances',
  },
  '5722': { code: '5722', title: 'Household Appliance Stores' },
  '5732': { code: '5732', title: 'Electronics Stores' },
  '5733': {
    code: '5733',
    title: 'Music Stores - Musical Instruments, Pianos, and Sheet Music',
  },
  '5735': { code: '5735', title: 'Record Stores' },
  '5941': { code: '5941', title: 'Sporting Goods Stores' },
  '5942': { code: '5942', title: 'Book Stores' },
  '5943': {
    code: '5943',
    title: 'Stationery Stores, Office and School Supply Stores',
  },
  '5944': {
    code: '5944',
    title: 'Jewelry Stores, Watches, Clocks, and Silverware Stores',
  },
  '5945': { code: '5945', title: 'Hobby, Toy, and Game Shops' },
  '5946': { code: '5946', title: 'Camera and Photographic Supply Stores' },
  '5947': { code: '5947', title: 'Gift, Card, Novelty and Souvenir Shops' },
  '5948': { code: '5948', title: 'Luggage and Leather Goods Stores' },
  '5977': { code: '5977', title: 'Cosmetic Stores' },
  '5992': { code: '5992', title: 'Florists' },
  '5995': { code: '5995', title: 'Pet Shops, Pet Foods and Supplies Stores' },

  // Comida preparada.
  '5812': {
    code: '5812',
    title: 'Eating Places and Restaurants',
    note: 'Consumo inmediato, tipicamente con servicio de mesa.',
  },
  '5813': {
    code: '5813',
    title:
      'Drinking Places (Alcoholic Beverages) - Bars, Taverns, Nightclubs, ' +
      'Cocktail Lounges, and Discotheques',
    note: 'Un bar no es un restaurante para efectos de categoria, aunque sirva comida.',
  },
  '5814': {
    code: '5814',
    title: 'Fast Food Restaurants',
    note: 'Se ordena y se paga en mostrador, kiosco o ventanilla.',
  },

  // Salud y servicios.
  '5912': { code: '5912', title: 'Drug Stores and Pharmacies' },
  '7210': { code: '7210', title: 'Laundry, Cleaning, and Garment Services' },
  '7230': { code: '7230', title: 'Beauty and Barber Shops' },
  '7298': { code: '7298', title: 'Health and Beauty Spas' },
  '7832': { code: '7832', title: 'Motion Picture Theaters' },
  '7997': {
    code: '7997',
    title:
      'Membership Clubs (Sports, Recreation, Athletic), Country Clubs, and ' +
      'Private Golf Courses',
    note: 'Aca cae un gimnasio. No es 7298 (spa) ni 5941 (venta de articulos deportivos).',
  },
  '8043': { code: '8043', title: 'Opticians, Optical Goods, and Eyeglasses' },
};

export function lookupMcc(code: string): Mcc {
  const found = MCC_CATALOG[code];
  if (found) return found;
  return { code, title: `MCC ${code} (sin titulo en el catalogo)` };
}
