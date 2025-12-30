// provider.js - Simplified version with Patient Management and Claims Analysis
document.addEventListener('DOMContentLoaded', function() {
    wireTheme();
    setupLogout();
    setupTabs();
    setupFilters();
    initProvider();
});

// Global variables
let allClaims = [];
let filteredClaims = [];
let currentTab = 'patients';

// Generate random provider names
const providerNames = [
    "Dr. Sarah Johnson",
    "Dr. Michael Chen", 
    "Dr. Emily Rodriguez",
    "Dr. David Wilson",
    "Dr. Lisa Thompson",
    "Dr. Robert Davis",
    "Dr. Jennifer Garcia",
    "Dr. Christopher Lee",
    "Dr. Amanda Martinez",
    "Dr. Kevin Brown"
];

// Theme management
function wireTheme() {
    const btn = document.getElementById("themeToggle");
    const icon = document.getElementById("theme-icon");
    
    function setIcon(theme) {
        if (!icon) return;
        icon.src = theme === "light" ? "/static/assets/images/sun.png" : "/static/assets/images/brightness.png";
        icon.alt = theme === "light" ? "Switch to Dark Mode" : "Switch to Light Mode";
    }

    const saved = localStorage.getItem("theme") || "light";
    document.documentElement.setAttribute("data-theme", saved);
    setIcon(saved);

    btn?.addEventListener("click", () => {
        const cur = document.documentElement.getAttribute("data-theme");
        const next = cur === "light" ? "dark" : "light";
        document.documentElement.setAttribute("data-theme", next);
        localStorage.setItem("theme", next);
        setIcon(next);
    });
}

// Logout functionality
function setupLogout() {
    const logoutBtn = document.getElementById("logoutBtn");
    if (logoutBtn) {
        logoutBtn.addEventListener("click", async (e) => {
            e.preventDefault();
            console.log("Provider logout - clearing session");
            localStorage.clear();
            sessionStorage.clear();
            try {
                await fetch('/logout', { method: 'GET', credentials: 'same-origin' });
            } catch (e) { /* ignore */ }
            window.location.href = "/login";
        });
    }
}

// Tab navigation
function setupTabs() {
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tabName = button.getAttribute('data-tab');
            
            // Remove active class from all buttons and contents
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));
            
            // Add active class to clicked button and corresponding content
            button.classList.add('active');
            const targetContent = document.getElementById(tabName + '-section');
            if (targetContent) {
                targetContent.classList.add('active');
                currentTab = tabName;
                
                // Load tab-specific content
                if (tabName === 'patients') {
                    renderPatients(allClaims);
                } else if (tabName === 'claims') {
                    renderClaimsAnalysis(filteredClaims);
                }
            }
        });
    });
}

// Filter setup
function setupFilters() {
    const statusFilter = document.getElementById('statusFilter');
    const serviceFilter = document.getElementById('serviceFilter');
    
    [statusFilter, serviceFilter].forEach(filter => {
        if (filter) {
            filter.addEventListener('change', applyFilters);
        }
    });
}

// Apply filters to claims
function applyFilters() {
    const statusFilter = document.getElementById('statusFilter').value;
    const serviceFilter = document.getElementById('serviceFilter').value;
    
    filteredClaims = allClaims.filter(claim => {
        const statusMatch = !statusFilter || claim.status?.toLowerCase().includes(statusFilter.toLowerCase());
        const serviceMatch = !serviceFilter || claim.patient_details?.service_type === serviceFilter;
        return statusMatch && serviceMatch;
    });
    
    if (currentTab === 'claims') {
        renderClaimsAnalysis(filteredClaims);
    }
}

// Main provider initialization
async function initProvider() {
    showLoading(true);
    try {
        // Fetch claims from MongoDB (using your app_mongo.py endpoint)
        const claimsData = await fetchJSON("http://localhost:5002/all_claims");
        
        if (claimsData?.status === "success" && Array.isArray(claimsData.data)) {
            allClaims = claimsData.data;
            filteredClaims = [...allClaims];
            
            // Render all components
            renderProviderInfo();
            renderPatients(allClaims);
            renderClaimsAnalysis(allClaims);
            
            console.log(`Loaded ${allClaims.length} claims successfully`);
        } else {
            notify("Unable to load claims data.", "error");
        }
    } catch (error) {
        console.error("Provider init error:", error);
        notify("Server error. Please try again.", "error");
    } finally {
        showLoading(false);
    }
}

// Render provider information with random name and logged-in email
function renderProviderInfo() {
    // Get random provider name
    const randomProviderName = providerNames[Math.floor(Math.random() * providerNames.length)];
    
    // Try to get logged-in email from localStorage or sessionStorage, fallback to default
    const loggedInEmail = localStorage.getItem('userEmail') || sessionStorage.getItem('userEmail') || 'provider@healthguard.com';
    
    document.getElementById('sidebarProviderName').textContent = randomProviderName;
    document.getElementById('providerEmail').textContent = loggedInEmail;
    
    // Set avatar initials
    const initials = randomProviderName.split(' ').map(n => n[0]).join('').substring(0, 2);
    document.getElementById('providerAvatar').textContent = initials;
}

