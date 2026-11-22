// The native dialog keeps the filtered list and its scroll position across a Psyche decision.
window.mountReviewQueue = function ({getRows, read, confirmation, html, plural}) {
  const $ = id => document.getElementById(id);
  let queueSelection = null, queueDecision = '', queueKeys = [], queueScroll = 0, queueSignature = '', queueDetailSignature = '';
  let displayedRequest;
  function closeReviewQueue() {
    queueSelection = null; queueDecision = ''; displayedRequest = null;
    $('queueDetail').replaceChildren(); $('queueList').replaceChildren(); queueKeys = [];
    $('reviewQueue').close();
    $('needBtn').setAttribute('aria-pressed', 'false');
    $('needBtn').focus();
  }
  function queueListFocus(key, index) {
    const buttons = Array.from($('queueList').querySelectorAll('button'));
    const next = buttons.find(b => b.dataset.key === key) || buttons[Math.min(index, buttons.length - 1)] || $('queueFilter');
    next.focus({preventScroll: true});
    if (next !== $('queueFilter')) next.scrollIntoView({block: 'nearest'});
  }
  function returnToQueue(message) {
    const {key} = queueSelection, index = Math.max(0, queueKeys.indexOf(key));
    queueSelection = null; queueDecision = ''; queueSignature = ''; displayedRequest = null;
    $('queueDetail').replaceChildren();
    syncReviewQueue();
    if (message) $('queueStatus').textContent = message + ' ' + $('queueStatus').textContent;
    $('queueList').scrollTop = queueScroll;
    queueListFocus(key, index);
  }
  function syncReviewQueue() {
    const rows = getRows();
    const detail = $('queueDetail'), list = $('queueList');
    detail.hidden = !queueSelection; list.hidden = $('queueTools').hidden = !!queueSelection;
    if (queueSelection) {
      const row = rows.find(r => r.key === queueSelection.key);
      if (!row) {
        const message = queueDecision === 'held' ? 'Request held.' : queueDecision === 'allowed_once' ? 'Request allowed.' : 'This request is no longer pending at this replay position.';
        return returnToQueue(message);
      }
      const {request, state} = read(row);
      const signature = JSON.stringify([row, state]);
      if (request === displayedRequest && signature === queueDetailSignature) return;
      displayedRequest = request;
      queueDetailSignature = signature;
      const previous = detail.contains(document.activeElement) ? document.activeElement.textContent : null;
      $('queueHeading').textContent = row.title;
      $('queueStatus').textContent = [row.project, row.mission, row.familiar].filter(Boolean).join(' · ');
      const back = html('button', 'btn', 'Back to queue'); back.type = 'button';
      back.addEventListener('click', () => returnToQueue());
      detail.replaceChildren(back, confirmation(row));
      if (previous) (Array.from(detail.querySelectorAll('button')).find(b => b.textContent === previous && !b.disabled) || back).focus();
      return;
    }
    const query = $('queueFilter').value.trim().toLowerCase();
    const matches = rows.filter(r => [r.project, r.mission, r.familiar, r.title].join(' ').toLowerCase().includes(query));
    const signature = JSON.stringify([rows.length, matches, query]);
    if (signature === queueSignature) return;
    queueSignature = signature;
    const focused = document.activeElement.dataset.key, index = Math.max(0, queueKeys.indexOf(focused)), scroll = list.scrollTop;
    queueKeys = matches.map(r => r.key);
    $('queueHeading').textContent = 'Needs review';
    $('queueStatus').textContent = !rows.length ? 'Inbox clear. No pending requests across the Coven.' : !matches.length ? 'No matching requests. Change or clear your filter.' : (query ? matches.length + ' of ' : '') + plural(rows.length, 'pending request');
    list.replaceChildren();
    let previousProject;
    for (const row of matches) {
      if (row.project !== previousProject) list.appendChild(html('h3', '', row.project));
      previousProject = row.project;
      const button = html('button', 'queue-row'); button.type = 'button'; button.dataset.key = row.key;
      button.setAttribute('aria-label', [row.title, row.project, row.mission, row.familiar].filter(Boolean).join(', '));
      button.append(html('b', '', row.title), html('span', '', [row.mission, row.familiar].filter(Boolean).join(' · ')));
      button.addEventListener('click', () => {
        queueScroll = list.scrollTop; queueSelection = row; queueDetailSignature = '';
        syncReviewQueue(); $('queueHeading').focus();
      });
      list.appendChild(button);
    }
    list.scrollTop = scroll;
    if (focused) queueListFocus(focused, index);
  }
  function open() {
    queueSignature = ''; $('queueFilter').value = ''; $('reviewQueue').showModal();
    syncReviewQueue(); $('queueList').scrollTop = 0; $('queueFilter').focus(); $('needBtn').setAttribute('aria-pressed', 'true');
  }
  $('queueFilter').addEventListener('input', syncReviewQueue);
  $('queueClose').addEventListener('click', closeReviewQueue);
  $('reviewQueue').addEventListener('keydown', ev => {
    ev.stopPropagation();
    if (ev.key === 'Escape' && !ev.isComposing) {
      ev.preventDefault();
      if (queueSelection) returnToQueue(); else closeReviewQueue();
    }
  });
  $('reviewQueue').addEventListener('cancel', ev => {
    ev.preventDefault();
    if (queueSelection) returnToQueue(); else closeReviewQueue();
  });

  return {open, close: closeReviewQueue, sync: syncReviewQueue, deciding(project, id, decision) {
    if (queueSelection?.project === project && queueSelection.id === id) queueDecision = decision;
  }};
};
