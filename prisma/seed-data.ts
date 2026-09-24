// Demo data for local development. Not used by `pnpm setup:store` (Phase 12), which creates a
// store with no demo products. All money is in paise; tax rates are in basis points.

import type {
  AttributeDefinitionInput,
  Choice,
  ProductOptions,
} from "../src/lib/validators/catalog";
import type { LocalizedText } from "../src/lib/validators/localized";

type L = LocalizedText;

const t = (en: string, ta: string, kn: string): L => ({ en, ta, kn });
const choice = (value: string, label: L): Choice => ({ value, label });
const image = (slug: string, n: number) => `https://picsum.photos/seed/${slug}-${n}/800/800`;

// ───────────────────────────── Store settings ─────────────────────────────

export const storeSettings = {
  name: "Demo Store",
  tagline: t(
    "Everyday essentials, delivered",
    "அன்றாடத் தேவைகள், உங்கள் வீட்டு வாசலில்",
    "ದಿನನಿತ್ಯದ ಅಗತ್ಯಗಳು, ನಿಮ್ಮ ಮನೆ ಬಾಗಿಲಿಗೆ",
  ),
  primaryColor: "#0f766e",
  secondaryColor: "#f59e0b",
  headingFont: "Noto Sans",
  bodyFont: "Noto Sans",
  contactEmail: "support@example.com",
  contactPhone: "+919876543210",
  whatsappNumber: "+919876543210",
  businessAddress: {
    line1: "12, MG Road",
    city: "Bengaluru",
    state: "Karnataka",
    stateCode: "KA",
    pincode: "560001",
  },
  socialLinks: { instagram: "https://instagram.com/example" },
  legalName: "Demo Store Private Limited",
  // Sample GSTIN format for demo purposes only.
  gstNumber: "29ABCDE1234F1Z5",
  stateCode: "KA",
  pricesIncludeTax: true,
  defaultTaxRateBps: 1800,
  supportedLocales: ["en", "ta", "kn"],
  defaultLocale: "en",
  minOrderValue: 9900,
  codEnabled: true,
  codFee: 4900,
  codMinOrderValue: 19900,
  codMaxOrderValue: 1000000,
  features: { wishlist: true, reviews: true, abandonedCart: false },
};

// ───────────────────────────── Categories ─────────────────────────────

export type SeedCategory = {
  slug: string;
  name: L;
  description: L;
  taxRateBps: number;
  hsnCode?: string;
  sortOrder: number;
  attributes: AttributeDefinitionInput[];
};

const size = (value: string) => choice(value, t(value, value, value));

