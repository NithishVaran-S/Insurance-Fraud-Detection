document.addEventListener("DOMContentLoaded", () => {
    // -----------------------
    // DOM refs (match your HTML)
    // -----------------------
    const themeToggle = document.getElementById("themeToggle");
    const themeIcon = document.getElementById("theme-icon");
    const tabButtons = document.querySelectorAll(".tab-btn");
    const tabContents = document.querySelectorAll(".tab-content");
    const auditTable = document.getElementById("auditTable");
    const auditTableBody = auditTable?.querySelector("tbody");
    const statusFilter = document.getElementById("statusFilter");
    const riskFilter = document.getElementById("riskFilter");
    const claimsSearchInput = document.getElementById("claimsSearchInput");
    const refreshBtn = document.getElementById("refreshBtn");
    const exportCsvBtn = document.getElementById("exportCsvBtn");
    const logoutBtn = document.querySelector(".logout-btn");
    const detectionRateEl = document.getElementById("detectionRate"); 

    // Modal elements (exact IDs from your HTML)
    const reviewModal = document.getElementById("claimReviewModal");
    const closeReviewModal = document.getElementById("closeReviewModal");
    const saveReviewBtn = document.getElementById("saveReviewBtn");
    const reviewNotes = document.getElementById("reviewNotes");
    const reviewActionBtns = document.querySelectorAll(".review-action");

    // KPI / Dashboard elements
    const fraudDetectedCount = document.getElementById("fraudDetectedCount");
    const recoveryAmountEl = document.getElementById("recoveryAmount");
    const roiValueEl = document.getElementById("roiValue");
    const lastDashboardUpdate = document.getElementById("lastDashboardUpdate");
    const fraudAlertsList = document.getElementById("fraudAlertsList");
    const alertCountEl = document.getElementById("alertCount");

    // -----------------------
    // Chart.js Configuration
    // -----------------------
    const chartColors = {
        primary: '#0369a1',
        secondary: '#0891b2', 
        success: '#22c55e',
        danger: '#ef4444',
        warning: '#f59e0b',
        info: '#06b6d4',
        light: '#f8fafc',
        dark: '#1e293b'
    };

    // Chart instances
    const dashboardCharts = {};

    // -----------------------
    // State
    // -----------------------
    let claimsData = []; // original dataset
    let filteredData = []; // filtered view
    let currentClaimId = null;
    let selectedAction = null;

    // -----------------------
    // Helpers
    // -----------------------
    const safe = (el) => el ?? null;
    const sanitizeClass = (s) => String(s || "")
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-_]/g, "");

    const formatCurrency = (v) => {
        const n = Number(v) || 0;
        return `$${n.toLocaleString()}`;
    };

    // -----------------------
    // Theme toggle
    // -----------------------
    (function initTheme() {
        const savedTheme = localStorage.getItem("theme") || "light";
        document.documentElement.setAttribute("data-theme", savedTheme);
        
        if (themeIcon) {
            themeIcon.src = savedTheme === "light" 
                ? "static/assets/images/sun.png" 
                : "static/assets/images/brightness.png";
        }

        themeToggle?.addEventListener("click", () => {
            const cur = document.documentElement.getAttribute("data-theme");
            const next = cur === "light" ? "dark" : "light";
            document.documentElement.setAttribute("data-theme", next);
            localStorage.setItem("theme", next);
            
            if (themeIcon) {
                themeIcon.src = next === "light" 
                    ? "static/assets/images/sun.png" 
                    : "static/assets/images/brightness.png";
            }
        });
    })();

    // -----------------------
    // Tabs
    // -----------------------
    function activateTab(tab) {
        tabButtons.forEach((b) => b.classList.remove("active"));
        tabContents.forEach((c) => c.classList.remove("active"));
        
        const btn = Array.from(tabButtons).find((b) => b.dataset.tab === tab);
        const sec = document.getElementById(tab + "-section");
        
        if (btn) btn.classList.add("active");
        if (sec) sec.classList.add("active");
    }

    tabButtons.forEach((btn) => 
        btn.addEventListener("click", () => activateTab(btn.dataset.tab))
    );

    // -----------------------
    // Chart Creation Functions
    // -----------------------
    function createROIChart() {
    const ctx = document.getElementById('roiChart');
    if (!ctx || !claimsData.length) return;

    if (dashboardCharts.roi) dashboardCharts.roi.destroy();

    // Use the 30 fetched ROI values
    const roiValues = claimsData.slice(0, 30).map(c => parseFloat(c.roi) || 0);
    const labels = claimsData.slice(0, 30).map((c, i) => `Claim ${i + 1}`);

    dashboardCharts.roi = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'ROI',
                data: roiValues,
                borderColor: chartColors.success,
                backgroundColor: chartColors.success + '20',
                fill: true,
                tension: 0.4,
                pointRadius: 6,
                pointHoverRadius: 8,
                pointBackgroundColor: chartColors.success,
                pointBorderColor: '#fff',
                pointBorderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `ROI: ${context.parsed.y.toFixed(2)}`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: 'rgba(0,0,0,0.1)' },
                    ticks: { color: '#6b7280' }
                },
                x: {
                    grid: { color: 'rgba(0,0,0,0.1)' },
                    ticks: { color: '#6b7280' }
                }
            }
        }
    });
}

    function createPredictionsChart() {
    const ctx = document.getElementById('predictionsChart');
    if (!ctx) return;

    // Destroy existing chart if it exists
    if (dashboardCharts.predictions) {
        dashboardCharts.predictions.destroy();
    }

    // Define statuses
    const fraudStatuses = ["fraud"];
    const nonFraudStatuses = ["not fraud", "approved"];

    // Count fraud and non-fraud
    let fraudCount = 0;
    let nonFraudCount = 0;

    claimsData.forEach(claim => {
        const status = (claim.status || "").toLowerCase().trim();
        if (fraudStatuses.includes(status)) {
            fraudCount++;
        } else if (nonFraudStatuses.includes(status)) {
            nonFraudCount++;
        } else {
            // Treat any other or suspicious status as non-fraud (or adjust as needed)
            nonFraudCount++;
        }
    });

    const dataValues = [fraudCount, nonFraudCount];

    // Create doughnut chart
    dashboardCharts.predictions = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Fraud', 'Non-Fraud'],
            datasets: [{
                data: dataValues,
                backgroundColor: [chartColors.danger, chartColors.success],
                borderWidth: 3,
                borderColor: '#fff',
                hoverOffset: 10
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '60%',
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        usePointStyle: true,
                        padding: 20,
                        font: { size: 12 }
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    titleColor: '#fff',
                    bodyColor: '#fff',
                    callbacks: {
                        label: function(context) {
                            const total = dataValues.reduce((a, b) => a + b, 0);
                            const percentage = total ? ((context.parsed / total) * 100).toFixed(1) : 0;
                            return `${context.label}: ${context.parsed} (${percentage}%)`;
                        }
                    }
                }
            }
        }
    });
}


    function createRiskLevelsChart() {
    const ctx = document.getElementById('riskLevelsChart');
    if (!ctx) return;

    // Destroy existing chart if it exists
    if (dashboardCharts.riskLevels) {
        dashboardCharts.riskLevels.destroy();
    }

    // Count risk levels
    const riskCounts = { High: 0, Medium: 0, Low: 0 };

    claimsData.forEach(claim => {
        const risk = (claim.fraud_risk || "").trim();
        if (riskCounts.hasOwnProperty(risk)) {
            riskCounts[risk]++;
        }
    });

    const dataValues = Object.values(riskCounts);

    // Create doughnut chart
    dashboardCharts.riskLevels = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: Object.keys(riskCounts),
            datasets: [{
                data: dataValues,
                backgroundColor: [chartColors.danger, chartColors.warning, chartColors.success],
                borderColor: '#fff',
                borderWidth: 3,
                hoverOffset: 10
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '60%',
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        usePointStyle: true,
                        padding: 20,
                        font: { size: 12 }
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    titleColor: '#fff',
                    bodyColor: '#fff',
                    callbacks: {
                        label: function(context) {
                            const total = dataValues.reduce((a, b) => a + b, 0);
                            const percentage = total ? ((context.parsed / total) * 100).toFixed(1) : 0;
                            return `${context.label}: ${context.parsed} (${percentage}%)`;
                        }
                    }
                }
            }
        }
    });
}


    function createAmountDistributionChart() {
    const ctx = document.getElementById('amountDistributionChart');
    if (!ctx || !claimsData.length) return;

    // Destroy existing chart
    if (dashboardCharts.amountDistribution) {
        dashboardCharts.amountDistribution.destroy();
    }

    // Map risk levels to numeric values
    const riskMapping = { 'Low': 1, 'Medium': 2, 'High': 3 };

    // Prepare data for line chart
    const labels = claimsData.map((c, i) => `Claim ${i + 1}`);
    const amountData = claimsData.map(c => c.amount || 0);
    const riskData = claimsData.map(c => riskMapping[c.fraud_risk] || 0);
    const predictionData = claimsData.map(c => (c.prediction_score || 0) * 100);

    dashboardCharts.amountDistribution = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Claim Amount ($)',
                    data: amountData,
                    borderColor: chartColors.primary,
                    backgroundColor: chartColors.primary + '20',
                    fill: true,
                    tension: 0.3,
                    pointRadius: 4,
                    yAxisID: 'yAmount'
                },
                {
                    label: 'Fraud Risk (Numeric)',
                    data: riskData,
                    borderColor: chartColors.warning,
                    backgroundColor: chartColors.warning + '20',
                    fill: false,
                    tension: 0.3,
                    pointRadius: 4,
                    yAxisID: 'yRisk'
                },
                {
                    label: 'Prediction Score (%)',
                    data: predictionData,
                    borderColor: chartColors.danger,
                    backgroundColor: chartColors.danger + '20',
                    fill: false,
                    tension: 0.3,
                    pointRadius: 4,
                    yAxisID: 'yRisk'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false
            },
            plugins: {
                legend: {
                    position: 'top',
                    labels: { font: { size: 12 } }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `${context.dataset.label}: ${context.parsed.y.toLocaleString()}`;
                        }
                    }
                }
            },
            scales: {
                yAmount: {
                    type: 'linear',
                    position: 'left',
                    title: { display: true, text: 'Claim Amount ($)' },
                    beginAtZero: true,
                    grid: { color: 'rgba(0,0,0,0.1)' },
                    ticks: { color: '#6b7280' }
                },
                yRisk: {
                    type: 'linear',
                    position: 'right',
                    title: { display: true, text: 'Risk / Prediction Score' },
                    beginAtZero: true,
                    min: 0,
                    max: 3.5,
                    grid: { drawOnChartArea: false },
                    ticks: { color: '#6b7280' }
                },
                x: {
                    grid: { color: 'rgba(0,0,0,0.1)' },
                    ticks: { color: '#6b7280' }
                }
            }
        }
    });
}


    function createProviderAnalysisChart() {
        const ctx = document.getElementById('providerAnalysisChart');
        if (!ctx) return;

        // Destroy existing chart
        if (dashboardCharts.providerAnalysis) {
            dashboardCharts.providerAnalysis.destroy();
        }

        // Analyze top 5 providers by fraud risk
        const providerStats = {};
        claimsData.forEach(claim => {
            if (!providerStats[claim.provider_id]) {
                providerStats[claim.provider_id] = { total: 0, fraudulent: 0 };
            }
            providerStats[claim.provider_id].total++;
            if (claim.fraud_risk === 'High' || claim.status.toLowerCase().includes('fraud')) {
                providerStats[claim.provider_id].fraudulent++;
            }
        });

        // Get top 5 providers by total claims
        const topProviders = Object.entries(providerStats)
            .sort(([,a], [,b]) => b.total - a.total)
            .slice(0, 5);

        dashboardCharts.providerAnalysis = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: topProviders.map(([id]) => id),
                datasets: [{
                    label: 'Total Claims',
                    data: topProviders.map(([,stats]) => stats.total),
                    backgroundColor: chartColors.info + '80',
                    borderRadius: 4
                }, {
                    label: 'High Risk Claims',
                    data: topProviders.map(([,stats]) => stats.fraudulent),
                    backgroundColor: chartColors.danger,
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                indexAxis: 'y',
                plugins: {
                    legend: {
                        position: 'top',
                        labels: {
                            font: {
                                size: 12
                            }
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        titleColor: '#fff',
                        bodyColor: '#fff'
                    }
                },
                scales: {
                    x: {
                        beginAtZero: true,
                        grid: {
                            color: 'rgba(0, 0, 0, 0.1)'
                        },
                        ticks: {
                            color: '#6b7280'
                        }
                    },
                    y: {
                        grid: {
                            display: false
                        },
                        ticks: {
                            color: '#6b7280'
                        }
                    }
                }
            }
        });
    }

    function createAccuracyTrendChart() {
    const ctx = document.getElementById('accuracyTrendChart');
    if (!ctx || !claimsData.length) return;

    if (dashboardCharts.accuracyTrend) dashboardCharts.accuracyTrend.destroy();

    const labels = claimsData.slice(0, 30).map((_, i) => `Claim ${i + 1}`);
    const accuracyData = claimsData.slice(0, 30).map(c => {
        const numerator = (c.tp || 0) + (c.tn || 0);
        const denominator = (c.tp || 0) + (c.tn || 0) + (c.fp || 0) + (c.fn || 0);
        return denominator > 0 ? (numerator / denominator) * 100 : 0;
    });

    dashboardCharts.accuracyTrend = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Detection Accuracy %',
                data: accuracyData,
                borderColor: chartColors.primary,
                backgroundColor: chartColors.primary + '20',
                fill: true,
                tension: 0.3,
                pointRadius: 4,
                pointBackgroundColor: chartColors.primary,
                pointBorderColor: '#fff',
                pointBorderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `Accuracy: ${context.parsed.y.toFixed(1)}%`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: false,
                    min: 0,
                    max: 100,
                    grid: { color: 'rgba(0,0,0,0.1)' },
                    ticks: { callback: v => v + '%', color: '#6b7280' }
                },
                x: {
                    grid: { color: 'rgba(0,0,0,0.1)' },
                    ticks: { color: '#6b7280' }
                }
            }
        }
    });
}


    // -----------------------
    // Chart Management Functions
    // -----------------------
    function createAllCharts() {
        if (claimsData.length === 0) return;
        
        // Add a small delay to ensure DOM is ready
        setTimeout(() => {
            createROIChart();
            createPredictionsChart();
            createRiskLevelsChart();
            createAmountDistributionChart();
            createProviderAnalysisChart();
            createAccuracyTrendChart();
        }, 100);
    }

    function updateAllCharts() {
        // Destroy existing charts
        Object.values(dashboardCharts).forEach(chart => {
            if (chart) chart.destroy();
        });
        
        // Clear the charts object
        Object.keys(dashboardCharts).forEach(key => {
            delete dashboardCharts[key];
        });
        
        // Recreate charts with new data
        createAllCharts();
    }

    // -----------------------
    // Fetch / load claims
    // -----------------------
    async function fetchClaims() {
        try {
            // Show loading state
            if (auditTableBody) {
                auditTableBody.innerHTML = `
                    <tr>
                        <td colspan="8" class="table-help">
                            🔄 Loading claims data...
                        </td>
                    </tr>
                `;
            }

            console.log("Fetching claims from backend..."); // Debug log

            // Fetch from your Flask backend
            const res = await fetch("http://localhost:5002/all_claims");
            
            if (!res.ok) {
                throw new Error(`HTTP error! status: ${res.status}`);
            }
            
            const json = await res.json();
            console.log("Received data:", json); // Debug log
            
            // Handle response format
            if (json.status === "error") {
                throw new Error(json.message || "Server error");
            }
            
            const data = json.status === "success" ? (json.data || []) : (Array.isArray(json) ? json : []);
            
            // normalize fields to match frontend expectations
            claimsData = data.map((c) => ({
                claim_id: c.claim_id ?? c.id ?? "",
                patient_id: c.patient_id ?? "",
                provider_id: c.provider_id ?? "",
                amount: Number(c.amount ?? c.amount_claimed ?? 0),
                status: (c.status ?? "Unknown").toString(),
                fraud_risk: (c.fraud_risk ?? c.risk ?? "").toString(),
                prediction_score: typeof c.prediction_score === "number" 
                    ? c.prediction_score : parseFloat(c.prediction_score || 0),
                reason: c.llm_message ?? c.reason ?? c.detection_reason ?? "No reason provided",
                review_notes: c.review_notes ?? "",
                roi: parseFloat(c.roi || 0), 
                review_status: c.review_status ?? null,
                patient_details: c.patient_details ?? {},
                // keep full object to reference other props if needed
                __raw: c,
                tp: parseFloat(c.TP || 0),
                tn: parseFloat(c.FN || 0),
                fp: parseFloat(c.FP || 0),
                fn: parseFloat(c.FN || 0)
            }));

            console.log("Processed claims data:", claimsData); // Debug log

            // sort newest first by claim_id (lexicographic fallback)
            claimsData.sort((a, b) => (b.claim_id || "").localeCompare(a.claim_id || ""));

            // initialize filteredData + render
            filterAndRender();
            updateDashboard();

        } catch (err) {
            console.error("fetchClaims error:", err);
            
            // show friendly fallback row
            if (auditTableBody) {
                auditTableBody.innerHTML = `
                    <tr>
                        <td colspan="8" class="table-help" style="color: red;">
                            ❌ Error loading claims data: ${err.message}
                            <br><small>Make sure the backend server is running on port 5001</small>
                            <br><small>Check browser console for more details</small>
                        </td>
                    </tr>
                `;
            }
        }
    }

    // -----------------------
    // Filter and Render Functions
    // -----------------------
    function filterAndRender() {
        filteredData = claimsData.filter((claim) => {
            const statusMatch = !statusFilter?.value || statusFilter.value === "all" || 
                               claim.status.toLowerCase().includes(statusFilter.value.toLowerCase());
            
            const riskMatch = !riskFilter?.value || riskFilter.value === "all" || 
                             claim.fraud_risk.toLowerCase() === riskFilter.value.toLowerCase();
            
            const searchMatch = !claimsSearchInput?.value || 
                               claim.claim_id.toLowerCase().includes(claimsSearchInput.value.toLowerCase()) ||
                               claim.patient_id.toLowerCase().includes(claimsSearchInput.value.toLowerCase()) ||
                               claim.provider_id.toLowerCase().includes(claimsSearchInput.value.toLowerCase());

            return statusMatch && riskMatch && searchMatch;
        });

        renderClaimsTable();
    }

    function renderClaimsTable() {
        if (!auditTableBody) return;

        if (filteredData.length === 0) {
            auditTableBody.innerHTML = `
                <tr>
                    <td colspan="8" class="table-help">
                        ${claimsData.length === 0 ? "No claims data available" : "No claims match your filters"}
                    </td>
                </tr>
            `;
            return;
        }

        auditTableBody.innerHTML = filteredData.map((claim) => {
            const statusClass = sanitizeClass(claim.status);
            const riskClass = sanitizeClass(claim.fraud_risk);
            
            // Truncate reason for table display
            const truncatedReason = claim.reason && claim.reason.length > 100 
                ? claim.reason.substring(0, 100) + "..." 
                : claim.reason || "No reason provided";
            
            return `
                <tr>
                    <td>
                        <button class="link-btn" onclick="openClaimModal('${claim.claim_id}')">
                            ${claim.claim_id || 'N/A'}
                        </button>
                    </td>
                    <td>${claim.patient_id || 'N/A'}</td>
                    <td>${claim.provider_id || 'N/A'}</td>
                    <td class="numeric">${formatCurrency(claim.amount)}</td>
                    <td>
                        <span class="claim-status status-${statusClass}">
                            ${claim.status}
                        </span>
                    </td>
                    <td>
                        <span class="claim-status status-${riskClass}">
                            ${claim.fraud_risk}
                        </span>
                    
                    <td>
                        <button class="btn-primary" onclick="openClaimModal('${claim.claim_id}')">
                            Review
                        </button>
                    </td>
                </tr>
            `;
        }).join("");
    }

    // -----------------------
    // Dashboard Update
    // -----------------------
    function updateDashboard() {

    if (claimsData.length === 0) return;

    // Calculate KPIs from actual data
    const suspiciousClaims = claimsData.filter(c => 
        c.fraud_risk === "High" || c.status?.toLowerCase().includes("fraud")
    ).length;

    const totalAmount = claimsData.reduce((sum, c) => sum + c.amount, 0);
    
    const fraudClaimsAmount = claimsData
    .filter(c => c.fraud_risk.toLowerCase() === "high" || c.status.toLowerCase().includes("fraud"))
    .reduce((sum, c) => sum + c.amount, 0);
    
    // **FIXED ROI Calculation**
    const avgClaimAmount = totalAmount / claimsData.length || 1500; // Default average
    const preventedFraudAmount = suspiciousClaims * avgClaimAmount; // Total fraud prevented
    const recoveredAmount = preventedFraudAmount * 0.15; // 15% recovery rate
    const operationalCost = 25000; // Lower monthly operational cost

    // Use first 30 claims
    const accuracyValues = claimsData.slice(0, 30).map(c => {
        const numerator = (c.tp || 0) + (c.tn || 0);
        const denominator = (c.tp || 0) + (c.tn || 0) + (c.fp || 0) + (c.fn || 0);
        return denominator > 0 ? (numerator / denominator) * 100 : 0;
    });

    // Average accuracy for KPI
    const avgAccuracy = accuracyValues.length > 0 
        ? accuracyValues.reduce((sum, val) => sum + val, 0) / accuracyValues.length 
        : 0;
    
    // Calculate ROI as a multiplier (not percentage)
    const roiValues = claimsData.slice(0, 30).map(c => parseFloat(c.roi) || 0);
    const avgROI = roiValues.length > 0 
        ? roiValues.reduce((sum, val) => sum + val, 0) / roiValues.length 
        : 0;
    // Update KPI elements
    if (fraudDetectedCount) fraudDetectedCount.textContent = suspiciousClaims;
    if (roiValueEl) roiValueEl.textContent = avgROI.toFixed(2); // Show exact ROI
    if (detectionRateEl) detectionRateEl.textContent = `${avgAccuracy.toFixed(1)}%`;
    if (recoveryAmountEl) recoveryAmountEl.textContent = formatCurrency(fraudClaimsAmount);

    // Update timestamp
    if (lastDashboardUpdate) {
        lastDashboardUpdate.textContent = new Date().toLocaleString();
    }

    // Update alerts
    updateFraudAlerts();
    
    // Create/Update charts
    createAllCharts();
}


    function updateFraudAlerts() {
        if (!fraudAlertsList) return;

        const highRiskClaims = claimsData
            .filter(c => c.fraud_risk === "High")
            .slice(0, 5); // Show top 5

        if (alertCountEl) alertCountEl.textContent = highRiskClaims.length;

        fraudAlertsList.innerHTML = highRiskClaims.map(claim => `
            <div class="fraud-alert-item high-risk">
                <div class="alert-header">
                    <strong>Claim ${claim.claim_id}</strong>
                    <span class="alert-score">HIGH</span>
                </div>
                <div class="alert-details">
                    Provider: ${claim.provider_id} | Amount: ${formatCurrency(claim.amount)}
                    <br>Risk Score: ${(claim.prediction_score * 100).toFixed(1)}%
                </div>
            </div>
        `).join("");
    }

    // -----------------------
    // Modal Functions
    // -----------------------
    function populateClaimModal(claim) {
        // Basic claim information
        const claimIdField = document.querySelector('#modalClaimId');
        const patientIdField = document.querySelector('#modalPatientId');
        const providerIdField = document.querySelector('#modalProviderId');
        const amountField = document.querySelector('#modalAmount');
        const statusField = document.querySelector('#modalStatus');
        const riskField = document.querySelector('#modalRisk');
        const reasonField = document.querySelector('#modalReason');

        if (claimIdField) claimIdField.textContent = claim.claim_id || 'N/A';
        if (patientIdField) patientIdField.textContent = claim.patient_id || 'N/A';
        if (providerIdField) providerIdField.textContent = claim.provider_id || 'N/A';
        if (amountField) amountField.textContent = formatCurrency(claim.amount);
        
        // Fix status display - show the actual prediction status
        if (statusField) statusField.textContent = claim.status || 'Unknown';
        
        // Fix fraud risk display
        if (riskField) riskField.textContent = claim.fraud_risk || 'Unknown';
        
        // Fix reason display - show the LLM message/reason
        if (reasonField) reasonField.textContent = claim.reason || 'No reason provided';

        // Populate patient details if available
        if (claim.patient_details) {
            const patientName = document.querySelector('#modalPatientName');
            const patientAge = document.querySelector('#modalPatientAge');
            const patientInsurance = document.querySelector('#modalPatientInsurance');
            const serviceType = document.querySelector('#modalServiceType');

            if (patientName) patientName.textContent = claim.patient_details.name || 'N/A';
            if (patientAge) patientAge.textContent = claim.patient_details.age || 'N/A';
            if (patientInsurance) patientInsurance.textContent = claim.patient_details.insurance || 'N/A';
            if (serviceType) serviceType.textContent = claim.patient_details.service_type || 'N/A';
        }

        // Update fraud risk circle
        updateFraudRiskDisplay(claim);
    }

    function updateFraudRiskDisplay(claim) {
        const riskBox = document.querySelector('.risk-box');
        const riskScore = document.querySelector('.risk-score');
        const riskLabel = document.querySelector('.risk-label');
        
        if (riskScore) {
            // Display the prediction score as percentage
            const score = (claim.prediction_score || 0) * 100;
            riskScore.textContent = `${score.toFixed(1)}%`;
        }
        
        if (riskLabel) {
            riskLabel.textContent = claim.fraud_risk || 'Unknown';
        }
        
        // Change risk box color based on risk level
        if (riskBox) {
            const risk = claim.fraud_risk?.toLowerCase();
            if (risk === 'high') {
                riskBox.style.background = 'linear-gradient(135deg, #ef4444, #dc2626)';
            } else if (risk === 'medium') {
                riskBox.style.background = 'linear-gradient(135deg, #f59e0b, #d97706)';
            } else if (risk === 'low') {
                riskBox.style.background = 'linear-gradient(135deg, #22c55e, #16a34a)';
            } else {
                riskBox.style.background = 'linear-gradient(135deg, #00c6ff, #0072ff)';
            }
        }
    }

    window.openClaimModal = function(claimId) {
        const claim = claimsData.find(c => c.claim_id === claimId);
        if (!claim || !reviewModal) return;

        currentClaimId = claimId;
        
        // Populate modal with claim data
        populateClaimModal(claim);

        reviewModal.style.display = 'flex';
        reviewModal.setAttribute('aria-hidden', 'false');
    };

    // Close modal
    closeReviewModal?.addEventListener('click', () => {
        if (reviewModal) {
            reviewModal.style.display = 'none';
            reviewModal.setAttribute('aria-hidden', 'true');
        }
    });

    // Close modal when clicking outside
    reviewModal?.addEventListener('click', (e) => {
        if (e.target === reviewModal) {
            reviewModal.style.display = 'none';
            reviewModal.setAttribute('aria-hidden', 'true');
        }
    });

    // -----------------------
    // Event Listeners
    // -----------------------
    refreshBtn?.addEventListener('click', () => {
        fetchClaims();
    });

    statusFilter?.addEventListener('change', filterAndRender);
    riskFilter?.addEventListener('change', filterAndRender);
    claimsSearchInput?.addEventListener('input', filterAndRender);

    exportCsvBtn?.addEventListener('click', () => {
        exportToCSV(filteredData);
    });

    // Review action buttons
    reviewActionBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            reviewActionBtns.forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            selectedAction = btn.dataset.action;
        });
    });

    saveReviewBtn?.addEventListener('click', () => {
        if (currentClaimId && selectedAction) {
            saveReview(currentClaimId, selectedAction, reviewNotes?.value || '');
        }
    });

    logoutBtn?.addEventListener('click', () => {
        // Implement logout functionality
        console.log('Logout clicked');
    });

    // -----------------------
    // Utility Functions
    // -----------------------
    function exportToCSV(data) {
        const headers = ['Claim ID', 'Patient ID', 'Provider ID', 'Amount', 'Status', 'Fraud Risk', 'Prediction Score', 'Reason'];
        const csvContent = [
            headers.join(','),
            ...data.map(claim => [
                claim.claim_id,
                claim.patient_id,
                claim.provider_id,
                claim.amount,
                claim.status,
                claim.fraud_risk,
                claim.prediction_score,
                `"${(claim.reason || '').replace(/"/g, '""')}"`
            ].join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `fraud_claims_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
        window.URL.revokeObjectURL(url);
    }

    function saveReview(claimId, action, notes) {
        // This would normally send data to backend
        console.log('Saving review:', { claimId, action, notes });
        
        // Update local data
        const claim = claimsData.find(c => c.claim_id === claimId);
        if (claim) {
            claim.review_status = action;
            claim.review_notes = notes;
        }

        // Close modal
        if (reviewModal) {
            reviewModal.style.display = 'none';
            reviewModal.setAttribute('aria-hidden', 'true');
        }

        // Refresh display
        filterAndRender();
        
        // Show success message
        alert('Review saved successfully!');
    }

    // -----------------------
    // Initialize
    // -----------------------
    
    // Set default active tab
    activateTab('dashboard');
    
    // Load claims data on startup
    fetchClaims();
    
    // Auto-refresh every 5 minutes
    setInterval(fetchClaims, 5 * 60 * 1000);
});

// Make functions globally available for inline onclick handlers
window.openClaimModal = window.openClaimModal || function(claimId) {
    console.log('Opening claim modal for:', claimId);
};
