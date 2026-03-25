/**
 * Cart & Checkout Logic — جوب البلاد
 * Saves orders to Supabase, generates WhatsApp link
 */

let activeStoreCarts = [];
let currentCheckoutStore = null; // { storeId, subtotal, deliveryFee }

document.addEventListener('DOMContentLoaded', () => {
    if (window.NavbarComponent) NavbarComponent.render('navbar-container');
    loadAllCarts();
    setupLocationButton();
    setupCheckoutForm();
});

// ── Load carts from localStorage ─────────────────────

function loadAllCarts() {
    activeStoreCarts = [];

    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key.startsWith('cart_')) continue;

        const storeId = key.replace('cart_', '');
        let cartData;
        try { cartData = JSON.parse(localStorage.getItem(key)); } catch { continue; }

        const items = Object.values(cartData || {});
        if (items.length > 0) {
            activeStoreCarts.push({ storeId, items });
        } else {
            localStorage.removeItem(key);
        }
    }

    renderCarts();
}

// ── Render cart list ──────────────────────────────────

async function renderCarts() {
    const emptyMsg = document.getElementById('cart-empty-msg');
    const content  = document.getElementById('cart-content');
    const list     = document.getElementById('cart-items-list');

    if (activeStoreCarts.length === 0) {
        emptyMsg.style.display = 'block';
        content.style.display  = 'none';
        document.querySelector('.summary-box').style.display = 'none';
        return;
    }

    emptyMsg.style.display = 'none';
    content.style.display  = 'block';
    list.innerHTML = '';

    // Fetch store names in parallel for display
    const storeCache = {};
    await Promise.all(activeStoreCarts.map(async (c) => {
        try {
            const s = await API.stores.getById(c.storeId);
            storeCache[c.storeId] = s;
        } catch {
            storeCache[c.storeId] = null;
        }
    }));

    activeStoreCarts.forEach((cartEntry) => {
        let subtotal = 0;
        const store = storeCache[cartEntry.storeId];
        const storeName = store ? escHtml(store.name) : `متجر`;

        const itemsHtml = cartEntry.items.map(item => {
            const itemTotal = item.price * item.qty;
            subtotal += itemTotal;
            return `
                <div class="cart-item">
                    <div>
                        <h4>${escHtml(item.name)}</h4>
                        <span class="text-muted" style="font-size:.9rem;color:var(--text-muted);">
                            ${item.qty} × ${Utils.formatCurrency(item.price)}
                        </span>
                    </div>
                    <strong>${Utils.formatCurrency(itemTotal)}</strong>
                </div>`;
        }).join('');

        const deliveryFee = Utils.calculateDeliveryFee(subtotal);
        const isRejected  = deliveryFee === -1;

        list.innerHTML += `
            <div style="background:var(--bg-card);border-radius:var(--radius-md);padding:1.5rem;margin-bottom:2rem;border:1px solid var(--border);">
                <h3 style="margin-bottom:1rem;color:var(--primary);">🛒 ${storeName}</h3>
                ${itemsHtml}
                <div style="display:flex;justify-content:space-between;align-items:center;border-top:1px dashed var(--border);padding-top:1rem;margin-top:1rem;flex-wrap:wrap;gap:.5rem;">
                    <strong>المجموع: ${Utils.formatCurrency(subtotal)}</strong>
                    ${isRejected
                        ? `<span style="color:var(--danger);font-weight:bold;">الطلب تجاوز 50 ر.ع — غير مقبول ❌</span>`
                        : `<button class="btn btn-secondary" onclick="prepareCheckout('${cartEntry.storeId}', ${subtotal}, ${deliveryFee})">إتمام الطلب →</button>`
                    }
                </div>
            </div>`;
    });

    document.querySelector('.summary-box').style.display = 'none';
}

// ── Prepare checkout for one store ───────────────────