export const categories: SeedCategory[] = [
  {
    slug: "clothing",
    name: t("Clothing", "ஆடைகள்", "ಉಡುಪುಗಳು"),
    description: t(
      "Comfortable everyday wear and festive outfits",
      "அன்றாட உடைகளும் பண்டிகை ஆடைகளும்",
      "ದಿನನಿತ್ಯದ ಉಡುಪುಗಳು ಮತ್ತು ಹಬ್ಬದ ಉಡುಗೆಗಳು",
    ),
    taxRateBps: 500,
    sortOrder: 1,
    attributes: [
      {
        key: "material",
        label: t("Material", "துணி வகை", "ಬಟ್ಟೆಯ ವಿಧ"),
        type: "SELECT",
        options: [
          choice("cotton", t("Cotton", "பருத்தி", "ಹತ್ತಿ")),
          choice("linen", t("Linen", "லினன்", "ಲಿನನ್")),
          choice("silk", t("Silk", "பட்டு", "ರೇಷ್ಮೆ")),
          choice("denim", t("Denim", "டெனிம்", "ಡೆನಿಮ್")),
        ],
        isRequired: true,
        isFilterable: true,
        sortOrder: 1,
      },
      {
        key: "fit",
        label: t("Fit", "பொருத்தம்", "ಫಿಟ್"),
        type: "SELECT",
        options: [
          choice("regular", t("Regular", "வழக்கமான", "ಸಾಮಾನ್ಯ")),
          choice("slim", t("Slim", "ஸ்லிம்", "ಸ್ಲಿಮ್")),
          choice("relaxed", t("Relaxed", "தளர்வான", "ಸಡಿಲ")),
        ],
        isRequired: false,
        isFilterable: true,
        sortOrder: 2,
      },
      {
        key: "gender",
        label: t("For", "யாருக்கு", "ಯಾರಿಗೆ"),
        type: "SELECT",
        options: [
          choice("men", t("Men", "ஆண்கள்", "ಪುರುಷರು")),
          choice("women", t("Women", "பெண்கள்", "ಮಹಿಳೆಯರು")),
          choice("unisex", t("Unisex", "அனைவருக்கும்", "ಎಲ್ಲರಿಗೂ")),
        ],
        isRequired: true,
        isFilterable: true,
        sortOrder: 3,
      },
      {
        key: "care",
        label: t("Care instructions", "பராமரிப்பு வழிமுறைகள்", "ಆರೈಕೆ ಸೂಚನೆಗಳು"),
        type: "TEXT",
        isRequired: false,
        isFilterable: false,
        sortOrder: 4,
      },
    ],
  },
  {
    slug: "food",
    name: t("Food", "உணவுப் பொருட்கள்", "ಆಹಾರ ಪದಾರ್ಥಗಳು"),
    description: t(
      "Traditional sweets, spices and pantry staples",
      "பாரம்பரிய இனிப்புகள், மசாலாப் பொருட்கள் மற்றும் சமையலறைத் தேவைகள்",
      "ಸಾಂಪ್ರದಾಯಿಕ ಸಿಹಿತಿಂಡಿಗಳು, ಮಸಾಲೆಗಳು ಮತ್ತು ಅಡುಗೆಮನೆಯ ಅಗತ್ಯಗಳು",
    ),
    taxRateBps: 500,
    sortOrder: 2,
    attributes: [
      {
        key: "diet_type",
        label: t("Diet type", "உணவு வகை", "ಆಹಾರ ವಿಧ"),
        type: "SELECT",
        options: [
          choice("veg", t("Veg", "சைவம்", "ಸಸ್ಯಾಹಾರ")),
          choice("non_veg", t("Non-veg", "அசைவம்", "ಮಾಂಸಾಹಾರ")),
          choice("vegan", t("Vegan", "வீகன்", "ವೀಗನ್")),
        ],
        isRequired: true,
        isFilterable: true,
        sortOrder: 1,
      },
      {
        key: "shelf_life_days",
        label: t("Shelf life", "பயன்படுத்தும் காலம்", "ಬಳಕೆಯ ಅವಧಿ"),
        type: "NUMBER",
        unit: "days",
        isRequired: true,
        isFilterable: false,
        sortOrder: 2,
      },
      {
        key: "spice_level",
        label: t("Spice level", "காரத்தின் அளவு", "ಖಾರದ ಮಟ್ಟ"),
        type: "SELECT",
        options: [
          choice("mild", t("Mild", "குறைவான காரம்", "ಕಡಿಮೆ ಖಾರ")),
          choice("medium", t("Medium", "நடுத்தர காரம்", "ಮಧ್ಯಮ ಖಾರ")),
          choice("hot", t("Hot", "அதிக காரம்", "ಹೆಚ್ಚು ಖಾರ")),
        ],
        isRequired: false,
        isFilterable: true,
        sortOrder: 3,
      },
      {
        key: "ingredients",
        label: t("Ingredients", "தேவையான பொருட்கள்", "ಪದಾರ್ಥಗಳು"),
        type: "TEXT",
        isRequired: false,
        isFilterable: false,
        sortOrder: 4,
      },
    ],
  },
  {
    slug: "electronics",
    name: t("Electronics", "மின்னணு சாதனங்கள்", "ಎಲೆಕ್ಟ್ರಾನಿಕ್ಸ್"),
    description: t(
      "Audio, wearables and accessories",
      "ஆடியோ, அணியக்கூடிய சாதனங்கள் மற்றும் துணைக்கருவிகள்",
      "ಆಡಿಯೋ, ಧರಿಸಬಹುದಾದ ಸಾಧನಗಳು ಮತ್ತು ಪರಿಕರಗಳು",
    ),
    taxRateBps: 1800,
    sortOrder: 3,
    attributes: [
      {
        key: "warranty_months",
        label: t("Warranty", "உத்தரவாதம்", "ವಾರಂಟಿ"),
        type: "NUMBER",
        unit: "months",
        isRequired: true,
        isFilterable: true,
        sortOrder: 1,
      },
      {
        key: "battery_life_hours",
        label: t("Battery life", "பேட்டரி நேரம்", "ಬ್ಯಾಟರಿ ಬಾಳಿಕೆ"),
        type: "NUMBER",
        unit: "hours",
        isRequired: false,
        isFilterable: true,
        sortOrder: 2,
      },
      {
        key: "connectivity",
        label: t("Connectivity", "இணைப்பு", "ಸಂಪರ್ಕ"),
        type: "SELECT",
        options: [
          choice("bluetooth", t("Bluetooth", "புளூடூத்", "ಬ್ಲೂಟೂತ್")),
          choice("usb_c", t("USB-C", "USB-C", "USB-C")),
          choice("wifi", t("Wi-Fi", "வைஃபை", "ವೈ-ಫೈ")),
        ],
        isRequired: false,
        isFilterable: true,
        sortOrder: 3,
      },
      {
        key: "color",
        label: t("Colour", "நிறம்", "ಬಣ್ಣ"),
        type: "COLOR",
        options: [
          choice("#111827", t("Black", "கருப்பு", "ಕಪ್ಪು")),
          choice("#f9fafb", t("White", "வெள்ளை", "ಬಿಳಿ")),
          choice("#1d4ed8", t("Blue", "நீலம்", "ನೀಲಿ")),
        ],
        isRequired: false,
        isFilterable: true,
        sortOrder: 4,
      },
    ],
  },
];

