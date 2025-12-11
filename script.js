// API Configuration
const API_URL = 'https://evt-backend.onrender.com';
let authToken = localStorage.getItem('authToken') || null;
let currentUser = JSON.parse(localStorage.getItem('currentUser')) || null;

// Toast notifications
const toastContainer = (() => {
    const c = document.createElement('div');
    c.id = 'toastContainer';
    c.style.position = 'fixed';
    c.style.right = '20px';
    c.style.bottom = '20px';
    c.style.zIndex = '9999';
    document.body.appendChild(c);
    return c;
})();

function showToast(msg, type = 'info', timeout = 2500) {
    const t = document.createElement('div');
    t.className = `toast toast-${type}`;
    t.style.marginTop = '8px';
    t.style.padding = '10px 14px';
    t.style.background = type === 'error' ? 'linear-gradient(90deg,#ff5252,#ff1744)' :
        type === 'success' ? 'linear-gradient(90deg,#4caf50,#388e3c)' :
            'linear-gradient(90deg,#2196f3,#1e88e5)';
    t.style.color = 'white';
    t.style.borderRadius = '8px';
    t.style.boxShadow = '0 6px 20px rgba(0,0,0,0.15)';
    t.style.fontWeight = '600';
    t.textContent = msg;
    toastContainer.appendChild(t);
    setTimeout(() => { t.style.transform = 'translateY(-10px)'; t.style.opacity = '0'; }, timeout);
    setTimeout(() => t.remove(), timeout + 600);
}

// API Helper Functions
async function apiRequest(endpoint, options = {}) {
    try {
        const headers = {
            'Content-Type': 'application/json',
            ...options.headers
        };

        if (authToken && !options.skipAuth) {
            headers['Authorization'] = `Bearer ${authToken}`;
        }

        const response = await fetch(`${API_URL}${endpoint}`, {
            ...options,
            headers
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || 'API request failed');
        }

        return data;
    } catch (error) {
        console.error('API Error:', error);
        showToast(error.message, 'error');
        throw error;
    }
}

// Auth Functions
async function login(email, password) {
    try {
        const data = await apiRequest('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password })
        });

        authToken = data.token;
        currentUser = data.user;
        localStorage.setItem('authToken', authToken);
        localStorage.setItem('currentUser', JSON.stringify(currentUser));
        
        updateUIForAuth();
        await loadCart();
        showToast(data.message, 'success');
        return data;
    } catch (error) {
        throw error;
    }
}

async function register(name, email, password, role = 'user') {
    try {
        const data = await apiRequest('/auth/register', {
            method: 'POST',
            body: JSON.stringify({ name, email, password, role })
        });

        authToken = data.token;
        currentUser = data.user;
        localStorage.setItem('authToken', authToken);
        localStorage.setItem('currentUser', JSON.stringify(currentUser));
        
        updateUIForAuth();
        showToast(data.message, 'success');
        return data;
    } catch (error) {
        throw error;
    }
}

function logout() {
    authToken = null;
    currentUser = null;
    localStorage.removeItem('authToken');
    localStorage.removeItem('currentUser');
    cart = [];
    updateUIForAuth();
    renderCart();
    showToast('Logged out successfully', 'info');
    if (window.location.href.includes('seller-dashboard')) {
        window.location.href = 'index.html';
    }
}

function updateUIForAuth() {
    const loginBtn = document.getElementById('loginBtn');
    if (!loginBtn) return;

    if (currentUser) {
        loginBtn.innerHTML = `<i class='fas fa-user'></i> ${currentUser.name}`;
        loginBtn.onclick = () => openAccountMenu();
    } else {
        loginBtn.innerHTML = `<i class='fas fa-sign-in-alt'></i> Login`;
        loginBtn.onclick = () => window.location.href = 'login.html';
    }
}

function openAccountMenu() {
    const div = document.createElement('div');
    div.className = 'account-popup';
    div.style.cssText = 'position:fixed;right:20px;top:70px;background:rgba(255,255,255,0.95);border:1px solid rgba(0,0,0,0.06);padding:12px;border-radius:10px;box-shadow:0 8px 30px rgba(0,0,0,0.12);z-index:4000;';
    
    let menuHTML = `
        <strong>${currentUser.name}</strong><br>
        <small>${currentUser.email}</small><br>
        <small style="color:#666">Role: ${currentUser.role}</small><br>
        <hr style="margin:8px 0">
    `;

    if (currentUser.role === 'seller' || currentUser.role === 'admin') {
        menuHTML += `<button onclick="window.location.href='seller-dashboard.html'" style="width:100%;margin:4px 0;padding:6px 12px;border:none;background:#4caf50;color:white;border-radius:5px;cursor:pointer;">Seller Dashboard</button>`;
    } else {
        menuHTML += `<button onclick="requestBecomeSeller()" style="width:100%;margin:4px 0;padding:6px 12px;border:none;background:#1e88e5;color:white;border-radius:5px;cursor:pointer;">Become a Seller</button>`;
    }

    menuHTML += `<button onclick="logout()" style="width:100%;margin:4px 0;padding:6px 12px;border:none;background:#e53935;color:white;border-radius:5px;cursor:pointer;">Logout</button>`;
    
    div.innerHTML = menuHTML;
    document.body.appendChild(div);
    
    setTimeout(() => {
        const closeMenu = (e) => {
            if (!div.contains(e.target)) {
                div.remove();
                document.removeEventListener('click', closeMenu);
            }
        };
        document.addEventListener('click', closeMenu);
    }, 100);
}

