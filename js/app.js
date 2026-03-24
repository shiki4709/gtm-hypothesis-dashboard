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

// Boot
render();

// Auto-sync connected sources on load
syncAll(function(n) { if (n > 0) { showToast(n + ' sources synced'); render(); } });
