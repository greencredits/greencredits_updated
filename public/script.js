// ============================================
// GREENCREDITS - COMPLETE FIXED FRONTEND
// All bugs fixed, production-ready
// ============================================

let currentUser = null;
let currentLocation = null;

// Initialize app on page load
document.addEventListener('DOMContentLoaded', function() {
  console.log('🌍 GreenCredits initialized');
  
  checkSession();
  
  // ✅ FIX: Mobile Menu (Hamburger)
  const mobileToggle = document.getElementById('mobileMenuToggle');
  const mainNav = document.querySelector('.main-nav');
  
  if (mobileToggle && mainNav) {
    mobileToggle.addEventListener('click', function(e) {
      e.stopPropagation();
      mainNav.classList.toggle('active');
      mobileToggle.classList.toggle('active');
    });
    
    document.querySelectorAll('.nav-link').forEach(link => {
      link.addEventListener('click', () => {
        mainNav.classList.remove('active');
        mobileToggle.classList.remove('active');
      });
    });
    
    document.addEventListener('click', (e) => {
      if (!mainNav.contains(e.target) && !mobileToggle.contains(e.target)) {
        mainNav.classList.remove('active');
        mobileToggle.classList.remove('active');
      }
    });
  }
  
  initializeEventListeners();
  loadPublicData();
  
  // ✅ FIX: Footer Links & Download Buttons
  document.querySelectorAll('.footer-links a').forEach(link => {
    link.addEventListener('click', (e) => {
      const href = link.getAttribute('href');
      
      if (href && (href.startsWith('#features') || href.startsWith('#journey') || 
          href.startsWith('#impact') || href.startsWith('#leaderboard'))) {
        e.preventDefault();
        const targetId = href.replace('#', '');
        const section = document.getElementById(targetId);
        if (section) {
          section.scrollIntoView({ behavior: 'smooth' });
        }
      } else if (!href || href === '#' || href.includes('admin.html') === false) {
        if (!href.includes('admin.html')) {
          e.preventDefault();
          showNotification('This feature is coming soon! 🚀', 'info');
        }
      }
    });
  });
  
  document.querySelectorAll('.app-btn, .app-buttons a').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      showNotification('📱 Mobile app coming soon! Stay tuned for updates.', 'info');
    });
  });
  
  const logo = document.querySelector('.logo');
  if (logo) {
    logo.style.cursor = 'pointer';
    logo.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }
});

// ============================================
// SESSION MANAGEMENT
// ============================================

async function checkSession() {
  try {
    const response = await fetch('/api/check-session', {
      credentials: 'include'
    });
    const data = await response.json();
    
    if (data.loggedIn && data.user) {
      currentUser = data.user;
      showLoggedInState();
      await loadUserCredits();
      console.log('✅ User logged in:', currentUser.name);
    } else {
      showLoggedOutState();
      console.log('ℹ️ User not logged in');
    }
  } catch (error) {
    console.error('Session check failed:', error);
    showLoggedOutState();
  }
}

function showLoggedInState() {
  document.getElementById('authButtons')?.classList.add('hidden');
  
  const userWelcome = document.getElementById('userWelcome');
  if (userWelcome) {
    userWelcome.classList.remove('hidden');
    userWelcome.innerHTML = `
      <span class="welcome-text">Welcome, <strong>${currentUser.name}</strong></span>
      <div id="userCreditsDisplay" class="credits-display">
        <span class="credits-icon">💰</span>
        <span id="creditsAmount">Loading...</span> Credits
      </div>
      <button onclick="logout()" class="btn-logout">Logout</button>
    `;
  }
  
  document.querySelectorAll('.logged-in-only').forEach(el => {
    el.style.display = 'block';
  });
}

function showLoggedOutState() {
  currentUser = null;
  document.getElementById('authButtons')?.classList.remove('hidden');
  
  const userWelcome = document.getElementById('userWelcome');
  if (userWelcome) {
    userWelcome.classList.add('hidden');
    userWelcome.innerHTML = '';
  }
  
  document.querySelectorAll('.logged-in-only').forEach(el => {
    el.style.display = 'none';
  });
}

// ============================================
// EVENT LISTENERS
// ============================================

function initializeEventListeners() {
  const loginBtn = document.getElementById('loginBtn');
  if (loginBtn) {
    loginBtn.addEventListener('click', () => openModal('loginModal'));
  }
  
  const signupBtn = document.getElementById('signupBtn');
  if (signupBtn) {
    signupBtn.addEventListener('click', () => openModal('signupModal'));
  }
  
  const loginForm = document.getElementById('loginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', handleLogin);
  }
  
  const signupForm = document.getElementById('signupForm');
  if (signupForm) {
    signupForm.addEventListener('submit', handleSignup);
  }
  
  const reportForm = document.getElementById('reportForm');
  if (reportForm) {
    reportForm.addEventListener('submit', handleReportSubmit);
  }
  
  const useLocationBtn = document.getElementById('useLocationBtn');
  if (useLocationBtn) {
    useLocationBtn.addEventListener('click', getUserLocation);
  }
  
  const photoInput = document.getElementById('photoInput');
  if (photoInput) {
    styleFileInput(photoInput);
  }
  
  initializeNavTabs();
  
  window.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal')) {
      closeModal(e.target.id);
    }
  });
}

// ============================================
// AUTHENTICATION
// ============================================

async function handleLogin(e) {
  e.preventDefault();
  
  const email = document.getElementById('loginEmail').value;
  const password = document.getElementById('loginPassword').value;
  
  if (!email || !password) {
    showNotification('Please fill all fields', 'error');
    return;
  }
  
  try {
    const response = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, password })
    });
    
    const data = await response.json();
    
    if (data.success) {
      currentUser = data.user;
      showNotification(`Welcome back, ${data.user.name}! 🎉`, 'success');
      closeModal('loginModal');
      document.getElementById('loginForm').reset();
      showLoggedInState();
      await loadUserCredits();
    } else {
      showNotification(data.error || 'Login failed', 'error');
    }
  } catch (error) {
    console.error('Login error:', error);
    showNotification('Login failed. Please try again.', 'error');
  }
}

async function handleSignup(e) {
  e.preventDefault();
  
  const name = document.getElementById('signupName').value;
  const email = document.getElementById('signupEmail').value;
  const password = document.getElementById('signupPassword').value;
  
  if (!name || !email || !password) {
    showNotification('Please fill all fields', 'error');
    return;
  }
  
  if (password.length < 6) {
    showNotification('Password must be at least 6 characters', 'error');
    return;
  }
  
  try {
    const response = await fetch('/api/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ name, email, password })
    });
    
    const data = await response.json();
    
    if (data.success) {
      currentUser = data.user;
      showNotification(`Welcome to GreenCredits, ${name}! You earned 50 welcome credits! 🎉`, 'success');
      closeModal('signupModal');
      document.getElementById('signupForm').reset();
      showLoggedInState();
      await loadUserCredits();
    } else {
      showNotification(data.error || 'Registration failed', 'error');
    }
  } catch (error) {
    console.error('Signup error:', error);
    showNotification('Registration failed. Please try again.', 'error');
  }
}

