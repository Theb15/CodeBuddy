// Popup script for Code Buddy settings

document.addEventListener('DOMContentLoaded', async () => {
  // Load saved settings
  const settings = await chrome.storage.sync.get(['apiProvider', 'groqKey', 'geminiKey']);
  
  if (settings.apiProvider) {
    document.getElementById('apiProvider').value = settings.apiProvider;
    toggleProviderFields(settings.apiProvider);
  }
  
  if (settings.groqKey) {
    document.getElementById('groqKey').value = settings.groqKey;
  }
  
  if (settings.geminiKey) {
    document.getElementById('geminiKey').value = settings.geminiKey;
  }

  // Event listeners
  document.getElementById('apiProvider').addEventListener('change', (e) => {
    toggleProviderFields(e.target.value);
  });

  document.getElementById('saveBtn').addEventListener('click', saveSettings);
  document.getElementById('testBtn').addEventListener('click', testConnection);
  document.getElementById('clearBtn').addEventListener('click', clearData);
});

function toggleProviderFields(provider) {
  const groqGroup = document.getElementById('groqGroup');
  const geminiGroup = document.getElementById('geminiGroup');
  
  if (provider === 'groq') {
    groqGroup.style.display = 'block';
    geminiGroup.style.display = 'none';
  } else {
    groqGroup.style.display = 'none';
    geminiGroup.style.display = 'block';
  }
}

async function saveSettings() {
  const provider = document.getElementById('apiProvider').value;
  const groqKey = document.getElementById('groqKey').value.trim();
  const geminiKey = document.getElementById('geminiKey').value.trim();
  
  // Validation
  if (provider === 'groq' && !groqKey) {
    showStatus('Please enter your Groq API key', 'error');
    return;
  }
  
  if (provider === 'gemini' && !geminiKey) {
    showStatus('Please enter your Gemini API key', 'error');
    return;
  }
  
  // Save to storage
  await chrome.storage.sync.set({
    apiProvider: provider,
    groqKey: groqKey,
    geminiKey: geminiKey
  });
  
  showStatus('✅ Settings saved successfully!', 'success');
}

async function testConnection() {
  const settings = await chrome.storage.sync.get(['apiProvider', 'groqKey', 'geminiKey']);
  
  if (!settings.apiProvider) {
    showStatus('Please save your settings first', 'error');
    return;
  }
  
  showStatus('Testing connection...', 'success');
  
  try {
    if (settings.apiProvider === 'groq') {
      await testGroq(settings.groqKey);
    } else {
      await testGemini(settings.geminiKey);
    }
    showStatus('✅ Connection successful!', 'success');
  } catch (error) {
    showStatus(`❌ Connection failed: ${error.message}`, 'error');
  }
}

async function testGroq(apiKey) {
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'user', content: 'Say "test successful" if you can read this.' }
      ],
      max_tokens: 10
    })
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Invalid API key');
  }
}

async function testGemini(apiKey) {
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      contents: [{
        parts: [{
          text: 'Say "test successful" if you can read this.'
        }]
      }]
    })
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Invalid API key');
  }
}

async function clearData() {
  if (confirm('Are you sure you want to clear all saved data?')) {
    await chrome.storage.sync.clear();
    document.getElementById('groqKey').value = '';
    document.getElementById('geminiKey').value = '';
    document.getElementById('apiProvider').value = 'groq';
    toggleProviderFields('groq');
    showStatus('✅ Data cleared', 'success');
  }
}

function showStatus(message, type) {
  const status = document.getElementById('status');
  status.textContent = message;
  status.className = `status ${type}`;
  status.style.display = 'block';
  
  setTimeout(() => {
    status.style.display = 'none';
  }, 3000);
}

function togglePassword(fieldId) {
  const field = document.getElementById(fieldId);
  field.type = field.type === 'password' ? 'text' : 'password';
}

// Make togglePassword global
window.togglePassword = togglePassword;