document.addEventListener('DOMContentLoaded', function () {
  // Elements
  const themeToggle = document.getElementById('themeToggle');
  const themeIcon = document.getElementById('theme-icon');
  const loginForm = document.getElementById('loginForm');
  const loginStep = document.getElementById('loginStep');
  const otpStep = document.getElementById('otpStep');
  const loginBtn = document.getElementById('loginBtn');
  const verifyOtpBtn = document.getElementById('verifyOtpBtn');
  const backToLogin = document.getElementById('backToLogin');
  const resendBtn = document.getElementById('resendBtn');
  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');
  const togglePassword = document.getElementById('togglePassword');
  const userTabs = document.querySelectorAll('.user-tab');
  const otpInputs = document.querySelectorAll('.otp-input');
  const maskedEmail = document.getElementById('maskedEmail');
  const countdown = document.getElementById('countdown');
  const timerText = document.getElementById('timerText');

  // Forgot password modal
  const forgotPasswordBtn = document.getElementById('forgotPasswordBtn');
  const forgotModal = document.getElementById('forgotModal');
  const closeForgot = document.getElementById('closeForgot');
  const forgotForm = document.getElementById('forgotForm');
  const forgotEmail = document.getElementById('forgotEmail');
  const newPassword = document.getElementById('newPassword');
  const confirmPassword = document.getElementById('confirmPassword');
  const forgotUserType = document.getElementById('forgotUserType');

  let selectedUserType = 'patient';
  let otpTimer = null;
  let timeLeft = 60;

  // ---------------- THEME ----------------
  function updateThemeIcon(theme) {
    if (theme === 'light') {
      themeIcon.src = '/static/assets/images/sun.png';
      themeIcon.alt = 'Switch to Dark Mode';
    } else {
      themeIcon.src = '/static/assets/images/brightness.png';
      themeIcon.alt = 'Switch to Light Mode';
    }
  }
  const savedTheme = localStorage.getItem('theme') || 'light';
  document.documentElement.setAttribute('data-theme', savedTheme);
  updateThemeIcon(savedTheme);

  themeToggle.addEventListener('click', function () {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    updateThemeIcon(newTheme);
  });

  // ---------------- USER TYPE ----------------
  userTabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      userTabs.forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      selectedUserType = tab.getAttribute('data-type');
      forgotUserType.value = selectedUserType; // keep in sync for forgot password
    });
  });

  // ---------------- PASSWORD TOGGLE ----------------
  togglePassword.addEventListener('click', () => {
    const type =
      passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
    passwordInput.setAttribute('type', type);
    const icon = togglePassword.querySelector('i');
    icon.className =
      type === 'password' ? 'fas fa-eye' : 'fas fa-eye-slash';
  });

  // ---------------- LOGIN SUBMIT ----------------
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = emailInput.value.trim();
    const password = passwordInput.value;

    if (!email || !password) {
      showNotification('Please fill in all fields', 'error');
      return;
    }

    try {
      setButtonLoading(loginBtn, true);

      const response = await fetch('/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, userType: selectedUserType }),
      });

      const result = await response.json();
      setButtonLoading(loginBtn, false);

     if (result.status === 'user_success') {
  // Patient → dashboard
  window.location.href = '/user';
} else if (result.status === 'audit_success') {
  // Audit → dashboard
  window.location.href = '/audit';
} else if (result.status === 'provider_success') {
  // Provider → dashboard
  window.location.href = '/provider';
} else {
  showNotification(result.message || 'Login failed', 'error');
}


    } catch (err) {
      setButtonLoading(loginBtn, false);
      showNotification('Server error. Please try again later.', 'error');
    }
  });

  // ---------------- OTP LOGIC ----------------
  otpInputs.forEach((input, index) => {
    input.addEventListener('input', (e) => {
      if (!/^\d*$/.test(e.target.value)) {
        e.target.value = '';
        return;
      }
      if (e.target.value && index < otpInputs.length - 1) {
        otpInputs[index + 1].focus();
      }
    });
  });

  verifyOtpBtn.addEventListener('click', verifyOtp);

  function getOtpValue() {
    return Array.from(otpInputs).map((input) => input.value).join('');
  }

  function verifyOtp() {
    const otp = getOtpValue();

    fetch('/otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ otp }),
    })
      .then((res) => res.json())
      .then((result) => {
        if (result.status === 'success') {
          window.location.href = '/user';
        } else {
          showNotification('Invalid OTP', 'error');
        }
      });
  }

  backToLogin.addEventListener('click', () => {
    otpStep.classList.remove('active');
    loginStep.classList.add('active');
    otpInputs.forEach((input) => (input.value = ''));
    clearInterval(otpTimer);
    timerText.style.display = 'block';
    resendBtn.style.display = 'none';
  });

  resendBtn.addEventListener('click', () => {
    otpInputs.forEach((input) => (input.value = ''));
    startOtpTimer();
    showNotification('New OTP sent', 'info');
  });

  function maskEmail(email) {
    const [localPart, domain] = email.split('@');
    const maskedLocal =
      localPart[0] + '***' + localPart.slice(-1);
    return `${maskedLocal}@${domain}`;
  }

  function startOtpTimer() {
    timeLeft = 60;
    updateTimerDisplay();
    otpTimer = setInterval(() => {
      timeLeft--;
      updateTimerDisplay();
      if (timeLeft <= 0) {
        clearInterval(otpTimer);
        timerText.style.display = 'none';
        resendBtn.style.display = 'flex';
      }
    }, 1000);
  }

  function updateTimerDisplay() {
    countdown.textContent = timeLeft;
    countdown.style.color =
      timeLeft <= 10 ? 'var(--error-color)' : 'var(--accent-cyan)';
  }

  // ---------------- FORGOT PASSWORD ----------------
  forgotPasswordBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    forgotModal.style.display = 'flex';
  });

  closeForgot?.addEventListener('click', () => {
    forgotModal.style.display = 'none';
  });

  window.addEventListener('click', (e) => {
    if (e.target === forgotModal) {
      forgotModal.style.display = 'none';
    }
  });

  forgotForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = forgotEmail.value.trim();
    const pass1 = newPassword.value;
    const pass2 = confirmPassword.value;
    const userType = forgotUserType.value;

    if (!email || !pass1 || !pass2) {
      showNotification('Please fill all fields', 'error');
      return;
    }
    if (pass1 !== pass2) {
      showNotification('Passwords do not match', 'error');
      return;
    }

    try {
      const res = await fetch('/forgot_password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, newPassword: pass1, userType }),
      });
      const result = await res.json();
      if (result.status === 'success') {
        showNotification('Password updated successfully!', 'success');
        forgotModal.style.display = 'none';
      } else {
        showNotification(result.message || 'Error updating password', 'error');
      }
    } catch (err) {
      console.error(err);
      showNotification('Server error. Try again later.', 'error');
    }
  });

  // ---------------- HELPERS ----------------
  function setButtonLoading(button, loading) {
    const text = button.querySelector('.btn-text');
    const icon = button.querySelector('.btn-icon');
    const spinner = button.querySelector('.btn-loading');
    if (loading) {
      button.disabled = true;
      if (text) text.style.display = 'none';
      if (icon) icon.style.display = 'none';
      if (spinner) spinner.style.display = 'block';
    } else {
      button.disabled = false;
      if (text) text.style.display = 'block';
      if (icon) icon.style.display = 'block';
      if (spinner) spinner.style.display = 'none';
    }
  }

  function showNotification(message, type = 'info') {
    const container = document.getElementById('notificationContainer');
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `<div class="notification-content"><span>${message}</span></div>`;
    container.appendChild(notification);
    setTimeout(() => notification.remove(), 4000);
  }
});
