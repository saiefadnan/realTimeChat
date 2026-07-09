export function createNotificationDrawer() {
  const style = document.createElement("style");
  style.textContent =
    ".nd-item.nd-out{transform:translateX(120%)!important;opacity:0!important;}.nd-item{will-change:transform,opacity;}";
  document.head.appendChild(style);

  const container = document.createElement("div");
  container.id = "notification-drawer";
  container.style.cssText =
    "position:fixed;top:16px;right:16px;z-index:10000;display:flex;flex-direction:column;gap:8px;pointer-events:none;";
  document.body.appendChild(container);

  const notifications = [];
  const GAP = 8;
  const DURATION = 6000;

  function layout() {
    let top = 0;
    for (const n of notifications) {
      n.el.style.top = top + "px";
      top += n.el.offsetHeight + GAP;
    }
  }

  function remove(entry) {
    const idx = notifications.indexOf(entry);
    if (idx !== -1) notifications.splice(idx, 1);
    entry.el.classList.add("nd-out");
    setTimeout(() => {
      entry.el.remove();
      layout();
    }, 300);
  }

  return function show(msg, action) {
    const el = document.createElement("div");
    el.className = "nd-item";
    el.style.cssText =
      "position:relative;pointer-events:auto;background:#1565C0;color:#fff;padding:14px 20px;border-radius:8px;box-shadow:0 4px 16px rgba(0,0,0,.3);font-size:14px;line-height:1.5;display:flex;align-items:center;gap:14px;max-width:380px;transform:translateX(120%);transition:transform .3s ease,opacity .3s ease;";
    const body = document.createElement("span");
    body.innerHTML = msg;
    el.appendChild(body);
    if (action) {
      const btn = document.createElement("button");
      btn.textContent = "Yes";
      btn.style.cssText =
        "flex-shrink:0;background:#fff;color:#1565C0;font-weight:700;border:none;border-radius:6px;padding:6px 18px;cursor:pointer;font-size:13px;";
      btn.onclick = (e) => {
        e.stopPropagation();
        remove(entry);
        action();
      };
      el.appendChild(btn);
    }
    container.appendChild(el);
    const entry = { el };
    notifications.push(entry);
    requestAnimationFrame(() => { el.style.transform = "translateX(0)"; });
    layout();
    setTimeout(() => remove(entry), DURATION);
  };
}