// ───────────────────────────── Products ─────────────────────────────

export type SeedVariant = {
  sku: string;
  optionValues: Record<string, string>;
  price: number;
  compareAtPrice?: number;
  stock: number;
  weightGrams: number;
};

export type SeedProduct = {
  slug: string;
  categorySlug: string;
  name: L;
  shortDescription: L;
  brand?: string;
  isFeatured?: boolean;
  taxRateBps?: number;
  hsnCode: string;
  attributes: Record<string, string | number>;
  options: ProductOptions;
  variants: SeedVariant[];
  imageCount: number;
};

const sizeOption = (...values: string[]) => ({
  key: "size",
  label: t("Size", "அளவு", "ಗಾತ್ರ"),
  values: values.map(size),
});
const colorOption = (values: Choice[]) => ({
  key: "color",
  label: t("Colour", "நிறம்", "ಬಣ್ಣ"),
  values,
});
const packOption = (...values: string[]) => ({
  key: "pack",
  label: t("Pack size", "பேக் அளவு", "ಪ್ಯಾಕ್ ಗಾತ್ರ"),
  values: values.map(size),
});

const black = choice("black", t("Black", "கருப்பு", "ಕಪ್ಪು"));
const white = choice("white", t("White", "வெள்ளை", "ಬಿಳಿ"));
const blue = choice("blue", t("Blue", "நீலம்", "ನೀಲಿ"));
const maroon = choice("maroon", t("Maroon", "மெரூன்", "ಮರೂನ್"));

/** One variant per combination of the given axes. */
function matrix(
  skuPrefix: string,
  axes: Record<string, string[]>,
  build: (values: Record<string, string>) => Omit<SeedVariant, "sku" | "optionValues">,
): SeedVariant[] {
  let combos: Record<string, string>[] = [{}];
  for (const [key, values] of Object.entries(axes)) {
    combos = combos.flatMap((combo) => values.map((value) => ({ ...combo, [key]: value })));
  }
  return combos.map((optionValues) => ({
    sku: [skuPrefix, ...Object.values(optionValues)].join("-").toUpperCase(),
    optionValues,
    ...build(optionValues),
  }));
}

/** A simple product with a single default variant. */
function single(sku: string, v: Omit<SeedVariant, "sku" | "optionValues">): SeedVariant[] {
  return [{ sku, optionValues: {}, ...v }];
}

