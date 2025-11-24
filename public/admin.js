let allReports = [];

document.addEventListener('DOMContentLoaded', checkAuth);

async function checkAuth() {
  const res = await fetch('/api/admin/me', {credentials: 'include'});
  if (res.status === 403 || res.status === 401) {
    window.location.href = '/admin-login.html';
    return;
  }
  loadReports();
}

async function loadReports() {
  const res = await fetch('/api/admin/reports', {credentials: 'include'});
  const data = await res.json();
  allReports = data.reports || [];
  renderReports(allReports);
}

function renderReports(reports) {
  const container = document.getElementById('reports-container');
  if (!container) return;
  
  if (reports.length === 0) {
    container.innerHTML = '<p>No reports</p>';
    return;
  }
  
  container.innerHTML = reports.map(r => `
    <div class="report-card">
      <div class="report-header">
        <h3 class="report-id">#${r.reportId}</h3>
        <span class="zone-badge" style="background: ${getZoneColor(r.assignedZone)}">
          ${r.assignedZone || 'No Zone'}
        </span>
      </div>
      ${r.photo ? `<img src="${r.photo}" class="report-image">` : ''}
      <p>${r.description}</p>
      <p>📍 ${r.address || 'No address'}</p>
      <p>👤 ${r.userId?.name || 'Unknown'} | 📅 ${new Date(r.createdAt).toLocaleDateString()}</p>
      <button onclick="changeStatus('${r._id}', '${r.status}')">Change Status</button>
    </div>
  `).join('');
}

function getZoneColor(zone) {
  const colors = {
    'Zone 1 - North Gonda': '#3b82f6',
    'Zone 2 - South Gonda': '#10b981',
    'Zone 3 - East Gonda': '#f59e0b',
    'Zone 4 - West Gonda': '#ef4444',
    'Zone 5 - Central Gonda': '#8b5cf6'
  };
  return colors[zone] || '#6b7280';
}

function filterReports(status) {
  renderReports(status === 'all' ? allReports : allReports.filter(r => r.status === status));
}

function filterByZone(zone) {
  renderReports(zone === 'all' ? allReports : allReports.filter(r => r.assignedZone === zone));
}

function changeStatus(id, current) {
  const newStatus = prompt('Enter new status:\npending / verified / in-progress / resolved / rejected', current);
  if (!newStatus) return;
  
  fetch(`/api/admin/reports/${id}/status`, {
    method: 'PUT',
    headers: {'Content-Type': 'application/json'},
    credentials: 'include',
    body: JSON.stringify({status: newStatus, adminNotes: 'Status changed'})
  })
  .then(r => r.json())
  .then(d => {
    if (d.success) {
      alert('✅ Updated!');
      loadReports();
    } else {
      alert('❌ Failed');
    }
  });
}

async function logout() {
  await fetch('/api/admin/logout', {method: 'POST', credentials: 'include'});
  window.location.href = '/admin-login.html';
}