async function requestBecomeSeller() {
    try {
        if (!authToken) {
            showToast('Please login first', 'error');
            return;
        }

        const data = await apiRequest('/auth/become-seller', {
            method: 'PUT'
        });

        currentUser = data.user;
        localStorage.setItem('currentUser', JSON.stringify(currentUser));
        showToast(data.message, 'success');
        
        setTimeout(() => {
            window.location.href = 'seller-dashboard.html';
        }, 1500);
    } catch (error) {
        console.error('Become seller error:', error);
    }
}

// Products Functions
let allProducts = [];

async function loadProducts(filters = {}) {
    try {
        let endpoint = '/products?';
        if (filters.category) endpoint += `category=${filters.category}&`;
        if (filters.search) endpoint += `search=${filters.search}&`;
        if (filters.sort) endpoint += `sort=${filters.sort}&`;

        const data = await apiRequest(endpoint, { skipAuth: true });
        allProducts = data.products;
        renderProducts(allProducts);
    } catch (error) {
        console.error('Load products error:', error);
    }
}

function renderProducts(products) {
    const productsGrid = document.getElementById('productsGrid');
    if (!productsGrid) return;

    productsGrid.innerHTML = '';

    if (!products || products.length === 0) {
        productsGrid.innerHTML = '<p style="grid-column:1/-1;text-align:center;color:#777;">No products found.</p>';
        return;
    }

    products.forEach(product => {
        const card = document.createElement('div');
        card.className = 'product-card';
        card.innerHTML = `
            <div class="product-image">
                <img src="${API_URL.replace('/api', '')}${product.image}" alt="${product.name}" onerror="this.src='./images/default.jpg'" />
                <div class="verified-badge">✓ Verified</div>
            </div>
            <div class="product-info">
                <div class="product-name">${product.name}</div>
                <div class="product-seller">by ${product.sellerName}</div>
                <div class="product-rating"><span class="stars">⭐ ${product.rating}</span></div>
                <div class="product-price">₹${product.price}</div>
                <div class="product-stock" style="font-size:0.85rem;color:${product.stock > 0 ? '#4caf50' : '#f44336'}">
                    ${product.stock > 0 ? `In Stock: ${product.stock}` : 'Out of Stock'}
                </div>
                <div class="product-actions">
                    <button class="add-to-cart-btn" ${product.stock === 0 ? 'disabled' : ''} onclick="addToCartAPI('${product._id}')">Add to Cart</button>
                    <button class="view-details-btn" onclick="viewProductDetails('${product._id}')">View Details</button>
                </div>
            </div>
        `;
        productsGrid.appendChild(card);
    });
}

function searchProducts() {
    const query = document.getElementById('searchInput')?.value.trim();
    if (query) {
        loadProducts({ search: query });
        window.location.hash = '#products';
    }
}

function filterByCategory(category) {
    loadProducts({ category });
    window.location.hash = '#products';
    showToast(`Filtered by ${category}`, 'info');
}

function sortProducts(sortType) {
    loadProducts({ sort: sortType });
}

// Cart Functions
let cart = [];

async function loadCart() {
    if (!authToken) {
        cart = [];
        renderCart();
        return;
    }

    try {
        const data = await apiRequest('/cart');
        cart = data.cart.items.map(item => ({
            id: item._id,
            productId: item.product,
            name: item.name,
            price: item.price,
            img: item.image,
            qty: item.quantity
        }));
        renderCart();
    } catch (error) {
        console.error('Load cart error:', error);
        cart = [];
        renderCart();
    }
}

async function addToCartAPI(productId) {
    if (!authToken) {
        showToast('Please login to add items to cart', 'error');
        window.location.href = 'login.html';
        return;
    }

    try {
        await apiRequest('/cart', {
            method: 'POST',
            body: JSON.stringify({ productId, quantity: 1 })
        });
        
        showToast('Item added to cart', 'success');
        await loadCart();
    } catch (error) {
        console.error('Add to cart error:', error);
    }
}

