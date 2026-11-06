/**
 * SnapzDealz - Product Catalog Data
 * Multi-category bold deal store inventory
 */

const DEFAULT_PRODUCTS = [
  {
    id: 1,
    name: "Apex Pulse Air Running Shoes",
    category: "Men's Shoes",
    categorySlug: "mens-shoes",
    price: 64.99,
    oldPrice: 129.99,
    rating: 4.8,
    reviewCount: 342,
    badge: "50% OFF",
    stock: 14,
    isTrending: true,
    isFeatured: true,
    colors: ["#1f1f1f", "#F9B800", "#DC3545", "#0D6EFD"],
    sizes: ["US 8", "US 9", "US 10", "US 11", "US 12"],
    images: [
      "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1608231387042-66d1773070a5?w=800&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?w=800&auto=format&fit=crop&q=80"
    ],
    description: "Engineered with responsive cloud-cushioning and aerodynamic breathable mesh. Designed for marathon training, sprint sessions, and all-day street style.",
    features: [
      "Dynamic Dual-Density Foam midsole for maximum energy rebound",
      "Seamless knitted upper for featherlight blister-free comfort",
      "High-abrasion anti-slip rubber outsole with flex grooves",
      "Reflective accents for low-light night running safety"
    ],
    specs: {
      "Brand": "Apex Footwear",
      "Weight": "285g (Size 10)",
      "Upper Material": "Engineered Knit Mesh",
      "Sole Material": "Phylon & Vulcanized Rubber",
      "Closure": "Lace-up Lock",
      "Warranty": "6 Months Manufacturer Warranty"
    }
  },
  {
    id: 2,
    name: "Luxe Verona Italian Leather Tote",
    category: "Ladies Bags",
    categorySlug: "ladies-bags",
    price: 79.99,
    oldPrice: 159.00,
    rating: 4.9,
    reviewCount: 218,
    badge: "FLASH DEAL",
    stock: 9,
    isTrending: true,
    isFeatured: true,
    colors: ["#8B4513", "#1f1f1f", "#D2B48C", "#B22222"],
    sizes: ["Medium (14\"x11\")", "Large (16\"x13\")"],
    images: [
      "https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=800&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1590874103328-eac38a683ce7?w=800&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1566150905458-1bf1fc113f0d?w=800&auto=format&fit=crop&q=80"
    ],
    description: "Crafted from hand-selected pebbled vegan leather with gold-tone hardware. Generous compartment holds up to a 15-inch laptop, cosmetics, and everyday essentials.",
    features: [
      "Scratch-resistant water-repellent pebbled vegan leather",
      "Padded central compartment fits laptops up to 15.6 inches",
      "Detachable adjustable crossbody strap with shoulder pad",
      "Reinforced protective metal feet at the base"
    ],
    specs: {
      "Brand": "Verona Atelier",
      "Dimensions": "15\" W x 12\" H x 5.5\" D",
      "Lining": "Signature Silk Jacquard",
      "Hardware": "14K Gold-tone zinc alloy",
      "Closure": "Magnetic snap & zipper top",
      "Warranty": "1 Year Craftsmanship Guarantee"
    }
  },
  {
    id: 3,
    name: "Lumière Radiance Botanical Glow Serum",
    category: "Health & Beauty",
    categorySlug: "health-beauty",
    price: 34.50,
    oldPrice: 68.00,
    rating: 4.9,
    reviewCount: 512,
    badge: "BESTSELLER",
    stock: 31,
    isTrending: true,
    isFeatured: true,
    colors: ["#F9B800", "#FFF"],
    sizes: ["30ml / 1.0 fl oz", "50ml / 1.7 fl oz"],
    images: [
      "https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=800&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1608248597359-54359d997d43?w=800&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?w=800&auto=format&fit=crop&q=80"
    ],
    description: "Potent antioxidant elixir with 15% stabilized Vitamin C, botanical hyaluronic acid, and niacinamide. Delivers glass-skin clarity and deep 72-hour hydration.",
    features: [
      "Visibly brightens dark spots and evens skin tone in 14 days",
      "100% Vegan, Cruelty-Free, Paraben-Free, and Fragrance-Free",
      "Triple molecular weight hyaluronic acid for multi-layer hydration",
      "Dermatologist tested and hypoallergenic for sensitive skin"
    ],
    specs: {
      "Brand": "Lumière Botanics",
      "Volume": "30ml (1.0 fl oz)",
      "Skin Type": "All Skin Types (Oily, Dry, Sensitive, Combination)",
      "Key Actives": "15% L-Ascorbic Acid, Hyaluronic Acid, Vitamin E",
      "Packaging": "UV-protective amber glass bottle with dropper",
      "Origin": "Formulated in France"
    }
  },
  {
    id: 4,
    name: "SonicPro ANC Wireless Headphones",
    category: "Electronics",
    categorySlug: "electronics",
    price: 89.99,
    oldPrice: 179.99,
    rating: 4.7,
    reviewCount: 429,
    badge: "50% OFF",
    stock: 18,
    isTrending: true,
    isFeatured: true,
    colors: ["#1f1f1f", "#E0E0E0", "#1E3A8A"],
    sizes: ["Universal Fit"],
    images: [
      "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1484704849700-f032a568e944?w=800&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1583394838336-acd977736f90?w=800&auto=format&fit=crop&q=80"
    ],
    description: "Immerse yourself in rich hi-res studio acoustics with Hybrid Active Noise Cancellation. Features 60-hour playtime and ultra-plush memory foam earcups.",
    features: [
      "Hybrid ANC reduces ambient noise by up to 38dB",
      "Custom 40mm titanium diaphragm drivers for punchy bass",
      "60-Hour battery life; 10 min fast charge yields 5 hours",
      "Multipoint Bluetooth 5.3 connection for seamless device switching"
    ],
    specs: {
      "Brand": "SonicAudio",
      "Driver Size": "40mm Custom Titanium",
      "Battery Life": "60 Hours (ANC Off) / 45 Hours (ANC On)",
      "Bluetooth": "Version 5.3 (SBC, AAC, LDAC)",
      "Microphones": "4 Beamforming Mics with AI ENC",
      "Weight": "240g"
    }
  },
  {
    id: 5,
    name: "Chronos Stealth Chronograph Watch",
    category: "Watches",
    categorySlug: "watches",
    price: 119.00,
    oldPrice: 240.00,
    rating: 4.8,
    reviewCount: 164,
    badge: "HOT DEAL",
    stock: 7,
    isTrending: true,
    isFeatured: false,
    colors: ["#1f1f1f", "#C0C0C0", "#F9B800"],
    sizes: ["42mm Case"],
    images: [
      "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=800&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1524805444758-089113d48a6d?w=800&auto=format&fit=crop&q=80"
    ],
    description: "Sleek matte black stainless steel case paired with scratch-proof sapphire crystal glass. Features Japanese quartz precision movement and 100m water resistance.",
    features: [
      "Genuine Japanese Miyota Quartz movement",
      "Ultra-scratch-resistant sapphire crystal glass",
      "Subdials for 60-second, 30-minute, and 24-hour displays",
      "10 ATM (100 meters / 330 feet) water resistance"
    ],
    specs: {
      "Brand": "Chronos Heritage",
      "Case Diameter": "42mm",
      "Case Thickness": "11.5mm",
      "Band Material": "316L Solid Stainless Steel",
      "Glass": "Anti-Reflective Sapphire Crystal",
      "Movement": "Japanese Miyota OS20"
    }
  },
  {
    id: 6,
    name: "AeroGlide Cross-Trainer Sneaker",
    category: "Men's Shoes",
    categorySlug: "mens-shoes",
    price: 54.00,
    oldPrice: 110.00,
    rating: 4.6,
    reviewCount: 189,
    badge: "51% OFF",
    stock: 22,
    isTrending: true,
    isFeatured: false,
    colors: ["#212529", "#F9B800", "#6C757D"],
    sizes: ["US 8", "US 9", "US 10", "US 11", "US 12"],
    images: [
      "https://images.unsplash.com/photo-1560769629-975ec94e6a86?w=800&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1512374382149-233c42b661ac?w=800&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1515955656352-a1fa3ffcd111?w=800&auto=format&fit=crop&q=80"
    ],
    description: "Versatile gym sneaker engineered with lateral stability wings and an ultra-grip traction base for HIIT, cross-training, and heavy lifting.",
    features: [
      "Reinforced TPU heel counter for zero wobble on squats",
      "Breathable engineered jacquard knit upper",
      "Cushioned EVA insole with ergonomic arch support",
      "Multi-surface grooved tread for rapid agility cuts"
    ],
    specs: {
      "Brand": "AeroSport",
      "Weight": "310g",
      "Upper": "TPU reinforced knit",
      "Midsole": "High-density EVA foam",
      "Drop": "6mm offset",
      "Warranty": "3 Months"
    }
  },
  {
    id: 7,
    name: "Seraphina Quilted Crossbody Chain Bag",
    category: "Ladies Bags",
    categorySlug: "ladies-bags",
    price: 49.50,
    oldPrice: 99.00,
    rating: 4.8,
    reviewCount: 175,
    badge: "50% OFF",
    stock: 12,
    isTrending: true,
    isFeatured: false,
    colors: ["#1f1f1f", "#FFFFFF", "#F9B800", "#E91E63"],
    sizes: ["Compact (9.5\"x6\")"],
    images: [
      "https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=800&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1594223274512-ad4803739b7c?w=800&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1575032617751-6ddec2089882?w=800&auto=format&fit=crop&q=80"
    ],
    description: "Elevate date nights and weekend outings with this iconic diamond-quilted crossbody featuring a polished interwoven gold curb chain.",
    features: [
      "Signature geometric diamond chevron quilt stitching",
      "Convertible strap: wear as long shoulder strap or double cross",
      "Dual interior slip pockets plus secure zip wallet slot",
      "Turn-lock hardware clasp with polished gold finish"
    ],
    specs: {
      "Brand": "Seraphina New York",
      "Dimensions": "9.5\" L x 6.2\" H x 3.0\" D",
      "Material": "Eco-friendly Microfiber Leather",
      "Strap Drop": "22\" crossbody or 12\" double shoulder",
      "Lining": "Burgundy grosgrain fabric"
    }
  },
  {
    id: 8,
    name: "HydraGel Ultra Deep Moisture Creme",
    category: "Health & Beauty",
    categorySlug: "health-beauty",
    price: 28.00,
    oldPrice: 56.00,
    rating: 4.7,
    reviewCount: 388,
    badge: "BUY 1 GET 1",
    stock: 45,
    isTrending: false,
    isFeatured: true,
    colors: ["#4FC3F7"],
    sizes: ["50ml", "100ml"],
    images: [
      "https://images.unsplash.com/photo-1598440947619-2c35fc9aa908?w=800&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1556228720-195a672e8a03?w=800&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1535585209827-a15fcdbc4c2d?w=800&auto=format&fit=crop&q=80"
    ],
    description: "Weightless oil-free water-burst cream infused with bio-ceramides and Japanese green tea extract to reinforce the moisture barrier.",
    features: [
      "Instantly boosts skin moisture levels by 179%",
      "Non-comedogenic formula won't clog pores or cause breakouts",
      "Infused with soothing Centella Asiatica & Aloe leaf water",
      "Perfect smoothing primer base under daily makeup"
    ],
    specs: {
      "Brand": "DermaAqua",
      "Form": "Gel-Cream",
      "Skin Concern": "Dehydration, Dullness, Redness",
      "Net Weight": "50g / 1.76 oz",
      "Free From": "Sulfates, Phthalates, Synthetic Dyes"
    }
  },
  {
    id: 9,
    name: "TitanFit Pro Smart Fitness Tracker",
    category: "Electronics",
    categorySlug: "electronics",
    price: 45.99,
    oldPrice: 89.99,
    rating: 4.6,
    reviewCount: 290,
    badge: "48% OFF",
    stock: 25,
    isTrending: true,
    isFeatured: false,
    colors: ["#1f1f1f", "#F9B800", "#2E7D32"],
    sizes: ["Standard Wrist"],
    images: [
      "https://images.unsplash.com/photo-1579586337278-3befd40fd17a?w=800&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1508685096489-7aacd43bd3b1?w=800&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1510017803434-a899398421b3?w=800&auto=format&fit=crop&q=80"
    ],
    description: "Crisp 1.62-inch AMOLED screen tracking 120+ workout modes, continuous SpO2 oxygen, heart rate dynamics, and scientific sleep stage analysis.",
    features: [
      "Always-On Retina AMOLED full-color touch display",
      "14-day ultra-long battery life on single magnetic charge",
      "5 ATM waterproof rating for swimming laps and showers",
      "Smart phone notifications, music control, and camera shutter"
    ],
    specs: {
      "Brand": "TitanTech",
      "Display": "1.62\" AMOLED 490x192 HD",
      "Battery": "180mAh Li-Po (14 days regular use)",
      "Compatibility": "iOS 12.0+ & Android 7.0+",
      "Sensors": "6-axis PPG Optical Heart Rate, SpO2, Accelerometer",
      "Water Resistance": "50 Meters (5 ATM)"
    }
  },
  {
    id: 10,
    name: "Nomad Explorer Canvas Travel Duffel",
    category: "Ladies Bags",
    categorySlug: "ladies-bags",
    price: 59.00,
    oldPrice: 119.00,
    rating: 4.8,
    reviewCount: 147,
    badge: "TOP PICK",
    stock: 11,
    isTrending: false,
    isFeatured: false,
    colors: ["#556B2F", "#1f1f1f", "#A0522D"],
    sizes: ["Weekender (45L)"],
    images: [
      "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=800&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1547949003-9792a18a2601?w=800&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1578632767115-351597cf2477?w=800&auto=format&fit=crop&q=80"
    ],
    description: "Rugged 16oz wax-treated military canvas with top-grain leather trim. Features an isolated ventilated shoe compartment and TSA flight-carry compliance.",
    features: [
      "Separate zipped waterproof shoe & dirty laundry tunnel",
      "Heavy-duty brass YKK two-way lockable zippers",
      "Removable ergonomic padded shoulder sling",
      "Rear luggage trolley sleeve slips effortlessly over roll-aboard handles"
    ],
    specs: {
      "Brand": "Nomad Supply Co.",
      "Capacity": "45 Liters (Meets Airline Carry-On Standards)",
      "Dimensions": "21.5\" x 12\" x 11\"",
      "Fabric": "Waxed Cotton Canvas & Full-Grain Leather",
      "Weight": "1.25 kg"
    }
  },
  {
    id: 11,
    name: "Vortex 4K Ultra Action Camera",
    category: "Electronics",
    categorySlug: "electronics",
    price: 99.99,
    oldPrice: 199.99,
    rating: 4.7,
    reviewCount: 204,
    badge: "DEAL OF DAY",
    stock: 8,
    isTrending: true,
    isFeatured: false,
    colors: ["#1f1f1f"],
    sizes: ["Action Bundle"],
    images: [
      "https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=800&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=800&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1502920917128-1aa500764cbd?w=800&auto=format&fit=crop&q=80"
    ],
    description: "Shoot crisp 4K 60fps action footage with 6-axis electronic image stabilization. Includes 131ft waterproof case and dual color screens for vlogging.",
    features: [
      "Crystal-clear 4K/60fps video & 20MP high-res action stills",
      "Dual screens: 2.0\" rear touch display + 1.4\" front selfie screen",
      "Advanced 6-Axis HyperSmooth EIS anti-shake stabilization",
      "Includes waterproof housing submersible down to 40m / 131ft"
    ],
    specs: {
      "Brand": "Vortex Vision",
      "Video Resolution": "4K@60fps, 2.7K@60fps, 1080P@120fps",
      "Photo Resolution": "20 Megapixels",
      "Lens": "170° Super Wide-Angle 7G Glass Lens",
      "Battery": "Dual 1350mAh Li-ion batteries included",
      "Connectivity": "Wi-Fi + Companion Mobile App"
    }
  },
  {
    id: 12,
    name: "Classic Derby Brogue Oxford Shoes",
    category: "Men's Shoes",
    categorySlug: "mens-shoes",
    price: 84.00,
    oldPrice: 168.00,
    rating: 4.9,
    reviewCount: 133,
    badge: "50% OFF",
    stock: 15,
    isTrending: false,
    isFeatured: false,
    colors: ["#8B4513", "#1f1f1f"],
    sizes: ["US 8", "US 9", "US 10", "US 11", "US 12"],
    images: [
      "https://images.unsplash.com/photo-1614252235316-8c857d38b5f4?w=800&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1533867617858-e7b97e060509?w=800&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1549298916-b41d501d3772?w=800&auto=format&fit=crop&q=80"
    ],
    description: "Timeless formal dress shoes with handcrafted wingtip perforations. Goodyear welted construction on a burnished full-grain calfskin upper.",
    features: [
      "Hand-burnished Italian calfskin leather",
      "Goodyear-welted sole that can be repeatedly resoled",
      "Breathable leather lining with memory foam footbed",
      "Waxed dress laces and blind eyelets"
    ],
    specs: {
      "Brand": "Kingsman & Co.",
      "Style": "Wingtip Brogue Derby",
      "Upper": "100% Full-Grain Calf Leather",
      "Outsole": "Stacked Leather with Non-Skid Rubber Top-Lift",
      "Origin": "Handmade in Portugal"
    }
  },
  {
    id: 13,
    name: "Volumizing 24K Gold Collagen Hair Mask",
    category: "Health & Beauty",
    categorySlug: "health-beauty",
    price: 24.99,
    oldPrice: 49.99,
    rating: 4.8,
    reviewCount: 295,
    badge: "HOT DEAL",
    stock: 38,
    isTrending: true,
    isFeatured: false,
    colors: ["#F9B800"],
    sizes: ["250ml / 8.5 oz", "500ml / 17 oz"],
    images: [
      "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=800&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1526947425960-945c6e72858f?w=800&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1571875257727-256c39da42af?w=800&auto=format&fit=crop&q=80"
    ],
    description: "Deep conditioning restorative hair treatment that repairs heat damage, split ends, and eliminates frizz with hydrolyzed keratin and argan oils.",
    features: [
      "Restores brittle, color-treated hair in a 5-minute salon ritual",
      "Infused with Moroccan Argan oil, Keratin, and pure botanical lipids",
      "Adds mirror-like gloss and weightless bounce",
      "Color-safe, sulfate-free, and paraben-free"
    ],
    specs: {
      "Brand": "Aura Hair Lab",
      "Size": "250ml (8.45 fl oz)",
      "Hair Type": "Damaged, Dry, Curly, or Color-Treated",
      "Usage": "Apply after shampooing, rinse after 5-10 minutes"
    }
  },
  {
    id: 14,
    name: "Aviator Gold Polarized Sunglasses",
    category: "Watches",
    categorySlug: "watches",
    price: 39.99,
    oldPrice: 85.00,
    rating: 4.7,
    reviewCount: 167,
    badge: "53% OFF",
    stock: 20,
    isTrending: false,
    isFeatured: false,
    colors: ["#F9B800", "#1f1f1f", "#4A5568"],
    sizes: ["Standard 58mm"],
    images: [
      "https://images.unsplash.com/photo-1511499767150-a48a237f0083?w=800&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1508296695146-257a814070b4?w=800&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1473496169904-658ba7c44d8a?w=800&auto=format&fit=crop&q=80"
    ],
    description: "Classic military pilot sunglasses with 100% UV400 polarized HD lenses, corrosion-resistant metallic alloy frames, and soft silicone nose pads.",
    features: [
      "TAC Polarized lenses block 100% harmful UVA & UVB rays",
      "Ultralight stainless titanium alloy frame (only 21 grams)",
      "Spring hinges flex up to 15 degrees for any face shape",
      "Includes hardshell leather case and microfiber cloth"
    ],
    specs: {
      "Brand": "Skyline Optics",
      "Lens Width": "58mm",
      "Bridge": "14mm",
      "Temple Length": "138mm",
      "Frame Material": "Gold-Plated Titanium Alloy",
      "Lens Type": "Polarized Triacetate Cellulose"
    }
  },
  {
    id: 15,
    name: "UrbanTech Heavyweight Oversized Hoodie",
    category: "Men's Clothing",
    categorySlug: "mens-clothing",
    price: 39.99,
    oldPrice: 89.00,
    rating: 4.9,
    reviewCount: 382,
    badge: "55% OFF",
    stock: 25,
    isTrending: true,
    isFeatured: true,
    colors: ["#1f1f1f", "#F9B800", "#4B5563", "#2E4057"],
    sizes: ["S", "M", "L", "XL", "XXL"],
    images: [
      "https://images.unsplash.com/photo-1556905055-8f358a7a47b2?w=800&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1578768079052-aa76e520028b?w=800&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1509967419530-da38b4704bc6?w=800&auto=format&fit=crop&q=80"
    ],
    description: "Crafted from luxury 460GSM brushed French terry cotton. Engineered with dropped shoulders, structured kangaroo pouch, and double-layered hood for the ultimate modern streetwear silhouette.",
    features: [
      "460GSM ultra-dense French terry cotton with anti-shrink pre-wash",
      "Seamless ribbed cuffs and hem with spandex shape memory",
      "Reinforced bartack stitching on stress points and kangaroo pocket",
      "Clean minimalist design suitable for lounging, gym, or urban layers"
    ],
    specs: {
      "Brand": "UrbanTech Apparel",
      "Fabric Weight": "460 GSM Heavyweight",
      "Material": "100% Combed Organic Cotton",
      "Fit": "Oversized / Relaxed Streetwear Fit",
      "Care": "Machine wash cold inside out; air dry"
    }
  },
  {
    id: 16,
    name: "Maverick Tactical Cargo Utility Pants",
    category: "Men's Clothing",
    categorySlug: "mens-clothing",
    price: 44.50,
    oldPrice: 85.00,
    rating: 4.8,
    reviewCount: 247,
    badge: "HOT DEAL",
    stock: 18,
    isTrending: true,
    isFeatured: false,
    colors: ["#1f1f1f", "#C2B280", "#354230"],
    sizes: ["30W x 30L", "32W x 32L", "34W x 32L", "36W x 34L"],
    images: [
      "https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?w=800&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1517445312882-bc9910d016b7?w=800&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1542272604-780c96856592?w=800&auto=format&fit=crop&q=80"
    ],
    description: "Multi-pocket tactical utility cargo trousers constructed from heavy-duty stretch ripstop. Designed for rugged outdoor trails, tactical missions, and streetwear styling.",
    features: [
      "Durable ripstop cotton-elastane weave with water-repellent DWR coating",
      "6 ergonomic utility pockets with secure bellows and zipper closures",
      "Articulated knees and gusseted crotch for unrestricted athletic mobility",
      "Adjustable bungee drawcord ankle cuffs for tapered fit"
    ],
    specs: {
      "Brand": "Maverick Gear",
      "Material": "97% Ripstop Cotton, 3% Spandex",
      "Pockets": "6 High-Capacity Tactical Pockets",
      "Closure": "Heavy-duty YKK Brass Zipper & Button",
      "Weather Resistance": "Light Rain Water-Repellent"
    }
  },
  {
    id: 17,
    name: "Signature Oxford Tailored Button-Down Shirt",
    category: "Men's Clothing",
    categorySlug: "mens-clothing",
    price: 32.00,
    oldPrice: 65.00,
    rating: 4.7,
    reviewCount: 198,
    badge: "50% OFF",
    stock: 22,
    isTrending: false,
    isFeatured: true,
    colors: ["#FFFFFF", "#87CEEB", "#1E3A8A", "#FFC0CB"],
    sizes: ["S (38)", "M (40)", "L (42)", "XL (44)", "XXL (46)"],
    images: [
      "https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?w=800&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=800&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1589310243389-96a5483213a8?w=800&auto=format&fit=crop&q=80"
    ],
    description: "The quintessential modern Oxford shirt, woven from pure 2-ply pinpoint cotton with a soft washed texture. Seamlessly transitions from boardroom meetings to weekend dinners.",
    features: [
      "100% long-staple combed cotton with non-iron wrinkle resistance",
      "Button-down collar that stays structured with or without a tie",
      "Tailored slim-regular cut for a flattering modern profile",
      "Durable mother-of-pearl finish buttons cross-stitched for longevity"
    ],
    specs: {
      "Brand": "Savile Row Atelier",
      "Fabric": "100% 2-Ply Long-Staple Cotton",
      "Weave": "Classic Pinpoint Oxford",
      "Collar": "Button-Down Roll Collar",
      "Cuff": "Adjustable Barrel Cuffs"
    }
  },
  {
    id: 18,
    name: "AeroPro Quick-Dry Compression Athletic Tee",
    category: "Men's Clothing",
    categorySlug: "mens-clothing",
    price: 22.99,
    oldPrice: 45.00,
    rating: 4.8,
    reviewCount: 310,
    badge: "FLASH DEAL",
    stock: 35,
    isTrending: true,
    isFeatured: false,
    colors: ["#1f1f1f", "#F9B800", "#0D6EFD", "#DC3545"],
    sizes: ["S", "M", "L", "XL", "XXL"],
    images: [
      "https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=800&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1581655353564-df123a1eb820?w=800&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?w=800&auto=format&fit=crop&q=80"
    ],
    description: "Ultra-breathable athletic compression performance shirt engineered with 4-way stretch micro-mesh. Evaporates sweat instantaneously during high-intensity training.",
    features: [
      "HydroWick cooling technology lowers skin temperature during workouts",
      "Silver-infused antimicrobial fibers neutralize sweat odor bacteria",
      "Flat-lock seams eliminate irritation and chafing under armpits",
      "UPF 50+ UV sun protection for outdoor runners and cyclists"
    ],
    specs: {
      "Brand": "AeroPro Sport",
      "Material": "88% Polyester Microfiber, 12% Spandex",
      "Moisture Wicking": "Instant HydroDry",
      "Weight": "145g Ultralight",
      "Sun Protection": "UPF 50+"
    }
  },
  {
    id: 19,
    name: "Parisian Cashmere-Blend Wool Trench Coat",
    category: "Women's Clothing",
    categorySlug: "womens-clothing",
    price: 89.99,
    oldPrice: 189.00,
    rating: 4.9,
    reviewCount: 265,
    badge: "52% OFF",
    stock: 11,
    isTrending: true,
    isFeatured: true,
    colors: ["#D2B48C", "#1f1f1f", "#F5F5DC", "#800020"],
    sizes: ["XS (US 0-2)", "S (US 4-6)", "M (US 8-10)", "L (US 12-14)", "XL (US 16)"],
    images: [
      "https://images.unsplash.com/photo-1544441893-675973e31985?w=800&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=800&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=800&auto=format&fit=crop&q=80"
    ],
    description: "Exquisite tailoring meets cold-weather luxury. Woven from a double-faced cashmere and virgin wool blend with signature wide lapels and a contouring waist-tie belt.",
    features: [
      "70% fine virgin wool, 20% recycled cashmere, 10% silk weave",
      "Double-breasted front with real horn buttons and storm flap",
      "Fully lined in breathable, anti-static satin for smooth layering",
      "Deep dual welt hand-warmer pockets and interior passport pocket"
    ],
    specs: {
      "Brand": "Maison Éléganse",
      "Material": "70% Wool, 20% Cashmere, 10% Silk",
      "Lining": "100% Cupro Satin",
      "Length": "Mid-Calf (112cm)",
      "Care": "Professional Dry Clean Only"
    }
  },
  {
    id: 20,
    name: "Bella Floral Tiered Chiffon Maxi Dress",
    category: "Women's Clothing",
    categorySlug: "womens-clothing",
    price: 48.00,
    oldPrice: 98.00,
    rating: 4.8,
    reviewCount: 319,
    badge: "BESTSELLER",
    stock: 19,
    isTrending: true,
    isFeatured: true,
    colors: ["#00563B", "#E07A5F", "#1D3557", "#F9B800"],
    sizes: ["XS", "S", "M", "L", "XL"],
    images: [
      "https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?w=800&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1496747611176-843222e1e57c?w=800&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?w=800&auto=format&fit=crop&q=80"
    ],
    description: "Dreamy floral print maxi dress crafted with featherlight cascading chiffon tiers. Features a smocked sweetheart bust and romantic flutter sleeves for garden weddings and holidays.",
    features: [
      "Breathable, non-crease georgette chiffon with vibrant botanical print",
      "Stretchy smocked bodice ensures flattering fit across all bust sizes",
      "Full tiered maxi skirt with subtle front slit for effortless movement",
      "Fully lined through the body with sheer lightweight sleeves"
    ],
    specs: {
      "Brand": "Bella Bloom Studio",
      "Material": "100% Poly Georgette Chiffon",
      "Lining": "100% Rayon Soft Lining",
      "Neckline": "Sweetheart / Square Neck Convertible",
      "Length": "Full Floor Length Maxi"
    }
  },
  {
    id: 21,
    name: "SculptLuxe Seamless Ribbed Leggings & Top Set",
    category: "Women's Clothing",
    categorySlug: "womens-clothing",
    price: 36.50,
    oldPrice: 75.00,
    rating: 4.9,
    reviewCount: 442,
    badge: "51% OFF",
    stock: 28,
    isTrending: true,
    isFeatured: false,
    colors: ["#1f1f1f", "#D97706", "#4D7C0F", "#7C3AED"],
    sizes: ["XS/S (US 0-4)", "M/L (US 6-10)", "XL (US 12-14)"],
    images: [
      "https://images.unsplash.com/photo-1518611012118-696072aa579a?w=800&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1506152983158-b4a74a01c721?w=800&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1538805060514-97d9cc17730c?w=800&auto=format&fit=crop&q=80"
    ],
    description: "2-piece matching activewear gym set featuring high-waisted ribbed compressive leggings and padded racerback sports top. 100% squat proof and sculpt contouring.",
    features: [
      "Zero-transparency squat-proof 4-way micro-ribbed compression knit",
      "Double-layer ribbed waistband holds core tight without rolling down",
      "Removable push-up cups included in coordinating racerback crop top",
      "Sweat-wicking and quick-drying for gym, yoga, Pilates, and travel"
    ],
    specs: {
      "Brand": "SculptLuxe Athletics",
      "Includes": "High-Waist Legging + Padded Crop Top Set",
      "Material": "90% Nylon, 10% Spandex Micro-Rib",
      "Waistband": "4.5-inch Compressive High Rise",
      "Opacity": "100% Squat Proof Verified"
    }
  },
  {
    id: 22,
    name: "CozyCloud Cable-Knit Oversized Cardigan",
    category: "Women's Clothing",
    categorySlug: "womens-clothing",
    price: 42.00,
    oldPrice: 85.00,
    rating: 4.8,
    reviewCount: 187,
    badge: "50% OFF",
    stock: 14,
    isTrending: false,
    isFeatured: true,
    colors: ["#FFFDD0", "#F9B800", "#E0A96D", "#6B7280"],
    sizes: ["S/M (Relaxed Fit)", "L/XL (Cozy Oversized)"],
    images: [
      "https://images.unsplash.com/photo-1434389677669-e08b4cac3105?w=800&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1584273143981-41c073dfe8f8?w=800&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1576995853123-5a10305d93c0?w=800&auto=format&fit=crop&q=80"
    ],
    description: "Indulgently soft chunky cable-knit cardigan with tortoiseshell buttons and deep patch pockets. The perfect cozy layer for cool evenings and autumn strolls.",
    features: [
      "Ultra-soft cloud-spun acrylic and cotton blend with zero skin itch",
      "Intricate heritage cable and honeycomb texture knit pattern",
      "Oversized dropped shoulder silhouette with deep front patch pockets",
      "Durable natural tortoiseshell effect buttons"
    ],
    specs: {
      "Brand": "Nordic Weave",
      "Material": "60% Cotton, 40% Soft-Spun Thermal Acrylic",
      "Knit Gauge": "Heavy 5-Gauge Cable Knit",
      "Closure": "4-Button Front Placket",
      "Pockets": "Two Deep Hand Pockets"
    }
  },
  {
    id: 99,
    name: "AeroPulse Max Wireless ANC Headphones",
    category: "Electronics",
    categorySlug: "electronics",
    price: 149.99,
    oldPrice: 299.99,
    rating: 4.9,
    reviewCount: 428,
    badge: "3D EXCLUSIVE",
    stock: 25,
    isTrending: true,
    isFeatured: true,
    has3DView: true,
    colors: ["#18191e", "#F9B800", "#e2e8f0", "#c82333"],
    sizes: ["One Size (Adjustable)"],
    images: [
      "https://images.unsplash.com/photo-1546435770-a3e426bf472b?w=800&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1484704849700-f032a568e944?w=800&auto=format&fit=crop&q=80"
    ],
    description: "Experience the next echelon of sound reproduction with AeroPulse Max. Custom tuned 40mm Beryllium acoustic drivers, -42dB Hybrid Active Noise Cancellation, and 65-hour playback with rapid charging.",
    features: [
      "40mm Beryllium Dynamic Drivers with ultra-low 0.05% THD distortion",
      "Hybrid Active Noise Cancellation (-42dB ambient sound suppression)",
      "Interactive 3D Studio inspection with explode view of acoustic chamber",
      "Dual-density memory foam wrapped in breathable protein leather",
      "65-hour playback battery life with 10-minute quick charge"
    ],
    specs: {
      "Brand": "AeroPulse Acoustic",
      "Driver Size": "40mm Beryllium Composite",
      "Frequency Response": "10Hz - 40,000Hz Hi-Res",
      "Active Noise Cancellation": "-42dB Hybrid DSP",
      "Battery Life": "Up to 65 Hours",
      "Connectivity": "Bluetooth 5.3 + 3.5mm Aux",
      "Weight": "248 grams"
    }
  }
];

