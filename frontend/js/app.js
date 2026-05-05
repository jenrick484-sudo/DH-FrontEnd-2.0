// Check if logged in
const token = localStorage.getItem('token');
if (!token) window.location.href = 'index.html';

// Axios-like fetch helper
async function apiFetch(url, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
    ...options.headers
  };
  const res = await fetch(`${API_BASE_URL}${url}`, { ...options, headers });
  if (res.status === 401 || res.status === 403) {
    localStorage.clear();
    window.location.href = 'index.html';
  }
  return res;
}

// Logout
document.getElementById('logoutBtn').addEventListener('click', () => {
  localStorage.clear();
  window.location.href = 'index.html';
});

// Sidebar navigation – i-load ang module HTML
document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', async (e) => {
    // Alisin ang active class sa lahat
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const page = btn.dataset.page;
    const contentArea = document.getElementById('contentArea');
    try {
      const response = await fetch(`modules/${page}.html`);
      if (!response.ok) throw new Error('Page not found');
      const html = await response.text();
      contentArea.innerHTML = html;
      // Pagkatapos ma-load, i-invoke ang module-specific setup
      initModule(page);
    } catch (err) {
      contentArea.innerHTML = '<p>Error loading page.</p>';
    }
  });
});

// Module init – centralized
function initModule(module) {
  switch (module) {
    case 'dashboard': initDashboard(); break;
    case 'items': initItems(); break;
    case 'inventory': initInventory(); break;
    case 'sales': initSales(); break;
    case 'report': initReport(); break;
  }
}

// ---- Dashboard Module ----
async function initDashboard() {
  try {
    const res = await apiFetch('/dashboard');
    const data = await res.json();
    document.getElementById('todaySales').textContent = `₱${data.today_sales.toFixed(2)}`;
    document.getElementById('itemCount').textContent = data.total_items;
    document.getElementById('inventoryValue').textContent = `₱${data.inventory_value.toFixed(2)}`;
  } catch (err) {
    console.error(err);
  }
}

// ---- Items Module ----
async function initItems() {
  loadItems();
  document.getElementById('addItemForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('itemName').value;
    const price = document.getElementById('itemPrice').value;
    const description = document.getElementById('itemDesc').value;
    const initial_stock = document.getElementById('initialStock').value;
    const res = await apiFetch('/items', {
      method: 'POST',
      body: JSON.stringify({ name, price, description, initial_stock })
    });
    if (res.ok) {
      document.getElementById('addItemForm').reset();
      loadItems();
    } else {
      alert('Error adding item');
    }
  });
}
async function loadItems() {
  const res = await apiFetch('/items');
  const items = await res.json();
  const tbody = document.querySelector('#itemsTable tbody');
  tbody.innerHTML = items.map(item => `
    <tr>
      <td>${item.name}</td>
      <td>${item.description || ''}</td>
      <td>₱${parseFloat(item.price).toFixed(2)}</td>
    </tr>`).join('');
}

// ---- Inventory Module ----
async function initInventory() {
  loadInventory();
}
async function loadInventory() {
  const res = await apiFetch('/inventory');
  const data = await res.json();
  const tbody = document.querySelector('#inventoryTable tbody');
  tbody.innerHTML = data.map(item => `
    <tr>
      <td>${item.name}</td>
      <td>₱${item.price}</td>
      <td>${item.quantity}</td>
      <td>
        <button data-id="${item.id}" class="restockBtn" style="background:#28a745">+ Restock</button>
      </td>
    </tr>`).join('');
  // Attach restock events (simple prompt)
  document.querySelectorAll('.restockBtn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const itemId = btn.dataset.id;
      const qty = prompt('Enter quantity to add:');
      if (qty && !isNaN(qty) && qty > 0) {
        await apiFetch(`/inventory/${itemId}`, {
          method: 'PUT',
          body: JSON.stringify({ quantity: parseInt(qty) + parseInt(qty) /* need current quantity */ })
        });
        // For simplicity, reload page; better implementation would update directly
        loadInventory();
      }
    });
  });
}

// ---- Sales Module ----
let cart = [];
async function initSales() {
  // Load available items for selection
  const res = await apiFetch('/items');
  const items = await res.json();
  const itemSelect = document.getElementById('itemSelect');
  itemSelect.innerHTML = items.map(i => `<option value="${i.id}">${i.name} (₱${i.price})</option>`).join('');
  // Event para idagdag sa cart
  document.getElementById('addToCartBtn').addEventListener('click', () => {
    const id = parseInt(itemSelect.value);
    const qty = parseInt(document.getElementById('qty').value);
    const price = parseFloat(itemSelect.selectedOptions[0].text.match(/₱([\d.]+)/)[1]);
    const existing = cart.find(c => c.item_id === id);
    if (existing) existing.quantity += qty;
    else cart.push({ item_id: id, quantity: qty, price: price, name: itemSelect.selectedOptions[0].text.split(' (')[0] });
    renderCart();
  });
  // Checkout
  document.getElementById('checkoutBtn').addEventListener('click', async () => {
    if (cart.length === 0) return alert('Cart is empty');
    const res = await apiFetch('/sales', {
      method: 'POST',
      body: JSON.stringify({ items: cart.map(c => ({ item_id: c.item_id, quantity: c.quantity })) })
    });
    if (res.ok) {
      const data = await res.json();
      alert(`Sale completed! Total: ₱${data.total_amount.toFixed(2)}`);
      cart = [];
      renderCart();
      // Refresh inventory from backend if needed
    } else {
      const err = await res.json();
      alert(err.error);
    }
  });
  renderCart();
}
function renderCart() {
  const cartDiv = document.getElementById('cartItems');
  const totalSpan = document.getElementById('cartTotal');
  cartDiv.innerHTML = cart.map(c => `<div>${c.name} x${c.quantity} = ₱${(c.price * c.quantity).toFixed(2)}</div>`).join('');
  const total = cart.reduce((sum, c) => sum + c.price * c.quantity, 0);
  totalSpan.textContent = total.toFixed(2);
}

// ---- Report Module ----
async function initReport() {
  document.getElementById('generateReportBtn').addEventListener('click', loadReport);
}
async function loadReport() {
  const year = document.getElementById('yearFilter').value;
  const month = document.getElementById('monthFilter').value;
  const day = document.getElementById('dayFilter').value;
  const params = new URLSearchParams();
  if (year) params.append('year', year);
  if (month) params.append('month', month);
  if (day) params.append('day', day);
  const res = await apiFetch(`/sales/report?${params.toString()}`);
  const data = await res.json();
  const tbody = document.querySelector('#reportTable tbody');
  tbody.innerHTML = data.map(row => `
    <tr>
      <td>${new Date(row.sale_date).toLocaleDateString()}</td>
      <td>₱${parseFloat(row.daily_total).toFixed(2)}</td>
      <td>${row.transaction_count}</td>
    </tr>`).join('');
}

// Initial load – dashboard
window.addEventListener('DOMContentLoaded', () => {
  document.querySelector('.nav-btn[data-page="dashboard"]').click();
});