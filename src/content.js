
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.message) {
    displayMessage(request.message);
  }
});

function displayMessage(message) {
  // Remove any existing message
  const existingMessage = document.getElementById('remote-message-displayer');
  if (existingMessage) {
    existingMessage.remove();
  }

  // Create the message element
  const messageDiv = document.createElement('div');
  messageDiv.id = 'remote-message-displayer';
  messageDiv.textContent = message;

  // Style the message
  messageDiv.style.position = 'fixed';
  messageDiv.style.top = '20px';
  messageDiv.style.right = '20px';
  messageDiv.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
  messageDiv.style.color = 'white';
  messageDiv.style.padding = '15px';
  messageDiv.style.borderRadius = '10px';
  messageDiv.style.zIndex = '9999';
  messageDiv.style.fontSize = '18px';
  messageDiv.style.boxShadow = '0 4px 8px rgba(0,0,0,0.2)';
  messageDiv.style.fontFamily = 'sans-serif';

  // Add the message to the page
  document.body.appendChild(messageDiv);

  // Automatically remove the message after a few seconds
  setTimeout(() => {
    messageDiv.remove();
  }, 4000);
}