// Category metadata for category bar and filters
const categoriesData = [
  { name: "All", slug: "all", icon: "bi-grid-fill" },
  { name: "Men's Shoes", slug: "mens-shoes", icon: "bi-shoe" },
  { name: "Men's Clothing", slug: "mens-clothing", icon: "bi-person-standing" },
  { name: "Women's Clothing", slug: "womens-clothing", icon: "bi-person-standing-dress" },
  { name: "Ladies Bags", slug: "ladies-bags", icon: "bi-handbag" },
  { name: "Health & Beauty", slug: "health-beauty", icon: "bi-stars" },
  { name: "Electronics", slug: "electronics", icon: "bi-laptop" },
  { name: "Watches & Acc.", slug: "watches", icon: "bi-watch" }
];

// Product Persistence Key
const STORAGE_CUSTOM_PRODUCTS_KEY = 'snapdealz_custom_products_v2';

/**
 * Loads products from localStorage.
 * CRITICAL FIX: NEVER auto-merge DEFAULT_PRODUCTS back!
 * User edits, custom items, and deletions remain 100% permanent and never revert.
 */
function loadProductsCatalog() {
  try {
    const raw = localStorage.getItem(STORAGE_CUSTOM_PRODUCTS_KEY);
    if (raw !== null) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed; // User's customized catalog preserved as-is!
      }
    }
  } catch (e) {
    console.error("Error loading custom products from storage:", e);
  }
  // Initialize storage once if never saved before
  try {
    localStorage.setItem(STORAGE_CUSTOM_PRODUCTS_KEY, JSON.stringify(DEFAULT_PRODUCTS));
  } catch (e) {}
  return [...DEFAULT_PRODUCTS];
}

