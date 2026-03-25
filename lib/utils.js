/**
 * Utilities and Helpers
 */

const Utils = {
    // 1. Currency Formatting (Omani Rial)
    formatCurrency: (amount) => {
        return parseFloat(amount).toFixed(3) + ' ر.ع';
    },

    // 2. Geolocation checker for Al-Maamoura (Approximate bounding box)
    // Al-Maamoura Coordinates (Example boundaries to be replaced with exact later)
    BOUNDARIES: {
        latMin: 23.5000,
        latMax: 23.8000,
        lngMin: 57.0000,
        lngMax: 57.5000
    },

    checkLocation: async () => {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                reject(new Error("اللوكيشن غير مدعوم في متصفحك"));
                return;
            }

            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const { latitude, longitude } = position.coords;
                    
                    // Check if within bounds
                    const isInside = 
                        latitude >= Utils.BOUNDARIES.latMin && 
                        latitude <= Utils.BOUNDARIES.latMax && 
                        longitude >= Utils.BOUNDARIES.lngMin && 
                        longitude <= Utils.BOUNDARIES.lngMax;
                    
                    resolve({
                        lat: latitude,
                        lng: longitude,
                        isInside: isInside
                    });
                },
                (error) => {
                    reject(error);
                },
                { enableHighAccuracy: true }
            );
        });
    },

    // Generates a Google Maps link
    getGoogleMapsLink: (lat, lng) => {
        return `https://maps.google.com/?q=${lat},${lng}`;
    },

    // 3. Delivery Pricing Logic
    calculateDeliveryFee: (totalOrderValue, isFirstOrder = false) => {
        // First week logic handled via DB or isFirstOrder flag
        if (isFirstOrder) return 0.000;

        if (totalOrderValue > 0 && totalOrderValue <= 10) {
            return 0.300;
        } else if (totalOrderValue > 10 && totalOrderValue < 50) {
            return 0.500;
        } else if (totalOrderValue >= 50) {
            return -1; // -1 means order rejected/too large
        }
        return 0; // fallback
    },

    // 4. WhatsApp Message Generator
    generateWhatsAppLink: (storePhone, orderDetails, customerInfo) => {
        let msg = `*طلب جديد من منصة جوب البلاد* 📦\n\n`;
        if (customerInfo.orderId) msg += `*رقم الطلب:* ${customerInfo.orderId}\n`;
        msg += `*العميل:* ${customerInfo.name}\n`;
        msg += `*الموقع:* ${customerInfo.locationLink}\n\n`;

        msg += `*المنتجات:*\n`;
        orderDetails.items.forEach(item => {
            msg += `- ${item.name} (${item.qty}x) = ${Utils.formatCurrency(item.price * item.qty)}\n`;
        });

        msg += `\n*المجموع:* ${Utils.formatCurrency(orderDetails.total)}\n`;
        msg += `*التوصيل:* ${orderDetails.delivery === 0 ? 'مجانية 🎁' : Utils.formatCurrency(orderDetails.delivery)}\n`;
        msg += `*الإجمالي:* ${Utils.formatCurrency(orderDetails.total + (orderDetails.delivery || 0))}\n`;

        const encodedMsg = encodeURIComponent(msg);
        // Clean phone: strip non-digits, if no country code prefix use 968
        const cleanPhone = String(storePhone).replace(/\D/g, '');
        const fullPhone = cleanPhone.startsWith('968') ? cleanPhone : `968${cleanPhone}`;
        return `https://wa.me/${fullPhone}?text=${encodedMsg}`;
    }
};

window.Utils = Utils;
