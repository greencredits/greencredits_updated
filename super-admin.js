// ============================================
// SUPER ADMIN JAVASCRIPT
// ============================================

// Check if logged in
async function checkAuth() {
    try {
        const response = await fetch('/api/super-admin/check-auth', {
            credentials: 'include'
        });
        const data = await response.json();
        
        if (!data.success) {
            window.location.href = '/super-admin-login.html';
        } else {
            document.getElementById('adminName').textContent = data.admin.name;
            loadDashboard();
        }
    } catch (error) {
        console.error('Auth check failed:', error);
        window.location.href = '/super-admin-login.html';
    }
}

// Login Handler
document.getElementById('superAdminLoginForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('adminEmail').value;
    const password = document.getElementById('adminPassword').value;
    
    try {
        const response = await fetch('/api/super-admin/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ email, password })
        });
        
        const data = await response.json();
        
        if (data.success) {
            alert('✅ Login successful!');
            window.location.href = '/super-admin-dashboard.html';
        } else {
            alert('❌ ' + (data.message || 'Invalid credentials'));
        }
    } catch (error) {
        console.error('Login error:', error);
        alert('❌ Login failed. Please try again.');
    }
});

// Load Dashboard
async function loadDashboard() {
    try {
        const response = await fetch('/api/super-admin/dashboard-stats', {
            credentials: 'include'
        });
        const data = await response.json();
        
        if (data.success) {
            // Update stats
            document.getElementById('totalReports').textContent = data.stats.totalReports;
            document.getElementById('resolvedReports').textContent = data.stats.resolvedReports;
            document.getElementById('totalOfficers').textContent = data.stats.totalOfficers;
            document.getElementById('totalWorkers').textContent = data.stats.totalWorkers;
            
            // Load zone stats
            loadZoneStats(data.zoneStats);
            
            // Load recent reports
            loadRecentReports(data.recentReports);
        }
    } catch (error) {
        console.error('Dashboard load error:', error);
    }
}

// Load Zone Stats
function loadZoneStats(zoneStats) {
    const container = document.getElementById('zoneStats');
    container.innerHTML = zoneStats.map(zone => `
        <div class="zone-card" style="border-left: 4px solid ${zone.color}">
            <h3>${zone.name}</h3>
            <div class="zone-stats">
                <div class="zone-stat">
                    <span class="zone-stat-value">${zone.totalReports}</span>
                    <span class="zone-stat-label">Total Reports</span>
                </div>
                <div class="zone-stat">
                    <span class="zone-stat-value">${zone.activeWorkers}</span>
                    <span class="zone-stat-label">Active Workers</span>
                </div>
                <div class="zone-stat">
                    <span class="zone-stat-value">${zone.pendingReports}</span>
                    <span class="zone-stat-label">Pending</span>
                </div>
            </div>
        </div>
    `).join('');
}

// Load Recent Reports
function loadRecentReports(reports) {
    const container = document.getElementById('recentReports');
    container.innerHTML = `
        <table>
            <thead>
                <tr>
                    <th>Report ID</th>
                    <th>Location</th>
                    <th>Zone</th>
                    <th>Status</th>
                    <th>Reported By</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
                ${reports.map(report => `
                    <tr>
                        <td>${report.id}</td>
                        <td>${report.location}</td>
                        <td><span class="zone-badge" style="background:${report.zoneColor}">${report.zone}</span></td>
                        <td><span class="status-badge ${report.status}">${report.status}</span></td>
                        <td>${report.userName}</td>
                        <td>
                            <button class="btn-sm" onclick="viewReport('${report.id}')">View</button>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

// Show Section
function showSection(sectionName) {
    // Hide all sections
    document.querySelectorAll('.content-section').forEach(section => {
        section.classList.remove('active');
    });
    
    // Remove active from all nav items
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });
    
    // Show selected section
    const section = document.getElementById(sectionName + 'Section');
    if (section) {
        section.classList.add('active');
    }
    
    // Add active to clicked nav item
    event.target.classList.add('active');
    
    // Load section data
    switch(sectionName) {
        case 'dashboard':
            loadDashboard();
            break;
        case 'officers':
            loadOfficers();
            break;
        case 'workers':
            loadWorkerApplications();
            break;
        case 'zones':
            loadZones();
            break;
        case 'reports':
            loadAllReports();
            break;
    }
}

// Load Officers
async function loadOfficers() {
    try {
        const response = await fetch('/api/super-admin/officers', {
            credentials: 'include'
        });
        const data = await response.json();
        
        if (data.success) {
            const container = document.getElementById('officersList');
            container.innerHTML = `
                <table>
                    <thead>
                        <tr>
                            <th>Officer ID</th>
                            <th>Name</th>
                            <th>Email</th>
                            <th>Mobile</th>
                            <th>Assigned Zones</th>
                            <th>Status</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${data.officers.map(officer => `
                            <tr>
                                <td><strong>${officer.id}</strong></td>
                                <td>${officer.name}</td>
                                <td>${officer.email}</td>
                                <td>${officer.mobile}</td>
                                <td>${officer.assignedZones.join(', ')}</td>
                                <td><span class="status-badge ${officer.status}">${officer.status}</span></td>
                                <td>
                                    <button class="btn-sm" onclick="editOfficer('${officer.id}')">Edit</button>
                                    <button class="btn-sm btn-danger" onclick="deactivateOfficer('${officer.id}')">Deactivate</button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;
        }
    } catch (error) {
        console.error('Load officers error:', error);
    }
}