async function logout() {
  try {
    const response = await fetch('/api/logout', {
      method: 'POST',
      credentials: 'include'
    });
    
    if (response.ok) {
      showNotification('Logged out successfully', 'success');
      
      document.querySelectorAll('form').forEach(form => form.reset());
      document.querySelectorAll('input[type="file"]').forEach(input => {
        input.value = '';
        const label = input.nextElementSibling;
        if (label) label.textContent = 'Choose File';
      });
      
      const mapPreview = document.getElementById('mapPreview');
      if (mapPreview) mapPreview.remove();
      
      showLoggedOutState();
    }
  } catch (error) {
    console.error('Logout error:', error);
  }
}

// ============================================
// CREDITS SYSTEM
// ============================================

async function loadUserCredits() {
  if (!currentUser) return;
  
  try {
    const response = await fetch('/api/credits', {
      credentials: 'include'
    });
    const data = await response.json();
    
    if (data.success) {
      updateCreditsDisplay(data.credits, data.badges, data.nextBadges);
    }
  } catch (error) {
    console.error('Load credits error:', error);
  }
}

function updateCreditsDisplay(credits, badges, nextBadges) {
  const creditsAmount = document.getElementById('creditsAmount');
  if (creditsAmount) {
    creditsAmount.textContent = credits.available;
  }
  
  const creditsPage = document.getElementById('creditsSection');
  if (creditsPage) {
    creditsPage.innerHTML = `
      <div class="credits-dashboard">
        <h2>Your Green Credits 💰</h2>
        
        <div class="credits-grid">
          <div class="credit-card">
            <div class="credit-icon">🌟</div>
            <div class="credit-number">${credits.total || 0}</div>
            <div class="credit-label">Total Earned</div>
          </div>
          
          <div class="credit-card">
            <div class="credit-icon">💵</div>
            <div class="credit-number">${credits.available || 0}</div>
            <div class="credit-label">Available</div>
          </div>
          
          <div class="credit-card">
            <div class="credit-icon">🎁</div>
            <div class="credit-number">${(credits.total || 0) - (credits.available || 0)}</div>
            <div class="credit-label">Redeemed</div>
          </div>
        </div>
        
        <div class="badges-section">
          <h3>Earned Badges</h3>
          ${badges && badges.length > 0 ? `
            <div class="badges-grid">
              ${badges.map(badge => `
                <div class="badge-card">
                  <span class="badge-icon">${badge.icon}</span>
                  <span class="badge-name">${badge.name}</span>
                </div>
              `).join('')}
            </div>
          ` : '<p>No badges earned yet. Submit reports to start earning badges!</p>'}
        </div>
        
        <div class="next-badges-section">
          <h3>Progress Towards Next Badges</h3>
          ${nextBadges && nextBadges.length > 0 ? `
            <div class="progress-list">
              ${nextBadges.slice(0, 3).map(badge => `
                <div class="progress-item">
                  <div class="progress-header">
                    <span>${badge.icon} ${badge.name}</span>
                    <span>${Math.round(badge.progress)}%</span>
                  </div>
                  <div class="progress-bar">
                    <div class="progress-fill" style="width: ${badge.progress}%"></div>
                  </div>
                  <div class="progress-description">${badge.threshold} ${badge.field === 'reportCount' ? 'reports' : 'credits'} required</div>
                </div>
              `).join('')}
            </div>
          ` : ''}
        </div>
        
        <div class="credit-info">
          <h3>How to Earn Credits 📝</h3>
          <ul>
            <li>📍 Submit waste report: <strong>+10 credits</strong></li>
            <li>📸 Include photo: <strong>+10 credits</strong></li>
            <li>🗺️ Add GPS location: <strong>+10 credits</strong></li>
            <li>✍️ Detailed description: <strong>+10 credits</strong></li>
            <li>✅ Admin verification: <strong>+20 credits</strong></li>
            <li>⭐ High-quality report: <strong>+30 credits</strong></li>
          </ul>
        </div>
      </div>
    `;
  }
}

// ============================================
// REPORT SUBMISSION
// ============================================

async function handleReportSubmit(e) {
  e.preventDefault();
  
  const submitBtn = reportForm.querySelector('button[type="submit"]');
  const btnText = submitBtn.innerHTML;
  
  try {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner"></span> Submitting...';
    
    const formData = new FormData(reportForm);
    
    // Add location data if available
    if (currentLocation) {
      formData.append('lat', currentLocation.latitude);
      formData.append('lng', currentLocation.longitude);
    }
    
    const response = await fetch('/api/report', {
      method: 'POST',
      body: formData
    });
    
    const data = await response.json();
    
    if (data.success) {
      // ✅ SHOW POPUP - This is the key line!
      showSuccessPopup(data);
      
      // Clear form
      reportForm.reset();
      photoInput.value = '';
      photoPreview.style.display = 'none';
      photoPreview.src = '';
      
      // Reset location
      currentLocation = null;
      
    } else {
      alert('❌ ' + (data.error || 'Failed to submit report'));
    }
    
  } catch (error) {
    console.error('Submit error:', error);
    alert('❌ Failed to submit report. Please try again.');
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = btnText;
  }
}


// ============================================
// LOCATION SERVICES (FIXED - Preserves User Input + Shows Map)
// ============================================

function getUserLocation() {
  if (!navigator.geolocation) {
    showNotification('Geolocation is not supported by your browser', 'error');
    return;
  }
  
  const locationInput = document.getElementById('locationInput');
  const userEnteredAddress = locationInput?.value || ''; // ✅ SAVE user's input!
  
  showNotification('Getting your location...', 'info');
  // Inside getUserLocation, after getting location:
showNotification('⚠️ GPS may not be exact. Please verify and edit the address if needed!', 'warning');

  navigator.geolocation.getCurrentPosition(
    async (position) => {
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      
      currentLocation = { lat, lng };
      
      try {
        const address = await reverseGeocode(lat, lng);
        currentLocation.address = address;
        
        // ✅ DON'T overwrite user input, append GPS coordinates
        if (userEnteredAddress && userEnteredAddress.trim()) {
          locationInput.value = `${userEnteredAddress} (GPS: ${lat.toFixed(6)}, ${lng.toFixed(6)})`;
        } else {
          locationInput.value = address;
        }
        
        showNotification('Location captured successfully! 📍', 'success');
        showMapPreview(lat, lng); // ✅ Show Google Maps
        
      } catch (error) {
        console.error('Reverse geocoding error:', error);
        if (locationInput) {
          if (userEnteredAddress) {
            locationInput.value = `${userEnteredAddress} (${lat.toFixed(6)}, ${lng.toFixed(6)})`;
          } else {
            locationInput.value = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
          }
        }
        showNotification('Location captured!', 'success');
        showMapPreview(lat, lng);
      }
    },
    (error) => {
      let errorMessage = 'Could not get your location.';
      if (error.code === error.PERMISSION_DENIED) {
        errorMessage = 'Please enable location access in browser settings.';
      } else if (error.code === error.POSITION_UNAVAILABLE) {
        errorMessage = 'Location information unavailable. Try again.';
      } else if (error.code === error.TIMEOUT) {
        errorMessage = 'Location request timed out. Try again.';
      }
      showNotification(errorMessage, 'error');
    },
    {
      enableHighAccuracy: true, // ✅ Better GPS accuracy
      timeout: 10000,
      maximumAge: 0
    }
  );
}