async function updateCartQuantity(itemId, quantity) {
    try {
        await apiRequest(`/cart/${itemId}`, {
            method: 'PUT',
            body: JSON.stringify({ quantity })
        });
        await loadCart();
    } catch (error) {
        console.error('Update cart error:', error);
    }
}

async function removeFromCartAPI(itemId) {
    try {
        await apiRequest(`/cart/${itemId}`, {
            method: 'DELETE'
        });
        showToast('Item removed from cart', 'info');
        await loadCart();
    } catch (error) {
        console.error('Remove from cart error:', error);
    }
}

function renderCart() {
    const container = document.getElementById('cartItems');
    const totalEl = document.getElementById('cartTotal');
    const countEl = document.getElementById('cartCount');
    
    if (!container) return;

    container.innerHTML = '';
    let total = 0;

    if (cart.length === 0) {
        container.innerHTML = '<div class="empty-cart"><i class="fas fa-box-open"></i><p>Your cart is empty</p></div>';
    } else {
        cart.forEach(item => {
            total += item.price * item.qty;
            const el = document.createElement('div');
            el.className = 'cart-item';
            el.innerHTML = `
                <img src="${API_URL.replace('/api', '')}${item.img}" alt="${item.name}" class="cart-item-image" />
                <div class="cart-item-details">
                    <div class="cart-item-name">${item.name}</div>
                    <div class="cart-item-price">₹${item.price * item.qty}</div>
                    <div class="cart-item-quantity">
                        <button class="qty-btn" onclick="changeQuantity('${item.id}', ${item.qty - 1})">-</button>
                        <span style="min-width:28px;text-align:center;display:inline-block">${item.qty}</span>
                        <button class="qty-btn" onclick="changeQuantity('${item.id}', ${item.qty + 1})">+</button>
                    </div>
                </div>
                <button class="remove-item-btn" onclick="removeFromCartAPI('${item.id}')">Remove</button>
            `;
            container.appendChild(el);
        });
    }

    if (totalEl) totalEl.textContent = `₹${total}`;
    if (countEl) countEl.textContent = cart.reduce((sum, item) => sum + item.qty, 0);
}

function changeQuantity(itemId, newQty) {
    if (newQty < 1) {
        removeFromCartAPI(itemId);
    } else {
        updateCartQuantity(itemId, newQty);
    }
}

function toggleCart() {
    document.getElementById('cartSidebar')?.classList.toggle('active');
}

async function checkout() {
    if (!authToken) {
        showToast('Please login to checkout', 'error');
        window.location.href = 'login.html';
        return;
    }

    if (cart.length === 0) {
        showToast('Cart is empty', 'error');
        return;
    }

    try {
        await apiRequest('/orders', {
            method: 'POST',
            body: JSON.stringify({})
        });

        showToast('Order placed successfully!', 'success');
        cart = [];
        await loadCart();
        toggleCart();
        await loadProducts();
    } catch (error) {
        console.error('Checkout error:', error);
    }
}

// Modal Functions
function viewProductDetails(productId) {
    const product = allProducts.find(p => p._id === productId);
    if (!product) return;

    const modal = document.getElementById('productModal');
    if (!modal) return;

    document.getElementById('modalProductImage').src = `${API_URL.replace('/api', '')}${product.image}`;
    document.getElementById('modalProductName').textContent = product.name;
    document.getElementById('modalProductDesc').textContent = product.description;
    document.getElementById('modalProductPrice').textContent = `₹${product.price}`;
    document.getElementById('modalAddToCart').onclick = () => {
        addToCartAPI(product._id);
        closeProductModal();
    };

    modal.style.display = 'flex';
}

function closeProductModal() {
    const modal = document.getElementById('productModal');
    if (modal) modal.style.display = 'none';
}

// Footer Modals
function openStory() { document.getElementById("storyModal").style.display = "flex"; }
function closeStory() { document.getElementById("storyModal").style.display = "none"; }
function openCareers() { document.getElementById("careerModal").style.display = "flex"; }
function closeCareers() { document.getElementById("careerModal").style.display = "none"; }
function openSeller() {
    if (currentUser && (currentUser.role === 'seller' || currentUser.role === 'admin')) {
        window.location.href = 'seller-dashboard.html';
    } else {
        document.getElementById("sellerModal").style.display = "flex";
    }
}
function closeSeller() { document.getElementById("sellerModal").style.display = "none"; }
function openSafety() { document.getElementById("safetyModal").style.display = "flex"; }
function closeSafety() { document.getElementById("safetyModal").style.display = "none"; }

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    updateUIForAuth();
    loadProducts();
    if (authToken) {
        loadCart();
    }

    // Search on Enter key
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('keyup', (e) => {
            if (e.key === 'Enter') searchProducts();
        });
    }

    // Close modals on outside click
    window.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal')) {
            e.target.style.display = 'none';
        }
    });
});
