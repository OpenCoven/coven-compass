// Both map scopes use the same flat crown, share bands and screen-sized tap target.
(() => {
  'use strict';
  function create(parent, svg) {
    const badge = svg('g', {class: 'psyche-badge', 'aria-hidden': 'true'}, parent);
    const hit = svg('circle', {class: 'atlas-map-hit', r: 22}, badge);
    const artwork = svg('g', {class: 'coord-artwork'}, badge);
    svg('circle', {class: 'coord-face', r: 32}, artwork);
    const band = (kind, r) => {
      svg('circle', {class: 'coord-track', r}, artwork);
      return svg('circle', {class: 'coord-band coord-' + kind, r, pathLength: 100, transform: 'rotate(-90)'}, artwork);
    };
    const work = band('work', 25), attention = band('attention', 30);
    svg('use', {class: 'coord-crown', href: '#crown', x: -16, y: -14.8, width: 32, height: 29.6}, artwork);
    const title = svg('title', {}, parent);
    return {badge, hit, artwork, work, attention, title, parent};
  }
  function draw(marker, {x, y, screenScale, radius}) {
    marker.badge.setAttribute('transform', `translate(${x} ${y}) scale(${1 / screenScale})`);
    marker.artwork.setAttribute('transform', `scale(${radius / 32})`);
    marker.hit.setAttribute('r', Math.max(22, radius));
  }
  function update(marker, scope, working, agents, waiting, missions) {
    const fraction = (part, total) => (total ? 100 * part / total : 0).toFixed(3) + ' 100';
    const description = `Psyche, ${scope}. Inner band: ${working} of ${agents} agents working. Outer band: ${waiting} of ${missions} missions waiting for you. Open simulated conversation.`;
    if (marker.title.textContent === description) return;
    marker.work.setAttribute('stroke-dasharray', fraction(working, agents));
    marker.attention.setAttribute('stroke-dasharray', fraction(waiting, missions));
    marker.title.textContent = description;
    marker.parent.setAttribute('aria-label', description);
  }
  window.CovenAtlasCrown = Object.freeze({create, draw, update});
})();
