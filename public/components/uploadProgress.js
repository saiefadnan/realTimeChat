export function createUploadProgress(messagesDiv) {
  let _el = null;

  function addUploadProgress(fileName) {
    removeUploadProgress();
    const container = document.createElement("div");
    container.className = "send-final-container";
    const timeLabel = document.createElement("div");
    timeLabel.textContent = new Date().toLocaleString();
    timeLabel.style.fontSize = "10px";
    timeLabel.style.color = "#777";
    timeLabel.style.marginBottom = "2px";
    const body = document.createElement("div");
    body.className = "message-send-container";
    const msgBox = document.createElement("div");
    msgBox.className = "message-send upload-progress-msg";
    msgBox.innerHTML = `
      <div style="font-weight:600;margin-bottom:6px;">Uploading <span class="up-fname"></span></div>
      <div class="progress-bar-bg"><div class="progress-bar-fill" style="width:0%"></div></div>
      <div style="margin-top:4px;font-size:11px;text-align:right;"><span class="up-pct">0</span>%</div>`;
    body.appendChild(msgBox);
    container.append(timeLabel, body);
    messagesDiv.appendChild(container);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
    _el = container;
  }

  function updateChatProgress(percent, fileName) {
    if (!_el || !_el.parentNode) return false;
    const pct = _el.querySelector(".up-pct");
    const fill = _el.querySelector(".progress-bar-fill");
    const nameEl = _el.querySelector(".up-fname");
    if (pct) pct.textContent = Math.round(percent);
    if (fill) fill.style.width = percent + "%";
    if (nameEl && fileName) nameEl.textContent = fileName;
    if (percent >= 100) {
      const box = _el.querySelector(".message-send");
      if (box) box.innerHTML = '<div style="font-weight:600;color:#000;">Upload complete, waiting for server...</div>';
    }
    return true;
  }

  function removeUploadProgress() {
    if (_el && _el.parentNode) _el.remove();
    _el = null;
  }

  return { addUploadProgress, updateChatProgress, removeUploadProgress };
}
