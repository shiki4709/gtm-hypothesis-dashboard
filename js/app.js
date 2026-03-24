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
