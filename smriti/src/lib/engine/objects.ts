import type { UILanguage } from '@/lib/i18n/languages';

export interface SmritiObject {
  id: string;
  name: Record<UILanguage, string>;
  emoji: string;
  category: string;
  /** Hex without alpha — callers append their own alpha suffix. */
  categoryColor: string;
}

/**
 * Grounded in Northeast India daily life, so recognition doesn't depend on
 * literacy or on cultural material a patient in this cohort has never seen.
 *
 * Kept well above the highest `objectCount` used by any level (Object
 * Hunt's level 10 shows 8 at once): a pool close to that count leaves the
 * same handful of objects reappearing almost every round, which read as
 * "the game repeats itself" even though the shuffle was working correctly.
 */
export const OBJECTS: SmritiObject[] = [
  { id: 'gamosa', name: { en: 'Gamosa', as: 'গামোচা', hi: 'गमछा' }, emoji: '🧣', category: 'textile', categoryColor: '#8B6914' },
  { id: 'jaapi', name: { en: 'Jaapi', as: 'জাপি', hi: 'जापी' }, emoji: '👒', category: 'craft', categoryColor: '#5C4510' },
  { id: 'bamboo_basket', name: { en: 'Bamboo Basket', as: 'বাঁহৰ চাকি', hi: 'बांस की टोकरी' }, emoji: '🧺', category: 'household', categoryColor: '#5C6BC0' },
  { id: 'mekhela', name: { en: 'Mekhela', as: 'মেখেলা', hi: 'मेखेला' }, emoji: '👘', category: 'textile', categoryColor: '#8B6914' },
  { id: 'dhol', name: { en: 'Dhol', as: 'ঢোল', hi: 'ढोल' }, emoji: '🥁', category: 'instrument', categoryColor: '#00897B' },
  { id: 'xorai', name: { en: 'Xorai', as: 'চৰাই', hi: 'शराई' }, emoji: '🫓', category: 'household', categoryColor: '#5C6BC0' },
  { id: 'tamul', name: { en: 'Betel Nut', as: 'তামোল', hi: 'सुपारी' }, emoji: '🌿', category: 'food', categoryColor: '#C62828' },
  { id: 'rhino', name: { en: 'Rhino', as: 'গঁড়', hi: 'गैंडा' }, emoji: '🦏', category: 'animal', categoryColor: '#2E7D32' },
  { id: 'tea_leaf', name: { en: 'Tea Leaf', as: 'চাহ পাত', hi: 'चाय पत्ती' }, emoji: '🍵', category: 'food', categoryColor: '#C62828' },
  { id: 'clay_pot', name: { en: 'Clay Pot', as: 'মাটিৰ চৰীয়া', hi: 'मिट्टी का बर्तन' }, emoji: '🏺', category: 'household', categoryColor: '#5C6BC0' },
  { id: 'pepa', name: { en: 'Pepa', as: 'পেঁপা', hi: 'पेपा' }, emoji: '🎵', category: 'instrument', categoryColor: '#00897B' },
  { id: 'muga_silk', name: { en: 'Muga Silk', as: 'মুগা পাট', hi: 'मुगा सिल्क' }, emoji: '✨', category: 'textile', categoryColor: '#8B6914' },
  { id: 'rice', name: { en: 'Rice', as: 'চাউল', hi: 'चावल' }, emoji: '🍚', category: 'food', categoryColor: '#C62828' },
  { id: 'fish', name: { en: 'Fish', as: 'মাছ', hi: 'मछली' }, emoji: '🐟', category: 'food', categoryColor: '#C62828' },
  { id: 'banana', name: { en: 'Banana', as: 'কল', hi: 'केला' }, emoji: '🍌', category: 'food', categoryColor: '#C62828' },
  { id: 'mango', name: { en: 'Mango', as: 'আম', hi: 'आम' }, emoji: '🥭', category: 'food', categoryColor: '#C62828' },
  { id: 'elephant', name: { en: 'Elephant', as: 'হাতী', hi: 'हाथी' }, emoji: '🐘', category: 'animal', categoryColor: '#2E7D32' },
  { id: 'cow', name: { en: 'Cow', as: 'গৰু', hi: 'गाय' }, emoji: '🐄', category: 'animal', categoryColor: '#2E7D32' },
  { id: 'duck', name: { en: 'Duck', as: 'হাঁহ', hi: 'बत्तख' }, emoji: '🦆', category: 'animal', categoryColor: '#2E7D32' },
  { id: 'peacock', name: { en: 'Peacock', as: 'ময়ূৰ', hi: 'मोर' }, emoji: '🦚', category: 'animal', categoryColor: '#2E7D32' },
  { id: 'umbrella', name: { en: 'Umbrella', as: 'চাতি', hi: 'छाता' }, emoji: '☂️', category: 'household', categoryColor: '#5C6BC0' },
  { id: 'lamp', name: { en: 'Oil Lamp', as: 'প্ৰদীপ', hi: 'दीया' }, emoji: '🪔', category: 'household', categoryColor: '#5C6BC0' },
  { id: 'book', name: { en: 'Book', as: 'কিতাপ', hi: 'किताब' }, emoji: '📖', category: 'household', categoryColor: '#5C6BC0' },
  { id: 'key', name: { en: 'Key', as: 'চাবি', hi: 'चाबी' }, emoji: '🔑', category: 'household', categoryColor: '#5C6BC0' },
  { id: 'bell', name: { en: 'Bell', as: 'ঘণ্টা', hi: 'घंटी' }, emoji: '🔔', category: 'household', categoryColor: '#5C6BC0' },
  { id: 'bicycle', name: { en: 'Bicycle', as: 'চাইকেল', hi: 'साइकिल' }, emoji: '🚲', category: 'vehicle', categoryColor: '#546E7A' },
  { id: 'boat', name: { en: 'Boat', as: 'নাও', hi: 'नाव' }, emoji: '🛶', category: 'vehicle', categoryColor: '#546E7A' },
  { id: 'sun', name: { en: 'Sun', as: 'সূৰ্য', hi: 'सूरज' }, emoji: '☀️', category: 'nature', categoryColor: '#EF6C00' },
  { id: 'moon', name: { en: 'Moon', as: 'চন্দ্ৰ', hi: 'चाँद' }, emoji: '🌙', category: 'nature', categoryColor: '#3949AB' },
  { id: 'flower', name: { en: 'Flower', as: 'ফুল', hi: 'फूल' }, emoji: '🌸', category: 'nature', categoryColor: '#D81B60' },
  { id: 'tree', name: { en: 'Tree', as: 'গছ', hi: 'पेड़' }, emoji: '🌳', category: 'nature', categoryColor: '#2E7D32' },
];

function shuffled<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/** Random sample without replacement, optionally excluding specific ids. */
export function pickObjects(count: number, exclude: string[] = []): SmritiObject[] {
  const pool = OBJECTS.filter((o) => !exclude.includes(o.id));
  return shuffled(pool).slice(0, count);
}
