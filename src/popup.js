document.addEventListener('DOMContentLoaded', () => {
  const settingsView = document.getElementById('settings-view');
  const messagesView = document.getElementById('messages-view');

  const urlInput = document.getElementById('url');
  const usernameInput = document.getElementById('username');
  const passwordInput = document.getElementById('password');
  const apiTokenInput = document.getElementById('api-token');
  const loginButton = document.getElementById('login-btn');
  const saveButton = document.getElementById('save-btn');
  const settingsError = document.getElementById('settings-error');

  const messageList = document.getElementById('message-list');
  const visitButton = document.getElementById('visit-btn');
  const settingsButton = document.getElementById('settings-btn');
  const refreshButton = document.getElementById('refresh-btn');

  // Tabs
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');
  let activeTab = 'creds';

  tabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
          tabBtns.forEach(b => b.classList.remove('active'));
          tabContents.forEach(c => c.classList.remove('active'));
          
          btn.classList.add('active');
          activeTab = btn.dataset.tab;
          document.getElementById(`tab-${activeTab}`).classList.add('active');
      });
  });

  function showView(viewId) {
    settingsView.classList.remove('active');
    messagesView.classList.remove('active');
    document.getElementById(viewId).classList.add('active');
  }

  function initializeView() {
    chrome.storage.local.get(['serverUrl', 'authToken', 'loggedIn', 'username'], (result) => {
      // Pre-fill fields if available
      if (result.serverUrl) urlInput.value = result.serverUrl;
      if (result.username && result.username !== 'API User') usernameInput.value = result.username;
      if (result.authToken) apiTokenInput.value = result.authToken;

      if (result.loggedIn && result.serverUrl && result.authToken) {
          showView('messages-view');
          loadMessages();
      } else {
        showView('settings-view');
      }
    });
  }

  initializeView();

  function getLoginPayload() {
    const serverUrl = urlInput.value.replace(/\/$/, "");
    let payload = { url: serverUrl };
    let isValid = false;

    if (!serverUrl) {
        settingsError.textContent = 'Server URL is required';
        return null;
    }

    if (activeTab === 'creds') {
        const username = usernameInput.value;
        const password = passwordInput.value;
        if (username && password) {
            payload.username = username;
            payload.password = password;
            isValid = true;
        } else {
            settingsError.textContent = 'Username and Password are required';
        }
    } else {
        const token = apiTokenInput.value;
        if (token) {
            payload.token = token;
            isValid = true;
        } else {
            settingsError.textContent = 'API Token is required';
        }
    }
    return isValid ? payload : null;
  }

  loginButton.addEventListener('click', () => {
    const payload = getLoginPayload();
    if (payload) {
      settingsError.textContent = 'Logging in...';
      loginButton.disabled = true;
      saveButton.disabled = true;
      
      chrome.runtime.sendMessage({ 
          type: 'login', 
          payload: payload 
      }, (response) => {
          loginButton.disabled = false;
          saveButton.disabled = false;
          if (response && response.success) {
              showView('messages-view');
              loadMessages();
              settingsError.textContent = '';
              passwordInput.value = '';
          } else {
              settingsError.textContent = response.error || 'Login failed';
          }
      });
    }
  });

  saveButton.addEventListener('click', () => {
      const payload = getLoginPayload();
      if (payload) {
          if (activeTab === 'creds') {
              settingsError.textContent = "Cannot save credentials without logging in. Use 'Login & Test'.";
              return;
          }

          // For Token, we can save directly.
          chrome.storage.local.set({
              serverUrl: payload.url,
              authToken: payload.token,
              username: 'API User',
              loggedIn: true // Assume logged in if they save manually? Or maybe just save creds but don't switch view?
              // The user said "Save Only", implying they might want to configure it.
              // But if we don't set loggedIn=true, checkMessages won't run.
              // Let's set loggedIn=true so it tries to poll.
          }, () => {
              showView('messages-view');
              loadMessages();
              settingsError.textContent = '';
              // Trigger a check in background
              chrome.runtime.sendMessage({ type: 'checkMessages' });
          });
      }
  });

  settingsButton.addEventListener('click', () => {
      // Just switch view, don't logout
      showView('settings-view');
      passwordInput.value = '';
  });

  refreshButton.addEventListener('click', () => {
      refreshButton.disabled = true;
      refreshButton.textContent = '...';
      chrome.runtime.sendMessage({ type: 'checkMessages' }, (response) => {
          refreshButton.disabled = false;
          refreshButton.textContent = 'Refresh';
          if (response && response.success) {
              loadMessages();
          } else if (response && response.error) {
              // Show error in the list or somewhere visible
              messageList.innerHTML = `<li style="justify-content: center; color: red;">${response.error}</li>`;
          }
      });
  });

  visitButton.addEventListener('click', () => {
      chrome.storage.local.get(['serverUrl'], (result) => {
          if (result.serverUrl) {
              chrome.tabs.create({ url: `${result.serverUrl}/console/` });
          }
      });
  });

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'messagesUpdated') {
      if (messagesView.classList.contains('active')) {
        renderMessages(request.payload.messages);
      }
    } else if (request.type === 'connectionError') {
        if (messagesView.classList.contains('active')) {
             messageList.innerHTML = `<li style="justify-content: center; color: red;">${request.error}</li>`;
        }
    }
  });

  function loadMessages() {
    chrome.runtime.sendMessage({ type: 'getMessages' }, (response) => {
        if (response && response.payload && response.payload.messages) {
            renderMessages(response.payload.messages);
        }
    });
  }

  function renderMessages(msgs) {
    const oldScrollTop = messageList.scrollTop;
    messageList.innerHTML = '';
    
    if (!msgs || msgs.length === 0) {
        messageList.innerHTML = '<li style="justify-content: center; color: #888;">No messages</li>';
        return;
    }

    // Sort: unread first, then by date desc
    msgs.sort((a, b) => {
      if (a.read === b.read) { return new Date(b.created) - new Date(a.created); }
      return a.read ? 1 : -1;
    });

    chrome.storage.local.get(['serverUrl'], (result) => {
        const serverUrl = result.serverUrl;
        
        msgs.forEach(msg => {
          const li = document.createElement('li');
          li.className = msg.read ? '' : 'unread';
          li.style.cursor = 'pointer';
          
          li.addEventListener('click', () => {
              if (serverUrl) {
                  chrome.tabs.create({ url: `${serverUrl}/console/${msg.id}` });
                  if (!msg.read) {
                      chrome.runtime.sendMessage({ type: 'markAsRead', payload: { messageIds: [msg.id] } });
                  }
              }
          });
          
          const contentDiv = document.createElement('div');
          contentDiv.style.flex = '1';
          
          const subjectDiv = document.createElement('div');
          subjectDiv.style.fontWeight = msg.read ? 'normal' : 'bold';
          subjectDiv.textContent = msg.subject || '(No Subject)';
          contentDiv.appendChild(subjectDiv);
          
          // Removed bodyDiv as requested
          
          li.appendChild(contentDiv);
          messageList.appendChild(li);
        });
    });

    messageList.scrollTop = oldScrollTop;
  }
});
