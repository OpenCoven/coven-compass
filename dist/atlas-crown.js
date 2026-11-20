// Map marks stay upright and use screen pixels so a close zoom keeps missions prominent.
(() => {
  'use strict';
  function create(parent, svg) {
    const badge = svg('g', {class: 'psyche-badge', 'aria-hidden': 'true'}, parent);
    svg('circle', {class: 'atlas-map-hit', r: 22}, badge);
    svg('circle', {class: 'coord-face', r: 22}, badge);
    svg('use', {class: 'coord-crown', href: '#crown', x: -16, y: -14.8, width: 32, height: 29.6}, badge);
    svg('circle', {class: 'coord-point', r: 8}, badge);
    svg('text', {class: 'coord-name', y: 35, 'text-anchor': 'middle', 'font-size': 11}, badge).textContent = 'Psyche';
    return badge;
  }
  function draw(badge, {x, y, screenScale}) {
    badge.setAttribute('transform', `translate(${x} ${y}) scale(${1 / screenScale})`);
  }
  window.CovenAtlasCrown = Object.freeze({create, draw});
})();
