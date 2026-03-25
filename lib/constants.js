/**
 * جوب البلاد — Application Constants
 * Central definition of all fixed values used across the platform.
 * Loaded before any other script on every page.
 */

const CONSTANTS = {

  // ================================================================
  // App Identity
  // ================================================================
  APP_NAME:    'جوب البلاد',
  APP_TAGLINE: 'سوق المعمورة المحلي',
  APP_VERSION: '1.0.0',

  // ================================================================
  // Coverage Area — Al-Maamoura, Oman
  // Coordinates can be overridden via app_config in Supabase
  // ================================================================
  AREA: {
    NAME:       'المعمورة',
    CENTER_LAT: 23.6500,
    CENTER_LNG: 57.7000,
    RADIUS_KM:  10,   // Maximum delivery radius
    BUFFER_KM:  2,    // Extra tolerance for boundary users
  },

  // ================================================================
  // Delivery Pricing (Omani Rial)
  // ================================================================
  DELIVERY: {
    TIER_1: { MIN: 0,  MAX: 10, FEE: 0.300 }, // 0–10 OMR → 0.300 OMR
    TIER_2: { MIN: 10, MAX: 50, FEE: 0.500 }, // 10–50 OMR → 0.500 OMR
    MAX_ORDER_AMOUNT: 50,  // Orders ≥ 50 OMR are auto-rejected
    FREE_PERIOD_DAYS: 7,   // Free delivery during first week after launch
  },

  // ================================================================
  // Order Status Machine
  // ================================================================
  ORDER_STATUS: {
    PENDING:          'pending',
    CONFIRMED:        'confirmed',
    READY:            'ready',
    OUT_FOR_DELIVERY: 'out_for_delivery',
    DELIVERED:        'delivered',
    REJECTED:         'rejected',
  },

  // Arabic labels for each status
  ORDER_STATUS_LABELS: {
    pending:          'قيد الانتظار',
    confirmed:        'مؤكد',
    ready:            'جاهز للشحن',
    out_for_delivery: 'في طريق التسليم',
    delivered:        'تم التسليم',
    rejected:         'مرفوض',
  },

  // Color for each status badge
  ORDER_STATUS_COLORS: {
    pending:          '#d97706',
    confirmed:        '#0ea5e9',
    ready:            '#7c3aed',
    out_for_delivery: '#0284c7',
    delivered:        '#16a34a',
    rejected:         '#dc2626',
  },

  // Valid transitions for each actor
  ORDER_STATUS_TRANSITIONS: {
    store:  { pending: 'confirmed', confirmed: 'ready', pending_reject: 'rejected' },
    driver: { ready: 'out_for_delivery', out_for_delivery: 'delivered' },
    admin:  'all',
  },

  // ================================================================
  // User Roles
  // ================================================================
  ROLES: {
    CUSTOMER: 'customer',
    STORE:    'store',
    DRIVER:   'driver',
    ADMIN:    'admin',
  },

  // Where to redirect after login per role
  ROLE_DASHBOARDS: {
    customer: '/index.html',
    store:    '/dashboard/store.html',
    driver:   '/dashboard/driver.html',
    admin:    '/dashboard/admin.html',
  },

  // Pages that require a specific role
  PROTECTED_ROUTES: {
    '/cart.html':            ['customer'],
    '/checkout.html':        ['customer'],
    '/orders.html':          ['customer'],
    '/profile.html':         ['customer', 'store', 'driver', 'admin'],
    '/dashboard/store.html': ['store'],
    '/dashboard/driver.html':['driver'],
    '/dashboard/admin.html': ['admin'],
  },

  // ================================================================
  // System Limits
  // ================================================================
  MAX_DRIVERS:             5,    // Hard cap on active drivers
  MAX_CART_QTY_PER_ITEM:   99,

  // ================================================================
  // localStorage Keys
  // ================================================================
  STORAGE: {
    CART:               'gb_cart',
    LOCATION:           'gb_location',
    LOCATION_VERIFIED:  'gb_loc_verified',
    LOCATION_TIMESTAMP: 'gb_loc_ts',
  },

  // How long to trust a cached location check (minutes)
  LOCATION_CACHE_MINUTES: 30,

  // ================================================================
  // Supabase Table Names
  // ================================================================
  TABLES: {
    USERS:         'users',
    STORES:        'stores',
    PRODUCTS:      'products',
    ORDERS:        'orders',
    ORDER_ITEMS:   'order_items',
    DRIVERS:       'drivers',
    APP_CONFIG:    'app_config',
    FREE_DELIVERY: 'free_delivery_used',
  },

};

// Prevent accidental mutation
Object.freeze(CONSTANTS);
Object.freeze(CONSTANTS.AREA);
Object.freeze(CONSTANTS.DELIVERY);
Object.freeze(CONSTANTS.ORDER_STATUS);
Object.freeze(CONSTANTS.ROLES);
Object.freeze(CONSTANTS.STORAGE);
Object.freeze(CONSTANTS.TABLES);
