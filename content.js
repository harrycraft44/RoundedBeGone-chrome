function ensureHead(cb) {
  if (document.head) return cb();
  const obs = new MutationObserver(() => {
    if (document.head) {
      obs.disconnect();
      cb();
    }
  });
  obs.observe(document.documentElement || document, { childList: true, subtree: true });
}

function injectCSS() {
  ensureHead(() => {
    removeCSS();
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = chrome.runtime.getURL('flatten.css');
    link.id = 'flatten-css-toggle';
    document.head.appendChild(link);
  });
}

function removeCSS() {
  const existing = document.getElementById('flatten-css-toggle');
  if (existing) existing.remove();
}

chrome.runtime.onMessage.addListener((msg) => {
  if (!msg) return;
  if ('_rb_probe' in msg) {

    return; 
  }
  if ('toggle' in msg) {
    if (msg.toggle) injectCSS(); else removeCSS();
  }
});

chrome.storage?.sync.get(['enabled'], (result) => {
  if (result.enabled !== false) injectCSS();
});