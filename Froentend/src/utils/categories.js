/**
 * Universal Category Master for ShiftFlow POS
 * Covers ALL types of retail businesses:
 * - Kirana & Supermarkets
 * - Medical & Pharmacies
 * - Garments & Footwear
 * - Electronics & Mobile
 * - Hardware, Sanitary & Electricals
 * - Stationery & Books
 * - Cosmetics & Beauty
 * - Bakery & Sweets
 * - General Stores & Daily Needs
 */

export const UNIVERSAL_SHOP_SECTORS = [
    {
        id: 'ALL',
        name: 'All Shops',
        icon: '🏪',
        categories: []
    },
    {
        id: 'GROCERY',
        name: 'Grocery & Supermarket',
        icon: '🛒',
        categories: [
            'Staples & Flour',
            'Edible Oils & Ghee',
            'Spices & Masala',
            'Dairy & Refrigerated',
            'Packaged Foods & Noodles',
            'Snacks & Namkeen',
            'Biscuits & Bakery',
            'Beverages & Cold Drinks',
            'Fresh Fruits & Vegetables',
            'Pulses & Dals',
            'Dry Fruits & Nuts'
        ]
    },
    {
        id: 'PHARMACY',
        name: 'Pharmacy & Medical',
        icon: '💊',
        categories: [
            'Prescription Tablets & Capsules',
            'Syrups, Tonics & Drops',
            'First Aid & Bandages',
            'Baby Care & Diapers',
            'Vitamins & Supplements',
            'Ayurvedic & Herbal',
            'Personal Hygiene'
        ]
    },
    {
        id: 'GARMENTS',
        name: 'Clothing & Footwear',
        icon: '👕',
        categories: [
            "Men's Ready-made Wear",
            "Women's Ethnic & Western",
            "Kids & Baby Wear",
            'Footwear, Shoes & Slippers',
            'Innerwear & Hosiery',
            'Fabrics, Sarees & Suiting'
        ]
    },
    {
        id: 'ELECTRONICS',
        name: 'Electronics & Mobile',
        icon: '📱',
        categories: [
            'Mobile Phones & Tablets',
            'Chargers & Data Cables',
            'Earphones, Audio & Bluetooth',
            'Mobile Covers & Screen Glass',
            'Home & Kitchen Appliances',
            'LED Bulbs & Lighting'
        ]
    },
    {
        id: 'HARDWARE',
        name: 'Hardware & Electrical',
        icon: '🔧',
        categories: [
            'Tools & Fasteners (Nuts/Bolts)',
            'Paints, Putty & Brushes',
            'Plumbing Pipes & Sanitary',
            'Wires, Switches & MCB',
            'Plywood, Locks & Hinges'
        ]
    },
    {
        id: 'STATIONERY',
        name: 'Stationery & Books',
        icon: '📚',
        categories: [
            'Notebooks, Registers & Paper',
            'Pens, Pencils & Markers',
            'School Bags & Art Supplies',
            'Office Files & Calculators',
            'Books, Toys & Board Games'
        ]
    },
    {
        id: 'COSMETICS',
        name: 'Beauty & Cosmetics',
        icon: '💄',
        categories: [
            'Skin Care, Creams & Lotions',
            'Shampoos & Hair Care',
            'Perfumes, Body Sprays & Deos',
            'Color Cosmetics & Makeup',
            'Bathing Soaps & Body Wash'
        ]
    },
    {
        id: 'BAKERY',
        name: 'Bakery, Sweets & Cafe',
        icon: '🍞',
        categories: [
            'Fresh Breads, Buns & Pav',
            'Cakes, Pastries & Muffins',
            'Traditional Sweets (Mithai)',
            'Savory Puffs & Hot Snacks',
            'Cold Coffee, Shakes & Juices'
        ]
    },
    {
        id: 'GENERAL',
        name: 'Household & Daily Needs',
        icon: '🧼',
        categories: [
            'Detergents & Washing Powder',
            'Floor & Toilet Cleaners',
            'Utensils & Cookware',
            'Plastics & Buckets',
            'Pooja Items & Agarbatti',
            'General Store Miscellaneous'
        ]
    }
];

// Flat list of all default categories
export const ALL_FLAT_CATEGORIES = [
    'General',
    ...UNIVERSAL_SHOP_SECTORS.flatMap(s => s.categories)
];

// Standard Indian GST Tax Slabs
export const GST_SLABS = [
    { value: 0, label: '0% (Exempt / Nil)' },
    { value: 5, label: '5% (Essential Goods)' },
    { value: 12, label: '12% (Processed / Standard)' },
    { value: 18, label: '18% (Standard Retail Goods)' },
    { value: 28, label: '28% (Luxury / Sin Goods)' }
];

