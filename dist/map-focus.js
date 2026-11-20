/*
 * The map as one Tab stop (a roving tabindex).
 *
 * Every interactive map item (Projects, gates, familiars, missions, agents, Psyche) is marked with
 * data-map-item and kept at tabindex -1, except one: the item focused last, or else the first
 * eligible item in document order. Tab therefore enters the map once and leaves it on the next press.
 * Inside the map, the arrow keys move to the next or previous item, and Home and End go to the first
 * and last. Enter and Space still activate an item through its own handler.
 *
 *   const focus = CovenMapFocus.create(container);   // container: the <svg id="plan">
 *   focus.schedule();                                 // after items are added, removed or hidden
 *
 * An item is eligible when it is connected, not inside aria-hidden="true", and rendered. Shift- or
 * modifier-arrows are left alone, so they never steal the stage's own camera keys.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.CovenMapFocus = api;
}(typeof window !== 'undefined' ? window : null, function () {
'use strict';

const ITEM = '[data-map-item]';
const NEXT = {ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1};

function eligible(el) {
  if (!el || !el.isConnected) return false;
  if (el.closest && el.closest('[aria-hidden="true"]')) return false;
  return !el.getClientRects || el.getClientRects().length > 0;
}

function create(container, options) {
  const o = options || {}, ok = o.eligible || eligible;
  let current = null, queued = false;
  const items = () => Array.prototype.slice.call(container.querySelectorAll(ITEM)).filter(ok);
  const set = (el, v) => { if (el.getAttribute('tabindex') !== v) el.setAttribute('tabindex', v); };

  // Exactly one eligible item is reachable by Tab: the current one if it still qualifies, else the first.
  function sync() {
    queued = false;
    const all = Array.prototype.slice.call(container.querySelectorAll(ITEM));
    if (!current || !all.includes(current) || !ok(current)) current = all.find(ok) || null;
    all.forEach(el => set(el, el === current ? '0' : '-1'));
    return current;
  }
  function schedule() {
    if (queued) return;
    queued = true;
    Promise.resolve().then(sync);
  }
  function moveTo(el) {
    if (!el) return null;
    current = el; sync();
    el.focus({preventScroll: false});
    return el;
  }
  // delta: +1 / -1 from `from`, or 'first' / 'last'. It doesn't wrap, so the ends are clear.
  function move(from, delta) {
    const list = items();
    if (!list.length) return null;
    if (delta === 'first') return moveTo(list[0]);
    if (delta === 'last') return moveTo(list[list.length - 1]);
    const at = list.indexOf(from), next = at < 0 ? 0 : Math.max(0, Math.min(list.length - 1, at + delta));
    return list[next] === from ? from : moveTo(list[next]);
  }
  function onKey(ev) {
    const el = ev.target && ev.target.closest ? ev.target.closest(ITEM) : null;
    if (!el || ev.target !== el || ev.shiftKey || ev.altKey || ev.ctrlKey || ev.metaKey) return;
    let target = null;
    if (Object.prototype.hasOwnProperty.call(NEXT, ev.key)) target = move(el, NEXT[ev.key]);
    else if (ev.key === 'Home') target = move(el, 'first');
    else if (ev.key === 'End') target = move(el, 'last');
    else return;
    ev.preventDefault(); ev.stopPropagation();
    return target;
  }
  function onFocus(ev) {
    const el = ev.target && ev.target.closest ? ev.target.closest(ITEM) : null;
    if (el && el === ev.target && current !== el) { current = el; sync(); }
  }
  container.addEventListener('keydown', onKey);
  container.addEventListener('focusin', onFocus);
  let observer = null;
  if (typeof MutationObserver === 'function') {
    observer = new MutationObserver(schedule);
    observer.observe(container, {childList: true, subtree: true, attributes: true, attributeFilter: ['aria-hidden', 'data-map-item']});
  }
  return {sync, schedule, move, onKey, onFocus, current: () => current,
    destroy() { if (observer) observer.disconnect(); container.removeEventListener('keydown', onKey); container.removeEventListener('focusin', onFocus); }};
}

return Object.freeze({create, eligible, ITEM});
}));