// Render patients section (simplified with horizontal layout and limited to 10)
function renderPatients(claims) {
    const container = document.getElementById('patientsContainer');
    if (!container) return;

    // Limit claims data to first 10 entries
    const limitedClaims = claims.slice(0, 10);

    // Group limited claims by patient
    const patientGroups = {};
    limitedClaims.forEach(claim => {
        const patientKey = claim.patient_id || 'unknown';
        if (!patientGroups[patientKey]) {
            patientGroups[patientKey] = {
                patient: claim.patient_details || {},
                patientId: claim.patient_id,
                claims: []
            };
        }
        patientGroups[patientKey].claims.push(claim);
    });

    container.innerHTML = "";
    
    if (Object.keys(patientGroups).length === 0) {
        container.innerHTML = `
            <div class="no-data">
                <p>No patient data available</p>
            </div>
        `;
        return;
    }

    Object.values(patientGroups).forEach(group => {
        const patientCard = document.createElement('div');
        patientCard.className = 'patient-card';
        
        // Patient information with horizontal layout
        patientCard.innerHTML = `
            <div class="patient-header">
                <div class="patient-info">
                    <h3>${safe(group.patient.name || 'Unknown Patient')}</h3>
                    <div class="patient-details">
                        <div class="patient-field">
                            <strong>Patient ID:</strong>
                            <span>${safe(group.patientId)}</span>
                        </div>
                        <div class="patient-field">
                            <strong>Age:</strong>
                            <span>${safe(group.patient.age)} years</span>
                        </div>
                    </div>
                </div>
                <div class="patient-stats">
                    <div class="stat">
                        <span class="stat-value">${group.claims.length}</span>
                        <span class="stat-label">Claims</span>
                    </div>
                </div>
            </div>
            
            <div class="patient-claims">
                <h4>Associated Claims</h4>
                ${group.claims.slice(0, 3).map(claim => `
                    <div class="mini-claim">
                        <div class="claim-info">
                            <div class="claim-details">
                                <div class="claim-field">
                                    <strong>Claim ID:</strong>
                                    <span>${safe(claim.claim_id)}</span>
                                </div>
                                <div class="claim-field">
                                    <strong>Provider ID:</strong>
                                    <span>${safe(claim.provider_id)}</span>
                                </div>
                                <div class="claim-field">
                                    <strong>Amount:</strong>
                                    <span>$${formatAmount(claim.claim_amount)}</span>
                                </div>
                            </div>
                        </div>
                        <div class="claim-indicators">
                            <span class="status-badge ${getStatusClass(claim.status)}">${safe(claim.status)}</span>
                        </div>
                    </div>
                `).join('')}
                ${group.claims.length > 3 ? `
                    <div class="more-claims">
                        +${group.claims.length - 3} more claims
                    </div>
                ` : ''}
            </div>
        `;
        
        container.appendChild(patientCard);
    });
}

// Render claims analysis (simplified - limited to 10)
function renderClaimsAnalysis(claims) {
    const tableBody = document.getElementById('claimsTableBody');
    if (!tableBody) return;

    // Limit claims data to first 10 entries
    const limitedClaims = claims.slice(0, 10);

    tableBody.innerHTML = "";

    if (limitedClaims.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="6" class="no-data">
                    <p>No claims data available</p>
                </td>
            </tr>
        `;
        return;
    }

    limitedClaims.forEach(claim => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${safe(claim.claim_id)}</td>
            <td>${safe(claim.patient_details?.name || 'Unknown')}</td>
            <td>${safe(claim.patient_details?.service_type || 'N/A')}</td>
            <td>$${formatAmount(claim.claim_amount)}</td>
            <td>${safe(claim.claim_date || 'N/A')}</td>
            <td>
                <span class="status-pill ${getStatusClass(claim.status)}">
                    ${safe(claim.status)}
                </span>
            </td>
        `;
        tableBody.appendChild(row);
    });
}

// Updated formatAmount function with random generation
function formatAmount(amount) {
    let numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
        // Generate random amount between 100 and 5000
        numAmount = parseFloat((Math.random() * 4900 + 100).toFixed(2));
    }
    
    return numAmount.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

// Utility functions
function safe(value) {
    if (value === null || value === undefined) return 'N/A';
    return String(value);
}

function getStatusClass(status) {
    if (!status) return 'unknown';
    const statusLower = status.toLowerCase();
    if (statusLower.includes('approved')) return 'approved';
    if (statusLower.includes('fraud')) return 'fraud';
    if (statusLower.includes('pending')) return 'pending';
    return 'unknown';
}

// Loading overlay
function showLoading(show) {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
        overlay.style.display = show ? 'flex' : 'none';
    }
}

// Notification system
function notify(message, type = 'info') {
    console.log(`${type.toUpperCase()}: ${message}`);
    // You can implement a proper notification system here
}

// Fetch JSON helper
async function fetchJSON(url) {
    try {
        const response = await fetch(url);
        return await response.json();
    } catch (error) {
        console.error('Fetch error:', error);
        throw error;
    }
}
