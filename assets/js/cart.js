/**
 * Cart & Checkout Logic
 */

let activeStoreCarts = [];
let currentCheckoutStoreId = null;

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
