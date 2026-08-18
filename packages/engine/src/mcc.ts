import type { Mcc } from './types';

/**
 * Titles taken from the Visa Merchant Data Standards Manual, April 2026.
 *
 * Assignment rule, section 1 of the manual:
 * "The MCC is a four-digit number assigned to describe a Merchant's primary
 * business based on annual sales volume."
 *
 * That sentence is the reason the whole product exists: Walmart sells food, but food
 * is not its primary business, so it does not code as a supermarket.
 *
 * Every title was verified one by one against the manual PDF on August 18, 2026. None
 * of them comes from memory or from a third party summary.
 */
export const MCC_CATALOG: Record<string, Mcc> = {
  // General merchandise. This is where the exclusions that break the supermarket
  // categories of premium cards live.
  '5200': { code: '5200', title: 'Home Supply Warehouse Stores' },
  '5251': { code: '5251', title: 'Hardware Stores' },
  '5300': {
    code: '5300',
    title: 'Wholesale Clubs',
    note: 'Costco, BJ\'s, PriceSmart. Excluded from the supermarket category.',
  },
  '5310': {
    code: '5310',
    title: 'Discount Stores',
    note: 'Walmart and Target. The best known exclusion among US card users.',
  },
  '5311': { code: '5311', title: 'Department Stores' },
  '5331': { code: '5331', title: 'Variety Stores' },
  '5399': { code: '5399', title: 'Miscellaneous General Merchandise' },

  // Food. The border between 5411 and everything else is where the money is decided.
  '5411': {
    code: '5411',
    title: 'Grocery Stores and Supermarkets',
    note: 'The manual requires perishables to be at least 45% of monthly sales volume.',
  },
  '5422': {
    code: '5422',
    title: 'Freezer and Locker Meat Provisioners',
    note: 'Butchers and meat markets. Not 5411 even though they sell food.',
  },
  '5441': { code: '5441', title: 'Candy, Nut, and Confectionery Stores' },
  '5451': {
    code: '5451',
    title: 'Dairy Products Stores',
    note: 'The manual includes ice cream shops: "butter, cheese, ice cream, milk, and other dairy".',
  },
  '5462': { code: '5462', title: 'Bakeries' },
  '5499': {
    code: '5499',
    title: 'Miscellaneous Food Stores - Convenience Stores and Specialty Markets',
    note:
      'Amex explicitly names convenience stores as excluded from the supermarket ' +
      'category. A 7-Eleven is not a 5411.',
  },

  // Fuel. The 5541 and 5542 pair changes with where you pay, not with where you are.
  '5541': {
    code: '5541',
    title: 'Service Stations (With or without Ancillary Services)',
    note: 'Manual quote: "Excluded from this category code are Automated Fuel Dispensers, MCC 5542".',
  },
  '5542': {
    code: '5542',
    title: 'Automated Fuel Dispensers',
    note: 'Unattended pump. Same gas station as 5541, different MCC depending on where you pay.',
  },

  // Mall retail.
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

  // Prepared food.
  '5812': {
    code: '5812',
    title: 'Eating Places and Restaurants',
    note: 'Immediate consumption, typically with table service.',
  },
  '5813': {
    code: '5813',
    title:
      'Drinking Places (Alcoholic Beverages) - Bars, Taverns, Nightclubs, ' +
      'Cocktail Lounges, and Discotheques',
    note: 'A bar is not a restaurant for category purposes, even if it serves food.',
  },
  '5814': {
    code: '5814',
    title: 'Fast Food Restaurants',
    note: 'Ordering and payment happen at a counter, kiosk or window.',
  },

  // Health and services.
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
    note: 'A gym lands here. Not 7298 (spa) and not 5941 (sporting goods retail).',
  },
  '8043': { code: '8043', title: 'Opticians, Optical Goods, and Eyeglasses' },
};

export function lookupMcc(code: string): Mcc {
  const found = MCC_CATALOG[code];
  if (found) return found;
  return { code, title: `MCC ${code} (sin titulo en el catalogo)` };
}