export const products: SeedProduct[] = [
  // Clothing
  {
    slug: "classic-cotton-t-shirt",
    categorySlug: "clothing",
    name: t("Classic Cotton T-Shirt", "கிளாசிக் காட்டன் டி-ஷர்ட்", "ಕ್ಲಾಸಿಕ್ ಕಾಟನ್ ಟಿ-ಶರ್ಟ್"),
    shortDescription: t(
      "Soft, breathable 100% cotton tee for everyday wear.",
      "அன்றாடம் அணிய மென்மையான, காற்றோட்டமான 100% பருத்தி டி-ஷர்ட்.",
      "ದಿನನಿತ್ಯ ಧರಿಸಲು ಮೃದುವಾದ, ಗಾಳಿಯಾಡುವ 100% ಹತ್ತಿ ಟಿ-ಶರ್ಟ್.",
    ),
    isFeatured: true,
    hsnCode: "6109",
    attributes: { material: "cotton", fit: "regular", gender: "unisex", care: "Machine wash cold" },
    options: [sizeOption("S", "M", "L", "XL"), colorOption([white, black])],
    variants: matrix("TEE", { size: ["S", "M", "L", "XL"], color: ["white", "black"] }, (v) => ({
      price: v.size === "XL" ? 54900 : 49900,
      compareAtPrice: 79900,
      stock: v.size === "S" ? 3 : 25,
      weightGrams: 200,
    })),
    imageCount: 3,
  },
  {
    slug: "linen-kurta",
    categorySlug: "clothing",
    name: t("Linen Kurta", "லினன் குர்தா", "ಲಿನನ್ ಕುರ್ತಾ"),
    shortDescription: t(
      "Lightweight linen kurta, perfect for warm days.",
      "வெயில் நாட்களுக்கு ஏற்ற இலகுவான லினன் குர்தா.",
      "ಬಿಸಿಲಿನ ದಿನಗಳಿಗೆ ಸೂಕ್ತವಾದ ಹಗುರವಾದ ಲಿನನ್ ಕುರ್ತಾ.",
    ),
    hsnCode: "6211",
    attributes: { material: "linen", fit: "relaxed", gender: "men" },
    options: [sizeOption("M", "L", "XL"), colorOption([white, blue])],
    variants: matrix("KURTA", { size: ["M", "L", "XL"], color: ["white", "blue"] }, () => ({
      price: 129900,
      compareAtPrice: 179900,
      stock: 12,
      weightGrams: 300,
    })),
    imageCount: 2,
  },
  {
    slug: "kanchipuram-silk-saree",
    categorySlug: "clothing",
    name: t("Kanchipuram Silk Saree", "காஞ்சிபுரம் பட்டுப் புடவை", "ಕಾಂಚೀಪುರಂ ರೇಷ್ಮೆ ಸೀರೆ"),
    shortDescription: t(
      "Handwoven pure silk saree with zari border.",
      "ஜரிகை பார்டருடன் கையால் நெய்த தூய பட்டுப் புடவை.",
      "ಜರಿ ಅಂಚಿನ ಕೈಮಗ್ಗದ ಶುದ್ಧ ರೇಷ್ಮೆ ಸೀರೆ.",
    ),
    isFeatured: true,
    taxRateBps: 1200,
    hsnCode: "5007",
    attributes: { material: "silk", gender: "women", care: "Dry clean only" },
    options: [colorOption([maroon, blue])],
    variants: matrix("SAREE-KANCHI", { color: ["maroon", "blue"] }, () => ({
      price: 1249900,
      compareAtPrice: 1499900,
      stock: 4,
      weightGrams: 800,
    })),
    imageCount: 3,
  },
  {
    slug: "denim-jacket",
    categorySlug: "clothing",
    name: t("Denim Jacket", "டெனிம் ஜாக்கெட்", "ಡೆನಿಮ್ ಜಾಕೆಟ್"),
    shortDescription: t(
      "Classic blue denim jacket with a modern fit.",
      "நவீன பொருத்தத்துடன் கூடிய கிளாசிக் நீல டெனிம் ஜாக்கெட்.",
      "ಆಧುನಿಕ ಫಿಟ್‌ನ ಕ್ಲಾಸಿಕ್ ನೀಲಿ ಡೆನಿಮ್ ಜಾಕೆಟ್.",
    ),
    taxRateBps: 1200,
    hsnCode: "6201",
    attributes: { material: "denim", fit: "slim", gender: "unisex" },
    options: [sizeOption("S", "M", "L")],
    variants: matrix("DENIM-JKT", { size: ["S", "M", "L"] }, (v) => ({
      price: 249900,
      compareAtPrice: 349900,
      stock: v.size === "L" ? 0 : 8,
      weightGrams: 700,
    })),
    imageCount: 2,
  },

  // Food
  {
    slug: "filter-coffee-powder",
    categorySlug: "food",
    name: t("Filter Coffee Powder", "ஃபில்டர் காபி தூள்", "ಫಿಲ್ಟರ್ ಕಾಫಿ ಪುಡಿ"),
    shortDescription: t(
      "80:20 coffee-chicory blend, freshly roasted and ground.",
      "புதிதாக வறுத்து அரைத்த 80:20 காபி-சிக்கரி கலவை.",
      "ಹೊಸದಾಗಿ ಹುರಿದು ಪುಡಿ ಮಾಡಿದ 80:20 ಕಾಫಿ-ಚಿಕೋರಿ ಮಿಶ್ರಣ.",
    ),
    isFeatured: true,
    hsnCode: "0901",
    attributes: { diet_type: "vegan", shelf_life_days: 180, ingredients: "Coffee, chicory" },
    options: [packOption("250g", "500g", "1kg")],
    variants: [
      {
        sku: "COFFEE-250G",
        optionValues: { pack: "250g" },
        price: 22000,
        stock: 50,
        weightGrams: 260,
      },
      {
        sku: "COFFEE-500G",
        optionValues: { pack: "500g" },
        price: 42000,
        stock: 40,
        weightGrams: 520,
      },
      {
        sku: "COFFEE-1KG",
        optionValues: { pack: "1kg" },
        price: 79900,
        compareAtPrice: 84000,
        stock: 20,
        weightGrams: 1030,
      },
    ],
    imageCount: 2,
  },
  {
    slug: "mysore-pak",
    categorySlug: "food",
    name: t("Mysore Pak", "மைசூர் பாக்", "ಮೈಸೂರು ಪಾಕ್"),
    shortDescription: t(
      "Melt-in-the-mouth ghee Mysore Pak made in small batches.",
      "சிறிய அளவில் தயாரிக்கப்படும், வாயில் கரையும் நெய் மைசூர் பாக்.",
      "ಸಣ್ಣ ಪ್ರಮಾಣದಲ್ಲಿ ತಯಾರಿಸಿದ, ಬಾಯಲ್ಲಿ ಕರಗುವ ತುಪ್ಪದ ಮೈಸೂರು ಪಾಕ್.",
    ),
    hsnCode: "1704",
    attributes: {
      diet_type: "veg",
      shelf_life_days: 15,
      ingredients: "Gram flour, ghee, sugar",
    },
    options: [packOption("250g", "500g")],
    variants: [
      {
        sku: "MYSOREPAK-250G",
        optionValues: { pack: "250g" },
        price: 25000,
        stock: 30,
        weightGrams: 280,
      },
      {
        sku: "MYSOREPAK-500G",
        optionValues: { pack: "500g" },
        price: 48000,
        stock: 20,
        weightGrams: 540,
      },
    ],
    imageCount: 2,
  },
  {
    slug: "organic-turmeric-powder",
    categorySlug: "food",
    name: t("Organic Turmeric Powder", "இயற்கை மஞ்சள் தூள்", "ಸಾವಯವ ಅರಿಶಿನ ಪುಡಿ"),
    shortDescription: t(
      "High-curcumin turmeric from Erode farms.",
      "ஈரோடு பண்ணைகளில் இருந்து அதிக குர்குமின் கொண்ட மஞ்சள்.",
      "ಈರೋಡ್ ಹೊಲಗಳಿಂದ ಹೆಚ್ಚು ಕರ್ಕ್ಯುಮಿನ್ ಹೊಂದಿರುವ ಅರಿಶಿನ.",
    ),
    hsnCode: "0910",
    attributes: { diet_type: "vegan", shelf_life_days: 365, ingredients: "Turmeric" },
    options: [],
    variants: single("TURMERIC-200G", {
      price: 14900,
      compareAtPrice: 18000,
      stock: 60,
      weightGrams: 210,
    }),
    imageCount: 1,
  },
  {
    slug: "mango-pickle",
    categorySlug: "food",
    name: t("Mango Pickle", "மாங்காய் ஊறுகாய்", "ಮಾವಿನಕಾಯಿ ಉಪ್ಪಿನಕಾಯಿ"),
    shortDescription: t(
      "Tangy, spicy homestyle mango pickle in sesame oil.",
      "நல்லெண்ணெயில் செய்த புளிப்பும் காரமும் கொண்ட வீட்டு முறை மாங்காய் ஊறுகாய்.",
      "ಎಳ್ಳೆಣ್ಣೆಯಲ್ಲಿ ಮಾಡಿದ ಹುಳಿ-ಖಾರದ ಮನೆಶೈಲಿಯ ಮಾವಿನಕಾಯಿ ಉಪ್ಪಿನಕಾಯಿ.",
    ),
    taxRateBps: 1200,
    hsnCode: "2001",
    attributes: {
      diet_type: "vegan",
      shelf_life_days: 270,
      spice_level: "hot",
      ingredients: "Raw mango, sesame oil, chilli, salt, mustard",
    },
    options: [],
    variants: single("PICKLE-MANGO-300G", { price: 18900, stock: 2, weightGrams: 380 }),
    imageCount: 1,
  },

  // Electronics
  {
    slug: "wireless-earbuds",
    categorySlug: "electronics",
    name: t("Wireless Earbuds", "வயர்லெஸ் இயர்பட்ஸ்", "ವೈರ್‌ಲೆಸ್ ಇಯರ್‌ಬಡ್ಸ್"),
    shortDescription: t(
      "True wireless earbuds with noise cancellation and 30-hour battery.",
      "சத்தக் குறைப்பு வசதி மற்றும் 30 மணி நேர பேட்டரி கொண்ட வயர்லெஸ் இயர்பட்ஸ்.",
      "ಶಬ್ದ ನಿಯಂತ್ರಣ ಮತ್ತು 30 ಗಂಟೆಗಳ ಬ್ಯಾಟರಿ ಇರುವ ವೈರ್‌ಲೆಸ್ ಇಯರ್‌ಬಡ್ಸ್.",
    ),
    brand: "SoundCo",
    isFeatured: true,
    hsnCode: "8518",
    attributes: { warranty_months: 12, battery_life_hours: 30, connectivity: "bluetooth" },
    options: [colorOption([black, white])],
    variants: matrix("EARBUDS", { color: ["black", "white"] }, () => ({
      price: 249900,
      compareAtPrice: 399900,
      stock: 35,
      weightGrams: 120,
    })),
    imageCount: 3,
  },
  {
    slug: "bluetooth-speaker",
    categorySlug: "electronics",
    name: t("Bluetooth Speaker", "புளூடூத் ஸ்பீக்கர்", "ಬ್ಲೂಟೂತ್ ಸ್ಪೀಕರ್"),
    shortDescription: t(
      "Portable, water-resistant speaker with deep bass.",
      "ஆழமான பேஸ் ஒலியுடன், தண்ணீர் புகாத கையடக்க ஸ்பீக்கர்.",
      "ಆಳವಾದ ಬೇಸ್ ಹೊಂದಿರುವ, ನೀರು ನಿರೋಧಕ ಪೋರ್ಟಬಲ್ ಸ್ಪೀಕರ್.",
    ),
    brand: "SoundCo",
    hsnCode: "8518",
    attributes: {
      warranty_months: 12,
      battery_life_hours: 12,
      connectivity: "bluetooth",
      color: "#1d4ed8",
    },
    options: [],
    variants: single("SPEAKER-BT-10W", {
      price: 179900,
      compareAtPrice: 249900,
      stock: 18,
      weightGrams: 550,
    }),
    imageCount: 2,
  },
  {
    slug: "power-bank-10000mah",
    categorySlug: "electronics",
    name: t("Power Bank 10000mAh", "பவர் பேங்க் 10000mAh", "ಪವರ್ ಬ್ಯಾಂಕ್ 10000mAh"),
    shortDescription: t(
      "Slim 10000mAh power bank with 22.5W fast charging.",
      "22.5W வேகமான சார்ஜிங் கொண்ட மெல்லிய 10000mAh பவர் பேங்க்.",
      "22.5W ವೇಗದ ಚಾರ್ಜಿಂಗ್ ಇರುವ ತೆಳುವಾದ 10000mAh ಪವರ್ ಬ್ಯಾಂಕ್.",
    ),
    brand: "VoltX",
    hsnCode: "8507",
    attributes: { warranty_months: 6, connectivity: "usb_c", color: "#111827" },
    options: [],
    variants: single("POWERBANK-10K", {
      price: 119900,
      compareAtPrice: 159900,
      stock: 0,
      weightGrams: 230,
    }),
    imageCount: 1,
  },
  {
    slug: "smart-watch",
    categorySlug: "electronics",
    name: t("Smart Watch", "ஸ்மார்ட் வாட்ச்", "ಸ್ಮಾರ್ಟ್ ವಾಚ್"),
    shortDescription: t(
      "AMOLED smart watch with heart-rate, SpO2 and calling.",
      "இதயத் துடிப்பு, SpO2 மற்றும் அழைப்பு வசதி கொண்ட AMOLED ஸ்மார்ட் வாட்ச்.",
      "ಹೃದಯ ಬಡಿತ, SpO2 ಮತ್ತು ಕರೆ ಸೌಲಭ್ಯ ಇರುವ AMOLED ಸ್ಮಾರ್ಟ್ ವಾಚ್.",
    ),
    brand: "VoltX",
    isFeatured: true,
    hsnCode: "8517",
    attributes: { warranty_months: 12, battery_life_hours: 168, connectivity: "bluetooth" },
    options: [colorOption([black, blue])],
    variants: matrix("WATCH", { color: ["black", "blue"] }, () => ({
      price: 349900,
      compareAtPrice: 599900,
      stock: 15,
      weightGrams: 150,
    })),
    imageCount: 3,
  },
];