window.prepareCheckout = function (storeId, subtotal, deliveryFee) {
    currentCheckoutStore = { storeId, subtotal, deliveryFee };

    document.getElementById('subtotal-val').innerText  = Utils.formatCurrency(subtotal);
    document.getElementById('delivery-val').innerText  = Utils.formatCurrency(deliveryFee);
    document.getElementById('total-val').innerText     = Utils.formatCurrency(subtotal + deliveryFee);

    const box = document.querySelector('.summary-box');
    box.style.display = 'block';
    box.scrollIntoView({ behavior: 'smooth' });
};

// ── Location button ───────────────────────────────────

function setupLocationButton() {
    const btn = document.getElementById('btn-get-location');
    if (!btn) return;

    btn.addEventListener('click', async () => {
        btn.disabled = true;
        btn.innerText = '⏳';
        try {
            const loc = await Utils.checkLocation();
            if (loc.isInside) {
                document.getElementById('cust-location').value = Utils.getGoogleMapsLink(loc.lat, loc.lng);
            } else {
                alert('أنت خارج نطاق التوصيل (المعمورة) ❌');
                document.getElementById('cust-location').value = '';
            }
        } catch {
            alert('تعذر تحديد الموقع تلقائياً. يرجى إدخال الرابط يدوياً.');
        } finally {
            btn.disabled = false;
            btn.innerText = '📍';
        }
    });
}

// ── Checkout form submission ──────────────────────────

function setupCheckoutForm() {
    const form = document.getElementById('checkout-form');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        if (!currentCheckoutStore) {
            alert('يرجى اختيار سلة المتجر أولاً');
            return;
        }

        const submitBtn = form.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.innerText = 'جاري إرسال الطلب...';

        try {
            const { storeId, subtotal, deliveryFee } = currentCheckoutStore;
            const name  = document.getElementById('cust-name').value.trim();
            const phone = document.getElementById('cust-phone').value.trim();
            const loc   = document.getElementById('cust-location').value.trim();

            // Validate phone (basic Omani format)
            if (!/^9\d{7}$/.test(phone)) {
                alert('يرجى إدخال رقم هاتف عُماني صحيح (9 أرقام يبدأ بـ 9)');
                return;
            }

            const cartData = JSON.parse(localStorage.getItem(`cart_${storeId}`));
            const items    = Object.values(cartData || {});
            if (items.length === 0) {
                alert('السلة فارغة');
                return;
            }

            // Check free delivery eligibility
            let finalDeliveryFee = deliveryFee;
            let isFreeDelivery   = false;
            const user = await API.auth.getUser();

            if (user) {
                const config = await API.config.getAll().catch(() => ({}));
                const launchDate = config.launch_date ? new Date(config.launch_date) : null;
                const freeDays   = parseInt(config.free_delivery_days || '7');
                const withinFreeWindow = launchDate
                    ? (Date.now() - launchDate.getTime()) / 86400000 <= freeDays
                    : false;

                if (withinFreeWindow) {
                    const alreadyUsed = await API.freeDelivery.hasUsed(user.id);
                    if (!alreadyUsed) {
                        finalDeliveryFee = 0;
                        isFreeDelivery   = true;
                    }
                }

                // Build order object for DB
                const orderPayload = {
                    user_id:        user.id,
                    store_id:       storeId,
                    status:         'pending',
                    total_price:    subtotal,
                    delivery_fee:   finalDeliveryFee,
                    customer_name:  name,
                    customer_phone: `968${phone}`,
                    location_link:  loc,
                    is_free_delivery: isFreeDelivery,
                };

                const newOrder = await API.orders.place({ order: orderPayload, items });

                // Mark free delivery as used
                if (isFreeDelivery) {
                    await API.freeDelivery.markUsed(user.id).catch(() => {});
                }

                // Fetch store for WhatsApp number
                const store = await API.stores.getById(storeId);
                const whatsappNum = store.whatsapp || store.phone;

                // Generate WhatsApp message
                const waLink = Utils.generateWhatsAppLink(
                    whatsappNum,
                    { items, total: subtotal, delivery: finalDeliveryFee },
                    { name, locationLink: loc, orderId: newOrder.id }
                );

                // Clear this store's cart
                localStorage.removeItem(`cart_${storeId}`);

                // Update delivery display if free
                if (isFreeDelivery) {
                    document.getElementById('delivery-val').innerText = 'مجانية 🎁';
                    document.getElementById('total-val').innerText = Utils.formatCurrency(subtotal);
                }

                alert('تم إنشاء طلبك بنجاح ✅\nسيتم تحويلك للواتساب للتواصل مع المتجر.');
                window.open(waLink, '_blank');
                window.location.reload();

            } else {
                // Not logged in — guest checkout (WhatsApp only, no DB save)
                const store  = await API.stores.getById(storeId);
                const waLink = Utils.generateWhatsAppLink(
                    store.whatsapp || store.phone,
                    { items, total: subtotal, delivery: deliveryFee },
                    { name, locationLink: loc }
                );
                localStorage.removeItem(`cart_${storeId}`);
                alert('طلبك يتم تحويله للواتساب.\nللاستفادة من تتبع الطلبات، سجّل الدخول.');
                window.open(waLink, '_blank');
                window.location.reload();
            }

        } catch (err) {
            console.error('[checkout]', err);
            alert('حدث خطأ أثناء إرسال الطلب. يرجى المحاولة مرة أخرى.');
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerText = 'تأكيد الطلب وإرسال عبر واتساب';
        }
    });
}

function escHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

document.addEventListener("DOMContentLoaded", () => {
    if (window.NavbarComponent) NavbarComponent.render('navbar-container');
    
    loadAllCarts();
    setupLocationButton();
    setupCheckoutForm();
});

function loadAllCarts() {
    activeStoreCarts = [];
    
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key.startsWith('cart_')) {
            const storeId = key.replace('cart_', '');
            const cartData = JSON.parse(localStorage.getItem(key));
            
            // Check if cart is empty
            const itemsArray = Object.values(cartData);
            if (itemsArray.length > 0) {
                activeStoreCarts.push({
                    storeId,
                    items: itemsArray
                });
            } else {
                // cleanup empty 
                localStorage.removeItem(key);
            }
        }
    }

    renderCarts();
}

function renderCarts() {
    const emptyMsg = document.getElementById("cart-empty-msg");
    const content = document.getElementById("cart-content");
    const list = document.getElementById("cart-items-list");

    if (activeStoreCarts.length === 0) {
        emptyMsg.style.display = "block";
        content.style.display = "none";
        return;
    }

    emptyMsg.style.display = "none";
    content.style.display = "block";

    list.innerHTML = "";

    activeStoreCarts.forEach((cart, index) => {
        let subtotal = 0;
        
        const itemsHtml = cart.items.map(item => {
            const itemTotal = item.price * item.qty;
            subtotal += itemTotal;
            return `
                <div class="cart-item">
                    <div>
                        <h4>${item.name}</h4>
                        <span class="text-muted">الكمية: ${item.qty} × ${window.Utils.formatCurrency(item.price)}</span>
                    </div>
                    <p>${window.Utils.formatCurrency(itemTotal)}</p>
                </div>
            `;
        }).join('');

        // For simplicity, we assume we fetch store details from DB later. Using dummy name.
        const storeName = `متجر #${cart.storeId}`;
        const deliveryFee = window.Utils.calculateDeliveryFee(subtotal);
        const isRejected = deliveryFee === -1;

        const cartHtml = `
            <div style="background: var(--bg-card); border-radius: var(--radius-md); padding: 1.5rem; margin-bottom: 2rem; border: 1px solid var(--border);">
                <h3 style="margin-bottom: 1rem; color: var(--primary);">سلة: ${storeName}</h3>
                <div style="margin-bottom: 1rem;">
                    ${itemsHtml}
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px dashed var(--border); padding-top: 1rem;">
                    <strong style="font-size: 1.1rem;">المجموع: ${window.Utils.formatCurrency(subtotal)}</strong>
                    ${isRejected ? 
                        `<span style="color:var(--danger); font-weight:bold;">الطلب تجاوز الحد المسموح (50 ر.ع) ❌</span>` :
                        `<button class="btn btn-secondary" onclick="prepareCheckout('${cart.storeId}', ${subtotal}, ${deliveryFee})">إتمام طلب هذا المتجر</button>`
                    }
                </div>
            </div>
        `;
        list.innerHTML += cartHtml;
    });

    // Hide summary box initially
    document.querySelector('.summary-box').style.display = 'none';
}