// Global active product list used across the store
var products = loadProductsCatalog();

/**
 * Saves entire catalog to localStorage
 */
function saveProductCatalog(newCatalog) {
  try {
    localStorage.setItem(STORAGE_CUSTOM_PRODUCTS_KEY, JSON.stringify(newCatalog));
    products = newCatalog;
    window.dispatchEvent(new CustomEvent('catalog-updated', { detail: newCatalog }));
    return true;
  } catch (e) {
    console.error("Error saving product catalog:", e);
    return false;
  }
}

/**
 * Add a new product to catalog (top of the store)
 */
function addNewProduct(productData) {
  const currentCatalog = loadProductsCatalog();
  const maxId = currentCatalog.reduce((max, p) => (Number(p.id) > max ? Number(p.id) : max), 100);
  
  const categoryStr = (productData.category || "Electronics").trim();
  const slug = categoryStr.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');
  const priceNum = Math.max(0.99, parseFloat(productData.price) || 29.99);
  const oldPriceNum = parseFloat(productData.oldPrice) || (priceNum * 1.4);

  const formattedProduct = {
    id: maxId + 1,
    name: (productData.name || "Special Deal Product").trim(),
    category: categoryStr,
    categorySlug: slug,
    price: parseFloat(priceNum.toFixed(2)),
    oldPrice: parseFloat(oldPriceNum.toFixed(2)),
    rating: parseFloat(productData.rating) || 5.0,
    reviewCount: parseInt(productData.reviewCount, 10) || 16,
    badge: (productData.badge || "NEW DEAL").trim(),
    stock: parseInt(productData.stock, 10) || 20,
    isTrending: true,
    isFeatured: true,
    colors: Array.isArray(productData.colors) && productData.colors.length ? productData.colors : ["#1f1f1f", "#F9B800", "#0D6EFD"],
    sizes: Array.isArray(productData.sizes) && productData.sizes.length ? productData.sizes : ["Standard", "Large"],
    images: Array.isArray(productData.images) && productData.images.length > 0
      ? productData.images
      : [productData.image || "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&auto=format&fit=crop&q=80"],
    description: (productData.description || "Premium quality product with manufacturer warranty, fast dispatch, and guaranteed satisfaction.").trim(),
    features: Array.isArray(productData.features) && productData.features.length > 0
      ? productData.features
      : [
          "Authentic, factory sealed original merchandise",
          "Includes 30-day money-back guarantee & quick exchange",
          "Superfast priority courier shipping"
        ],
    specs: productData.specs || {
      "Category": categoryStr,
      "Condition": "Brand New / Sealed",
      "Warranty": "Official Warranty",
      "Shipping": "2-4 Business Days"
    }
  };

  const newCatalog = [formattedProduct, ...currentCatalog];
  saveProductCatalog(newCatalog);
  return formattedProduct;
}

