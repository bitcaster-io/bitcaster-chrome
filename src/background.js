const ALARM_NAME = 'pollMessages';
const POLL_INTERVAL_MINUTES = 1;

chrome.runtime.onInstalled.addListener(() => {
    console.log("Extension installed");
    chrome.alarms.create(ALARM_NAME, { periodInMinutes: POLL_INTERVAL_MINUTES });
});

chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === ALARM_NAME) {
        checkMessages();
    }
});

// Helper to ensure storage access works with Promises
const getStorage = (keys) => new Promise((resolve) => chrome.storage.local.get(keys, resolve));
const setStorage = (items) => new Promise((resolve) => chrome.storage.local.set(items, resolve));
const removeStorage = (keys) => new Promise((resolve) => chrome.storage.local.remove(keys, resolve));

async function login(url, username, password, providedToken) {
    try {
        let authToken = providedToken;

        if (!authToken) {
            // Adjust endpoint as needed. Assuming standard DRF Token Auth or similar
            const response = await fetch(`${url}/api/login/`, { 
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            
            if (!response.ok) {
                 const errorText = await response.text();
                 throw new Error(`Login failed: ${response.status} ${errorText}`);
            }
            
            const data = await response.json();
            // Assuming the API returns { "token": "..." } or { "key": "..." }
            authToken = data.token || data.key; 
            
            if (!authToken) throw new Error('No token received');
        }

        // Save temporarily to test
        await setStorage({ 
            serverUrl: url, 
            authToken: authToken,
            username: username || 'API User',
            loggedIn: true
        });
        
        // Test the token
        await checkMessages(true); // true = throw on error
        
        return { success: true };
    } catch (error) {
        console.error('Login error:', error);
        await setStorage({ loggedIn: false });
        return { success: false, error: error.message };
    }
}

async function checkMessages(throwOnError = false) {
    try {
        const { serverUrl, authToken, loggedIn } = await getStorage(['serverUrl', 'authToken', 'loggedIn']);
        
        if (!serverUrl || !authToken || (!loggedIn && !throwOnError)) {
            if (throwOnError && (!serverUrl || !authToken)) throw new Error("Missing credentials");
            return { success: false, error: "Missing credentials or not logged in" };
        }

        // Using /api/me/unseen/ to get unseen messages
        const url = `${serverUrl}/api/me/unseen/`;
        let response;
        try {
            response = await fetch(url, {
                headers: { 
                    'Authorization': `Key ${authToken}`, 
                    'Content-Type': 'application/json'
                }
            });
        } catch (networkError) {
            console.error("Network error:", networkError);
            updateBadge("?");
            // Notify popup about connection error
            chrome.runtime.sendMessage({ type: 'connectionError', error: "Server unreachable" }).catch(() => {});
            if (throwOnError) throw new Error("Server unreachable");
            return { success: false, error: "Server unreachable" };
        }

        if (response.status === 401 || response.status === 403) {
            // Token expired or invalid
            console.log("Token expired or invalid");
            updateBadge("!"); 
            if (throwOnError) throw new Error("Authentication failed (Invalid Token)");
            return { success: false, error: "Authentication failed" };
        }

        if (!response.ok) throw new Error(`Fetch failed: ${url} - ${response.status}`);

        const messages = await response.json();
        // Assuming messages is an array of message objects
        // If paginated, might need messages.results
        const messageList = Array.isArray(messages) ? messages : (messages.results || []);
        
        await setStorage({ messages: messageList });
        
        // Since we are fetching 'unseen', all messages returned are unread by definition
        const unreadCount = messageList.length;
        updateBadge(unreadCount);
        
        chrome.runtime.sendMessage({ type: 'messagesUpdated', payload: { messages: messageList } }).catch(() => {
            // Ignore error if popup is not open
        });
        
        return { success: true, count: messageList.length };
        
    } catch (error) {
        console.error('Check messages error:', error);
        if (throwOnError) throw error;
        return { success: false, error: error.message };
    }
}

function updateBadge(text) {
    if (text === 0 || text === "0") {
        chrome.action.setBadgeText({ text: '' });
    } else {
        chrome.action.setBadgeText({ text: text.toString() });
        chrome.action.setBadgeBackgroundColor({ color: '#007bff' }); // Changed to blue for better readability
        chrome.action.setBadgeTextColor({ color: '#FFFFFF' }); // Ensure text is white
    }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'login') {
        login(request.payload.url, request.payload.username, request.payload.password, request.payload.token)
            .then(sendResponse)
            .catch(err => sendResponse({ success: false, error: err.message }));
        return true; // Keep channel open for async response
    } else if (request.type === 'logout') {
        // Only set loggedIn to false. Keep credentials.
        setStorage({ loggedIn: false }).then(() => {
            updateBadge(0);
            sendResponse({ success: true });
        });
        return true;
    } else if (request.type === 'checkMessages') {
        checkMessages()
            .then((result) => sendResponse(result))
            .catch(err => sendResponse({ success: false, error: err.message }));
        return true;
    } else if (request.type === 'getMessages') {
        getStorage('messages').then((result) => {
            sendResponse({ payload: { messages: result.messages || [] } });
        });
        return true;
    } else if (request.type === 'markAsRead') {
        // Here you would typically call the API to mark as read
        // For now, we update local state and assume success or sync later
        getStorage(['messages', 'serverUrl', 'authToken']).then(async (result) => {
            let messages = result.messages || [];
            const ids = request.payload.messageIds.map(Number);
            
            // Optimistic update
            messages.forEach(m => {
                if (ids.includes(m.id)) m.read = true;
            });
            await setStorage({ messages });
            // Recalculate unread count
            updateBadge(messages.filter(m => !m.read).length);
            chrome.runtime.sendMessage({ type: 'messagesUpdated', payload: { messages } }).catch(() => {});

            // We do NOT call API here as requested
        });
    }
});
