// Both map scopes use this architectural model. Coordinates are on the map ground plane.
(() => {
  'use strict';
  const circle = (x, y, radius, sides, angle) => Array.from({length: sides}, (_, i) => {
    const a = angle + i * 2 * Math.PI / sides;
    return [x + radius * Math.cos(a), y + radius * Math.sin(a)];
  });

  function model(runs, overview) {
    const pieces = [];
    const prism = (points, bottom, top, material, detail = false) => {
      const x = points.reduce((v, p) => v + p[0], 0) / points.length;
      const y = points.reduce((v, p) => v + p[1], 0) / points.length;
      pieces.push({points, bottom, top, material, detail, x, y});
    };
    for (const [index, run] of runs.entries()) {
      const [a, b, c, d] = run;
      // Each curtain wall terminates at a real route opening.
      for (const [start, end] of [[a, b], [c, d]]) {
        const length = Math.hypot(end[0] - start[0], end[1] - start[1]);
        const dx = (end[0] - start[0]) / length, dy = (end[1] - start[1]) / length;
        const point = (t, offset) => [start[0] + dx * t - dy * offset, start[1] + dy * t + dx * offset];
        const strip = (from, to, width) => [point(from,-width),point(to,-width),point(to,width),point(from,width)];
        prism(strip(0, length, 8), 0, 30, 'wall');
        const steps = Math.max(1, Math.floor(length / 38));
        for (let i = 0; i < steps; i++) {
          const t = (i + .5) * length / steps;
          prism(strip(t - 7, t + 7, 7), 30, 38, 'cap', true);
        }
      }
      const x = (b[0]+c[0])/2, y = (b[1]+c[1])/2;
      const sides = index % 2 ? 4 : 12, angle = index % 2 ? Math.PI / 4 : 0;
      prism(circle(x,y,46,sides,angle), 0, 61, 'tower');
      prism(circle(x,y,49,sides,angle), 61, 68, 'rim');
      prism(circle(x,y,34,sides,angle), 68, 68, 'roof', true);
    }
    // The overview keep holds the mission total. Its counterpart inside is the Psyche hub.
    if (overview) {
      prism(circle(0,0,83,16,0), 0, 44, 'tower');
      prism(circle(0,0,88,16,0), 44, 51, 'rim');
      prism(circle(0,0,75,16,0), 51, 51, 'roof');
    }
    return pieces;
  }

  function create(parent, runs, svg, overview = false) {
    const g = svg('g', {'aria-hidden':'true', 'pointer-events':'none', class:'castle-stonework'}, parent);
    return {g, pieces: model(runs, overview).map(piece => {
      const group = svg('g', {class:'castle-' + piece.material}, g);
      return {...piece, group, side: svg('path', {class:'castle-side'}, group), face: svg('path', {class:'castle-face'}, group)};
    })};
  }

  function draw(castle, project, yaw, pitch, detail) {
    const signature = [yaw, pitch, detail].join('/');
    if (castle.view === signature) return;
    castle.view = signature;
    const path = points => 'M' + points.map(p => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join('L') + 'Z';
    const layers = [];
    for (const piece of castle.pieces) {
      piece.group.style.display = piece.detail && !detail ? 'none' : '';
      if (piece.detail && !detail) continue;
      const top = piece.points.map(([x,y]) => project(x,y,piece.top));
      const base = piece.points.map(([x,y]) => project(x,y,piece.bottom));
      let sides = '';
      if (pitch && piece.top > piece.bottom) {
        top.forEach((p,i) => {
          const j = (i+1) % top.length;
          if (top[j][0] < p[0]) sides += path([base[i],base[j],top[j],p]);
        });
      }
      piece.side.setAttribute('d', sides);
      piece.face.setAttribute('d', path(top));
      layers.push([project(piece.x,piece.y,(piece.top+piece.bottom)/2)[2],piece.group]);
    }
    layers.sort((a,b) => a[0]-b[0]).forEach(([,g]) => castle.g.appendChild(g));
  }
  window.CovenCastleMap = {create, draw};
})();