// Show Create Officer Modal
async function showCreateOfficerModal() {
    const modal = document.getElementById('createOfficerModal');
    modal.style.display = 'block';
    
    // Load zones for checkboxes
    const response = await fetch('/api/zones');
    const data = await response.json();
    
    const zoneCheckboxes = document.getElementById('zoneCheckboxes');
    zoneCheckboxes.innerHTML = data.zones.map(zone => `
        <label class="checkbox-label">
            <input type="checkbox" name="zones" value="${zone.id}">
            <span>${zone.name}</span>
        </label>
    `).join('');
}

// Close Modal
function closeModal() {
    document.getElementById('createOfficerModal').style.display = 'none';
}

// Create Officer
document.getElementById('createOfficerForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const selectedZones = Array.from(document.querySelectorAll('input[name="zones"]:checked'))
        .map(cb => cb.value);
    
    const officerData = {
        name: document.getElementById('officerName').value,
        email: document.getElementById('officerEmail').value,
        mobile: document.getElementById('officerMobile').value,
        assignedZones: selectedZones,
        password: document.getElementById('officerPassword').value
    };
    
    try {
        const response = await fetch('/api/super-admin/create-officer', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(officerData)
        });
        
        const data = await response.json();
        
        if (data.success) {
            alert(`✅ Officer created successfully!\n\nOfficer ID: ${data.officerId}\nPassword: ${officerData.password}\n\nPlease share these credentials securely.`);
            closeModal();
            loadOfficers();
        } else {
            alert('❌ ' + (data.message || 'Failed to create officer'));
        }
    } catch (error) {
        console.error('Create officer error:', error);
        alert('❌ Failed to create officer. Please try again.');
    }
});

// Load Worker Applications
async function loadWorkerApplications(status = 'pending') {
    try {
        const response = await fetch(`/api/super-admin/worker-applications?status=${status}`, {
            credentials: 'include'
        });
        const data = await response.json();
        
        if (data.success) {
            const container = document.getElementById('workersList');
            container.innerHTML = data.applications.map(app => `
                <div class="application-card">
                    <div class="app-header">
                        <h3>${app.name}</h3>
                        <span class="status-badge ${app.status}">${app.status}</span>
                    </div>
                    <div class="app-details">
                        <p><strong>Application ID:</strong> ${app.applicationId}</p>
                        <p><strong>Mobile:</strong> ${app.mobile}</p>
                        <p><strong>Preferred Zone:</strong> ${app.preferredZone}</p>
                        <p><strong>Address:</strong> ${app.address}</p>
                        <p><strong>Applied:</strong> ${new Date(app.appliedDate).toLocaleDateString()}</p>
                    </div>
                    <div class="app-documents">
                        <a href="${app.idProof}" target="_blank" class="doc-link">📄 View ID Proof</a>
                        <a href="${app.photo}" target="_blank" class="doc-link">📷 View Photo</a>
                    </div>
                    ${app.status === 'pending' ? `
                        <div class="app-actions">
                            <button class="btn-success" onclick="approveWorker('${app.applicationId}')">✅ Approve</button>
                            <button class="btn-danger" onclick="rejectWorker('${app.applicationId}')">❌ Reject</button>
                        </div>
                    ` : ''}
                </div>
            `).join('');
        }
    } catch (error) {
        console.error('Load applications error:', error);
    }
}

// Approve Worker
async function approveWorker(applicationId) {
    if (!confirm('Approve this worker application?')) return;
    
    try {
        const response = await fetch('/api/super-admin/approve-worker', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ applicationId })
        });
        
        const data = await response.json();
        
        if (data.success) {
            alert(`✅ Worker approved!\n\nWorker ID: ${data.workerId}\nPassword: ${data.password}\n\nCredentials sent via SMS.`);
            loadWorkerApplications();
        } else {
            alert('❌ ' + (data.message || 'Failed to approve worker'));
        }
    } catch (error) {
        console.error('Approve worker error:', error);
        alert('❌ Failed to approve worker. Please try again.');
    }
}

// Reject Worker
async function rejectWorker(applicationId) {
    const reason = prompt('Enter rejection reason:');
    if (!reason) return;
    
    try {
        const response = await fetch('/api/super-admin/reject-worker', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ applicationId, reason })
        });
        
        const data = await response.json();
        
        if (data.success) {
            alert('✅ Worker application rejected.');
            loadWorkerApplications();
        } else {
            alert('❌ ' + (data.message || 'Failed to reject worker'));
        }
    } catch (error) {
        console.error('Reject worker error:', error);
        alert('❌ Failed to reject worker. Please try again.');
    }
}

// Switch Tab
function switchTab(status) {
    document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
    event.target.classList.add('active');
    loadWorkerApplications(status);
}

// Logout
function logout() {
    if (confirm('Are you sure you want to logout?')) {
        fetch('/api/super-admin/logout', {
            method: 'POST',
            credentials: 'include'
        }).then(() => {
            window.location.href = '/super-admin-login.html';
        });
    }
}

// Initialize on page load
if (window.location.pathname.includes('dashboard')) {
    checkAuth();
}
