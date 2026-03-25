/**
 * Store & Product Logic
 */

let currentStoreId = null;
let cart = {}; // product_id : { ...product, qty }

document.addEventListener("DOMContentLoaded", () => {
    // 1. Get Store ID from URL
    const urlParams = new URLSearchParams(window.location.search);
    currentStoreId = urlParams.get('id');

    if (!currentStoreId) {
        alert("لم يتم تحديد المتجر");
        window.location.href = "index.html";
        return;
    }

    // 2. Load Cart for this store from LocalStorage
    loadCart();

    // 3. Fetch Store Info & Products
    fetchStoreData(currentStoreId);
});

function loadCart() {
    const savedCart = localStorage.getItem(`cart_${currentStoreId}`);
    if (savedCart) {
        cart = JSON.parse(savedCart);
    }
    updateCartIconBadge();
}

function saveCart() {
    localStorage.setItem(`cart_${currentStoreId}`, JSON.stringify(cart));
    updateCartIconBadge();
}

function updateCartIconBadge() {
    // We update the global cart badge in the navbar
    const badge = document.getElementById("cart-count");
    if (badge) {
        const totalItems = Object.values(cart).reduce((sum, item) => sum + item.qty, 0);
        badge.innerText = totalItems;
        badge.style.display = totalItems > 0 ? "flex" : "none";
    }
}

async function fetchStoreData(storeId) {
    // Mock Data for now until DB is populated
    const mockStoreInfo = { name: "بقالة النور", desc: "أفضل المواد الغذائية في المعمورة" };
    
    document.getElementById("store-title").innerText = mockStoreInfo.name;
    document.getElementById("store-desc").innerText = mockStoreInfo.desc;

    const mockProducts = [
        { id: 101, name: "حليب طازج 1 لتر", price: 0.600, image: "" },
        { id: 102, name: "خبز عماني كبير", price: 0.200, image: "" },
        { id: 103, name: "بيض 30 حبة", price: 2.100, image: "" }
    ];

    setTimeout(() => {
        renderProducts(mockProducts);
    }, 800);
}

function renderProducts(products) {
    const grid = document.getElementById("products-grid");
    
    if (products.length === 0) {
        grid.innerHTML = "<p>لا تتوفر منتجات حالياً.</p>";
        return;
    }

    grid.innerHTML = products.map(product => {
        const currentQty = cart[product.id] ? cart[product.id].qty : 0;
        
        return `
            <div class="product-card">
                <div class="product-img flex-center" style="font-size: 2rem; color: #ccc;">📦</div>
                <div class="product-info">
                    <h3>${product.name}</h3>
                    <p class="product-price">${window.Utils ? window.Utils.formatCurrency(product.price) : product.price}</p>
                </div>
                <!-- Logic buttons -->
                <div class="qty-controls">
                    ${currentQty > 0 ? `
                        <div class="qty-btn" onclick="updateQty(${product.id}, -1)">-</div>
                        <div class="qty-display">${currentQty}</div>
                        <div class="qty-btn" onclick="updateQty(${product.id}, 1)">+</div>
                    ` : `
                        <button class="btn btn-primary" style="width: 100%; padding:0.5rem;" onclick="addToCart(${product.id}, '${product.name}', ${product.price})">أضف للسلة</button>
                    `}
                </div>
            </div>
        `;
    }).join("");
}

window.addToCart = function(id, name, price) {
    if (!cart[id]) {
        cart[id] = { id, name, price, qty: 1 };
    }
    saveCart();
    // Re-render to show qty buttons
    // For demo simplicity we re-fetch Mock
    fetchStoreData(currentStoreId);
};

window.updateQty = function(id, delta) {
    if (cart[id]) {
        cart[id].qty += delta;
        if (cart[id].qty <= 0) {
            delete cart[id];
        }
        saveCart();
        fetchStoreData(currentStoreId); // Re-render
    }
};
