/* ================================================================
   Edit — Shared inline number editing (replaces all prompt() calls)

   Usage: inlineEdit(element, currentValue, onSave)
   - Transforms the element into an input in-place
   - Pre-selects the value for quick overwrite
   - Enter/blur saves, Escape cancels
   - +/- stepper buttons for quick increments
   ================================================================ */

function inlineEdit(el, currentVal, onSave, opts) {
  opts = opts || {};
  var isNum = opts.type !== 'text';
  var label = opts.label || '';

  // Prevent double-editing
  if (el.querySelector('.ie-wrap')) return;

  var originalHTML = el.innerHTML;
  var originalVal = currentVal;

  var wrap = document.createElement('div');
  wrap.className = 'ie-wrap';
  wrap.onclick = function(e) { e.stopPropagation(); };

  if (label) {
    var labelEl = document.createElement('div');
    labelEl.className = 'ie-label';
    labelEl.textContent = label;
    wrap.appendChild(labelEl);
  }

  var row = document.createElement('div');
  row.className = 'ie-row';

  if (isNum) {
    // Minus button
    var minus = document.createElement('button');
    minus.className = 'ie-step ie-minus';
    minus.textContent = '−';
    minus.onclick = function(e) {
      e.stopPropagation();
      var v = parseInt(input.value) || 0;
      if (v > 0) { input.value = v - 1; input.focus(); }
    };
    row.appendChild(minus);
  }

  var input = document.createElement('input');
  input.type = isNum ? 'number' : 'text';
  input.className = 'ie-input' + (isNum ? ' ie-input-num' : ' ie-input-text');
  input.value = currentVal;
  if (isNum) { input.min = '0'; input.step = '1'; }
  if (opts.placeholder) input.placeholder = opts.placeholder;
  row.appendChild(input);

  if (isNum) {
    // Plus button
    var plus = document.createElement('button');
    plus.className = 'ie-step ie-plus';
    plus.textContent = '+';
    plus.onclick = function(e) {
      e.stopPropagation();
      var v = parseInt(input.value) || 0;
      input.value = v + 1;
      input.focus();
    };
    row.appendChild(plus);
  }

  wrap.appendChild(row);

  // Quick increment buttons for numbers
  if (isNum) {
    var bumps = document.createElement('div');
    bumps.className = 'ie-bumps';
    [1, 5, 10, 50].forEach(function(n) {
      var btn = document.createElement('button');
      btn.className = 'ie-bump';
      btn.textContent = '+' + n;
      btn.onclick = function(e) {
        e.stopPropagation();
        var v = parseInt(input.value) || 0;
        input.value = v + n;
        input.focus();
      };
      bumps.appendChild(btn);
    });
    wrap.appendChild(bumps);
  }

  // Save/cancel row
  var actions = document.createElement('div');
  actions.className = 'ie-actions';

  var saveBtn = document.createElement('button');
  saveBtn.className = 'ie-save';
  saveBtn.textContent = 'Save';
  saveBtn.onclick = function(e) { e.stopPropagation(); doSave(); };

  var cancelBtn = document.createElement('button');
  cancelBtn.className = 'ie-cancel';
  cancelBtn.textContent = 'Cancel';
  cancelBtn.onclick = function(e) { e.stopPropagation(); doCancel(); };

  actions.appendChild(cancelBtn);
  actions.appendChild(saveBtn);
  wrap.appendChild(actions);

  el.innerHTML = '';
  el.appendChild(wrap);

  // Focus and select
  setTimeout(function() { input.focus(); input.select(); }, 30);

  function doSave() {
    var val = isNum ? (parseInt(input.value) || 0) : input.value;
    onSave(val);
  }

  function doCancel() {
    el.innerHTML = originalHTML;
  }

  input.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') { e.preventDefault(); doSave(); }
    if (e.key === 'Escape') { e.preventDefault(); doCancel(); }
  });
}

/* ================================================================
   Rewired edit functions (replace prompt-based ones)
   ================================================================ */

function editStage(id, idx, el) {
  var exps = load();
  var e = exps.find(function(x) { return x.id === id; });
  var stg = e.stages[idx];

  inlineEdit(el, stg.val, function(val) {
    var exps2 = load();
    var e2 = exps2.find(function(x) { return x.id === id; });
    e2.stages[idx].val = val;
    save(exps2); flash(); render();
  }, { label: stg.label });
}

function editHours(id, el) {
  var exps = load();
  var e = exps.find(function(x) { return x.id === id; });

  inlineEdit(el, e.hours || 0, function(val) {
    var exps2 = load();
    var e2 = exps2.find(function(x) { return x.id === id; });
    e2.hours = parseFloat(val) || 0;
    save(exps2); flash(); render();
  }, { label: 'Hours spent' });
}

function quickBump(id, stageIdx, el) {
  var exps = load();
  var e = exps.find(function(x) { return x.id === id; });
  var stg = e.stages[stageIdx];

  inlineEdit(el, stg.val, function(val) {
    var exps2 = load();
    var e2 = exps2.find(function(x) { return x.id === id; });
    e2.stages[stageIdx].val = val;
    save(exps2); flash(); render();
  }, { label: stg.label });
}
