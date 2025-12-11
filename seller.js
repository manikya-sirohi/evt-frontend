const API_URL = 'http://localhost:5000/api';
let authToken = localStorage.getItem('authToken');
let currentUser = JSON.parse(localStorage.getItem('currentUser'));
let myProducts = [];
let editingProductId = null;

// Check authentication
if (!authToken || !currentUser) {
    alert('Please login first');
    window.location.href = 'login.html';
}

// Check if user is seller
if (currentUser.role !== 'seller' && currentUser.role !== 'admin') {
    alert('Access denied. Seller account required.');
    window.location.href = 'index.html';
}

// Load products on page load
document.addEventListener('DOMContentLoaded', () => {
    loadMyProducts();
    setupImagePreview();
});

// API Helper
async function apiRequest(endpoint, options = {}) {
    try {
        const headers = {
            ...options.headers
        };

        if (authToken && !options.skipAuth) {
            headers['Authorization'] = `Bearer ${authToken}`;
        }

        // Don't set Content-Type for FormData
        if (!(options.body instanceof FormData)) {
            headers['Content-Type'] = 'application/json';
        }

        const response = await fetch(`${API_URL}${endpoint}`, {
            ...options,
            headers
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || 'Request failed');
        }

        return data;
    } catch (error) {
        console.error('API Error:', error);
        alert(error.message);
        throw error;
    }
}

// Load seller's products
async function loadMyProducts() {
    try {
        const data = await apiRequest('/products/seller/my-products');
        myProducts = data.products;
        renderProducts();
        updateStats();
    } catch (error) {
        console.error('Load products error:', error);
    }
}

// Render products
function renderProducts() {
    const grid = document.getElementById('productsGrid');
    const emptyState = document.getElementById('emptyState');

    if (!myProducts || myProducts.length === 0) {
        grid.style.display = 'none';
        emptyState.style.display = 'block';
        return;
    }

    grid.style.display = 'grid';
    emptyState.style.display = 'none';
    grid.innerHTML = '';

    myProducts.forEach(product => {
        const card = document.createElement('div');
        card.className = 'product-card';
        card.innerHTML = `
            <img src="${API_URL.replace('/api', '')}${product.image}" alt="${product.name}" onerror="this.src='./images/default.jpg'" />
            <h3>${product.name}</h3>
            <div class="price">₹${product.price}</div>
            <div class="stock">Stock: ${product.stock} units</div>
            <div class="stock" style="font-size:0.85rem;color:#999">Category: ${product.category}</div>
            <div class="actions">
                <button class="btn-edit" onclick="editProduct('${product._id}')">
                    <i class="fas fa-edit"></i> Edit
                </button>
                <button class="btn-danger" onclick="deleteProduct('${product._id}')">
                    <i class="fas fa-trash"></i> Delete
                </button>
            </div>
        `;
        grid.appendChild(card);
    });
}

// Update statistics
function updateStats() {
    document.getElementById('totalProducts').textContent = myProducts.length;
    document.getElementById('activeProducts').textContent = myProducts.filter(p => p.isActive).length;
    document.getElementById('totalStock').textContent = myProducts.reduce((sum, p) => sum + p.stock, 0);
}

// Open add product modal
function openAddProductModal() {
    editingProductId = null;
    document.getElementById('modalTitle').textContent = 'Add New Product';
    document.getElementById('productForm').reset();
    document.getElementById('imagePreview').style.display = 'none';
    document.getElementById('productImage').required = true;
    document.getElementById('productModal').classList.add('active');
}

// Open edit product modal
function editProduct(productId) {
    const product = myProducts.find(p => p._id === productId);
    if (!product) return;

    editingProductId = productId;
    document.getElementById('modalTitle').textContent = 'Edit Product';
    document.getElementById('productName').value = product.name;
    document.getElementById('productDescription').value = product.description;
    document.getElementById('productPrice').value = product.price;
    document.getElementById('productCategory').value = product.category;
    document.getElementById('productStock').value = product.stock;
    
    const preview = document.getElementById('imagePreview');
    preview.src = `${API_URL.replace('/api', '')}${product.image}`;
    preview.style.display = 'block';
    document.getElementById('productImage').required = false;
    
    document.getElementById('productModal').classList.add('active');
}

// Close modal
function closeProductModal() {
    document.getElementById('productModal').classList.remove('active');
    document.getElementById('productForm').reset();
    editingProductId = null;
}

// Handle form submission
document.getElementById('productForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const formData = new FormData();
    formData.append('name', document.getElementById('productName').value);
    formData.append('description', document.getElementById('productDescription').value);
    formData.append('price', document.getElementById('productPrice').value);
    formData.append('category', document.getElementById('productCategory').value);
    formData.append('stock', document.getElementById('productStock').value);

    const imageFile = document.getElementById('productImage').files[0];
    if (imageFile) {
        formData.append('image', imageFile);
    }

    const submitBtn = e.target.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Saving...';

    try {
        if (editingProductId) {
            // Update existing product
            await apiRequest(`/products/${editingProductId}`, {
                method: 'PUT',
                body: formData,
                headers: {}
            });
            alert('Product updated successfully!');
        } else {
            // Create new product
            await apiRequest('/products', {
                method: 'POST',
                body: formData,
                headers: {}
            });
            alert('Product added successfully!');
        }

        closeProductModal();
        await loadMyProducts();
    } catch (error) {
        console.error('Save product error:', error);
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Save Product';
    }
});

// Delete product
async function deleteProduct(productId) {
    if (!confirm('Are you sure you want to delete this product?')) {
        return;
    }

    try {
        await apiRequest(`/products/${productId}`, {
            method: 'DELETE'
        });
        alert('Product deleted successfully!');
        await loadMyProducts();
    } catch (error) {
        console.error('Delete product error:', error);
    }
}

// Setup image preview
function setupImagePreview() {
    const imageInput = document.getElementById('productImage');
    const preview = document.getElementById('imagePreview');

    imageInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                preview.src = e.target.result;
                preview.style.display = 'block';
            };
            reader.readAsDataURL(file);
        }
    });
}

// Logout function
function logout() {
    localStorage.removeItem('authToken');
    localStorage.removeItem('currentUser');
    alert('Logged out successfully');
    window.location.href = 'index.html';
}

// Close modal on outside click
window.addEventListener('click', (e) => {
    const modal = document.getElementById('productModal');
    if (e.target === modal) {
        closeProductModal();
    }
});
