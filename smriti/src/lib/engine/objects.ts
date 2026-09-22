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
  /** Content-pack tag for a themed reskin of Memory Match / Word Stream
   * (see pickObjects/`pack` param below). Untagged objects are the default
   * general pool; a tagged object is drawn only when its pack is asked for. */
  pack?: 'festival' | 'market';
}

export const CONTENT_PACKS = ['festival', 'market'] as const;

/** Narrows an untrusted value (e.g. a `?pack=` URL param) to a real content
 * pack, or `undefined` for anything else — including a typo'd or malicious
 * query string. Without this, an unchecked cast let a bad `pack` value filter
 * every object out of the pool, leaving Memory Match showing "0 of 0 pairs"
 * and Word Stream stuck on a blank show screen with no way to recover. */
export function toContentPack(value: string | null | undefined): SmritiObject['pack'] {
  return (CONTENT_PACKS as readonly string[]).includes(value ?? '') ? (value as SmritiObject['pack']) : undefined;
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
  { id: 'gamosa', name: { en: 'Gamosa', as: 'গামোচা', hi: 'गमछा', bn: 'গামছা', ne: 'गमछा', brx: 'गामोसा', mni: 'গামোসা' }, emoji: '🧣', category: 'textile', categoryColor: '#8B6914', pack: 'market' },
  { id: 'jaapi', name: { en: 'Jaapi', as: 'জাপি', hi: 'जापी', bn: 'জাপি', ne: 'जापी', brx: 'जापि', mni: 'জাপি' }, emoji: '👒', category: 'craft', categoryColor: '#5C4510', pack: 'market' },
  { id: 'bamboo_basket', name: { en: 'Bamboo Basket', as: 'বাঁহৰ চাকি', hi: 'बांस की टोकरी', bn: 'বাঁশের ঝুড়ি', ne: 'बाँसको डोको', brx: 'वाफांनि टोकरी', mni: 'মৈকুপ' }, emoji: '🧺', category: 'household', categoryColor: '#5C6BC0' },
  { id: 'mekhela', name: { en: 'Mekhela', as: 'মেখেলা', hi: 'मेखेला', bn: 'মেখেলা', ne: 'मेखेला', brx: 'मेखेला', mni: 'মেখেলা' }, emoji: '👘', category: 'textile', categoryColor: '#8B6914', pack: 'market' },
  { id: 'dhol', name: { en: 'Dhol', as: 'ঢোল', hi: 'ढोल', bn: 'ঢোল', ne: 'ढोल', brx: 'ढोल', mni: 'ঢোল' }, emoji: '🥁', category: 'instrument', categoryColor: '#00897B' },
  { id: 'xorai', name: { en: 'Xorai', as: 'চৰাই', hi: 'शराई', bn: 'সরাই', ne: 'शराई', brx: 'शराइ', mni: 'শরাই' }, emoji: '🫓', category: 'household', categoryColor: '#5C6BC0' },
  { id: 'tamul', name: { en: 'Betel Nut', as: 'তামোল', hi: 'सुपारी', bn: 'তামুল (সুপারি)', ne: 'सुपारी', brx: 'ताम्बुल', mni: 'গুয়া' }, emoji: '🌿', category: 'food', categoryColor: '#C62828', pack: 'market' },
  { id: 'rhino', name: { en: 'Rhino', as: 'গঁড়', hi: 'गैंडा', bn: 'গণ্ডার', ne: 'गैँडा', brx: 'गैंडा', mni: 'গণ্ডার' }, emoji: '🦏', category: 'animal', categoryColor: '#2E7D32' },
  { id: 'tea_leaf', name: { en: 'Tea Leaf', as: 'চাহ পাত', hi: 'चाय पत्ती', bn: 'চা পাতা', ne: 'चियापत्ती', brx: 'चा पाता', mni: 'চা পাতা' }, emoji: '🍵', category: 'food', categoryColor: '#C62828', pack: 'market' },
  { id: 'clay_pot', name: { en: 'Clay Pot', as: 'মাটিৰ চৰীয়া', hi: 'मिट्टी का बर्तन', bn: 'মাটির হাঁড়ি', ne: 'माटोको भाँडो', brx: 'माटिनि हाँड़ि', mni: 'মাটিগী হাঁড়ি' }, emoji: '🏺', category: 'household', categoryColor: '#5C6BC0' },
  { id: 'pepa', name: { en: 'Pepa', as: 'পেঁপা', hi: 'पेपा', bn: 'পেপা', ne: 'पेपा', brx: 'पेपा', mni: 'পেপা' }, emoji: '🎵', category: 'instrument', categoryColor: '#00897B' },
  { id: 'muga_silk', name: { en: 'Muga Silk', as: 'মুগা পাট', hi: 'मुगा सिल्क', bn: 'মুগা রেশম', ne: 'मुगा रेशम', brx: 'मुगा रेशम', mni: 'মুগা রেশম' }, emoji: '✨', category: 'textile', categoryColor: '#8B6914' },
  { id: 'rice', name: { en: 'Rice', as: 'চাউল', hi: 'चावल', bn: 'চাল', ne: 'चामल', brx: 'मै', mni: 'চাক' }, emoji: '🍚', category: 'food', categoryColor: '#C62828', pack: 'market' },
  { id: 'fish', name: { en: 'Fish', as: 'মাছ', hi: 'मछली', bn: 'মাছ', ne: 'माछा', brx: 'ना', mni: 'ঙা' }, emoji: '🐟', category: 'food', categoryColor: '#C62828', pack: 'market' },
  { id: 'banana', name: { en: 'Banana', as: 'কল', hi: 'केला', bn: 'কলা', ne: 'केरा', brx: 'केला', mni: 'কেলা' }, emoji: '🍌', category: 'food', categoryColor: '#C62828', pack: 'market' },
  { id: 'mango', name: { en: 'Mango', as: 'আম', hi: 'आम', bn: 'আম', ne: 'आँप', brx: 'आम', mni: 'আম' }, emoji: '🥭', category: 'food', categoryColor: '#C62828', pack: 'market' },
  { id: 'elephant', name: { en: 'Elephant', as: 'হাতী', hi: 'हाथी', bn: 'হাতি', ne: 'हात्ती', brx: 'हाथि', mni: 'সমু' }, emoji: '🐘', category: 'animal', categoryColor: '#2E7D32' },
  { id: 'cow', name: { en: 'Cow', as: 'গৰু', hi: 'गाय', bn: 'গরু', ne: 'गाई', brx: 'गाइ', mni: 'গাই' }, emoji: '🐄', category: 'animal', categoryColor: '#2E7D32' },
  { id: 'duck', name: { en: 'Duck', as: 'হাঁহ', hi: 'बत्तख', bn: 'হাঁস', ne: 'हाँस', brx: 'हाँस', mni: 'হাঁস' }, emoji: '🦆', category: 'animal', categoryColor: '#2E7D32' },
  { id: 'peacock', name: { en: 'Peacock', as: 'ময়ূৰ', hi: 'मोर', bn: 'ময়ূর', ne: 'मयूर', brx: 'मयूर', mni: 'ময়ূর' }, emoji: '🦚', category: 'animal', categoryColor: '#2E7D32' },
  { id: 'umbrella', name: { en: 'Umbrella', as: 'চাতি', hi: 'छाता', bn: 'ছাতা', ne: 'छाता', brx: 'छाता', mni: 'ছাতা' }, emoji: '☂️', category: 'household', categoryColor: '#5C6BC0' },
  { id: 'lamp', name: { en: 'Oil Lamp', as: 'প্ৰদীপ', hi: 'दीया', bn: 'প্রদীপ', ne: 'दीयो', brx: 'बत्ती', mni: 'বাতি' }, emoji: '🪔', category: 'household', categoryColor: '#5C6BC0' },
  { id: 'book', name: { en: 'Book', as: 'কিতাপ', hi: 'किताब', bn: 'বই', ne: 'किताब', brx: 'बिजाब', mni: 'পুথি' }, emoji: '📖', category: 'household', categoryColor: '#5C6BC0' },
  { id: 'key', name: { en: 'Key', as: 'চাবি', hi: 'चाबी', bn: 'চাবি', ne: 'चाबी', brx: 'चाबि', mni: 'চাবি' }, emoji: '🔑', category: 'household', categoryColor: '#5C6BC0' },
  { id: 'bell', name: { en: 'Bell', as: 'ঘণ্টা', hi: 'घंटी', bn: 'ঘণ্টা', ne: 'घण्टी', brx: 'घण्टा', mni: 'ঘণ্টা' }, emoji: '🔔', category: 'household', categoryColor: '#5C6BC0' },
  { id: 'bicycle', name: { en: 'Bicycle', as: 'চাইকেল', hi: 'साइकिल', bn: 'সাইকেল', ne: 'साइकल', brx: 'साइकेल', mni: 'সাইকেল' }, emoji: '🚲', category: 'vehicle', categoryColor: '#546E7A' },
  { id: 'boat', name: { en: 'Boat', as: 'নাও', hi: 'नाव', bn: 'নৌকা', ne: 'डुङ्गा', brx: 'नाव', mni: 'নাও' }, emoji: '🛶', category: 'vehicle', categoryColor: '#546E7A' },
  { id: 'sun', name: { en: 'Sun', as: 'সূৰ্য', hi: 'सूरज', bn: 'সূর্য', ne: 'सूर्य', brx: 'सान', mni: 'নুমিৎ' }, emoji: '☀️', category: 'nature', categoryColor: '#EF6C00' },
  { id: 'moon', name: { en: 'Moon', as: 'চন্দ্ৰ', hi: 'चाँद', bn: 'চাঁদ', ne: 'चन्द्रमा', brx: 'चाँद', mni: 'থা' }, emoji: '🌙', category: 'nature', categoryColor: '#3949AB' },
  { id: 'flower', name: { en: 'Flower', as: 'ফুল', hi: 'फूल', bn: 'ফুল', ne: 'फूल', brx: 'बिबार', mni: 'ফুল' }, emoji: '🌸', category: 'nature', categoryColor: '#D81B60' },
  { id: 'tree', name: { en: 'Tree', as: 'গছ', hi: 'पेड़', bn: 'গাছ', ne: 'रूख', brx: 'बिफांग', mni: 'গাছ' }, emoji: '🌳', category: 'nature', categoryColor: '#2E7D32' },

  // --- Additional NER-regional items (food, animals, instruments, crafts,
  // festival, nature) added to deepen cultural familiarity and widen the
  // pool so rounds at higher levels don't reuse the same handful of faces.
  { id: 'pitha', name: { en: 'Pitha', as: 'পিঠা', hi: 'पीठा', bn: 'পিঠা', ne: 'पिठा', brx: 'पिठा', mni: 'পিঠা' }, emoji: '🍥', category: 'food', categoryColor: '#C62828' },
  { id: 'khar', name: { en: 'Khar', as: 'খাৰ', hi: 'खार', bn: 'খার', ne: 'खार', brx: 'खार', mni: 'খার' }, emoji: '🍲', category: 'food', categoryColor: '#C62828' },
  { id: 'bamboo_shoot', name: { en: 'Bamboo Shoot', as: 'খৰিচা', hi: 'बांस की कोंपल', bn: 'বাঁশের কোঁড়', ne: 'तामा', brx: 'वा गुदि', mni: 'উঙ্গৌট' }, emoji: '🎋', category: 'food', categoryColor: '#C62828' },
  { id: 'kaji_nemu', name: { en: 'Assam Lemon', as: 'কাজী নেমু', hi: 'कागजी नींबू', bn: 'আসামের লেবু', ne: 'असमिया कागती', brx: 'असम लेबु', mni: 'আসাম লেবু' }, emoji: '🍋', category: 'food', categoryColor: '#C62828', pack: 'market' },
  { id: 'jackfruit', name: { en: 'Jackfruit', as: 'কঠাল', hi: 'कटहल', bn: 'কাঁঠাল', ne: 'कटहर', brx: 'कटहल', mni: 'কাঁঠাল' }, emoji: '🍈', category: 'food', categoryColor: '#C62828', pack: 'market' },
  { id: 'betel_leaf', name: { en: 'Betel Leaf', as: 'পান', hi: 'पान', bn: 'পান', ne: 'पान', brx: 'पान', mni: 'পান' }, emoji: '🍃', category: 'food', categoryColor: '#C62828', pack: 'market' },
  { id: 'curd', name: { en: 'Curd', as: 'দৈ', hi: 'दही', bn: 'দই', ne: 'दही', brx: 'दही', mni: 'দই' }, emoji: '🥛', category: 'food', categoryColor: '#C62828' },
  { id: 'king_chili', name: { en: 'King Chili', as: 'ভূত জলকীয়া', hi: 'भूत जोलोकिया', bn: 'ভূত জলকিয়া', ne: 'भूत जोलोकिया', brx: 'भूत जोलोकिया', mni: 'ভূত জলকিয়া' }, emoji: '🌶️', category: 'food', categoryColor: '#C62828', pack: 'market' },
  { id: 'ginger', name: { en: 'Ginger', as: 'আদা', hi: 'अदरक', bn: 'আদা', ne: 'अदुवा', brx: 'आदा', mni: 'আদা' }, emoji: '🫚', category: 'food', categoryColor: '#C62828', pack: 'market' },
  { id: 'sticky_rice', name: { en: 'Black Sticky Rice', as: 'বৰা চাউল', hi: 'चिपचिपा चावल', bn: 'কালো আঠালো চাল', ne: 'कालो चिप्लो चामल', brx: 'गोसोम मै', mni: 'ময়ূম চাক' }, emoji: '🍙', category: 'food', categoryColor: '#C62828' },
  { id: 'fish_curry', name: { en: 'Fish Curry', as: 'মাছৰ তেঙা', hi: 'मछली करी', bn: 'মাছের ঝোল', ne: 'माछाको तरकारी', brx: 'ना जोबाय', mni: 'ঙা তেঙা' }, emoji: '🍛', category: 'food', categoryColor: '#C62828' },
  { id: 'duck_egg', name: { en: 'Duck Egg', as: 'হাঁহৰ কণী', hi: 'बत्तख का अंडा', bn: 'হাঁসের ডিম', ne: 'हाँसको अण्डा', brx: 'हाँसनि गुदि', mni: 'হাঁসগী কোনি' }, emoji: '🥚', category: 'food', categoryColor: '#C62828' },
  { id: 'orange', name: { en: 'Orange', as: 'কমলা', hi: 'संतरा', bn: 'কমলা', ne: 'सुन्तला', brx: 'कमला', mni: 'কমলা' }, emoji: '🍊', category: 'food', categoryColor: '#C62828', pack: 'market' },
  { id: 'pineapple', name: { en: 'Pineapple', as: 'আনাৰস', hi: 'अनानास', bn: 'আনারস', ne: 'भुइँकटहर', brx: 'अनानास', mni: 'আনারস' }, emoji: '🍍', category: 'food', categoryColor: '#C62828', pack: 'market' },

  { id: 'hoolock_gibbon', name: { en: 'Hoolock Gibbon', as: 'হুলুক বান্দৰ', hi: 'हूलॉक गिब्बन', bn: 'হুলক গিবন', ne: 'हुलक गिब्बन', brx: 'हुलक गिब्बन', mni: 'হুলক গিবন' }, emoji: '🦍', category: 'animal', categoryColor: '#2E7D32' },
  { id: 'golden_langur', name: { en: 'Golden Langur', as: 'সোনালী বান্দৰ', hi: 'सुनहरी लंगूर', bn: 'সোনালি লাঙ্গুর', ne: 'सुनौलो लंगुर', brx: 'सोनाली लंगुर', mni: 'সোনালী লঙ্গুর' }, emoji: '🐒', category: 'animal', categoryColor: '#2E7D32' },
  { id: 'hornbill', name: { en: 'Hornbill', as: 'ধনেশ চৰাই', hi: 'धनेश पक्षी', bn: 'ধনেশ পাখি', ne: 'धनेश चरा', brx: 'धनेश चराइ', mni: 'ধনেশ চড়াই' }, emoji: '🦜', category: 'animal', categoryColor: '#2E7D32' },
  { id: 'tiger', name: { en: 'Tiger', as: 'বাঘ', hi: 'बाघ', bn: 'বাঘ', ne: 'बाघ', brx: 'मैजि', mni: 'কেই' }, emoji: '🐅', category: 'animal', categoryColor: '#2E7D32' },
  { id: 'water_buffalo', name: { en: 'Water Buffalo', as: 'মহ', hi: 'भैंस', bn: 'মহিষ', ne: 'भैंसी', brx: 'मेस', mni: 'মেস' }, emoji: '🐃', category: 'animal', categoryColor: '#2E7D32' },

  { id: 'gogona', name: { en: 'Gogona', as: 'গগণা', hi: 'गोगोना', bn: 'গগনা', ne: 'गगोना', brx: 'गगोना', mni: 'গগনা' }, emoji: '🪕', category: 'instrument', categoryColor: '#00897B' },
  { id: 'taal', name: { en: 'Taal', as: 'তাল', hi: 'ताल', bn: 'তাল', ne: 'ताल', brx: 'ताल', mni: 'তাল' }, emoji: '🪘', category: 'instrument', categoryColor: '#00897B' },

  { id: 'eri_silk', name: { en: 'Eri Silk', as: 'এৰি পাট', hi: 'एरी सिल्क', bn: 'এরি রেশম', ne: 'एरी रेशम', brx: 'एरि रेशम', mni: 'এরি রেশম' }, emoji: '🧶', category: 'textile', categoryColor: '#8B6914', pack: 'market' },
  { id: 'sador', name: { en: 'Sador', as: 'চাদৰ', hi: 'चादर', bn: 'চাদর', ne: 'चादर', brx: 'चादर', mni: 'চাদর' }, emoji: '🥻', category: 'textile', categoryColor: '#8B6914', pack: 'market' },
  { id: 'handloom', name: { en: 'Handloom', as: 'তাঁত', hi: 'हथकरघा', bn: 'তাঁত', ne: 'हातले बुन्ने तान', brx: 'ताँत', mni: 'তাঁত' }, emoji: '🧵', category: 'textile', categoryColor: '#8B6914', pack: 'market' },

  { id: 'tokou', name: { en: 'Tokou', as: 'টোকৌ', hi: 'टोकौ', bn: 'টোকৌ', ne: 'टोकौ', brx: 'टोकौ', mni: 'টোকৌ' }, emoji: '🪣', category: 'craft', categoryColor: '#5C4510' },
  { id: 'hand_fan', name: { en: 'Hand Fan', as: 'পাখা', hi: 'पंखा', bn: 'হাতপাখা', ne: 'हातपंखा', brx: 'हात पाखा', mni: 'হাত পাখা' }, emoji: '🪭', category: 'craft', categoryColor: '#5C4510' },

  { id: 'bell_metal_plate', name: { en: 'Bell Metal Plate', as: 'কাঁহী', hi: 'कांसे की थाली', bn: 'কাঁসার থালা', ne: 'काँसको थाली', brx: 'काँसानि थाली', mni: 'কাঁসার থালী' }, emoji: '🍽️', category: 'household', categoryColor: '#5C6BC0' },
  { id: 'fishing_net', name: { en: 'Fishing Net', as: 'জাকৈ', hi: 'मछली पकड़ने का जाल', bn: 'মাছ ধরার জাল', ne: 'माछा मार्ने जाल', brx: 'ना गनायनि जाल', mni: 'ঙা ছাংবগী জাল' }, emoji: '🥅', category: 'household', categoryColor: '#5C6BC0' },
  { id: 'mortar_pestle', name: { en: 'Dheki', as: 'ঢেঁকী', hi: 'ढेंकी', bn: 'ঢেঁকি', ne: 'ढिकी', brx: 'ढेकि', mni: 'ঢেঁকী' }, emoji: '🪵', category: 'household', categoryColor: '#5C6BC0' },
  { id: 'earthen_stove', name: { en: 'Earthen Stove', as: 'চুলা', hi: 'चूल्हा', bn: 'মাটির চুলা', ne: 'माटोको चुलो', brx: 'माटिनि चुला', mni: 'মাটিগী চুলা' }, emoji: '🔥', category: 'household', categoryColor: '#5C6BC0' },

  { id: 'bihu_dance', name: { en: 'Bihu Dance', as: 'বিহু নৃত্য', hi: 'बिहू नृत्य', bn: 'বিহু নৃত্য', ne: 'बिहु नृत्य', brx: 'बिहु नृत्य', mni: 'বিহু নৃত্য' }, emoji: '💃', category: 'festival', categoryColor: '#6A1B9A' },
  { id: 'bihu_bonfire', name: { en: 'Bihu Bonfire', as: 'মেজী', hi: 'मेजी अलाव', bn: 'মেজি', ne: 'मेजी अगेनो', brx: 'मेजि', mni: 'মেজি' }, emoji: '🎇', category: 'festival', categoryColor: '#6A1B9A' },

  { id: 'river', name: { en: 'River', as: 'নদী', hi: 'नदी', bn: 'নদী', ne: 'नदी', brx: 'दैमा', mni: 'তুরেল' }, emoji: '🌊', category: 'nature', categoryColor: '#0277BD' },
  { id: 'water_lily', name: { en: 'Water Lily', as: 'পদুম ফুল', hi: 'कमल', bn: 'পদ্মফুল', ne: 'कमल', brx: 'पदुम बिबार', mni: 'পদ্ম ফুল' }, emoji: '🪷', category: 'nature', categoryColor: '#C2185B' },
  { id: 'paddy_field', name: { en: 'Paddy Field', as: 'পথাৰ', hi: 'धान का खेत', bn: 'ধানখেত', ne: 'धानखेत', brx: 'मै फाला', mni: 'ফৌ পাডী' }, emoji: '🌾', category: 'nature', categoryColor: '#7CB342' },

  // --- Festival Match content pack (Part 2 of the mood/festival/reminders
  // brief): one card per NER state's signature festival, so a "found the
  // pair" match doubles as a small moment of cultural recognition. `pack:
  // 'festival'` opts these into Memory Match's festival-themed reskin
  // (src/app/games/memory-match/page.tsx) instead of the general pool.
  { id: 'bihu_festival', name: { en: 'Bihu (Assam)', as: 'বিহু (অসম)', hi: 'बिहू (असम)', bn: 'বিহু (আসাম)', ne: 'बिहु (आसाम)', brx: 'बिहु (असम)', mni: 'বিহু (আসাম)' }, emoji: '💃', category: 'festival', categoryColor: '#6A1B9A', pack: 'festival' },
  { id: 'hornbill_festival', name: { en: 'Hornbill Festival (Nagaland)', as: 'হৰ্নবিল উৎসৱ (নাগালেণ্ড)', hi: 'हॉर्नबिल उत्सव (नागालैंड)', bn: 'হর্নবিল উৎসব (নাগাল্যান্ড)', ne: 'हर्नबिल महोत्सव (नागाल्यान्ड)', brx: 'हर्नबिल फेस्टिभाल (नागालेण्ड)', mni: 'হর্নবিল ফেস্টিভেল (নাগাল্যান্ড)' }, emoji: '🦜', category: 'festival', categoryColor: '#6A1B9A', pack: 'festival' },
  { id: 'chapchar_kut', name: { en: 'Chapchar Kut (Mizoram)', as: 'চাপচাৰ কুট (মিজোৰাম)', hi: 'चापचार कुट (मिजोरम)', bn: 'চাপচার কুট (মিজোরাম)', ne: 'चापचार कुट (मिजोरम)', brx: 'चापचार कुट (मिजोरम)', mni: 'চাপচার কুট (মিজোরাম)' }, emoji: '🌸', category: 'festival', categoryColor: '#6A1B9A', pack: 'festival' },
  { id: 'wangala', name: { en: 'Wangala (Meghalaya)', as: 'ৱাংগালা (মেঘালয়)', hi: 'वांगला (मेघालय)', bn: 'ওয়াংগালা (মেঘালয়)', ne: 'वाङ्गला (मेघालय)', brx: 'वांगला (मेघालय)', mni: 'ৱাংগালা (মেঘালয়)' }, emoji: '🥁', category: 'festival', categoryColor: '#6A1B9A', pack: 'festival' },
  { id: 'sangai_festival', name: { en: 'Sangai Festival (Manipur)', as: 'সাংগাই উৎসৱ (মণিপুৰ)', hi: 'सांगाई उत्सव (मणिपुर)', bn: 'সাংগাই উৎসব (মণিপুর)', ne: 'साङ्गाई महोत्सव (मणिपुर)', brx: 'सांगाई फेस्टिभाल (मणिपुर)', mni: 'সাংগাই ফেস্টিভেল (মণিপুর)' }, emoji: '🦌', category: 'festival', categoryColor: '#6A1B9A', pack: 'festival' },
  { id: 'losar', name: { en: 'Losar (Sikkim & Arunachal)', as: 'লোছাৰ (চিকিম আৰু অৰুণাচল)', hi: 'लोसर (सिक्किम और अरुणाचल)', bn: 'লোসার (সিকিম ও অরুণাচল)', ne: 'ल्होसार (सिक्किम र अरुणाचल)', brx: 'लोसार (सिक्किम आरो अरुणाचल)', mni: 'লোসার (সিক্কিম অমসুং অরুণাচল)' }, emoji: '🏔️', category: 'festival', categoryColor: '#6A1B9A', pack: 'festival' },
];

function shuffled<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * Random sample without replacement, optionally excluding specific ids.
 * `pack` narrows to a themed reskin's own objects (e.g. 'market' for Local
 * Market Recall); omitted, it draws from the full pool exactly as before —
 * a `pack`-tagged object is still a perfectly good general-pool object, it
 * is just also selectable on its own when that pack is asked for.
 */
export function pickObjects(count: number, exclude: string[] = [], pack?: SmritiObject['pack']): SmritiObject[] {
  const pool = OBJECTS.filter((o) => !exclude.includes(o.id) && (!pack || o.pack === pack));
  return shuffled(pool).slice(0, count);
}

/** How many distinct objects a content pack has — callers clamp a level's
 * item/pair count to this so a small pack (e.g. 6 festivals) never asks for
 * more unique objects than actually exist. */
export function packPoolSize(pack?: SmritiObject['pack']): number {
  return pack ? OBJECTS.filter((o) => o.pack === pack).length : OBJECTS.length;
}
