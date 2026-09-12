import type { UILanguage } from '@/lib/i18n/languages';

export interface SmritiObject {
  id: string;
  /** English is the only guaranteed key — every UILanguage widening since
   * (bn/brx/mni/ne) does NOT require re-translating all 66 items here
   * immediately; `objectName()` below falls back to English exactly like
   * the app's own `t()` does ("falling back to English, then to the key").
   * Fill in a language's entry when it has a real translation, not before. */
  name: Partial<Record<UILanguage, string>> & { en: string };
  emoji: string;
  category: string;
  /** Hex without alpha — callers append their own alpha suffix. */
  categoryColor: string;
}

/** The name to display/speak for one object in one language, falling back
 * to English when this object has no translation for it yet. */
export function objectName(object: SmritiObject, language: UILanguage): string {
  return object.name[language] ?? object.name.en;
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

  // --- Additional NER-regional items (food, animals, instruments, crafts,
  // festival, nature) added to deepen cultural familiarity and widen the
  // pool so rounds at higher levels don't reuse the same handful of faces.
  { id: 'pitha', name: { en: 'Pitha', as: 'পিঠা', hi: 'पीठा' }, emoji: '🍥', category: 'food', categoryColor: '#C62828' },
  { id: 'khar', name: { en: 'Khar', as: 'খাৰ', hi: 'खार' }, emoji: '🍲', category: 'food', categoryColor: '#C62828' },
  { id: 'bamboo_shoot', name: { en: 'Bamboo Shoot', as: 'খৰিচা', hi: 'बांस की कोंपल' }, emoji: '🎋', category: 'food', categoryColor: '#C62828' },
  { id: 'kaji_nemu', name: { en: 'Assam Lemon', as: 'কাজী নেমু', hi: 'कागजी नींबू' }, emoji: '🍋', category: 'food', categoryColor: '#C62828' },
  { id: 'jackfruit', name: { en: 'Jackfruit', as: 'কঠাল', hi: 'कटहल' }, emoji: '🍈', category: 'food', categoryColor: '#C62828' },
  { id: 'betel_leaf', name: { en: 'Betel Leaf', as: 'পান', hi: 'पान' }, emoji: '🍃', category: 'food', categoryColor: '#C62828' },
  { id: 'curd', name: { en: 'Curd', as: 'দৈ', hi: 'दही' }, emoji: '🥛', category: 'food', categoryColor: '#C62828' },
  { id: 'king_chili', name: { en: 'King Chili', as: 'ভূত জলকীয়া', hi: 'भूत जोलोकिया' }, emoji: '🌶️', category: 'food', categoryColor: '#C62828' },
  { id: 'ginger', name: { en: 'Ginger', as: 'আদা', hi: 'अदरक' }, emoji: '🫚', category: 'food', categoryColor: '#C62828' },
  { id: 'sticky_rice', name: { en: 'Black Sticky Rice', as: 'বৰা চাউল', hi: 'चिपचिपा चावल' }, emoji: '🍙', category: 'food', categoryColor: '#C62828' },
  { id: 'fish_curry', name: { en: 'Fish Curry', as: 'মাছৰ তেঙা', hi: 'मछली करी' }, emoji: '🍛', category: 'food', categoryColor: '#C62828' },
  { id: 'duck_egg', name: { en: 'Duck Egg', as: 'হাঁহৰ কণী', hi: 'बत्तख का अंडा' }, emoji: '🥚', category: 'food', categoryColor: '#C62828' },
  { id: 'orange', name: { en: 'Orange', as: 'কমলা', hi: 'संतरा' }, emoji: '🍊', category: 'food', categoryColor: '#C62828' },
  { id: 'pineapple', name: { en: 'Pineapple', as: 'আনাৰস', hi: 'अनानास' }, emoji: '🍍', category: 'food', categoryColor: '#C62828' },

  { id: 'hoolock_gibbon', name: { en: 'Hoolock Gibbon', as: 'হুলুক বান্দৰ', hi: 'हूलॉक गिब्बन' }, emoji: '🦍', category: 'animal', categoryColor: '#2E7D32' },
  { id: 'golden_langur', name: { en: 'Golden Langur', as: 'সোনালী বান্দৰ', hi: 'सुनहरी लंगूर' }, emoji: '🐒', category: 'animal', categoryColor: '#2E7D32' },
  { id: 'hornbill', name: { en: 'Hornbill', as: 'ধনেশ চৰাই', hi: 'धनेश पक्षी' }, emoji: '🦜', category: 'animal', categoryColor: '#2E7D32' },
  { id: 'tiger', name: { en: 'Tiger', as: 'বাঘ', hi: 'बाघ' }, emoji: '🐅', category: 'animal', categoryColor: '#2E7D32' },
  { id: 'water_buffalo', name: { en: 'Water Buffalo', as: 'মহ', hi: 'भैंस' }, emoji: '🐃', category: 'animal', categoryColor: '#2E7D32' },

  { id: 'gogona', name: { en: 'Gogona', as: 'গগণা', hi: 'गोगोना' }, emoji: '🪕', category: 'instrument', categoryColor: '#00897B' },
  { id: 'taal', name: { en: 'Taal', as: 'তাল', hi: 'ताल' }, emoji: '🪘', category: 'instrument', categoryColor: '#00897B' },

  { id: 'eri_silk', name: { en: 'Eri Silk', as: 'এৰি পাট', hi: 'एरी सिल्क' }, emoji: '🧶', category: 'textile', categoryColor: '#8B6914' },
  { id: 'sador', name: { en: 'Sador', as: 'চাদৰ', hi: 'चादर' }, emoji: '🥻', category: 'textile', categoryColor: '#8B6914' },
  { id: 'handloom', name: { en: 'Handloom', as: 'তাঁত', hi: 'हथकरघा' }, emoji: '🧵', category: 'textile', categoryColor: '#8B6914' },

  { id: 'tokou', name: { en: 'Tokou', as: 'টোকৌ', hi: 'टोकौ' }, emoji: '🪣', category: 'craft', categoryColor: '#5C4510' },
  { id: 'hand_fan', name: { en: 'Hand Fan', as: 'পাখা', hi: 'पंखा' }, emoji: '🪭', category: 'craft', categoryColor: '#5C4510' },

  { id: 'bell_metal_plate', name: { en: 'Bell Metal Plate', as: 'কাঁহী', hi: 'कांसे की थाली' }, emoji: '🍽️', category: 'household', categoryColor: '#5C6BC0' },
  { id: 'fishing_net', name: { en: 'Fishing Net', as: 'জাকৈ', hi: 'मछली पकड़ने का जाल' }, emoji: '🥅', category: 'household', categoryColor: '#5C6BC0' },
  { id: 'mortar_pestle', name: { en: 'Dheki', as: 'ঢেঁকী', hi: 'ढेंकी' }, emoji: '🪵', category: 'household', categoryColor: '#5C6BC0' },
  { id: 'earthen_stove', name: { en: 'Earthen Stove', as: 'চুলা', hi: 'चूल्हा' }, emoji: '🔥', category: 'household', categoryColor: '#5C6BC0' },

  { id: 'bihu_dance', name: { en: 'Bihu Dance', as: 'বিহু নৃত্য', hi: 'बिहू नृत्य' }, emoji: '💃', category: 'festival', categoryColor: '#6A1B9A' },
  { id: 'bihu_bonfire', name: { en: 'Bihu Bonfire', as: 'মেজী', hi: 'मेजी अलाव' }, emoji: '🎇', category: 'festival', categoryColor: '#6A1B9A' },

  { id: 'river', name: { en: 'River', as: 'নদী', hi: 'नदी' }, emoji: '🌊', category: 'nature', categoryColor: '#0277BD' },
  { id: 'water_lily', name: { en: 'Water Lily', as: 'পদুম ফুল', hi: 'कमल' }, emoji: '🪷', category: 'nature', categoryColor: '#C2185B' },
  { id: 'paddy_field', name: { en: 'Paddy Field', as: 'পথাৰ', hi: 'धान का खेत' }, emoji: '🌾', category: 'nature', categoryColor: '#7CB342' },
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
