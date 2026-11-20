(() => {
  const select = selector => document.querySelector(selector);
  const chapterNav = select('#chapters');
  const links = [...chapterNav.querySelectorAll('a')];
  const chapters = links.map(link => document.getElementById(link.hash.slice(1)));
  const menu = select('#chapter-menu');
  const narrow = matchMedia('(max-width: 800px)');
  const input = select('#search');
  const matches = select('#matches');
  const outline = select('.outline');
  const compactOutline = matchMedia('(max-width: 1150px)');
  let current;
  let headings = [];
  let outlineLinks = [];
  let activeSection;
  let scrollFrame;

  function placeOutline() {
    const container = select(compactOutline.matches ? '#inline-outline' : '.outline-rail');
    container.append(outline);
    outline.open = !compactOutline.matches;
  }

  function updateSection() {
    scrollFrame = 0;
    const readingLine = select('.top').getBoundingClientRect().bottom + 36;
    let index = headings.findLastIndex(heading => heading.getBoundingClientRect().top <= readingLine);
    if (Math.ceil(window.scrollY + innerHeight) >= document.documentElement.scrollHeight) {
      // Near the end, a linked heading can be visible below the sticky header
      // without enough document remaining to align it with the reading line.
      const linked = outlineLinks.findIndex(link => link.hash === location.hash);
      if (linked >= 0 && headings[linked].getBoundingClientRect().top >= readingLine) index = linked;
      else if (window.scrollY > 0) index = headings.length - 1;
    }
    const next = outlineLinks[index];
    if (activeSection === next) return;
    activeSection?.removeAttribute('aria-current');
    next?.setAttribute('aria-current', 'location');
    activeSection = next;
  }

  function scheduleSection() {
    if (!scrollFrame) scrollFrame = requestAnimationFrame(updateSection);
  }

  const tableObserver = new ResizeObserver(entries => {
    for (const {target} of entries) {
      const overflow = target.scrollWidth > target.clientWidth + 1;
      let hint = target.previousElementSibling;
      if (!hint?.classList.contains('table-hint')) hint = null;
      if (overflow) {
        target.tabIndex = 0;
        if (!hint) {
          hint = document.createElement('div');
          hint.className = 'table-hint';
          hint.textContent = 'Scroll horizontally to see all columns →';
          target.before(hint);
        }
      } else {
        target.removeAttribute('tabindex');
        hint?.remove();
      }
    }
  });

  function navItem(heading) {
    const item = document.createElement('li');
    const link = document.createElement('a');
    link.href = '#' + heading.id;
    link.textContent = heading.textContent;
    item.append(link);
    return item;
  }

  function search() {
    const query = input.value.trim().toLowerCase();
    chapterNav.hidden = !!query;
    matches.hidden = !query;
    const list = matches.querySelector('ul');
    list.replaceChildren();
    if (!query) return;
    for (const chapter of chapters) {
      for (const heading of chapter.querySelectorAll('h1, h2[id], h3[id]')) {
        if (!heading.textContent.toLowerCase().includes(query)) continue;
        const item = navItem(heading);
        if (!heading.id) item.firstChild.href = '#' + chapter.id;
        list.append(item);
      }
    }
    const count = list.children.length;
    matches.querySelector('p').textContent = count ? count + (count === 1 ? ' result' : ' results') : 'No matching headings';
  }

  function setPager(selector, link, direction) {
    const slot = select(selector);
    slot.hidden = !link;
    if (!link) return;
    slot.href = link.hash;
    const label = document.createElement('small');
    label.textContent = direction;
    slot.replaceChildren(label, link.textContent);
  }

  function render(moveFocus) {
    let fragment;
    try { fragment = decodeURIComponent(location.hash.slice(1)); } catch { fragment = ''; }
    const anchor = document.getElementById(fragment);
    if (anchor && !anchor.closest('.chapter') && current) return;
    const target = anchor?.closest('.chapter') ? anchor : null;
    const chapter = target?.closest('.chapter') || chapters[0];
    if (current !== chapter) {
      const index = chapters.indexOf(chapter);
      for (const [i, entry] of chapters.entries()) {
        entry.hidden = entry !== chapter;
        if (i === index) links[i].setAttribute('aria-current', 'page');
        else links[i].removeAttribute('aria-current');
      }
      select('#group').textContent = chapter.dataset.group;
      const group = links[index].closest('.chapter-group');
      if (group) group.open = true;
      tableObserver.disconnect();
      for (const table of chapter.querySelectorAll('.table-scroll')) tableObserver.observe(table);
      headings = [...chapter.querySelectorAll('h2[id]')];
      outline.querySelector('ul').replaceChildren(...headings.map(navItem));
      outlineLinks = [...outline.querySelectorAll('a')];
      outline.hidden = headings.length === 0;
      setPager('#previous', links[index - 1], '← Previous');
      setPager('#next', links[index + 1], 'Next →');
      select('.pager').hidden = false;
      document.title = chapter.querySelector('h1').textContent + ' · Compass Docs';
      current = chapter;
    }
    if (moveFocus || target) {
      const destination = target || chapter;
      if (moveFocus) {
        destination.tabIndex = -1;
        destination.focus({preventScroll: true});
      }
      if (destination === chapter) window.scrollTo(0, 0);
      else destination.scrollIntoView();
    }
    scheduleSection();
  }

  function openSearch() {
    menu.open = true;
    input.focus();
    input.select();
  }

  function syncMenu() { menu.open = !narrow.matches; }
  placeOutline();
  compactOutline.addEventListener('change', placeOutline);
  outline.addEventListener('click', event => {
    const link = event.target.closest('a');
    if (!link || !compactOutline.matches || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    outline.open = false;
    if (link.hash === location.hash) render(true);
  });
  window.addEventListener('scroll', scheduleSection, {passive: true});
  window.addEventListener('resize', scheduleSection);
  syncMenu();
  narrow.addEventListener('change', syncMenu);
  select('.search').hidden = false;
  input.addEventListener('input', search);
  document.addEventListener('keydown', event => {
    if ((event.key === '/' && document.activeElement !== input) || ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k')) {
      event.preventDefault();
      openSearch();
    } else if (event.key === 'Escape' && menu.contains(document.activeElement)) {
      input.value = '';
      search();
      if (narrow.matches) {
        menu.open = false;
        menu.querySelector('summary').focus();
      } else input.focus();
    }
  });
  menu.addEventListener('click', event => {
    const link = event.target.closest('a[href^="#"]');
    if (!link || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    if (narrow.matches) menu.open = false;
    if (link.hash === location.hash) render(true);
    // The browser must follow the link before its search result is removed.
    setTimeout(() => { input.value = ''; search(); }, 0);
  });

  const theme = select('.theme');
  function applyTheme(value) {
    document.documentElement.dataset.theme = value;
    theme.setAttribute('aria-label', 'Switch to ' + (value === 'dark' ? 'light' : 'dark') + ' theme');
  }
  let savedTheme;
  try { savedTheme = localStorage.getItem('compass-guide-theme'); } catch {}
  applyTheme(savedTheme === 'light' ? 'light' : 'dark');
  theme.hidden = false;
  theme.addEventListener('click', () => {
    const value = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    applyTheme(value);
    try { localStorage.setItem('compass-guide-theme', value); } catch {}
  });
  render(false);
  window.addEventListener('hashchange', () => render(true));
})();
