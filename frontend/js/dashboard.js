const token = localStorage.getItem('token');
if (!token) {
  window.location.href = 'index.html'; // kung walang token, balik sa login
}

// Axios-like fetch helper with auth header
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

// Load sales records
async function loadSales() {
  try {
    const res = await apiFetch('/sales');
    const sales = await res.json();
    const tbody = document.querySelector('#salesTable tbody');
    tbody.innerHTML = '';
    sales.forEach(sale => {
      const row = tbody.insertRow();
      row.innerHTML = `
        <td>${new Date(sale.date).toLocaleDateString()}</td>
        <td>₱${parseFloat(sale.total_amount).toFixed(2)}</td>
        <td>${sale.notes || ''}</td>
        <td>${sale.username}</td>
      `;
    });
  } catch (err) {
    console.error('Failed to load sales', err);
  }
}

// Submit new sales entry
document.getElementById('salesForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const date = document.getElementById('date').value;
  const total_amount = document.getElementById('amount').value;
  const notes = document.getElementById('notes').value;

  try {
    const res = await apiFetch('/sales', {
      method: 'POST',
      body: JSON.stringify({ date, total_amount, notes })
    });
    if (res.ok) {
      document.getElementById('salesMsg').textContent = 'Sales added successfully!';
      loadSales(); // refresh table
      document.getElementById('salesForm').reset();
    } else {
      const err = await res.json();
      document.getElementById('salesMsg').textContent = err.error || 'Failed to add sales';
    }
  } catch (err) {
    document.getElementById('salesMsg').textContent = 'Network error';
  }
});

// Initially load
loadSales();