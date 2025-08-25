document.addEventListener('DOMContentLoaded', async () => {
  const toggle = document.getElementById('toggle');
  const status = document.getElementById('status');

  function setStatus(msg, tone = 'normal') {
    if (!status) return;
    status.textContent = msg || '';
    status.style.color = tone === 'warn' ? '#b00' : '#555';
  }

  chrome.storage?.sync.get(['enabled'], (result) => {
    toggle.checked = result.enabled !== false; 
  });

  let activeTab;
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    activeTab = tabs[0];
  } catch (_) {
    setStatus('Cannot access active tab', 'warn');
  }

  const unsupported = !activeTab || (
    activeTab.url && (
      activeTab.url.startsWith('chrome://') ||
      activeTab.url.startsWith('edge://') ||
      activeTab.url.startsWith('about:') ||
      activeTab.url.startsWith('chrome-extension://') ||
      /chromewebstore\.(google|chrome)\.com|chrome\.google\.com\/webstore/.test(activeTab.url)
    )
  );

  if (unsupported) {
    toggle.disabled = true;
    setStatus('Not available on this page', 'warn');
    return; 
  }

  let contentScriptReachable = false;
  try {
    chrome.tabs.sendMessage(activeTab.id, { _rb_probe: true }, () => {
      if (!chrome.runtime.lastError) contentScriptReachable = true;
      else setStatus('Initializing…');
    });
  } catch (_) { }

  let fallbackApplied = false; 

  async function applyFallback(enabled) {
    try {
      if (enabled) {
        await chrome.scripting.insertCSS({ target: { tabId: activeTab.id }, files: ['flatten.css'] });
        fallbackApplied = true;
      } else if (fallbackApplied) {
        await chrome.scripting.removeCSS({ target: { tabId: activeTab.id }, files: ['flatten.css'] });
      }
      setStatus(enabled ? 'Flattening on (fallback)' : 'Flattening off');
    } catch (e) {
      try {
        const cssText = await (await fetch(chrome.runtime.getURL('flatten.css'))).text();
        await chrome.scripting.executeScript({
          target: { tabId: activeTab.id },
          func: (css, enable) => {
            const id = 'flatten-css-toggle-inline';
            let tag = document.getElementById(id);
            if (enable) {
              if (tag) tag.remove();
              tag = document.createElement('style');
              tag.id = id;
              tag.textContent = css;
              document.documentElement.appendChild(tag);
            } else if (tag) {
              tag.remove();
            }
          },
          args: [cssText, enabled]
        });
        setStatus(enabled ? 'Flattening on (inline)' : 'Flattening off');
      } catch (e2) {
        setStatus('Fallback failed: ' + (e2.message || e.message), 'warn');
      }
    }
  }

  toggle.addEventListener('change', async () => {
    const enabled = toggle.checked;
    chrome.storage?.sync.set({ enabled });
    if (!activeTab) return;

    if (contentScriptReachable) {
      try {
        chrome.tabs.sendMessage(activeTab.id, { toggle: enabled }, () => {
          if (chrome.runtime.lastError) {
            setTimeout(() => {
              chrome.tabs.sendMessage(activeTab.id, { toggle: enabled }, () => {
                if (chrome.runtime.lastError) {
                  contentScriptReachable = false;
                  applyFallback(enabled);
                } else {
                  setStatus(enabled ? 'Flattening on' : 'Flattening off');
                }
              });
            }, 120);
          } else {
            setStatus(enabled ? 'Flattening on' : 'Flattening off');
          }
        });
      } catch (_) {
        contentScriptReachable = false;
        applyFallback(enabled);
      }
    } else {
      applyFallback(enabled);
    }
  });
});