/**
 * Get a product by its ID
 */
function getProductById(productId) {
  const catalog = loadProductsCatalog();
  return catalog.find(p => String(p.id) === String(productId)) || null;
}

/**
 * Update an existing product in the catalog
 */
function updateProductById(productId, updatedFields) {
  const currentCatalog = loadProductsCatalog();
  const prodIndex = currentCatalog.findIndex(p => String(p.id) === String(productId));
  
  if (prodIndex === -1) {
    console.error("Product not found for update, ID:", productId);
    return null;
  }

  const existing = currentCatalog[prodIndex];
  
  const categoryStr = (updatedFields.category || existing.category || "Electronics").trim();
  const slug = updatedFields.categorySlug || categoryStr.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');
  const priceNum = Math.max(0.01, parseFloat(updatedFields.price !== undefined ? updatedFields.price : existing.price) || 0.99);
  const oldPriceNum = parseFloat(updatedFields.oldPrice !== undefined ? updatedFields.oldPrice : existing.oldPrice) || (priceNum * 1.3);

  const updatedProduct = {
    ...existing,
    name: (updatedFields.name !== undefined ? updatedFields.name : existing.name).trim(),
    category: categoryStr,
    categorySlug: slug,
    price: parseFloat(priceNum.toFixed(2)),
    oldPrice: parseFloat(oldPriceNum.toFixed(2)),
    stock: parseInt(updatedFields.stock !== undefined ? updatedFields.stock : existing.stock, 10),
    badge: (updatedFields.badge !== undefined ? updatedFields.badge : (existing.badge || "DEAL")).trim(),
    rating: updatedFields.rating !== undefined ? parseFloat(updatedFields.rating) : existing.rating,
    reviewCount: updatedFields.reviewCount !== undefined ? parseInt(updatedFields.reviewCount, 10) : existing.reviewCount,
    description: (updatedFields.description !== undefined ? updatedFields.description : (existing.description || '')).trim(),
    images: Array.isArray(updatedFields.images) && updatedFields.images.length > 0
      ? updatedFields.images
      : (updatedFields.image ? [updatedFields.image] : (existing.images || [existing.image])),
    features: Array.isArray(updatedFields.features) ? updatedFields.features : existing.features,
    specs: updatedFields.specs || existing.specs
  };

  currentCatalog[prodIndex] = updatedProduct;
  saveProductCatalog(currentCatalog);
  return updatedProduct;
}