window.prepareCheckout = function(storeId, subtotal, delivery) {
    currentCheckoutStoreId = storeId;
    
    document.getElementById("subtotal-val").innerText = window.Utils.formatCurrency(subtotal);
    document.getElementById("delivery-val").innerText = window.Utils.formatCurrency(delivery);
    document.getElementById("total-val").innerText = window.Utils.formatCurrency(subtotal + delivery);

    const summaryBox = document.querySelector('.summary-box');
    summaryBox.style.display = 'block';
    
    // Scroll to form
    summaryBox.scrollIntoView({ behavior: 'smooth' });
};

function setupLocationButton() {
    const btnLoc = document.getElementById("btn-get-location");
    btnLoc.addEventListener("click", async () => {
        try {
            btnLoc.innerText = "⏳";
            const location = await window.Utils.checkLocation();
            if (location.isInside) {
                document.getElementById("cust-location").value = window.Utils.getGoogleMapsLink(location.lat, location.lng);
                alert("تم تحديد موقعك بنجاح ✅");
            } else {
                alert("للأسف، أنت خارج نطاق التوصيل (المعمورة) ❌");
                document.getElementById("cust-location").value = "";
            }
        } catch (error) {
            console.error(error);
            alert("تعذر تحديد الموقع تلقائياً. يرجى إدخال الرابط يدوياً.");
        } finally {
            btnLoc.innerText = "📍";
        }
    });
}

function setupCheckoutForm() {
    const form = document.getElementById("checkout-form");
    form.addEventListener("submit", async(e) => {
        e.preventDefault();

        if (!currentCheckoutStoreId) {
            alert("يرجى اختيار سلة المتجر أولاً");
            return;
        }

        const name = document.getElementById("cust-name").value;
        const phone = document.getElementById("cust-phone").value;
        const loc = document.getElementById("cust-location").value;

        // Retrieve items
        const cartData = JSON.parse(localStorage.getItem(`cart_${currentCheckoutStoreId}`));
        const items = Object.values(cartData);
        
        let subtotal = 0;
        items.forEach(i => subtotal += (i.price * i.qty));
        const delivery = window.Utils.calculateDeliveryFee(subtotal);

        const orderDetails = {
            items: items,
            total: subtotal,
            delivery: delivery
        };

        const customerInfo = {
            name: name,
            phone: phone,
            locationLink: loc
        };

        // 1. In a full app, insert order to Supabase here
        // const { data, error } = await supabase.from('orders').insert({ ... })

        // 2. Generate WhatsApp Link (Store phone should be fetched from DB, using dummy for now)
        const storePhone = "968XXXXXXXX"; // Dummy
        const waLink = window.Utils.generateWhatsAppLink(storePhone, orderDetails, customerInfo);
        
        alert("تم إنشاء طلبك بنجاح. سيتم تحويلك للواتساب للتواصل مع المتجر.");
        
        // Clear cart for this store
        localStorage.removeItem(`cart_${currentCheckoutStoreId}`);
        
        // Redirect to WhatsApp
        window.open(waLink, '_blank');
        
        // Reload page to update UI
        window.location.reload();
    });
}
