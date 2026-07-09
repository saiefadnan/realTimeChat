export function buildDrivePreview(fileId, type) {
  return window.ChatMediaPreview.buildDrivePreview(fileId, type);
}

export function addMessage(from, message, time, profile, messagesDiv, prepend = false) {
  const finalContainer = document.createElement("div");
  finalContainer.className = "final-container";
  const head = document.createElement("div");
  head.className = "time-name-container";
  const nameLabel = document.createElement("span");
  nameLabel.textContent = from;
  nameLabel.style.color = "#3498db";
  const timeLabel = document.createElement("span");
  timeLabel.textContent = ` • ${time}`;
  timeLabel.style.fontSize = "10px";
  timeLabel.style.color = "#777";
  head.append(nameLabel, timeLabel);
  const body = document.createElement("div");
  body.className = "message-receive-container";
  const img = document.createElement("img");
  img.src = profile;
  img.className = "receiver-profile-container";
  const msgBox = document.createElement("div");
  msgBox.className = "message-receive";
  msgBox.textContent = message;
  body.append(img, msgBox);
  finalContainer.append(head, body);
  if (prepend) {
    messagesDiv.insertBefore(finalContainer, messagesDiv.firstChild);
  } else {
    messagesDiv.appendChild(finalContainer);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
  }
}

export function addMessageTo(message, time, messagesDiv, prepend = false) {
  const finalContainer = document.createElement("div");
  finalContainer.className = "send-final-container";
  const timeLabel = document.createElement("div");
  timeLabel.textContent = time;
  timeLabel.style.fontSize = "10px";
  timeLabel.style.color = "#777";
  const body = document.createElement("div");
  body.className = "message-send-container";
  const msgBox = document.createElement("div");
  msgBox.className = "message-send";
  msgBox.textContent = message;
  body.appendChild(msgBox);
  finalContainer.append(timeLabel, body);
  if (prepend) {
    messagesDiv.insertBefore(finalContainer, messagesDiv.firstChild);
  } else {
    messagesDiv.appendChild(finalContainer);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
  }
}

export function embedDriveFiles(time, from, fileId, profile, type, messagesDiv, prepend = false) {
  const container = document.createElement("div");
  container.className = "message-receive-container";
  container.style.flexDirection = "column";
  container.style.alignItems = "flex-start";
  container.style.padding = "10px";
  const header = document.createElement("div");
  header.style.display = "flex";
  header.style.alignItems = "center";
  header.style.gap = "10px";
  const img = document.createElement("img");
  img.src = profile;
  img.style.width = "40px";
  img.style.height = "40px";
  img.style.borderRadius = "50%";
  const info = document.createElement("div");
  const nameSpan = document.createElement("b");
  nameSpan.textContent = from;
  const timeSpan = document.createElement("small");
  timeSpan.textContent = ` ${time}`;
  timeSpan.style.color = "#777";
  info.append(nameSpan, timeSpan);
  header.append(img, info);
  container.append(header, buildDrivePreview(fileId, type));
  if (prepend) {
    messagesDiv.insertBefore(container, messagesDiv.firstChild);
  } else {
    messagesDiv.appendChild(container);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
  }
}

export function embedDriveFilesTo(time, fileId, type, messagesDiv, prepend = false) {
  const container = document.createElement("div");
  container.style.display = "flex";
  container.style.flexDirection = "column";
  container.style.alignItems = "flex-end";
  container.style.padding = "10px";
  const timeLabel = document.createElement("small");
  timeLabel.textContent = time;
  timeLabel.style.color = "#777";
  container.append(timeLabel, buildDrivePreview(fileId, type));
  if (prepend) {
    messagesDiv.insertBefore(container, messagesDiv.firstChild);
  } else {
    messagesDiv.appendChild(container);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
  }
}

export function addOfflineTextPreview(message, messagesDiv) {
  const finalContainer = document.createElement("div");
  finalContainer.className = "send-final-container";
  const timeLabel = document.createElement("div");
  timeLabel.textContent = new Date().toLocaleString() + " • Offline Queue";
  timeLabel.style.fontSize = "10px";
  timeLabel.style.color = "#e67e22";
  timeLabel.style.marginBottom = "2px";
  const body = document.createElement("div");
  body.className = "message-send-container";
  const msgBox = document.createElement("div");
  msgBox.className = "message-send";
  msgBox.style.border = "1px dashed #e67e22";
  msgBox.style.opacity = "0.75";
  msgBox.textContent = message;
  const badge = document.createElement("div");
  badge.textContent = "⏳ Sending when online...";
  badge.style.fontSize = "10px";
  badge.style.color = "#e67e22";
  badge.style.marginTop = "4px";
  msgBox.appendChild(badge);
  body.appendChild(msgBox);
  finalContainer.append(timeLabel, body);
  messagesDiv.appendChild(finalContainer);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

export function addOfflineFilePreview(file, messagesDiv) {
  const finalContainer = document.createElement("div");
  finalContainer.className = "send-final-container";
  const timeLabel = document.createElement("div");
  timeLabel.textContent = new Date().toLocaleString() + " • Offline Queue";
  timeLabel.style.fontSize = "10px";
  timeLabel.style.color = "#e67e22";
  timeLabel.style.marginBottom = "2px";
  const body = document.createElement("div");
  body.className = "message-send-container";
  const msgBox = document.createElement("div");
  msgBox.className = "message-send";
  msgBox.style.border = "1px dashed #e67e22";
  if (file.type && file.type.startsWith("image/")) {
    const img = document.createElement("img");
    img.src = URL.createObjectURL(file);
    img.style.maxHeight = "150px";
    img.style.borderRadius = "8px";
    img.style.opacity = "0.7";
    const badge = document.createElement("div");
    badge.textContent = `Pending: ${file.name}`;
    badge.style.fontSize = "11px";
    badge.style.marginTop = "4px";
    badge.style.color = "#e67e22";
    msgBox.append(img, badge);
  } else {
    msgBox.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;color:#e67e22;">
        <span>📄</span>
        <div style="text-align:left;">
          <div style="font-weight:600;font-size:12px;">${file.name}</div>
          <small>Waiting for internet...</small>
        </div>
      </div>`;
  }
  body.appendChild(msgBox);
  finalContainer.append(timeLabel, body);
  messagesDiv.appendChild(finalContainer);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

export function addError(message, messagesDiv, color) {
  const err = document.createElement("div");
  err.textContent = message;
  Object.assign(err.style, {
    color: color === "green" ? "#2ecc71"
         : color === "blue" ? "#3498db"
         : message === "Connected" ? "#2ecc71"
         : "#e74c3c",
    backgroundColor: "#222",
    borderRadius: "5px",
    padding: "8px",
    margin: "10px auto",
    width: "fit-content",
    textAlign: "center",
    fontSize: "13px",
  });
  messagesDiv.appendChild(err);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
  setTimeout(() => {
    err.style.opacity = "0";
    err.style.transition = "opacity 1s";
    setTimeout(() => err.remove(), 1000);
  }, 3000);
}