/**
 * Delete a product by its ID
 */
function deleteProductById(productId) {
  const currentCatalog = loadProductsCatalog();
  const newCatalog = currentCatalog.filter(p => Number(p.id) !== Number(productId));
  saveProductCatalog(newCatalog);
  return newCatalog;
}

/**
 * Reset catalog back to factory defaults
 */
function resetProductsCatalog() {
  localStorage.removeItem(STORAGE_CUSTOM_PRODUCTS_KEY);
  products = [...DEFAULT_PRODUCTS];
  return products;
}

/* ==========================================================================
   HERO CAROUSEL SLIDES MANAGEMENT
   ========================================================================== */

const DEFAULT_HERO_SLIDES = [
  {
    id: 1,
    productId: 1,
    tag: "DEAL OF THE DAY",
    tagIcon: "bi-fire",
    title: "STEP INTO POWER & SPEED",
    description: "Apex Pulse Air Running Shoes with responsive cloud cushioning. Upgrade your athletic sprint with massive 50% discount savings.",
    btnPrimaryText: "Shop Now • $64.99",
    btnPrimaryLink: "product.html?id=1",
    btnSecondaryText: "Explore Shoes",
    btnSecondaryLink: "shop.html?category=mens-shoes",
    imageUrl: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800&auto=format&fit=crop&q=80",
    imageAlt: "Apex Pulse Air Running Shoes",
    stickerTop: "SAVE",
    stickerMiddle: "50%",
    stickerBottom: "TODAY",
    stickerTheme: "default"
  },
  {
    id: 2,
    productId: 2,
    tag: "LUXURY AT OUTLET PRICES",
    tagIcon: "bi-gem",
    title: "ITALIAN LEATHER STATEMENT TOTES",
    description: "Luxe Verona Italian Leather Tote crafted with scratch-resistant vegan pebbled leather and 14K gold-finish hardware.",
    btnPrimaryText: "Claim Deal • $79.99",
    btnPrimaryLink: "product.html?id=2",
    btnSecondaryText: "Browse All Bags",
    btnSecondaryLink: "shop.html?category=ladies-bags",
    imageUrl: "https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=800&auto=format&fit=crop&q=80",
    imageAlt: "Luxe Verona Tote",
    stickerTop: "ONLY",
    stickerMiddle: "$79",
    stickerBottom: "LIMITED",
    stickerTheme: "dark"
  },
  {
    id: 3,
    productId: 3,
    tag: "DERMATOLOGIST FORMULA",
    tagIcon: "bi-stars",
    title: "PURE BOTANICAL GLOW SERUM",
    description: "Lumière Radiance Botanical Glow Serum with 15% Stabilized Vitamin C & Triple Hyaluronic Acid for 72-hour deep moisture.",
    btnPrimaryText: "Get Glow • $34.50",
    btnPrimaryLink: "product.html?id=3",
    btnSecondaryText: "View Skincare",
    btnSecondaryLink: "shop.html?category=health-beauty",
    imageUrl: "https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=800&auto=format&fit=crop&q=80",
    imageAlt: "Lumière Radiance Serum",
    stickerTop: "TOP",
    stickerMiddle: "RATED",
    stickerBottom: "4.9★",
    stickerTheme: "default"
  }
];

