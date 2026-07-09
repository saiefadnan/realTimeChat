function cleanUp(existingScript) {
  // console.log(window.eventListeners.length);
  existingScript.remove();
  window.eventListeners.forEach(({ element, event, handler }) => {
    element.removeEventListener(event, handler);
  });
  window.eventListeners.length = 0;
  const page = document.getElementById("page");
  if (page) {
    while (page.firstChild) {
      page.removeChild(page.firstChild);
    }
  }
  //('clean....');
}

/**
 * Shows a global loading overlay.
 */
export function showLoading(text = "Loading...") {
  if (document.querySelector(".loading-overlay")) return;
  const overlay = document.createElement("div");
  overlay.className = "loading-overlay";
  overlay.innerHTML = `
        <div class="spinner"></div>
        <div class="loading-text" style="color:white; font-weight:600;">${text}</div>
    `;
  document.body.appendChild(overlay);
}

/**
 * Hides the global loading overlay.
 */
export function hideLoading() {
  const overlay = document.querySelector(".loading-overlay");
  if (overlay) {
    overlay.style.opacity = "0";
    setTimeout(() => overlay.remove(), 300);
  }
}

/**
 * Legacy upload progress - no longer used. Inline chat progress replaces this.
 */
export function updateUploadProgress(percent, filename = "File") {
  // Replaced by in-chat upload progress in dynamic_chat_91235.js / dynamic_room_91235.js
}

function closeAllSockets(socket) {
  socket.off("connect");
  socket.off("disconnect");
  socket.off("private message");
  socket.off("public message");
  socket.off("private image");
  socket.off("public image");
  socket.off("private video");
  socket.off("public video");
  socket.off("private file");
  socket.off("public file");
  socket.off("error");
  socket.off("init activeUsers");
  socket.off("activeUsers");
  socket.off("room-created");
  socket.off("invited");
  socket.off("room message");
  socket.off("invitation");
  socket.off("room file");
  socket.off("handshake");
  socket.off("room-info");
  socket.off("exit-video");
  socket.off("exit-room");
  socket.off("user-typing");
  socket.off("user-stop-typing");
  socket.off("update-room-info");
  socket.off("reject-call");
  socket.off("ack");
  // Stop camera/mic tracks from local video
  const localVideo = document.getElementById("localVideo");
  if (localVideo) {
    if (localVideo.srcObject instanceof MediaStream) {
      localVideo.srcObject.getTracks().forEach(function (t) { t.stop(); });
    }
    localVideo.srcObject = null;
  }
  // Stop any remote video tracks & close peer connections
  document.querySelectorAll(".video-modal-child").forEach(function (video) {
    if (video.srcObject instanceof MediaStream) {
      video.srcObject.getTracks().forEach(function (t) { t.stop(); });
    }
    video.srcObject = null;
  });
  // Clear the video modal container
  var modalContent = document.getElementById("video-modal-content");
  if (modalContent) {
    modalContent.innerHTML = "";
  }
  var videoModal = document.getElementById("video-modal");
  if (videoModal) {
    videoModal.style.display = "none";
  }
  // Close incoming call modal if open
  if (typeof window.incomingCallClose === "function") {
    window.incomingCallClose();
  }
}
export function loadPage(content, element = null) {
  console.log("Loading page:", content, "element:", element);
  window._uploadAborted = true; // Stop any in-flight uploads
  const container = document.querySelector(".upload-progress-container");
  if (container) container.style.display = "none";
  showLoading(); // Show loader on start
  const page = `views/dynamic_${content.replace(".html", "")}_91235.html`;
  fetch(page)
    .then((response) => {
      if (!response.ok) {
        throw new Error("Network status not good", response.statusText);
      }
      return response.text();
    })
    .then((data) => {
      const script = document.createElement("script");
      const Script = page.replace(".html", ".js"); // e.g. views/dynamic_chat_91235.js
      const existingScripts = document.querySelectorAll("script");
      if (existingScripts) {
        existingScripts?.forEach((existingScript) => {
          const srcName = existingScript?.getAttribute("src");
          if (
            srcName &&
            srcName.includes("dynamic_") &&
            srcName.includes("_91235")
          ) {
            if (window.socket) {
              closeAllSockets(window.socket);
              window.socket.disconnect(); // Definitive fix for '999' session conflict
              window.socket = null;
            }
            cleanUp(existingScript);
          }
        });
      }

      document.getElementById("page").innerHTML = data;
      // Auto-close Materialize sidenav if open (useful for mobile navigation)
      const sidenavElem = document.querySelector(".sidenav");
      if (sidenavElem && typeof M !== "undefined" && M.Sidenav) {
        const instance = M.Sidenav.getInstance(sidenavElem);
        if (instance) instance.close();
      }
      script.src = Script;
      script.onload = () => {
        //console.log(`${Script} loaded successfully`);
      };
      script.onerror = (error) => {
        console.error("Error loading script", error);
        hideLoading();
      };
      script.onload = () => {
        hideLoading(); // Hide when script is ready
      };
      if (element) {
        toggleColor(element);
      }
      document.body.appendChild(script);
    })
    .catch((error) => {
      console.error("Content fetched failed", error);
    });
}

export function toggleColor(element) {
  const element0 = element + "0";
  const links = document.querySelectorAll(".tab");
  links.forEach((link) => {
    link.classList.remove("clicked");
  });
  document.getElementById(element).classList.toggle("clicked");
  document.getElementById(element0).classList.toggle("clicked");
}

/**
 * Updates the navigation bar visibility based on login status.
 * @param {boolean} isLoggedIn
 */
export function updateNavState(isLoggedIn) {
  const navSelectors = {
    logout: ".nav-logout",
    signup: ".nav-signup",
    login: ".nav-login",
    chat: ".nav-chat",
    room: ".nav-room",
  };

  const setDisplay = (selector, display) => {
    document
      .querySelectorAll(selector)
      .forEach((el) => (el.style.display = display));
  };

  setDisplay(navSelectors.logout, isLoggedIn ? "block" : "none");
  setDisplay(navSelectors.chat, isLoggedIn ? "block" : "none");
  setDisplay(navSelectors.room, isLoggedIn ? "block" : "none");
  setDisplay(navSelectors.signup, isLoggedIn ? "none" : "block");
  setDisplay(navSelectors.login, isLoggedIn ? "none" : "block");

  if (!isLoggedIn) {
    const defaultProfile =
      "https://gifdb.com/images/high/eren-yeager-blowing-hair-o63aaatimhxaojbu.gif";
    document
      .querySelectorAll(".circle.responsive-img")
      .forEach((img) => (img.src = defaultProfile));
  }
}

export function handleLogout() {
  window._uploadAborted = true;
  Cookies.remove("token");
  updateNavState(false);
  window.loadPage("login.html", "login");
}
