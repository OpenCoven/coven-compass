(function () {
  'use strict';

  var PORTALS = ['inspect', 'psyche', 'empty', 'projectForm', 'atlasSidebar', 'atlasMissionBrowser'];
  var OVERLAYS = PORTALS.concat(['keyModal', 'cpModal']);
  var records = new Map(), stack = [], inertState = [], modalState = [];
  var settings = null, mounted = false, syncing = false, initial = true;
  var mobile = false, nativeOpen = false, topId = null, pendingActivation = null, frame = 0;
  var viewportPrevious = null, observer = null;
  var chrome = null, chromePortals = [], cameraExpanded = false, chromeObserver = null;
  var cameraObscured = null;
  var composingTargets = new WeakSet();
  var FOCUSABLE = 'a[href],button,input,select,textarea,summary,[tabindex],[contenteditable]';

  function narrow() {
    return window.matchMedia ? window.matchMedia('(max-width: 1100px), (pointer: coarse)').matches : window.innerWidth <= 1100;
  }

  function openNativeDialog() {
    return Array.from(document.querySelectorAll('dialog[open]')).find(function (el) { return el.isConnected && !el.hidden; }) || null;
  }

  function visible(el) {
    if (!el || !el.isConnected || el.disabled || el.closest('[hidden],[inert]')) return false;
    var style = window.getComputedStyle ? window.getComputedStyle(el) : null;
    if (style && (style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse')) return false;
    return !el.getClientRects || el.getClientRects().length > 0;
  }

  function focus(el) {
    if (!visible(el) || typeof el.focus !== 'function') return false;
    if (!el.matches(FOCUSABLE)) {
      if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1');
    }
    try { el.focus({preventScroll: true}); } catch (error) { el.focus(); }
    return document.activeElement === el;
  }

  function surface(rec) {
    return rec.el.querySelector('.modal-card[role="dialog"]') || rec.el;
  }

  function focusable(rec) {
    return Array.from(rec.el.querySelectorAll(FOCUSABLE)).filter(function (el) {
      return visible(el) && el.tabIndex >= 0 && el.getAttribute('aria-disabled') !== 'true' &&
        !(el.tagName === 'INPUT' && el.type === 'hidden') && el.getAttribute('contenteditable') !== 'false';
    });
  }

  function focusInside(rec) {
    if (!rec) return false;
    if (rec.el.contains(document.activeElement) && visible(document.activeElement)) return true;
    if (rec.lastFocused && rec.el.contains(rec.lastFocused) && focus(rec.lastFocused)) return true;
    var preferred = rec.el.querySelector('[data-mobile-initial-focus],[autofocus]');
    if (focus(preferred)) return true;
    var heading = rec.el.querySelector('h1,h2,[role="heading"]');
    if (focus(heading)) return true;
    var controls = focusable(rec);
    var input = controls.find(function (el) { return ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName); });
    if (focus(input) || focus(controls[0])) return true;
    return focus(surface(rec));
  }

  function fallbackFocus() {
    if (!settings || typeof settings.fallbackFocus !== 'function') return;
    var result = settings.fallbackFocus();
    if (result && typeof result.focus === 'function') focus(result);
  }

  function discover() {
    OVERLAYS.forEach(function (id) {
      var el = document.getElementById(id), old = records.get(id);
      if (!el || (old && old.el === el)) return;
      records.set(id, {
        id: id, el: el, parent: el.parentNode, next: el.nextSibling, anchor: null,
        open: false, returnFocus: null, lastFocused: null, lastOutside: document.activeElement,
        zIndex: el.style.getPropertyValue('z-index'), zPriority: el.style.getPropertyPriority('z-index')
      });
    });
  }

  function restoreInert() {
    inertState.forEach(function (item) {
      item.el.inert = item.value;
      if (item.attribute === null) item.el.removeAttribute('inert');
      else item.el.setAttribute('inert', item.attribute);
    });
    inertState = [];
  }

  function restoreModalAttributes() {
    modalState.forEach(function (item) {
      ['role', 'aria-modal'].forEach(function (name) {
        if (item[name] === null) item.el.removeAttribute(name);
        else item.el.setAttribute(name, item[name]);
      });
    });
    modalState = [];
  }

  function applyModal(rec) {
    if (!rec) return;
    var el = surface(rec);
    modalState.push({el: el, role: el.getAttribute('role'), 'aria-modal': el.getAttribute('aria-modal')});
    el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true');
    Array.from(document.body.children).forEach(function (sibling) {
      // Never disable an ancestor of the active overlay, even if an overlay was
      // supplied before it could be portalled.
      // Native dialogs own their browser top layer, including ones opened after
      // this sync. Setting inert on the dialog itself would disable that owner.
      if (sibling === rec.el || sibling.contains(rec.el) || ['SCRIPT', 'STYLE', 'LINK', 'META', 'DIALOG'].includes(sibling.tagName)) return;
      inertState.push({el: sibling, value: !!sibling.inert, attribute: sibling.getAttribute('inert')});
      sibling.inert = true;
      sibling.setAttribute('inert', '');
    });
  }

  function portal(rec) {
    if (!PORTALS.includes(rec.id) || rec.el.parentNode === document.body) return;
    if (!rec.anchor) {
      rec.anchor = document.createComment('mobile portal: ' + rec.id);
      rec.el.parentNode.insertBefore(rec.anchor, rec.el);
    }
    document.body.appendChild(rec.el);
  }

  function restorePortal(rec) {
    if (!PORTALS.includes(rec.id) || !rec.anchor) return;
    if (rec.anchor.parentNode) {
      rec.anchor.parentNode.insertBefore(rec.el, rec.anchor);
      rec.anchor.remove();
    } else if (rec.parent && rec.parent.isConnected) {
      rec.parent.insertBefore(rec.el, rec.next && rec.next.parentNode === rec.parent ? rec.next : null);
    }
    rec.anchor = null;
  }

  function restoreStackStyle(rec) {
    if (rec.zIndex) rec.el.style.setProperty('z-index', rec.zIndex, rec.zPriority);
    else rec.el.style.removeProperty('z-index');
  }

  function mountAdaptiveChrome() {
    if (chrome || !document.getElementById('timeline') || !document.getElementById('atlasCameraDock')) return;
    chrome = document.createElement('section'); chrome.id = 'atlasMobileChrome'; chrome.classList.add('atlas-mobile-chrome');
    chrome.setAttribute('aria-label', 'Mobile workspace'); chrome.hidden = true;
    var nav = document.createElement('nav'); nav.classList.add('atlas-mobile-views'); nav.setAttribute('aria-label', 'Workspace views');
    function action(id, text, label, run) {
      var el = document.createElement('button'); el.id = id; el.type = 'button'; el.textContent = text;
      el.setAttribute('aria-label', label); el.addEventListener('click', run); nav.appendChild(el); return el;
    }
    action('atlasMobileMap', 'Map', 'Show the Coven map', function () {
      var overview = document.getElementById('atlasOverview'); if (overview) overview.click();
    });
    action('atlasMobileMissions', 'Missions', 'Find a mission', function () {
      if (window.CovenAtlas) window.CovenAtlas.openMissions(true);
    });
    action('atlasMobileActivity', 'Activity', 'Open the activity conversation', function () {
      if (typeof settings.openActivity === 'function') settings.openActivity();
      else {
        var launcher = document.getElementById('launcher'); if (launcher) launcher.click();
        var tab = document.getElementById('tabChat'); if (tab) tab.click();
        var panel = document.getElementById('psyche'); if (panel) focus(panel.querySelector('h1,h2'));
      }
    });
    var view = action('atlasMobileView', 'View', 'Show map controls', function () {
      cameraExpanded = !cameraExpanded; updateCameraChoice(); scheduleViewport();
    });
    view.setAttribute('aria-controls', 'atlasCameraDock');
    chrome.appendChild(nav); document.body.insertBefore(chrome, document.body.firstChild);
    ['timeline', 'atlasCameraDock', 'live'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) chromePortals.push({el: el, anchor: null, destination: id === 'live' ? document.getElementById('timeline') : chrome});
    });
    updateCameraChoice();
    if (window.ResizeObserver) {
      // Scope changes show/hide the project header without a viewport resize.
      // Measure only the chrome we subtract from the canvas, avoiding map updates.
      chromeObserver = new window.ResizeObserver(scheduleViewport);
      var head = document.querySelector('.plan-head');
      if (head) chromeObserver.observe(head);
      chromeObserver.observe(chrome);
    }
  }

  function updateCameraChoice() {
    if (!chrome) return;
    chrome.dataset.cameraOpen = String(cameraExpanded);
    var view = document.getElementById('atlasMobileView');
    view.setAttribute('aria-expanded', String(cameraExpanded));
    view.setAttribute('aria-label', cameraExpanded ? 'Hide map controls' : 'Show map controls');
    var familiars = document.getElementById('atlasFamiliars');
    if (mobile && cameraExpanded && familiars && !cameraObscured) {
      cameraObscured = {el: familiars, hidden: familiars.hidden};
      familiars.hidden = true;
    } else if ((!mobile || !cameraExpanded) && cameraObscured) {
      cameraObscured.el.hidden = cameraObscured.hidden;
      cameraObscured = null;
    }
  }

  function syncAdaptiveChrome() {
    mountAdaptiveChrome();
    if (!chrome) return;
    chrome.hidden = !mobile;
    document.body.classList.toggle('atlas-adaptive-mobile', mobile);
    chromePortals.forEach(function (item) {
      if (mobile && item.el.parentNode !== item.destination) {
        item.anchor = document.createComment('mobile workspace: ' + item.el.id);
        item.el.parentNode.insertBefore(item.anchor, item.el);
        item.destination.appendChild(item.el);
      } else if (!mobile && item.anchor) {
        if (item.anchor.parentNode) item.anchor.parentNode.insertBefore(item.el, item.anchor);
        item.anchor.remove(); item.anchor = null;
      }
    });
    updateCameraChoice();
    if (!mobile) delete document.body.dataset.mobileLayout;
  }

  function updateAdaptiveLayout(geometry) {
    if (!chrome || !mobile) return;
    var layout = geometry.width >= 560 && geometry.height < 600 && geometry.width > geometry.height * 1.25 ? 'landscape' : geometry.width >= 700 ? 'tablet' : 'compact';
    document.body.dataset.mobileLayout = layout;
    var head = document.querySelector('.plan-head'), timeline = document.getElementById('timeline');
    var headHeight = head && head.getBoundingClientRect ? head.getBoundingClientRect().height : 0;
    var timelineHeight = timeline && timeline.getBoundingClientRect ? timeline.getBoundingClientRect().height : 0;
    var chromeHeight = chrome.getBoundingClientRect ? chrome.getBoundingClientRect().height : 0;
    chromeHeight = chromeHeight || Math.max(52, timelineHeight) + 56;
    var stageHeight = Math.max(160, Math.floor(geometry.height - headHeight - chromeHeight - 24));
    document.documentElement.style.setProperty('--mobile-chrome-height', chromeHeight + 'px');
    document.documentElement.style.setProperty('--mobile-stage-height', stageHeight + 'px');
    return stageHeight;
  }

  function sync() {
    if (!mounted || syncing) return;
    syncing = true;
    try {
      discover();
      var focused = document.activeElement, oldTop = topId && records.get(topId), wasMobile = mobile, hadNativeDialog = nativeOpen;
      var opened = [], closed = [];
      restoreInert(); restoreModalAttributes();
      mobile = narrow();
      nativeOpen = !!openNativeDialog();
      syncAdaptiveChrome();
      records.forEach(function (rec) {
        if (mobile) portal(rec); else restorePortal(rec);
        var open = rec.el.isConnected && !rec.el.hidden;
        if (open && !rec.open) {
          rec.returnFocus = rec.el.contains(focused) ? rec.lastOutside : focused;
          opened.push(rec.id);
          stack = stack.filter(function (id) { return id !== rec.id; });
          stack.push(rec.id);
        } else if (!open && rec.open) {
          closed.push(rec.id);
          stack = stack.filter(function (id) { return id !== rec.id; });
        }
        rec.open = open;
        restoreStackStyle(rec);
      });
      stack = stack.filter(function (id) { var rec = records.get(id); return rec && rec.open; });
      var activated = pendingActivation;
      pendingActivation = null;
      if (activated && stack.includes(activated)) {
        var selected = records.get(activated);
        if (!selected.el.contains(focused)) selected.returnFocus = focused;
        stack = stack.filter(function (id) { return id !== activated; });
        stack.push(activated);
      }
      topId = mobile && !nativeOpen && stack.length ? stack[stack.length - 1] : null;
      var nextTop = topId && records.get(topId);
      if (mobile) stack.forEach(function (id, index) { records.get(id).el.style.setProperty('z-index', String(100 + index * 2)); });
      applyModal(nextTop);
      document.body.classList.toggle('atlas-mobile-overlay', !!topId);
      if (topId) document.body.dataset.mobileOverlay = topId;
      else delete document.body.dataset.mobileOverlay;

      if (initial) {
        // A saved open panel must not summon the keyboard at page load. Preserve
        // an existing focus only when the portal move itself detached it.
        if (focused !== document.body && focused !== document.documentElement && visible(focused) && document.activeElement !== focused) focus(focused);
      } else if (nativeOpen) {
        // The browser's native dialog retains both focus and Escape handling.
      } else if (nextTop && hadNativeDialog) {
        focusInside(nextTop);
      } else if (nextTop && (opened.includes(topId) || activated === topId)) {
        focusInside(nextTop);
      } else if (oldTop && oldTop.id !== topId && closed.includes(oldTop.id)) {
        var returnTo = oldTop.returnFocus;
        if (!(returnTo && (!nextTop || nextTop.el.contains(returnTo)) && focus(returnTo))) {
          if (nextTop) focusInside(nextTop); else fallbackFocus();
        }
      } else if (mobile && nextTop && !wasMobile) {
        // A breakpoint change preserves focused content where possible; otherwise
        // move into the active dialog rather than leaving focus in inert content.
        if (!focus(focused)) focusInside(nextTop);
      } else if (!mobile && wasMobile && focused && focused !== document.body && visible(focused)) {
        focus(focused);
      } else if (!nextTop && focused && focused !== document.body && visible(focused) && document.activeElement !== focused) {
        focus(focused);
      }
      initial = false;
    } finally {
      syncing = false;
    }
    scheduleViewport();
  }

  function activate(id) {
    if (!OVERLAYS.includes(id)) return;
    pendingActivation = id;
    sync();
  }

  function editable(el) {
    if (!el || el.disabled || el.readOnly || !visible(el)) return false;
    if (el.isContentEditable || el.tagName === 'TEXTAREA') return true;
    return el.tagName === 'INPUT' && ['text', 'search', 'url', 'tel', 'email', 'password', 'number'].includes(el.type || 'text');
  }

  function updateViewport() {
    frame = 0;
    if (!mounted) return;
    var helper = window.CovenMobileInteractions;
    var width = window.innerWidth || document.documentElement.clientWidth || 1;
    var height = window.innerHeight || document.documentElement.clientHeight || 1;
    var geometry = helper ? helper.visualViewportGeometry(window.visualViewport, {width: width, height: height, editable: editable(document.activeElement)}) :
      {left: 0, top: 0, width: width, height: height, scale: 1, right: width, bottom: height, keyboardInset: 0, keyboardOpen: false};
    var vars = {'--app-height': geometry.height, '--viewport-width': geometry.width, '--viewport-top': geometry.top, '--viewport-left': geometry.left, '--keyboard-inset': geometry.keyboardInset};
    Object.keys(vars).forEach(function (key) { document.documentElement.style.setProperty(key, vars[key] + 'px'); });
    document.body.classList.toggle('atlas-keyboard-open', geometry.keyboardOpen);
    // Scope changes can resize the map while the visual viewport stays fixed.
    // Include that measured space so the camera receives the settled layout.
    geometry.stageHeight = updateAdaptiveLayout(geometry);
    var previous = viewportPrevious;
    viewportPrevious = geometry;
    if (typeof settings.onViewport === 'function' && JSON.stringify(geometry) !== JSON.stringify(previous)) settings.onViewport(geometry, previous);
  }

  // A scope switch changes the header and dock before the next animation frame.
  // Settle their new stage height before the overview chooses its world layout.
  function settleMapViewport() {
    if (!mounted || !mobile) return;
    if (frame) window.cancelAnimationFrame(frame);
    updateViewport();
  }

  function scheduleViewport() {
    if (frame || !mounted) return;
    frame = window.requestAnimationFrame(updateViewport);
  }

  function onFocus(ev) {
    records.forEach(function (rec) {
      if (rec.el.contains(ev.target)) rec.lastFocused = ev.target;
      else rec.lastOutside = ev.target;
    });
    scheduleViewport();
  }

  function onKey(ev) {
    if (!mobile || openNativeDialog() || ev.isComposing || ev.keyCode === 229 || (ev.target && composingTargets.has(ev.target))) return;
    if (!topId && cameraExpanded && ev.key === 'Escape') {
      cameraExpanded = false; updateCameraChoice(); focus(document.getElementById('atlasMobileView')); ev.preventDefault(); return;
    }
    if (!topId) return;
    var rec = records.get(topId);
    if (!rec || !rec.open) return;
    if (ev.key === 'Escape') {
      var close = settings.close && settings.close[topId];
      if (typeof close !== 'function') return;
      ev.preventDefault(); ev.stopPropagation();
      if (ev.stopImmediatePropagation) ev.stopImmediatePropagation();
      close(); sync();
    } else if (ev.key === 'Tab') {
      var controls = focusable(rec), current = document.activeElement, at = controls.indexOf(current);
      if (!controls.length) {
        ev.preventDefault(); focus(surface(rec));
      } else if (at < 0 || (ev.shiftKey && at === 0) || (!ev.shiftKey && at === controls.length - 1)) {
        ev.preventDefault(); focus(ev.shiftKey ? controls[controls.length - 1] : controls[0]);
      }
    }
  }

  function mount(options) {
    if (mounted) return;
    settings = options || {};
    mounted = true;
    discover();
    document.addEventListener('keydown', onKey, true);
    document.addEventListener('compositionstart', function (ev) { if (ev.target) composingTargets.add(ev.target); }, true);
    document.addEventListener('compositionend', function (ev) { if (ev.target) composingTargets.delete(ev.target); }, true);
    document.addEventListener('focusin', onFocus, true);
    document.addEventListener('focusout', scheduleViewport, true);
    document.addEventListener('close', function (ev) { if (ev.target.tagName === 'DIALOG') sync(); }, true);
    document.addEventListener('toggle', function (ev) { if (ev.target.tagName === 'DIALOG') sync(); }, true);
    window.addEventListener('resize', function () { sync(); scheduleViewport(); });
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', scheduleViewport);
      window.visualViewport.addEventListener('scroll', scheduleViewport);
    }
    if (window.MutationObserver) {
      observer = new window.MutationObserver(function (changes) {
        if (changes.some(function (change) { return records.has(change.target.id); })) sync();
      });
      observer.observe(document.body, {attributes: true, subtree: true, attributeFilter: ['hidden']});
    }
    sync();
    updateViewport();
  }

  window.CovenMobileUI = Object.freeze({mount: mount, sync: sync, activate: activate, settleMapViewport: settleMapViewport});
}());