const STORAGE_HERO_SLIDES_KEY = 'snapdealz_hero_slides_v2';

function loadHeroSlides() {
  try {
    const raw = localStorage.getItem(STORAGE_HERO_SLIDES_KEY);
    if (raw !== null) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed; // User's customized slides preserved permanently!
      }
    }
  } catch (e) {
    console.warn("Could not parse hero slides from localStorage", e);
  }
  // Initialize once with default template if not found
  const initial = JSON.parse(JSON.stringify(DEFAULT_HERO_SLIDES));
  try {
    localStorage.setItem(STORAGE_HERO_SLIDES_KEY, JSON.stringify(initial));
  } catch (e) {}
  return initial;
}

function saveHeroSlides(slides) {
  try {
    if (!Array.isArray(slides)) return false;
    localStorage.setItem(STORAGE_HERO_SLIDES_KEY, JSON.stringify(slides));
    window.dispatchEvent(new CustomEvent('hero-slides-updated', { detail: slides }));
    return true;
  } catch (e) {
    console.error("Failed to save hero slides to localStorage", e);
    return false;
  }
}

function resetHeroSlides() {
  try {
    localStorage.removeItem(STORAGE_HERO_SLIDES_KEY);
  } catch (e) {}
  return JSON.parse(JSON.stringify(DEFAULT_HERO_SLIDES));
}