// ✅ NEW FUNCTION: Show Google Maps Preview
function showMapPreview(lat, lng) {
  const reportForm = document.getElementById('reportForm');
  if (!reportForm) return;
  
  const existingMap = document.getElementById('mapPreview');
  if (existingMap) existingMap.remove();
  
  const mapContainer = document.createElement('div');
  mapContainer.id = 'mapPreview';
  mapContainer.className = 'map-preview';
  mapContainer.innerHTML = `
    <div class="map-preview-header">
      <span>📍 Location Preview</span>
      <button type="button" onclick="document.getElementById('mapPreview').remove()" class="close-map">✕</button>
    </div>
    <iframe
      width="100%"
      height="300"
      frameborder="0"
      style="border:0; border-radius: 8px;"
      src="https://www.google.com/maps?q=${lat},${lng}&output=embed&z=15"
      allowfullscreen>
    </iframe>
    <p class="map-coords">📍 ${lat.toFixed(6)}, ${lng.toFixed(6)}</p>
  `;
  
  const locationGroup = document.getElementById('locationInput').closest('.form-group');
  locationGroup.after(mapContainer);
}

async function reverseGeocode(lat, lng) {
  // Try multiple geocoding services for better accuracy
  
  // Method 1: OpenStreetMap Nominatim (most detailed)
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
      {
        headers: {
          'User-Agent': 'GreenCredits App'
        }
      }
    );
    
    if (response.ok) {
      const data = await response.json();
      
      // Build a more detailed address
      const address = data.address || {};
      const parts = [];
      
      // Add specific location details
      if (address.village) parts.push(address.village);
      if (address.town) parts.push(address.town);
      if (address.city) parts.push(address.city);
      if (address.state_district) parts.push(address.state_district);
      if (address.state) parts.push(address.state);
      if (address.postcode) parts.push(address.postcode);
      
      if (parts.length > 0) {
        return parts.join(', ');
      }
      
      // Fallback to display_name
      if (data.display_name) {
        return data.display_name;
      }
    }
  } catch (error) {
    console.error('Nominatim geocoding failed:', error);
  }
  
  // Method 2: Try BigDataCloud (free, no API key needed)
  try {
    const response = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`
    );
    
    if (response.ok) {
      const data = await response.json();
      const parts = [];
      
      if (data.locality) parts.push(data.locality);
      if (data.city) parts.push(data.city);
      if (data.principalSubdivision) parts.push(data.principalSubdivision);
      if (data.postcode) parts.push(data.postcode);
      
      if (parts.length > 0) {
        return parts.join(', ');
      }
    }
  } catch (error) {
    console.error('BigDataCloud geocoding failed:', error);
  }
  
  // Fallback: Return coordinates
  return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
}

// ============================================
// MY REPORTS
// ============================================

async function loadMyReports() {
  if (!currentUser) return;
  
  try {
    const response = await fetch('/api/reports', {
      credentials: 'include'
    });
    const data = await response.json();
    
    if (data.success) {
      displayMyReports(data.reports);
    }
  } catch (error) {
    console.error('Load reports error:', error);
  }
}

function displayMyReports(reports) {
  const reportsContainer = document.getElementById('myReportsContainer');
  if (!reportsContainer) return;
  
  if (!reports || reports.length === 0) {
    reportsContainer.innerHTML = `
      <div class="empty-state">
        <p>📋 No reports yet</p>
        <p>Submit your first waste report to get started!</p>
        <button onclick="switchTab('reportIssue')" class="btn-primary">Report Waste</button>
      </div>
    `;
    return;
  }
  
  reportsContainer.innerHTML = `
    <div class="reports-grid">
      ${reports.map(report => `
        <div class="report-card">
          ${report.photoUrl ? `<img src="${report.photoUrl}" alt="Report photo" class="report-photo">` : ''}
          <div class="report-content">
            <div class="report-id">Report #${report.reportId}</div>
            <p class="report-description">${report.description}</p>
            ${report.address ? `<p class="report-location">📍 ${report.address}</p>` : ''}
            <div class="report-meta">
              <span class="status-badge status-${report.status}">${report.status}</span>
              <span class="report-date">${new Date(report.createdAt).toLocaleDateString()}</span>
            </div>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

// ============================================
// LEADERBOARD
// ============================================

async function loadPublicData() {
  await loadLeaderboard();
}

async function loadLeaderboard() {
  try {
    const response = await fetch('/api/leaderboard');
    const data = await response.json();
    
    if (data.success) {
      displayLeaderboard(data.leaderboard);
    }
  } catch (error) {
    console.error('Load leaderboard error:', error);
  }
}

function displayLeaderboard(leaderboard) {
  const leaderboardContainer = document.getElementById('leaderboardContainer');
  if (!leaderboardContainer) return;
  
  if (!leaderboard || leaderboard.length === 0) {
    leaderboardContainer.innerHTML = '<p class="empty-state">No data yet. Be the first to submit a report!</p>';
    return;
  }
  
  leaderboardContainer.innerHTML = `
    <div class="leaderboard-list">
      ${leaderboard.map((user, index) => `
        <div class="leaderboard-item ${index < 3 ? 'top-three' : ''}">
          <div class="rank">${getRankEmoji(user.rank)} #${user.rank}</div>
          <div class="user-info">
            <div class="user-name">${user.name}</div>
            <div class="user-stats">${user.reports} reports • ${user.badges} badges</div>
          </div>
          <div class="user-credits">${user.credits} pts</div>
        </div>
      `).join('')}
    </div>
  `;
}

function getRankEmoji(rank) {
  if (rank === 1) return '🥇';
  if (rank === 2) return '🥈';
  if (rank === 3) return '🥉';
  return '🏅';
}

// ============================================
// NAVIGATION TABS
// ============================================

function initializeNavTabs() {
  const tabButtons = document.querySelectorAll('[data-tab]');
  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      switchTab(button.dataset.tab);
    });
  });
}

function switchTab(tabName) {
  // Hide all sections
  document.querySelectorAll('.tab-content').forEach(section => {
    section.classList.add('hidden');
  });
  
  // Show selected section
  const targetSection = document.getElementById(tabName + 'Section') || 
                        document.getElementById(tabName);
  if (targetSection) {
    targetSection.classList.remove('hidden');
  }
  
  // Update active tab button
  document.querySelectorAll('[data-tab]').forEach(button => {
    button.classList.remove('active');
  });
  document.querySelector(`[data-tab="${tabName}"]`)?.classList.add('active');
  
  // Load data for specific tabs
  if (tabName === 'myReports') loadMyReports();
  if (tabName === 'credits') loadUserCredits();
  if (tabName === 'leaderboard') loadLeaderboard();
}

// ============================================
// UI UTILITIES
// ============================================

function styleFileInput(input) {
  const label = document.createElement('label');
  label.htmlFor = input.id;
  label.className = 'file-input-label';
  label.textContent = 'Choose File';
  
  input.style.display = 'none';
  input.parentNode.insertBefore(label, input.nextSibling);
  
  input.addEventListener('change', function() {
    if (this.files && this.files[0]) {
      label.textContent = this.files[0].name;
      label.style.borderColor = 'var(--primary)';
      label.style.color = 'var(--primary)';
    } else {
      label.textContent = 'Choose File';
      label.style.borderColor = 'var(--gray-300)';
      label.style.color = 'var(--gray-700)';
    }
  });
}

function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.add('active');
    modal.style.display = 'flex';
  }
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove('active');
    setTimeout(() => {
      modal.style.display = 'none';
    }, 300);
  }
}

function showNotification(message, type = 'info') {
  // Remove existing notifications
  document.querySelectorAll('.notification').forEach(n => n.remove());
  
  const notification = document.createElement('div');
  notification.className = `notification notification-${type}`;
  
  const icon = {
    success: '✅',
    error: '❌',
    warning: '⚠️',
    info: 'ℹ️'
  }[type] || 'ℹ️';
  
  notification.innerHTML = `<span class="notification-icon">${icon}</span><span>${message}</span>`;
  
  notification.style.cssText = `
    position: fixed;
    top: 80px;
    right: 20px;
    padding: 15px 20px;
    background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : type === 'warning' ? '#f59e0b' : '#3b82f6'};
    color: white;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    z-index: 10000;
    animation: slideIn 0.3s ease;
    max-width: 400px;
    display: flex;
    align-items: center;
    gap: 10px;
    font-weight: 500;
  `;
  
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.style.animation = 'slideOut 0.3s ease';
    setTimeout(() => notification.remove(), 300);
  }, 4000);
}

function scrollToSection(sectionId) {
  const section = document.getElementById(sectionId);
  if (section) {
    section.scrollIntoView({ behavior: 'smooth' });
  }
}

// ============================================
// ANIMATIONS & STYLES
// ============================================

const style = document.createElement('style');
style.textContent = `
  @keyframes slideIn {
    from {
      transform: translateX(400px);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }
  
  @keyframes slideOut {
    from {
      transform: translateX(0);
      opacity: 1;
    }
    to {
      transform: translateX(400px);
      opacity: 0;
    }
  }
  
  @keyframes fadeInUp {
    from {
      opacity: 0;
      transform: translateY(30px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  
  .hidden {
    display: none !important;
  }
  
  .empty-state {
    text-align: center;
    padding: 3rem 2rem;
    color: var(--gray-600);
  }
  
  .empty-state p {
    margin-bottom: 1rem;
    font-size: 1.1rem;
  }
  
  .empty-state p:first-child {
    font-size: 2rem;
    margin-bottom: 0.5rem;
  }
  
  .loader {
    text-align: center;
    padding: 2rem;
    color: var(--gray-500);
    font-style: italic;
  }
  
  .report-location {
    font-size: 0.9rem;
    color: var(--gray-600);
    margin-top: 0.5rem;
    display: flex;
    align-items: center;
    gap: 0.3rem;
  }
`;
document.head.appendChild(style);

console.log('✅ GreenCredits script loaded successfully');

// ============================================
// 🎉 ENHANCED FEATURES: STREAK + POPUP + IMPACT  
// ============================================

// ========== SUCCESS POPUP ==========
function showSuccessPopup(data) {
  const popup = document.createElement('div');
  popup.className = 'success-popup-overlay';
  popup.innerHTML = `
    <div class="success-popup animate-in">
      <div class="confetti">🎉</div>
      <h2>🎊 REPORT SUBMITTED!</h2>
      
      <div class="rewards-earned">
        <div class="reward-item">
          <span class="reward-icon">💰</span>
          <span class="reward-value">${data.creditsEarned || 0} Credits</span>
        </div>
        
        ${data.streak && data.streak > 1 ? `
        <div class="reward-item streak-reward">
          <span class="reward-icon">🔥</span>
          <span class="reward-value">${data.streak}-Day Streak!</span>
        </div>
        ` : ''}
        
        ${data.streakBonus && data.streakBonus > 0 ? `
        <div class="reward-item bonus-reward">
          <span class="reward-icon">⚡</span>
          <span class="reward-value">+${data.streakBonus} Streak Bonus</span>
        </div>
        ` : ''}
        
        <div class="reward-item">
          <span class="reward-icon">🏆</span>
          <span class="reward-value">Report #${data.reportId || 'N/A'}</span>
        </div>
      </div>
      
      <div class="total-credits">
        <div class="total-label">Total Earned</div>
        <div class="total-value">${data.creditsEarned || 0} Credits</div>
        <div class="total-rupees">(₹${((data.creditsEarned || 0) / 10).toFixed(1)} value)</div>
      </div>
      
      <button onclick="closeSuccessPopup()" class="close-popup-btn">
        Continue ✨
      </button>
    </div>
  `;
  
  document.body.appendChild(popup);
  
  setTimeout(() => {
    if (document.querySelector('.success-popup-overlay')) {
      closeSuccessPopup();
    }
  }, 6000);
}

window.closeSuccessPopup = function() {
  const popup = document.querySelector('.success-popup-overlay');
  if (popup) {
    popup.querySelector('.success-popup').classList.add('animate-out');
    setTimeout(() => {
      popup.remove();
      loadUserCredits();
      loadMyReports();
    }, 300);
  }
};

// ========== HOOK INTO REPORT SUBMISSION ==========
const originalHandleReportSubmit = handleReportSubmit;
handleReportSubmit = async function(e) {
  await originalHandleReportSubmit.call(this, e);
};
async function handleReportSubmit(e) {
  e.preventDefault();
  
  const formData = new FormData();
  
  // ✅ FIX: Get description from correct field ID
  const description = document.getElementById('reportDescription').value.trim();
  const wasteCategory = document.getElementById('wasteCategory').value;
  const wasteSize = document.getElementById('wasteSize').value;
  const photoInput = document.getElementById('photoInput');
  
  // Add description to FormData
  formData.append('description', description);
  formData.append('wasteCategory', wasteCategory);
  formData.append('disposalMethod', wasteSize);
  
  // Add photo if selected
  if (photoInput.files[0]) {
    formData.append('photo', photoInput.files[0]);
  }
  
  // Add location if available
  if (currentLocation) {
    formData.append('lat', currentLocation.latitude);
    formData.append('lng', currentLocation.longitude);
    formData.append('address', document.getElementById('locationInput').value);
  }
  
  try {
    const response = await fetch('/api/report', {
      method: 'POST',
      body: formData
    });
    
    const data = await response.json();
    
    if (data.success) {
      // ✅ SHOW POPUP!
      showSuccessPopup(data);
      
      // Clear form
      document.getElementById('reportForm').reset();
    } else {
      alert('❌ ' + (data.error || 'Failed to submit report'));
    }
  } catch (error) {
    console.error('Submit error:', error);
    alert('❌ Failed to submit report');
  }
}


// Listen for successful submissions
document.addEventListener('reportSubmitted', (event) => {
  if (event.detail && event.detail.success) {
    showSuccessPopup(event.detail);
  }
});

// ========== ADD ENHANCED STYLES ==========
if (!document.getElementById('enhancedFeaturesStyles')) {
  const enhancedStyles = document.createElement('style');
  enhancedStyles.id = 'enhancedFeaturesStyles';
  enhancedStyles.textContent = `
/* Success Popup */
.success-popup-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0,0,0,0.85);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
  animation: fadeIn 0.3s;
}

.success-popup {
  background: white;
  border-radius: 20px;
  padding: 30px 25px;  /* Reduced padding */
  max-width: 420px;    /* Smaller width */
  width: 90%;
  text-align: center;
  box-shadow: 0 25px 75px rgba(0,0,0,0.5);
  max-height: 90vh;    /* Limit height */
  overflow-y: auto;    /* Scroll if needed */
}


.animate-in {
  animation: scaleIn 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55);
}

.animate-out {
  animation: scaleOut 0.3s ease-in-out;
}

@keyframes scaleIn {
  from { transform: scale(0.3) rotate(-10deg); opacity: 0; }
  to { transform: scale(1) rotate(0deg); opacity: 1; }
}

@keyframes scaleOut {
  from { transform: scale(1); opacity: 1; }
  to { transform: scale(0.5); opacity: 0; }
}

.confetti {
  font-size: 3.5rem;
  animation: bounce 0.8s infinite;
}

@keyframes bounce {
  0%, 100% { transform: translateY(0) rotate(0deg); }
  25% { transform: translateY(-25px) rotate(-5deg); }
  75% { transform: translateY(-15px) rotate(5deg); }
}

.success-popup h2 {
  color: #10b981;
  margin: 15px 0;
  font-size: 1.8rem;
  font-weight: 900;
}

.rewards-earned {
  display: flex;
  flex-direction: column;
  gap: 15px;
  margin: 30px 0;
}

.reward-item {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 15px;
  padding: 18px;
  background: #f9fafb;
  border-radius: 15px;
  transition: all 0.3s;
}

.reward-item:hover {
  transform: translateX(8px);
  background: #f3f4f6;
}

.streak-reward {
  background: linear-gradient(135deg, #FF6B6B 0%, #FFE66D 100%);
  color: white;
  font-weight: 700;
}

.bonus-reward {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  font-weight: 700;
}

.reward-icon {
  font-size: 2.5rem;
}

.reward-value {
  font-size: 1.3rem;
  font-weight: 700;
}

.total-credits {
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  color: white;
  padding: 25px;
  border-radius: 20px;
  margin: 20px 0;
  box-shadow: 0 10px 30px rgba(16, 185, 129, 0.3);
}

.total-label {
  font-size: 1rem;
  opacity: 0.95;
  margin-bottom: 8px;
  font-weight: 600;
}

.total-value {
  font-size: 2.5rem;
  font-weight: 900;
  margin: 10px 0;
  text-shadow: 0 2px 10px rgba(0,0,0,0.2);
}

.total-rupees {
  font-size: 1.2rem;
  opacity: 0.95;
}

.close-popup-btn {
  background: #10b981;
  color: white;
  border: none;
  padding: 18px 45px;
  border-radius: 15px;
  font-size: 1.2rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.3s;
  margin-top: 20px;
  box-shadow: 0 5px 15px rgba(16, 185, 129, 0.3);
}

.close-popup-btn:hover {
  background: #059669;
  transform: translateY(-3px);
  box-shadow: 0 12px 30px rgba(16, 185, 129, 0.4);
}

@media (max-width: 768px) {
  .success-popup {
    padding: 30px 20px;
    width: 95%;
  }
  
  .success-popup h2 {
    font-size: 1.8rem;
  }
  
  .total-value {
    font-size: 2.5rem;
  }
}
  `;
  document.head.appendChild(enhancedStyles);
}

// ============================================
// 🔥 STREAK SYSTEM DISPLAY
// ============================================

async function loadStreakData() {
  try {
    const response = await fetch('/api/user-profile');
    const data = await response.json();
    
    if (data.success && data.user) {
      const user = data.user;
      const currentStreak = user.currentStreak || 0;
      const longestStreak = user.longestStreak || 0;
      const lastReportDate = user.lastReportDate;
      
      // ✅ SAFE: Check if elements exist before updating
      const currentStreakEl = document.getElementById('currentStreak');
      const longestStreakEl = document.getElementById('longestStreak');
      const lastReportDateEl = document.getElementById('lastReportDate');
      const streakProgressEl = document.getElementById('streakProgress');
      const streakFire = document.querySelector('.streak-fire');
      const multiplierBadge = document.querySelector('.multiplier-badge');
      
      // Only update if elements exist
      if (currentStreakEl) currentStreakEl.textContent = currentStreak;
      if (longestStreakEl) longestStreakEl.textContent = longestStreak;
      
      // Calculate multiplier
      let multiplier = '1X';
      let multiplierClass = '';
      if (currentStreak >= 7) {
        multiplier = '3X';
        multiplierClass = 'multiplier-high';
      } else if (currentStreak >= 3) {
        multiplier = '2X';
        multiplierClass = 'multiplier-medium';
      }
      
      if (multiplierBadge) {
        multiplierBadge.textContent = multiplier;
        multiplierBadge.className = 'multiplier-badge ' + multiplierClass;
      }
      
      // Update progress bar (max 7 days)
      const progress = Math.min((currentStreak / 7) * 100, 100);
      if (streakProgressEl) {
        streakProgressEl.style.width = progress + '%';
      }
      
      // Add fire animation if streak active
      if (streakFire && currentStreak > 0) {
        streakFire.classList.add('active');
      }
      
      // Format last report date
      if (lastReportDateEl && lastReportDate) {
        const date = new Date(lastReportDate);
        const today = new Date();
        const diffTime = Math.abs(today - date);
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        
        let dateText = '';
        if (diffDays === 0) {
          dateText = 'Today';
        } else if (diffDays === 1) {
          dateText = 'Yesterday';
        } else {
          dateText = `${diffDays} days ago`;
        }
        
        lastReportDateEl.textContent = dateText;
      }
      
      console.log(`🔥 Streak: ${currentStreak} days | Best: ${longestStreak} days`);
    }
  } catch (error) {
    console.error('Failed to load streak data:', error);
  }
}


// ============================================
// 🎁 REWARDS STORE SYSTEM
// ============================================

const REWARDS_CATALOG = [
  { id: 'amazon50', name: '₹50 Amazon Voucher', category: 'vouchers', cost: 500, icon: '🛒', description: 'Amazon gift card worth ₹50', stock: 'Unlimited' },
  { id: 'flipkart100', name: '₹100 Flipkart Voucher', category: 'vouchers', cost: 1000, icon: '🛍️', description: 'Flipkart gift voucher', stock: 'Unlimited' },
  { id: 'zomato200', name: '₹200 Zomato Voucher', category: 'vouchers', cost: 2000, icon: '🍔', description: 'Zomato food voucher', stock: 'Limited' },
  { id: 'tshirt', name: 'GreenCredits T-Shirt', category: 'products', cost: 1500, icon: '👕', description: 'Premium eco-friendly cotton t-shirt', stock: '50 left' },
  { id: 'bottle', name: 'Steel Water Bottle', category: 'products', cost: 800, icon: '🍶', description: 'Reusable steel water bottle', stock: '100 left' },
  { id: 'bag', name: 'Eco Jute Bag', category: 'products', cost: 600, icon: '👜', description: 'Reusable jute shopping bag', stock: 'Unlimited' },
  { id: 'tree', name: 'Plant 5 Trees', category: 'donations', cost: 500, icon: '🌳', description: 'Plant 5 trees in your name', stock: 'Unlimited' },
  { id: 'cleanup', name: 'Fund Beach Cleanup', category: 'donations', cost: 1000, icon: '🏖️', description: 'Support coastal cleanup drive', stock: 'Unlimited' },
  { id: 'ngo', name: 'Donate to NGO', category: 'donations', cost: 2000, icon: '❤️', description: 'Support environmental NGOs', stock: 'Unlimited' },
  { id: 'cleaning', name: 'Free Home Waste Pickup', category: 'services', cost: 0, icon: '🚛', description: 'One-time free waste pickup service', stock: '20 left' },
  { id: 'consultation', name: 'Waste Management Consultation', category: 'services', cost: 1200, icon: '👨‍🏫', description: '1-hour expert consultation', stock: '10 left' }
];

function loadRewardsStore() {
  fetch('/api/credits')
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        document.getElementById('rewardsBalance').textContent = data.credits.available;
      }
    });
  
  renderRewards('all');
  
  document.querySelectorAll('.category-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      document.querySelectorAll('.category-btn').forEach(b => b.classList.remove('active'));
      this.classList.add('active');
      renderRewards(this.dataset.category);
    });
  });
}

function renderRewards(category) {
  const grid = document.getElementById('rewardsGrid');
  const filtered = category === 'all' ? REWARDS_CATALOG : REWARDS_CATALOG.filter(r => r.category === category);
  
  if (filtered.length === 0) {
    grid.innerHTML = '<p class="no-rewards">No rewards in this category yet.</p>';
    return;
  }
  
  grid.innerHTML = filtered.map(reward => `
    <div class="reward-card">
      <div class="reward-icon">${reward.icon}</div>
      <h3 class="reward-name">${reward.name}</h3>
      <p class="reward-desc">${reward.description}</p>
      <div class="reward-footer">
        <div class="reward-cost">
          <span class="cost-label">Cost:</span>
          <span class="cost-value">${reward.cost} credits</span>
        </div>
        <div class="reward-stock">${reward.stock}</div>
      </div>
      <button onclick="redeemReward('${reward.id}', ${reward.cost}, '${reward.name}')" class="btn-redeem">
        Redeem Now
      </button>
    </div>
  `).join('');
}

// ============================================
// 🎁 REDEEM REWARD WITH BEAUTIFUL MODAL
// ============================================

window.redeemReward = async function(rewardId, cost, name) {
  try {
    // Get fresh credits from server
    const response = await fetch('/api/credits', { credentials: 'include' });
    const data = await response.json();
    
    if (!data.success) {
      alert('Failed to check credits');
      return;
    }
    
    const available = data.credits.available;
    const total = data.credits.total;
    const redeemed = data.credits.redeemed || (total - available);
    
    // Check if enough credits
    if (available < cost) {
      showInsufficientCreditsModal(available, cost, name);
      return;
    }
    
    // Show beautiful confirmation modal
    const confirmed = await showConfirmationModal(name, cost, available, total, redeemed);
    
    if (!confirmed) return;
    
    // Redeem the reward
    const redeemResponse = await fetch('/api/redeem', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ rewardId, cost, name })
    });
    
    const result = await redeemResponse.json();
    
    if (result.success) {
      // Fetch fresh credits to get updated available amount
      const freshResponse = await fetch('/api/credits', { credentials: 'include' });
      const freshData = await freshResponse.json();
      
      if (freshData.success) {
        const newAvailable = freshData.credits.available;
        const newTotal = freshData.credits.total;
        
        // Update localStorage
        const user = JSON.parse(localStorage.getItem('user'));
        user.credits = newTotal;
        localStorage.setItem('user', JSON.stringify(user));
        
        // Update currentUser
        if (window.currentUser) window.currentUser.credits = newTotal;
        
        // Update header with AVAILABLE credits
        const headerCredits = document.getElementById('creditsAmount');
        if (headerCredits) {
          headerCredits.textContent = newAvailable;
        }
        
        // Update rewards balance
        const rewardsBalance = document.getElementById('rewardsBalance');
        if (rewardsBalance) {
          rewardsBalance.textContent = newAvailable;
        }
        
        // Show success popup
        showRedemptionSuccess(name, cost, newAvailable);
        
        setTimeout(() => {
          if (typeof loadRewardsStore === 'function') loadRewardsStore();
        }, 3000);
      }
    } else {
      alert('❌ ' + (result.error || 'Redemption failed'));
    }
  } catch (error) {
    console.error('Redemption error:', error);
    alert('❌ Failed to redeem reward. Please try again.');
  }
};

// ============================================
// 🎨 BEAUTIFUL CONFIRMATION MODAL
// ============================================

function showConfirmationModal(rewardName, cost, available, total, redeemed) {
  return new Promise((resolve) => {
    const modal = document.createElement('div');
    modal.id = 'confirmRedeemModal';
    modal.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      background: rgba(0,0,0,0.7); backdrop-filter: blur(5px);
      display: flex; align-items: center; justify-content: center;
      z-index: 99999; animation: fadeIn 0.2s;
    `;
    
    modal.innerHTML = `
      <style>
        @keyframes fadeIn { from {opacity:0} to {opacity:1} }
        @keyframes slideUp { from {transform:translateY(20px);opacity:0} to {transform:translateY(0);opacity:1} }
        
        .mini-modal {
          background: white;
          border-radius: 16px;
          max-width: 340px;
          width: 88%;
          animation: slideUp 0.25s ease;
          box-shadow: 0 15px 40px rgba(0,0,0,0.25);
          overflow: hidden;
        }
        
        .mini-header {
          background: linear-gradient(135deg, #10b981, #059669);
          padding: 14px;
          text-align: center;
        }
        
        .mini-icon { font-size: 2.2rem; margin-bottom: 4px; }
        .mini-title { color: white; font-size: 1.1rem; font-weight: 800; margin: 0 0 2px 0; }
        .mini-subtitle { color: rgba(255,255,255,0.95); font-size: 0.8rem; font-weight: 600; margin: 0; }
        
        .mini-body { padding: 14px; }
        
        .mini-stats {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
          margin-bottom: 10px;
          padding: 10px;
          background: #f9fafb;
          border-radius: 10px;
        }
        
        .mini-stat { text-align: center; }
        .mini-stat-label { font-size: 0.65rem; color: #6b7280; font-weight: 600; margin-bottom: 3px; text-transform: uppercase; }
        .mini-stat-value { font-size: 1.3rem; font-weight: 900; }
        .green { color: #10b981; }
        .orange { color: #f59e0b; }
        
        .mini-balance {
          background: linear-gradient(135deg, #dbeafe, #bfdbfe);
          border: 2px solid #3b82f6;
          border-radius: 10px;
          padding: 10px;
          text-align: center;
          margin-bottom: 10px;
        }
        .mini-balance-label { font-size: 0.65rem; color: #1e40af; font-weight: 700; margin-bottom: 4px; text-transform: uppercase; }
        .mini-balance-value { font-size: 1.8rem; font-weight: 900; color: #3b82f6; line-height: 1; }
        
        .mini-cost {
          background: linear-gradient(135deg, #10b981, #059669);
          border-radius: 10px;
          padding: 10px;
          text-align: center;
          margin-bottom: 10px;
          box-shadow: 0 4px 15px rgba(16,185,129,0.25);
        }
        .mini-cost-label { font-size: 0.7rem; color: rgba(255,255,255,0.95); font-weight: 600; margin-bottom: 4px; }
        .mini-cost-value { font-size: 1.8rem; font-weight: 900; color: white; line-height: 1; }
        
        .mini-result {
          background: #fef3c7;
          border: 2px solid #fbbf24;
          border-radius: 10px;
          padding: 10px;
          text-align: center;
          margin-bottom: 12px;
        }
        .mini-result-label { font-size: 0.7rem; color: #92400e; font-weight: 700; margin-bottom: 4px; }
        .mini-result-value { font-size: 1.4rem; font-weight: 900; color: #92400e; line-height: 1; }
        
        .mini-buttons {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
        }
        
        .mini-btn {
          padding: 10px;
          border: none;
          border-radius: 8px;
          font-size: 0.85rem;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.15s;
        }
        
        .mini-btn-cancel {
          background: #f3f4f6;
          color: #374151;
          border: 2px solid #e5e7eb;
        }
        .mini-btn-cancel:hover { background: #e5e7eb; }
        
        .mini-btn-confirm {
          background: linear-gradient(135deg, #10b981, #059669);
          color: white;
          box-shadow: 0 2px 8px rgba(16,185,129,0.3);
        }
        .mini-btn-confirm:hover { box-shadow: 0 3px 12px rgba(16,185,129,0.4); }
      </style>
      
      <div class="mini-modal">
        <div class="mini-header">
          <div class="mini-icon">🎁</div>
          <h4 class="mini-title">Confirm Redemption</h4>
          <p class="mini-subtitle">${rewardName}</p>
        </div>
        
        <div class="mini-body">
          <div class="mini-stats">
            <div class="mini-stat">
              <div class="mini-stat-label">Total Earned</div>
              <div class="mini-stat-value green">${total}</div>
            </div>
            <div class="mini-stat">
              <div class="mini-stat-label">Already Redeemed</div>
              <div class="mini-stat-value orange">${redeemed}</div>
            </div>
          </div>
          
          <div class="mini-balance">
            <div class="mini-balance-label">Available Balance</div>
            <div class="mini-balance-value">${available}</div>
          </div>
          
          <div class="mini-cost">
            <div class="mini-cost-label">This Reward Costs</div>
            <div class="mini-cost-value">-${cost}</div>
          </div>
          
          <div class="mini-result">
            <div class="mini-result-label">Balance After Redemption</div>
            <div class="mini-result-value">${available - cost} Credits</div>
          </div>
          
          <div class="mini-buttons">
            <button class="mini-btn mini-btn-cancel" id="cancelBtn">Cancel</button>
            <button class="mini-btn mini-btn-confirm" id="confirmBtn">Confirm</button>
          </div>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    document.getElementById('cancelBtn').onclick = () => {
      modal.remove();
      resolve(false);
    };
    
    document.getElementById('confirmBtn').onclick = () => {
      modal.remove();
      resolve(true);
    };
    
    modal.onclick = (e) => {
      if (e.target === modal) {
        modal.remove();
        resolve(false);
      }
    };
  });
}



// ============================================
// ❌ INSUFFICIENT CREDITS MODAL
// ============================================

function showInsufficientCreditsModal(available, cost, rewardName) {
  const modal = document.createElement('div');
  modal.style.cssText = `
    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
    background: rgba(0,0,0,0.85); display: flex; align-items: center;
    justify-content: center; z-index: 99999; animation: fadeIn 0.3s;
  `;
  
  modal.innerHTML = `
    <style>
      @keyframes fadeIn { from {opacity:0} to {opacity:1} }
      @keyframes slideUp { from {transform:translateY(30px);opacity:0} to {transform:translateY(0);opacity:1} }
    </style>
    <div style="background:white; border-radius:20px; padding:40px; max-width:450px; width:90%; text-align:center; animation:slideUp 0.5s; box-shadow:0 20px 60px rgba(0,0,0,0.5);">
      <div style="font-size:5rem; margin-bottom:20px;">😢</div>
      <h2 style="margin:0 0 15px 0; color:#ef4444; font-size:1.8rem;">Insufficient Credits</h2>
      <p style="color:#6b7280; font-size:1.1rem; margin-bottom:25px;">
        You don't have enough credits to redeem <strong>${rewardName}</strong>
      </p>
      
      <div style="background:#fef2f2; border:2px solid #fecaca; padding:20px; border-radius:15px; margin-bottom:25px;">
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:15px; text-align:center;">
          <div>
            <div style="font-size:0.85rem; color:#991b1b; margin-bottom:5px;">You Have</div>
            <div style="font-size:2.5rem; font-weight:900; color:#dc2626;">${available}</div>
          </div>
          <div>
            <div style="font-size:0.85rem; color:#991b1b; margin-bottom:5px;">You Need</div>
            <div style="font-size:2.5rem; font-weight:900; color:#10b981;">${cost}</div>
          </div>
        </div>
        <div style="margin-top:15px; padding-top:15px; border-top:2px solid white;">
          <div style="font-size:0.9rem; color:#991b1b;">Need ${cost - available} more credits</div>
        </div>
      </div>
      
      <p style="color:#6b7280; font-size:0.95rem; margin-bottom:25px;">
        💡 Keep reporting environmental issues to earn more credits!
      </p>
      
      <button onclick="this.closest('div[style*=position]').remove()" style="
        background:linear-gradient(135deg,#10b981,#059669); color:white;
        border:none; padding:15px 40px; border-radius:10px; font-size:1.1rem;
        font-weight:600; cursor:pointer; transition:all 0.2s;
      " onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
        OK, Got It!
      </button>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  modal.onclick = (e) => {
    if (e.target === modal) modal.remove();
  };
}





// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
  // Load streak data when Credits tab is clicked
  const creditsTab = document.querySelector('[data-tab="credits"]');
  if (creditsTab) {
    creditsTab.addEventListener('click', function() {
      // Wait a bit for the tab to be visible
      setTimeout(() => {
        loadStreakData();
      }, 100);
    });
  }
  
  const rewardsTab = document.querySelector('[data-tab="rewards"]');
  if (rewardsTab) {
    rewardsTab.addEventListener('click', loadRewardsStore);
  }
});


console.log('✅ Streak & Rewards systems loaded');

console.log('✅ Enhanced features loaded: Success Popup');
// ============================================
// 🔥 AUTO-INJECT STREAK WIDGET ON PAGE LOAD
// ============================================

function autoInjectStreakWidget() {
  // Wait for dashboard to be visible
  setTimeout(() => {
    // Only inject if user is logged in and on Credits tab
    const creditsTab = document.querySelector('[data-tab="credits"]');
    if (!creditsTab) return;
    
    creditsTab.addEventListener('click', function() {
      setTimeout(() => {
        // Check if widget already exists
        if (document.getElementById('streakWidget')) {
          console.log('✅ Streak widget already present');
          return;
        }
        
        // Find the "Your Green Credits" heading
        const titleElement = Array.from(document.querySelectorAll('h2, h3, div')).find(el => 
          el.textContent.trim().startsWith('Your Green Credits')
        );
        
        if (!titleElement) {
          console.log('⚠️ Could not find Your Green Credits title');
          return;
        }
        
        // Create streak widget
        const widget = document.createElement('div');
        widget.id = 'streakWidget';
        widget.className = 'streak-widget';
        widget.style.cssText = `
          background: linear-gradient(135deg, #ff6b6b 0%, #feca57 100%);
          border-radius: 20px;
          padding: 30px;
          margin: 20px auto 30px auto;
          color: white;
          box-shadow: 0 10px 30px rgba(255, 107, 107, 0.3);
          max-width: 900px;
        `;
        
        widget.innerHTML = `
          <div style="margin-bottom: 20px;">
            <h3 style="margin: 0 0 10px 0; font-size: 1.8rem; color: white;">🔥 Daily Streak</h3>
            <p style="margin: 0; opacity: 0.95; color: white;">Report every day to maintain your streak and earn bonus credits!</p>
          </div>
          
          <div style="display: flex; align-items: center; justify-content: space-around; margin: 30px 0; padding: 25px; background: rgba(255, 255, 255, 0.15); border-radius: 15px; flex-wrap: wrap; gap: 20px;">
            <div style="font-size: 5rem;">🔥</div>
            <div style="text-align: center;">
              <div id="currentStreak" style="font-size: 4rem; font-weight: 900; color: white;">0</div>
              <div style="font-size: 1.1rem; font-weight: 600; color: white;">Day Streak</div>
            </div>
            <div style="text-align: center;">
              <div class="multiplier-badge" style="font-size: 2.5rem; font-weight: 900; padding: 15px 25px; background: rgba(255, 255, 255, 0.25); border-radius: 15px; color: white;">1X</div>
              <div style="font-size: 0.95rem; margin-top: 8px; color: white;">Bonus</div>
            </div>
          </div>
          
          <div style="margin: 25px 0;">
            <div style="height: 20px; background: rgba(255, 255, 255, 0.25); border-radius: 10px; overflow: hidden; margin-bottom: 10px;">
              <div id="streakProgress" style="height: 100%; width: 0%; background: white; border-radius: 10px; transition: width 0.5s;"></div>
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 0.85rem; color: white;">
              <span>🔥 1 day</span>
              <span>🔥🔥 3 days (2X)</span>
              <span>🔥🔥🔥 7 days (3X)</span>
            </div>
          </div>
          
          <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; margin: 25px 0;">
            <div style="display: flex; align-items: center; gap: 15px; background: rgba(255, 255, 255, 0.15); padding: 20px; border-radius: 12px;">
              <span style="font-size: 2.5rem;">📅</span>
              <div>
                <div id="lastReportDate" style="font-size: 1.8rem; font-weight: 700; color: white;">Never</div>
                <div style="font-size: 0.9rem; opacity: 0.9; margin-top: 5px; color: white;">Last Report</div>
              </div>
            </div>
            <div style="display: flex; align-items: center; gap: 15px; background: rgba(255, 255, 255, 0.15); padding: 20px; border-radius: 12px;">
              <span style="font-size: 2.5rem;">🏆</span>
              <div>
                <div id="longestStreak" style="font-size: 1.8rem; font-weight: 700; color: white;">0</div>
                <div style="font-size: 0.9rem; opacity: 0.9; margin-top: 5px; color: white;">Longest Streak</div>
              </div>
            </div>
          </div>
          
          <div style="background: rgba(255, 255, 255, 0.15); padding: 20px; border-radius: 12px;">
            <h4 style="margin: 0 0 15px 0; font-size: 1.3rem; color: white;">🎁 Streak Rewards</h4>
            <div style="display: flex; flex-direction: column; gap: 10px;">
              <div style="background: rgba(255, 255, 255, 0.2); padding: 12px; border-radius: 8px; font-weight: 600; color: white;">3 days: 2X credit bonus</div>
              <div style="background: rgba(255, 255, 255, 0.2); padding: 12px; border-radius: 8px; font-weight: 600; color: white;">7 days: 3X credit bonus</div>
              <div style="background: rgba(255, 255, 255, 0.2); padding: 12px; border-radius: 8px; font-weight: 600; color: white;">30 days: Special badge!</div>
            </div>
          </div>
        `;
        
        // Insert before the title
        titleElement.insertAdjacentElement('beforebegin', widget);
        
        console.log('🎉 Streak widget auto-injected!');
        
        // Load streak data
        if (typeof loadStreakData === 'function') {
          setTimeout(() => loadStreakData(), 500);
        }
      }, 200);
    });
  }, 1000);
}

// Initialize when page loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', autoInjectStreakWidget);
} else {
  autoInjectStreakWidget();
}

console.log('✅ Streak widget auto-injector loaded');

// ============================================
// 🎉 BEAUTIFUL REDEMPTION SUCCESS POPUP
// ============================================

// ============================================
// 🎉 BEAUTIFUL REDEMPTION SUCCESS POPUP
// ============================================

function showRedemptionSuccess(rewardName, cost, newBalance) {
  // Remove existing popup if any
  const existing = document.getElementById('redemptionSuccessPopup');
  if (existing) existing.remove();
  
  // Create popup overlay
  const overlay = document.createElement('div');
  overlay.id = 'redemptionSuccessPopup';
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.85);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 99999;
    animation: fadeIn 0.3s ease;
  `;
  
  // Create popup card
  const popup = document.createElement('div');
  popup.style.cssText = `
    background: white;
    border-radius: 20px;
    padding: 40px;
    max-width: 500px;
    text-align: center;
    box-shadow: 0 20px 60px rgba(0,0,0,0.5);
    animation: slideUp 0.5s ease;
    position: relative;
  `;
  
  popup.innerHTML = `
    <style>
      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      @keyframes slideUp {
        from { transform: translateY(50px); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
      }
      @keyframes confetti {
        0% { transform: translateY(0) rotate(0deg); opacity: 1; }
        100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
      }
      .confetti {
        position: absolute;
        width: 10px;
        height: 10px;
        background: #10b981;
        animation: confetti 3s ease-out forwards;
      }
    </style>
    
    <!-- Confetti elements -->
    ${[...Array(20)].map((_, i) => `
      <div class="confetti" style="
        left: ${Math.random() * 100}%;
        top: -20px;
        background: ${['#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#8b5cf6'][Math.floor(Math.random() * 5)]};
        animation-delay: ${Math.random() * 0.5}s;
      "></div>
    `).join('')}
    
    <div style="font-size: 5rem; margin-bottom: 20px;">✅</div>
    
    <h2 style="color: #10b981; margin: 0 0 10px 0; font-size: 2rem;">
      Redeemed Successfully!
    </h2>
    
    <p style="font-size: 1.2rem; color: #374151; margin: 10px 0;">
      <strong>${rewardName}</strong>
    </p>
    
    <div style="background: linear-gradient(135deg, #10b981, #059669); color: white; padding: 20px; border-radius: 15px; margin: 20px 0;">
      <p style="margin: 0; font-size: 0.9rem; opacity: 0.9;">Credits Used</p>
      <p style="margin: 5px 0; font-size: 2.5rem; font-weight: 900;">-${cost}</p>
    </div>
    
    <div style="background: #f3f4f6; padding: 15px; border-radius: 10px; margin: 20px 0;">
      <p style="margin: 0; font-size: 0.9rem; color: #6b7280;">New Balance</p>
      <p style="margin: 5px 0; font-size: 2rem; font-weight: 700; color: #10b981;">${newBalance} Credits</p>
    </div>
    
    <p style="color: #6b7280; font-size: 0.95rem; margin: 20px 0;">
      🎁 Your reward will be delivered via email within 24 hours!
    </p>
    
    <button 
      onclick="document.getElementById('redemptionSuccessPopup').remove()"
      style="
        background: linear-gradient(135deg, #10b981, #059669);
        color: white;
        border: none;
        padding: 15px 40px;
        border-radius: 10px;
        font-size: 1.1rem;
        font-weight: 600;
        cursor: pointer;
        margin-top: 10px;
        transition: transform 0.2s;
      "
      onmouseover="this.style.transform='scale(1.05)'"
      onmouseout="this.style.transform='scale(1)'"
    >
      OK
    </button>
  `;
  
  overlay.appendChild(popup);
  document.body.appendChild(overlay);
  
  // Auto-close after 5 seconds
  setTimeout(() => {
    if (overlay.parentNode) {
      overlay.style.opacity = '0';
      setTimeout(() => overlay.remove(), 300);
    }
  }, 5000);
}



