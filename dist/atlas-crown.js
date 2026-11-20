// Psyche's map badge shares the canonical mark used in the conversation and map key.
(() => {
  'use strict';
  function create(parent, svg) {
    const badge = svg('g', {class: 'psyche-badge', 'aria-hidden': 'true'}, parent);
    svg('circle', {class: 'coord-face', r: 50}, badge);
    svg('use', {href: '#crown', x: -21.5, y: -30.5, width: 43, height: 40, fill: 'var(--primary)', 'pointer-events': 'none'}, badge);
    svg('text', {class: 'coord-name', y: 26, 'text-anchor': 'middle', 'font-size': 16, 'pointer-events': 'none'}, badge).textContent = 'Psyche';
    return badge;
  }
  function draw(badge, {x, y, radius}) {
    badge.setAttribute('transform', `translate(${x} ${y}) scale(${radius / 50})`);
  }
  window.CovenAtlasCrown = Object.freeze({create, draw});
})();