/* ==========================================================================
   STORE NEWS & ANNOUNCEMENTS SLIDER MANAGEMENT
   ========================================================================== */

const DEFAULT_NEWS_ITEMS = [
  {
    id: 1,
    badge: "⚡ FLASH PROMO",
    badgeColor: "warning",
    title: "Mid-Season Clearance Drop: Extra 20% Off With Code BUNDLE20",
    summary: "Limited 48-hour flash event on premium sneakers, designer handbags, and glowing skincare. Free express courier over $50.",
    linkText: "Shop Sale Now",
    linkUrl: "shop.html",
    date: "Nov 6, 2026",
    imageUrl: "https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=800&auto=format&fit=crop&q=80",
    showInTopTicker: true,
    tickerText: "EXTRA 20% OFF WITH CODE BUNDLE20 | FREE COURIER OVER $50"
  },
  {
    id: 2,
    badge: "🚚 SHIPPING UPDATE",
    badgeColor: "success",
    title: "Cash On Delivery & 24-Hour Express Dispatch Now Available Nationwide",
    summary: "All verified orders now dispatch within 24 hours with full parcel inspection before payment at your doorstep.",
    linkText: "Track Your Order",
    linkUrl: "#trackOrderModal",
    date: "Nov 5, 2026",
    imageUrl: "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=800&auto=format&fit=crop&q=80",
    showInTopTicker: true,
    tickerText: "CASH ON DELIVERY & FAST 24H DISPATCH NATIONWIDE"
  },
  {
    id: 3,
    badge: "⭐ NEW DROP",
    badgeColor: "primary",
    title: "Exclusive Winter Luxe Bags & High-End Footwear Collection Live",
    summary: "Hand-stitched Italian leather totes and athletic sneakers now unlocked at factory-direct wholesale pricing.",
    linkText: "Browse Collection",
    linkUrl: "shop.html?category=ladies-bags",
    date: "Nov 4, 2026",
    imageUrl: "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=800&auto=format&fit=crop&q=80",
    showInTopTicker: true,
    tickerText: "NEW LUXE WINTER COLLECTION DROPPED - UP TO 50% OFF"
  }
];

const STORAGE_NEWS_ITEMS_KEY = 'snapdealz_news_items_v1';

function loadNewsItems() {
  try {
    const raw = localStorage.getItem(STORAGE_NEWS_ITEMS_KEY);
    if (raw !== null) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.warn("Could not parse news items from localStorage", e);
  }
  const initial = JSON.parse(JSON.stringify(DEFAULT_NEWS_ITEMS));
  try {
    localStorage.setItem(STORAGE_NEWS_ITEMS_KEY, JSON.stringify(initial));
  } catch (e) {}
  return initial;
}

function saveNewsItems(items) {
  try {
    if (!Array.isArray(items)) return false;
    localStorage.setItem(STORAGE_NEWS_ITEMS_KEY, JSON.stringify(items));
    window.dispatchEvent(new CustomEvent('news-items-updated', { detail: items }));
    return true;
  } catch (e) {
    console.error("Failed to save news items to localStorage", e);
    return false;
  }
}

function resetNewsItems() {
  try {
    localStorage.removeItem(STORAGE_NEWS_ITEMS_KEY);
  } catch (e) {}
  return JSON.parse(JSON.stringify(DEFAULT_NEWS_ITEMS));
}

/* ==========================================================================
   FOOTER, SOCIAL MEDIA & CUSTOMER SUPPORT SETTINGS
   ========================================================================== */

