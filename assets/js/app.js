/**
 * App Main Logic for جوب البلاد
 */

document.addEventListener("DOMContentLoaded", () => {
    console.log("App Initialized.");
    
    // Components Init
    if (window.NavbarComponent) {
        NavbarComponent.render('navbar-container');
    }

    // Example feature: Check location on main page only
    const locationStatus = document.getElementById("location-status");
    if (locationStatus && window.Utils) {
        // Automatically check on load
        verifyUserLocation(locationStatus);
    }
    
    // Example: Mock Store Fetch
    const storesGrid = document.getElementById("stores-grid");
    if (storesGrid) {
        loadMockStores(storesGrid);
    }
});

async function verifyUserLocation(statusElement) {
    try {
        const locationData = await globalThis.Utils.checkLocation();
        if (locationData.isInside) {
            statusElement.className = "status-badge allowed";
            statusElement.innerText = "📍 أنت داخل المعمورة. يمكنك الطلب الآن.";
        } else {
            statusElement.className = "status-badge blocked";
            statusElement.innerText = "❌ خدماتنا متاحة حالياً داخل المعمورة فقط.";
        }
    } catch (error) {
        console.warn("Location error, bypassing strict check for development/mock mode:", error.message);
        // Fallback for demo mode
        statusElement.className = "status-badge allowed";
        statusElement.innerText = "⚠️ التحديد التلقائي للموقع فشل. يمكنك تحديده يدوياً عند الطلب.";
    }
}

// Temporary: Load mock stores
function loadMockStores(gridElement) {
    const mockStores = [
        { id: 1, name: "بقالة النور", category: "مواد غذائية", isOpen: true, owner: "محمد عبدالله" },
        { id: 2, name: "خضار وفواكه المعمورة", category: "خضار وفواكه", isOpen: true, owner: "علي سالم" },
        { id: 3, name: "مخبز البركة", category: "مخبوزات", isOpen: false, owner: "سعيد المحروقي" }
    ];

    setTimeout(() => {
        gridElement.innerHTML = mockStores.map(store => `
            <div class="card" onclick="window.location.href='store.html?id=${store.id}'" style="cursor: pointer;">
                <div class="card-img-wrapper" style="background-color: ${store.isOpen ? 'var(--primary-light)' : '#ccc'};">
                    <span class="card-placeholder-icon">🏪</span>
                </div>
                <div class="card-body">
                    <h3 class="card-title">${store.name}</h3>
                    <div class="card-subtitle">
                        <span class="status-badge ${store.isOpen ? 'allowed' : 'blocked'}">
                            ${store.isOpen ? 'مفتوح' : 'مغلق'}
                        </span>
                    </div>
                </div>
            </div>
        `).join('');
    }, 1000);
}
