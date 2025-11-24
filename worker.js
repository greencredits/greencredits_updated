// ============================================
// WORKER JAVASCRIPT
// ============================================

// Show file preview
function showPreview(input, previewId) {
    const preview = document.getElementById(previewId);
    const file = input.files[0];
    
    if (file) {
        preview.innerHTML = `✅ ${file.name} (${(file.size / 1024).toFixed(2)} KB)`;
        preview.style.display = 'block';
    }
}

// Worker Registration
document.getElementById('workerRegisterForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const formData = new FormData();
    formData.append('name', document.getElementById('workerName').value);
    formData.append('mobile', document.getElementById('workerMobile').value);
    formData.append('aadhaar', document.getElementById('workerAadhaar').value);
    formData.append('preferredZone', document.getElementById('workerZone').value);
    formData.append('address', document.getElementById('workerAddress').value);
    formData.append('photo', document.getElementById('workerPhoto').files[0]);
    formData.append('idProof', document.getElementById('workerIdProof').files[0]);
    
    try {
        const response = await fetch('/api/worker/register', {
            method: 'POST',
            body: formData
        });
        
        const data = await response.json();
        
        if (data.success) {
            alert(`✅ Application submitted successfully!\n\nApplication ID: ${data.applicationId}\n\nYou will receive login credentials via SMS once approved by an officer.`);
            document.getElementById('workerRegisterForm').reset();
            document.querySelectorAll('.file-preview').forEach(el => el.style.display = 'none');
        } else {
            alert('❌ ' + (data.message || 'Registration failed'));
        }
    } catch (error) {
        console.error('Registration error:', error);
        alert('❌ Registration failed. Please try again.');
    }
});

// Worker Dashboard Functions
async function checkWorkerAuth() {
    try {
        const response = await fetch('/api/worker/check-auth', {
            credentials: 'include'
        });
        const data = await response.json();
        
        if (!data.success) {
            window.location.href = '/worker-login.html';
        } else {
            document.getElementById('workerName').textContent = data.worker.name;
            document.getElementById('workerZone').textContent = data.worker.assignedZone;
            document.getElementById('workerId').textContent = data.worker.id;
            loadWorkerDashboard();
        }
    } catch (error) {
        console.error('Auth check failed:', error);
        window.location.href = '/worker-login.html';
    }
}

// Load Worker Dashboard
async function loadWorkerDashboard() {
    try {
        const response = await fetch('/api/worker/assigned-reports', {
            credentials: 'include'
        });
        const data = await response.json();
        
        if (data.success) {
            // Update stats
            document.getElementById('pendingCount').textContent = data.stats.pending;
            document.getElementById('inProgressCount').textContent = data.stats.inProgress;
            document.getElementById('completedCount').textContent = data.stats.completed;
            
            // Load reports
            loadWorkerReports(data.reports);
        }
    } catch (error) {
        console.error('Dashboard load error:', error);
    }
}

// Load Worker Reports
function loadWorkerReports(reports) {
    const container = document.getElementById('reportsList');
    
    if (reports.length === 0) {
        container.innerHTML = '<p style="text-align:center;padding:40px;color:#6b7280;">No reports assigned yet.</p>';
        return;
    }
    
    container.innerHTML = reports.map(report => `
        <div class="report-card ${report.status}">
            <div class="report-header">
                <h3>${report.title}</h3>
                <span class="status-badge ${report.status}">${report.status}</span>
            </div>
            <div class="report-details">
                <p><strong>📍 Location:</strong> ${report.location}</p>
                <p><strong>📋 Description:</strong> ${report.description}</p>
                <p><strong>📅 Reported:</strong> ${new Date(report.reportedAt).toLocaleString()}</p>
                <p><strong>👤 Reported by:</strong> ${report.userName}</p>
            </div>
            ${report.image ? `<img src="${report.image}" alt="Report" class="report-image">` : ''}
            <div class="report-actions">
                ${report.status === 'pending' ? `
                    <button class="btn-primary" onclick="acceptReport('${report.id}')">
                        ✅ Accept & Start Work
                    </button>
                ` : report.status === 'in-progress' ? `
                    <button class="btn-success" onclick="markResolved('${report.id}')">
                        ✔️ Mark as Resolved
                    </button>
                    <button class="btn-secondary" onclick="addUpdate('${report.id}')">
                        💬 Add Update
                    </button>
                ` : `
                    <button class="btn-disabled" disabled>
                        ✅ Completed
                    </button>
                `}
                <button class="btn-secondary" onclick="viewOnMap('${report.lat}', '${report.lng}')">
                    🗺️ View on Map
                </button>
            </div>
        </div>
    `).join('');
}

// Accept Report
async function acceptReport(reportId) {
    if (!confirm('Accept this report and start working on it?')) return;
    
    try {
        const response = await fetch('/api/worker/accept-report', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ reportId })
        });
        
        const data = await response.json();
        
        if (data.success) {
            alert('✅ Report accepted! Status updated to In Progress.');
            loadWorkerDashboard();
        } else {
            alert('❌ ' + (data.message || 'Failed to accept report'));
        }
    } catch (error) {
        console.error('Accept report error:', error);
        alert('❌ Failed to accept report. Please try again.');
    }
}

// Mark Resolved
async function markResolved(reportId) {
    if (!confirm('Mark this report as resolved?')) return;
    
    try {
        const response = await fetch('/api/worker/mark-resolved', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ reportId })
        });
        
        const data = await response.json();
        
        if (data.success) {
            alert('✅ Report marked as resolved!');
            loadWorkerDashboard();
        } else {
            alert('❌ ' + (data.message || 'Failed to mark as resolved'));
        }
    } catch (error) {
        console.error('Mark resolved error:', error);
        alert('❌ Failed to mark as resolved. Please try again.');
    }
}

// View on Map
function viewOnMap(lat, lng) {
    window.open(`https://www.google.com/maps?q=${lat},${lng}`, '_blank');
}

// Worker Logout
function workerLogout() {
    if (confirm('Are you sure you want to logout?')) {
        fetch('/api/worker/logout', {
            method: 'POST',
            credentials: 'include'
        }).then(() => {
            window.location.href = '/worker-login.html';
        });
    }
}

// Initialize on page load
if (window.location.pathname.includes('worker-dashboard')) {
    checkWorkerAuth();
}
