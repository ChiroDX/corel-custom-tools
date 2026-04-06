// ==========================================
// MENU DATA MODEL — Reference Spec
// ==========================================
// Source: separate ERP project
// Purpose: reference for future "auto design text" feature in CorelDraw plugin
//          and for defining completeness check rules for Menu document type
//
// Status: PARKED — not yet used in ai-server
// Used by: (future) /image/auto-layout, (future) /text/generate-menu
// ==========================================

// ==========================================
// 1. DATA TYPES (CODES)
// ==========================================

// Alle gültigen EU-Allergen-Codes
export type AllergenCode =
  | "A" | "A1" | "A2" | "B" | "C" | "D" | "E" | "F"
  | "G" | "H" | "I" | "J" | "K" | "L" | "M" | "N";

// Alle gängigen Zusatzstoff-Codes
export type AdditiveCode =
  | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "10" | "11";

// ==========================================
// 2. CORE INTERFACES
// ==========================================

export interface Allergen {
  code: AllergenCode;
  name_de: string;
  name_en: string;
}

export interface Additive {
  code: AdditiveCode;
  name_de: string;
  name_en: string;
  note_de?: string;
  note_en?: string;
}

// ==========================================
// 3. PRICING & CUSTOMIZATION (MODIFIERS)
// ==========================================

export interface PriceOption {
  variantName: string; // e.g., "0,33 L", "Tofu", "Standard"
  price: number;
  allergens?: AllergenCode[]; // Use when "Tofu" variant has different allergens than "Chicken"
  additives?: AdditiveCode[]; // Specific additives for this variant
}

export interface MenuModifier {
  name: string; // e.g., "Pfand / deposit", "Extra Sauce", "Ohne Koriander"
  price: number; // 0.25, or 0.00 for free removals
  allergens?: AllergenCode[];
  additives?: AdditiveCode[];
}

export interface ModifierGroup {
  name: string; // e.g., "Extras", "Choose your Protein"
  minSelections: number; // e.g., 0 (Optional), 1 (Required)
  maxSelections: number; // e.g., 1 (Only pick one), 5 (Pick up to 5)
  options: MenuModifier[];
}

// ==========================================
// 4. THE MAIN DATA MODELS (ITEMS & CATEGORIES)
// ==========================================

export interface MenuItem {
  id: string; // Unique identifier (UUID or stable string like "coca-cola")
  number?: string; // e.g. "14", "M1" (Optional)
  name: string; // e.g. "Nem Cuon", "Coca Cola"
  description?: string;
  image?: string; // URL or local path to the image

  // Pricing Strategy
  prices: PriceOption[]; // Replaces standard single `price`
  modifierGroups?: ModifierGroup[]; // Handles Add-ons, Pfand, Extras

  // Legal & Compliance
  allergens?: AllergenCode[];
  additives?: AdditiveCode[];
  dietaryPreference?: ("Vegan" | "Vegetarian" | "Halal" | "Gluten-Free")[];
  taxRate?: 7 | 19; // Crucial for German receipts (Food vs Drink/Dine-in)

  // Marketing & System
  tags?: string[]; // e.g., ["Spicy", "Bestseller", "New"]
  available?: boolean; // Defaults to true; easily disable sold-out items
}

export interface Category {
  id: string;           // e.g., "starters"
  title: string;        // e.g., "Suppen & Vorspeisen"
  description?: string; // Optional subtitle for the category

  // Visual & System routing
  image?: string;       // A banner image for the category header
  icon?: string;        // For quick navigation bars (e.g., a "🍜" emoji or SVG name)
  slug?: string;        // For SEO URLs: /menu/suppen-vorspeisen
  order?: number;       // Explicitly controls where this category appears (10, 20...)

  items: MenuItem[];
}

// ==========================================
// 5. STATIC REFERENCE DATA
// ==========================================

export const allergens: Allergen[] = [
  { code: "A",  name_de: "Glutenhaltiges Getreide",               name_en: "cereals containing gluten" },
  { code: "A1", name_de: "Weizen",                                name_en: "wheat" },
  { code: "A2", name_de: "Gerste",                                name_en: "barley" },
  { code: "B",  name_de: "Krebstiere",                            name_en: "crustaceans" },
  { code: "C",  name_de: "Ei",                                    name_en: "egg" },
  { code: "D",  name_de: "Fische",                                name_en: "fish" },
  { code: "E",  name_de: "Erdnüsse",                              name_en: "peanuts" },
  { code: "F",  name_de: "Sojabohnen",                            name_en: "soybeans" },
  { code: "G",  name_de: "Milch",                                 name_en: "milk" },
  { code: "H",  name_de: "Schalenfrüchte",                        name_en: "nuts" },
  { code: "I",  name_de: "Sellerie",                              name_en: "celery" },
  { code: "J",  name_de: "Senf",                                  name_en: "mustard" },
  { code: "K",  name_de: "Sesamsamen",                            name_en: "sesame seeds" },
  { code: "L",  name_de: "Schwefeldioxid und Sulphite",           name_en: "sulfur dioxide and sulphites" },
  { code: "M",  name_de: "Lupinen",                               name_en: "lupins" },
  { code: "N",  name_de: "Weichtiere",                            name_en: "molluscs" },
];

export const additives: Additive[] = [
  { code: "1",  name_de: "Farbstoff",                             name_en: "coloring" },
  { code: "2",  name_de: "Konservierungsstoff",                   name_en: "preservative" },
  { code: "3",  name_de: "Süßungsmittel",                         name_en: "sweetener" },
  { code: "4",  name_de: "koffeinhaltig",                         name_en: "contains caffeine" },
  { code: "5",  name_de: "Säuerungsmittel",                       name_en: "acidifier" },
  { code: "6",  name_de: "Stabilisator",                          name_en: "stabilizer" },
  { code: "7",  name_de: "Antioxidationsmittel",                  name_en: "antioxidant" },
  { code: "8",  name_de: "chininhaltig",                          name_en: "contains quinine" },
  { code: "9",  name_de: "Taurin",                                name_en: "taurine" },
  { code: "10", name_de: "Geschmacksverstärker",                  name_en: "flavor enhancer",  note_de: "z. B. Glutamat",                   note_en: "e.g., glutamate" },
  { code: "11", name_de: "enthält eine Phenylalaninquelle",        name_en: "contains a source of phenylalanine", note_de: "Hinweis relevant bei Aspartam", note_en: "Relevant when aspartame is present" },
];
