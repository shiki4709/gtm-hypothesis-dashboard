/* ================================================================
   App — Event listeners and boot
   ================================================================ */

// Close modal on overlay click
document.getElementById('modal').addEventListener('click', function(e) {
  if (e.target === this) closeModal();
});

// Close modal on Escape, cancel inline add
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') {
    if (qaOpen) closeModal();
    inlineAddCancel();
  }
});

// Load white-label config then boot
window._brandConfig = {};
(function() {
  var xhr = new XMLHttpRequest();
  xhr.open('GET', '/api/config');
  xhr.timeout = 3000;
  xhr.onload = function() {
    if (xhr.status === 200) {
      try {
        window._brandConfig = JSON.parse(xhr.responseText);
        applyBrand(window._brandConfig);
      } catch(e) {}
    }
    boot();
  };
  xhr.onerror = function() { boot(); };
  xhr.ontimeout = function() { boot(); };
  xhr.send();
})();

function applyBrand(cfg) {
  if (cfg.brandName) {
    document.title = cfg.brandName + (cfg.brandTagline ? ' — ' + cfg.brandTagline : '');
    var titleEl = document.querySelector('.topbar-title');
    if (titleEl) titleEl.textContent = cfg.brandName;
  }
  if (cfg.accentColor) {
    document.documentElement.style.setProperty('--inbound', cfg.accentColor);
  }
  // Apply default ICP if user hasn't configured their own
  if (cfg.defaultICP && !localStorage.getItem('gtm_icp_v1')) {
    var icp = { titles: cfg.defaultICP, exclude: cfg.defaultExclude || ['Recruiter', 'Student', 'Intern'] };
    localStorage.setItem('gtm_icp_v1', JSON.stringify(icp));
  }
}

function boot() {
  try { render(); } catch(e) { document.getElementById('view-experiments').style.display='block'; document.getElementById('view-experiments').innerHTML='<pre style="color:red">'+e.message+'\n'+e.stack+'</pre>'; }
}
