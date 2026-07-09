export function createTypingIndicator(chatWrapper) {
  const typingUsers = new Set();

  const typingIndicator = document.createElement("div");
  typingIndicator.className = "typing-indicator-box";
  typingIndicator.style.display = "none";
  typingIndicator.innerHTML =
    '<span id="typing-text"></span><div class="typing-dots"><span></span><span></span><span></span></div>';

  if (chatWrapper) {
    chatWrapper.insertBefore(typingIndicator, document.querySelector(".chat-footer"));
  }

  function updateTypingUI() {
    const textEl = document.getElementById("typing-text");
    if (!textEl || !typingIndicator) return;
    if (typingUsers.size > 0) {
      const names = Array.from(typingUsers);
      textEl.textContent =
        names.length > 1
          ? `${names[0]} and others are typing`
          : `${names[0]} is typing`;
      typingIndicator.style.display = "flex";
    } else {
      typingIndicator.style.display = "none";
    }
  }

  return { typingUsers, updateTypingUI, indicatorEl: typingIndicator };
}
