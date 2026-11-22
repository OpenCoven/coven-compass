// Project-local IDs may repeat. The stable tuple identifies a request at the current replay position.
(function (root) {
  function pending(world) {
    return Array.from(world.asks.values()).filter(request => request.status === 'open');
  }
  function rows(projects, familiarName) {
    const result = [];
    for (const project of Object.keys(projects).sort()) {
      const {world} = projects[project];
      for (const q of pending(world)) {
        result.push({
          key: JSON.stringify([project, q.id]), project, id: q.id, title: q.title,
          mission: world.missions.get(q.mission)?.name || q.mission || '',
          familiar: q.fam ? familiarName(q.fam) : ''
        });
      }
    }
    return result;
  }
  const api = {pending, rows};
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CovenReviewQueue = api;
})(globalThis);