const DEFAULT_FOOTER_SETTINGS = {
  brandName: "SNAPZDEALZ",
  brandBio: "SnapzDealz is your premier destination for verified high-octane deals, luxury fashion overstocks, high-tech electronics, and beauty essentials at factory-direct pricing.",
  copyrightText: "© 2026 SnapzDealz Inc. All rights reserved. Built for speed and maximum savings.",
  
  socialLinks: {
    facebook: { url: "https://facebook.com", enabled: true },
    instagram: { url: "https://instagram.com", enabled: true },
    twitter: { url: "https://twitter.com", enabled: true },
    tiktok: { url: "https://tiktok.com", enabled: true },
    youtube: { url: "https://youtube.com", enabled: true },
    whatsapp: { url: "https://wa.me/923001234567", enabled: true }
  },

  support: {
    address: "742 Evergreen Terrace, Suite 400, San Francisco, CA",
    phone: "1-800-SNAPZ-DEAL (Toll Free 24/7)",
    email: "support@snapzdealz.com",
    whatsappNumber: "+92 300 1234567",
    hours: "Live Support: 24 Hours / 7 Days",
    helpdeskUrl: "contact.html"
  },

  legal: {
    privacyUrl: "privacy.html",
    privacyTitle: "Privacy Policy",
    termsUrl: "terms.html",
    termsTitle: "Terms & Conditions",
    aboutUrl: "about.html",
    aboutTitle: "About SnapzDealz",
    contactUrl: "contact.html",
    contactTitle: "Contact & Helpdesk"
  },

  payments: {
    cod: true,
    easypaisa: true,
    jazzcash: true,
    cards: true,
    ssl: true
  }
};

const STORAGE_FOOTER_SETTINGS_KEY = 'snapdealz_footer_settings_v1';

function loadFooterSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_FOOTER_SETTINGS_KEY);
    if (raw !== null) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        return {
          ...DEFAULT_FOOTER_SETTINGS,
          ...parsed,
          socialLinks: { ...DEFAULT_FOOTER_SETTINGS.socialLinks, ...(parsed.socialLinks || {}) },
          support: { ...DEFAULT_FOOTER_SETTINGS.support, ...(parsed.support || {}) },
          legal: { ...DEFAULT_FOOTER_SETTINGS.legal, ...(parsed.legal || {}) },
          payments: { ...DEFAULT_FOOTER_SETTINGS.payments, ...(parsed.payments || {}) }
        };
      }
    }
  } catch (e) {
    console.warn("Could not parse footer settings from localStorage", e);
  }
  const initial = JSON.parse(JSON.stringify(DEFAULT_FOOTER_SETTINGS));
  try {
    localStorage.setItem(STORAGE_FOOTER_SETTINGS_KEY, JSON.stringify(initial));
  } catch (e) {}
  return initial;
}

function saveFooterSettings(settings) {
  try {
    localStorage.setItem(STORAGE_FOOTER_SETTINGS_KEY, JSON.stringify(settings));
    window.dispatchEvent(new CustomEvent('footer-settings-updated', { detail: settings }));
    return true;
  } catch (e) {
    console.error("Failed to save footer settings to localStorage", e);
    return false;
  }
}

function resetFooterSettings() {
  try {
    localStorage.removeItem(STORAGE_FOOTER_SETTINGS_KEY);
  } catch (e) {}
  return JSON.parse(JSON.stringify(DEFAULT_FOOTER_SETTINGS));
}

/* ==========================================================================
   STORE CURRENCY & PRICING CONFIGURATION (PKR, USD, etc.)
   ========================================================================== */

const DEFAULT_CURRENCY_SETTINGS = {
  activeCurrency: "PKR", // Default to PKR as requested by user, easily switchable to USD
  pricingMode: "auto", // "auto" uses exchangeRate (e.g. 1 USD = 280 PKR), "direct" uses 1:1
  enableStoreSwitcher: true, // Show currency switcher in store header & navbar
  currencies: {
    PKR: {
      code: "PKR",
      symbol: "Rs.",
      name: "Pakistani Rupee (PKR)",
      flag: "🇵🇰",
      rate: 280, // 1 USD = 280 PKR
      decimals: 0,
      placement: "before" // "Rs. 2,999"
    },
    USD: {
      code: "USD",
      symbol: "$",
      name: "US Dollar (USD)",
      flag: "🇺🇸",
      rate: 1,
      decimals: 2,
      placement: "before" // "$49.99"
    }
  }
};

const STORAGE_CURRENCY_SETTINGS_KEY = 'snapdealz_currency_settings_v1';

function loadCurrencySettings() {
  try {
    const raw = localStorage.getItem(STORAGE_CURRENCY_SETTINGS_KEY);
    if (raw !== null) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        return {
          ...DEFAULT_CURRENCY_SETTINGS,
          ...parsed,
          currencies: {
            ...DEFAULT_CURRENCY_SETTINGS.currencies,
            ...(parsed.currencies || {})
          }
        };
      }
    }
  } catch (e) {
    console.warn("Could not parse currency settings from localStorage", e);
  }
  const initial = JSON.parse(JSON.stringify(DEFAULT_CURRENCY_SETTINGS));
  try {
    localStorage.setItem(STORAGE_CURRENCY_SETTINGS_KEY, JSON.stringify(initial));
  } catch (e) {}
  return initial;
}

function saveCurrencySettings(settings) {
  try {
    localStorage.setItem(STORAGE_CURRENCY_SETTINGS_KEY, JSON.stringify(settings));
    window.dispatchEvent(new CustomEvent('currency-settings-updated', { detail: settings }));
    return true;
  } catch (e) {
    console.error("Failed to save currency settings to localStorage", e);
    return false;
  }
}

function resetCurrencySettings() {
  try {
    localStorage.removeItem(STORAGE_CURRENCY_SETTINGS_KEY);
  } catch (e) {}
  const def = JSON.parse(JSON.stringify(DEFAULT_CURRENCY_SETTINGS));
  window.dispatchEvent(new CustomEvent('currency-settings-updated', { detail: def }));
  return def;
}

function getActiveCurrency() {
  const cfg = loadCurrencySettings();
  const code = cfg.activeCurrency || 'PKR';
  return (cfg.currencies && cfg.currencies[code]) ? cfg.currencies[code] : cfg.currencies.PKR;
}

function setStoreActiveCurrency(code) {
  const cfg = loadCurrencySettings();
  if (cfg.currencies && cfg.currencies[code]) {
    cfg.activeCurrency = code;
    saveCurrencySettings(cfg);
    return true;
  }
  return false;
}

function formatCurrency(amount, customSettings) {
  const num = Number(amount) || 0;
  const cfg = customSettings || (typeof loadCurrencySettings === 'function' ? loadCurrencySettings() : DEFAULT_CURRENCY_SETTINGS);
  const activeCode = cfg.activeCurrency || 'PKR';
  const curr = (cfg.currencies && cfg.currencies[activeCode]) ? cfg.currencies[activeCode] : {
    code: 'PKR',
    symbol: 'Rs.',
    rate: 280,
    decimals: 0,
    placement: 'before'
  };

  const isDirect = cfg.pricingMode === 'direct';
  const rate = isDirect ? 1 : (curr.rate !== undefined ? curr.rate : 1);
  const converted = num * rate;
  const decimals = curr.decimals !== undefined ? curr.decimals : (activeCode === 'PKR' ? 0 : 2);

  const formattedNum = converted.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });

  const symbol = curr.symbol || (activeCode === 'PKR' ? 'Rs.' : '$');
  const placement = curr.placement || 'before';

  if (placement === 'after') {
    return `${formattedNum} ${symbol}`;
  } else {
    const space = symbol.length > 1 ? ' ' : '';
    return `${symbol}${space}${formattedNum}`;
  }
}

function formatPrice(amount) {
  return formatCurrency(amount);
}