export const productImage = image;

// ───────────────────────────── Coupons ─────────────────────────────

const DAY = 24 * 60 * 60 * 1000;

export const coupons = (now: Date) => [
  {
    code: "WELCOME10",
    description: t(
      "10% off your first order (up to ₹200)",
      "உங்கள் முதல் ஆர்டருக்கு 10% தள்ளுபடி (₹200 வரை)",
      "ನಿಮ್ಮ ಮೊದಲ ಆರ್ಡರ್‌ಗೆ 10% ರಿಯಾಯಿತಿ (₹200 ವರೆಗೆ)",
    ),
    type: "PERCENTAGE" as const,
    value: 1000,
    minCartValue: 49900,
    maxDiscount: 20000,
    perUserLimit: 1,
    categorySlugs: [] as string[],
  },
  {
    code: "FLAT100",
    description: t(
      "₹100 off on orders above ₹999",
      "₹999க்கு மேல் ஆர்டர் செய்தால் ₹100 தள்ளுபடி",
      "₹999ಕ್ಕಿಂತ ಹೆಚ್ಚಿನ ಆರ್ಡರ್‌ಗೆ ₹100 ರಿಯಾಯಿತಿ",
    ),
    type: "FLAT" as const,
    value: 10000,
    minCartValue: 99900,
    usageLimit: 500,
    categorySlugs: [] as string[],
  },
  {
    code: "FESTIVE20",
    description: t(
      "20% off clothing (up to ₹500), limited time",
      "ஆடைகளுக்கு 20% தள்ளுபடி (₹500 வரை), குறிப்பிட்ட காலத்திற்கு மட்டும்",
      "ಉಡುಪುಗಳ ಮೇಲೆ 20% ರಿಯಾಯಿತಿ (₹500 ವರೆಗೆ), ಸೀಮಿತ ಅವಧಿಗೆ",
    ),
    type: "PERCENTAGE" as const,
    value: 2000,
    maxDiscount: 50000,
    perUserLimit: 2,
    startsAt: now,
    endsAt: new Date(now.getTime() + 60 * DAY),
    categorySlugs: ["clothing"],
  },
];

// ───────────────────────────── Shipping ─────────────────────────────

export const shippingRules = [
  {
    id: "seed-shipping-local",
    name: "Bengaluru & Chennai (local)",
    priority: 10,
    pincodePrefixes: ["560", "600"],
    stateCodes: [] as string[],
    rateType: "FLAT" as const,
    flatRate: 4000,
    freeShippingThreshold: 49900,
    estimatedDaysMin: 1,
    estimatedDaysMax: 3,
  },
  {
    id: "seed-shipping-india",
    name: "Rest of India",
    priority: 0,
    pincodePrefixes: [] as string[],
    stateCodes: [] as string[],
    rateType: "WEIGHT_BASED" as const,
    baseWeightGrams: 500,
    baseRate: 6000,
    additionalWeightGrams: 500,
    additionalRate: 3000,
    freeShippingThreshold: 99900,
    estimatedDaysMin: 4,
    estimatedDaysMax: 7,
  },
];
