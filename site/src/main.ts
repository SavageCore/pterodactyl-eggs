import './style.css';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import Fuse from 'fuse.js';
import { createAtom, batch } from '@tanstack/store';
import { createIcons, ArrowLeft, ArrowUp, ArrowDown, ChevronsUpDown, Sun, Moon, Monitor, List } from 'lucide';
import {
  constructTable,
  tableFeatures,
  rowSortingFeature,
  columnFilteringFeature,
  createSortedRowModel,
  createFilteredRowModel,
  sortFn_alphanumeric,
  sortFn_basic,
  type ColumnDef,
  type Table,
  type Row,
  type Cell,
  type SortingState,
} from '@tanstack/table-core';
import type { TableReactivityBindings } from '@tanstack/table-core/reactivity';

const subscriptions = new Set<() => void>();

const lucideIcons = { ArrowLeft, ArrowUp, ArrowDown, ChevronsUpDown, Sun, Moon, Monitor, List };
function refreshIcons(root?: HTMLElement) {
  createIcons({ icons: lucideIcons, root } as Parameters<typeof createIcons>[0]);
}

const vanillaReactivity: TableReactivityBindings = {
  createOptionsStore: false,
  wrapExternalAtoms: false,
  addSubscription(subscription) {
    subscriptions.add(subscription.unsubscribe);
  },
  createWritableAtom(initialValue, options) {
    return createAtom(initialValue, options);
  },
  createReadonlyAtom(fn, options) {
    return createAtom(fn, options);
  },
  untrack(fn) {
    return fn();
  },
  batch(fn) {
    batch(fn);
  },
  schedule(fn) {
    queueMicrotask(fn);
  },
  unmount() {
    subscriptions.clear();
  },
};

interface EggVariable {
  name: string;
  envVariable: string;
  description: string;
}

interface Egg {
  slug: string;
  name: string;
  author: string;
  description: string;
  dockerImages: string[];
  variables: EggVariable[];
  path: string;
  jsonPath: string;
  readme: string;
}

marked.setOptions({ gfm: true, breaks: true });

const app = document.getElementById('app')!;

let eggs: Egg[] = [];
let fuse: Fuse<Egg>;
let filteredEggs: Egg[] = [];

const features = tableFeatures({
  coreReactivityFeature: vanillaReactivity,
  rowSortingFeature,
  columnFilteringFeature,
  sortedRowModel: createSortedRowModel(),
  filteredRowModel: createFilteredRowModel(),
  sortFns: {
    alphanumeric: sortFn_alphanumeric,
    basic: sortFn_basic,
  },
});

type EggFeatures = typeof features;

const SORTABLE_COLUMN_IDS = ['name', 'variables'] as const;
const DEFAULT_SORT: SortingState = [{ id: 'name', desc: false }];

const columns: ColumnDef<EggFeatures, Egg, unknown>[] = [
  {
    accessorKey: 'name',
    header: 'Name',
    cell: (info) => String(info.getValue()),
    sortFn: 'alphanumeric',
  },
  {
    id: 'variables',
    header: 'Variables',
    accessorFn: (row) => row.variables.length,
    cell: (info) => String(info.getValue()),
    sortFn: 'basic',
  },
];

let table: Table<EggFeatures, Egg>;
let tableUnsubscribe: (() => void) | null = null;
let lastSavedSorting = JSON.stringify(DEFAULT_SORT);

function getStoredSorting(): SortingState {
  try {
    const stored = localStorage.getItem('egg-catalog-sort');
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        const valid = parsed.filter(
          (s): s is { id: string; desc: boolean } =>
            s && typeof s.id === 'string' && typeof s.desc === 'boolean'
        );
        if (
          valid.length > 0 &&
          valid.every((s) => SORTABLE_COLUMN_IDS.includes(s.id as (typeof SORTABLE_COLUMN_IDS)[number]))
        ) {
          return valid;
        }
      }
    }
  } catch {}
  return structuredClone(DEFAULT_SORT);
}

function saveSorting(sorting: SortingState) {
  const serialized = JSON.stringify(sorting);
  if (serialized !== lastSavedSorting) {
    lastSavedSorting = serialized;
    localStorage.setItem('egg-catalog-sort', serialized);
  }
}

function createTableInstance(data: Egg[]) {
  if (tableUnsubscribe) {
    tableUnsubscribe();
    tableUnsubscribe = null;
  }
  const initialSorting = getStoredSorting();
  lastSavedSorting = JSON.stringify(initialSorting);
  const instance = constructTable({
    features,
    data,
    columns,
    enableSortingRemoval: false,
    initialState: {
      sorting: initialSorting,
    },
  });
  const sub = instance.store.subscribe((currentVal) => {
    saveSorting(currentVal.sorting);
    requestAnimationFrame(() => {
      renderRows();
      updateSortArrows(instance);
    });
  });
  tableUnsubscribe = () => sub.unsubscribe();
  table = instance;
  return instance;
}

function updateSortArrows(instance: Table<EggFeatures, Egg>) {
  document.querySelectorAll<HTMLElement>('thead th').forEach((th) => {
    const key = th.getAttribute('data-key');
    if (!key) return;
    const col = instance.getColumn(key);
    if (!col) return;
    const dir = col.getIsSorted();
    const icon = dir === 'asc' ? 'arrow-up' : dir === 'desc' ? 'arrow-down' : 'chevrons-up-down';
    const base = columns.find((c) => (c.id ?? (c as { accessorKey?: string }).accessorKey) === key)?.header ?? '';
    const ariaAttr = dir ? ` aria-label="Sort ${dir === 'asc' ? 'ascending' : 'descending'}"` : '';
    th.innerHTML = `<span>${base}</span><i data-lucide="${icon}" class="sort-icon${dir ? ' active' : ''}"${ariaAttr}></i>`;
  });
  refreshIcons();
}

type Theme = 'system' | 'light' | 'dark';
const THEME_KEY = 'egg-catalog-theme';

function getStoredTheme(): Theme {
  const stored = localStorage.getItem(THEME_KEY);
  if (stored === 'light' || stored === 'dark' || stored === 'system') {
    return stored;
  }
  return 'system';
}

function applyTheme(theme: Theme) {
  if (theme === 'system') {
    const prefersDark = window.matchMedia(
      '(prefers-color-scheme: dark)'
    ).matches;
    document.documentElement.setAttribute(
      'data-theme',
      prefersDark ? 'dark' : 'light'
    );
  } else {
    document.documentElement.setAttribute('data-theme', theme);
  }
}

function initTheme(): Theme {
  const theme = getStoredTheme();
  applyTheme(theme);
  return theme;
}

function themeIconName(type: Theme): string {
  if (type === 'light') return 'sun';
  if (type === 'dark') return 'moon';
  return 'monitor';
}

function renderThemeToggle(currentTheme: Theme): string {
  const options: Theme[] = ['system', 'light', 'dark'];
  return `
    <div class="theme-toggle">
      ${options
        .map(
          (value) =>
            `<button type="button" data-theme-value="${value}" class="${currentTheme === value ? 'active' : ''}" title="${value.charAt(0).toUpperCase() + value.slice(1)}"><i data-lucide="${themeIconName(value)}"></i></button>`
        )
        .join('')}
    </div>
  `;
}

function updateThemeToggleActiveState(activeTheme: Theme) {
  const buttons = document.querySelectorAll<HTMLElement>('.theme-toggle button');
  buttons.forEach((btn) => {
    btn.classList.toggle('active', btn.getAttribute('data-theme-value') === activeTheme);
  });
}

function attachThemeListeners() {
  const toggleEl = document.querySelector<HTMLElement>('.theme-toggle');
  if (!toggleEl) return;
  toggleEl.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const btn = target.closest('button');
    if (!btn) return;
    const theme = btn.getAttribute('data-theme-value') as Theme;
    localStorage.setItem(THEME_KEY, theme);
    applyTheme(theme);
    updateThemeToggleActiveState(theme);
  });
}

let currentTheme: Theme;

function renderTable() {
  clearScrollSpy();
  clearTocDrawer();
  clearScrollTopFab();
  app.innerHTML = `
    <div class="container">
      <header>
        <h1>Pterodactyl Egg</h1>
        <p class="subtitle">${eggs.length} egg${eggs.length !== 1 ? 's' : ''} available</p>
      </header>
      <div class="toolbar">
        <div class="search-bar">
          <input type="text" id="search" placeholder="Search eggs by name or description..." />
        </div>
        ${renderThemeToggle(currentTheme)}
      </div>
      <div class="table-wrapper">
        <table id="eggs-table">
          <thead>
            <tr>
              ${columns
                .map(
                  (col) =>
                    `<th data-key="${col.id ?? (col as { accessorKey?: string }).accessorKey}">${col.header ?? ''}</th>`
                )
                .join('')}
            </tr>
          </thead>
          <tbody></tbody>
        </table>
      </div>
    </div>
    ${renderFooter()}
    ${renderScrollTopFab()}
  `;

  createTableInstance(filteredEggs);
  updateSortArrows(table);
  renderRows();

  refreshIcons();
  attachThemeListeners();
  attachScrollTopFab();

  const headers = app.querySelectorAll('thead th');
  headers.forEach((th) => {
    th.addEventListener('click', () => {
      const key = th.getAttribute('data-key')!;
      const col = table.getColumn(key);
      if (col) {
        col.toggleSorting();
      }
    });
  });

  const searchInput = app.querySelector<HTMLInputElement>('#search')!;
  searchInput.addEventListener('input', () => {
    const value = searchInput.value.trim();
    if (value) {
      const results = fuse.search(value);
      filteredEggs = results.map((r) => r.item);
    } else {
      filteredEggs = [...eggs];
    }
    createTableInstance(filteredEggs);
    updateSortArrows(table);
    renderRows();
  });
}

function renderRows() {
  const tbody = app.querySelector('tbody')!;
  const rows = table.getSortedRowModel().rows;

  if (rows.length === 0) {
    tbody.innerHTML = `<tr><td colspan="${columns.length}" class="empty">No eggs found.</td></tr>`;
    return;
  }

  tbody.innerHTML = rows
    .map(
      (row: Row<EggFeatures, Egg>) => `
      <tr data-slug="${row.original.slug}" class="clickable">
        ${row
          .getAllCells()
          .map((cell: Cell<EggFeatures, Egg, unknown>) => {
            const column = cell.column.columnDef;
            if (typeof column.cell === 'function') {
              return `<td>${String(column.cell(cell.getContext()))}</td>`;
            }
            return `<td>${String(cell.getValue() ?? '')}</td>`;
          })
          .join('')}
       </tr>
    `
    )
    .join('');

  tbody.querySelectorAll('.clickable').forEach((tr) => {
    tr.addEventListener('click', () => {
      const slug = tr.getAttribute('data-slug')!;
      showDetail(slug);
    });
  });
}

function buildToc(html: string): { toc: string; content: string } {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const headings = doc.querySelectorAll('h1, h2, h3');

  const items: string[] = [];
  headings.forEach((heading, index) => {
    const id = `toc-${index}`;
    heading.id = id;
    const level = parseInt(heading.tagName[1]);
    const text = heading.textContent || '';
    items.push(
      `<a href="#${id}" class="toc-link toc-level-${level}">${escapeHtml(text)}</a>`
    );
  });

  const toc = items.length > 0 ? `<nav class="toc"><div class="toc-title">Contents</div>${items.join('')}</nav>` : '';
  return { toc, content: doc.body.innerHTML };
}

let scrollSpyCleanup: (() => void) | null = null;
let lockedId: string | null = null;
let lockTimer: ReturnType<typeof setTimeout> | null = null;
let lastScrollY = 0;

function clearScrollSpy() {
  if (scrollSpyCleanup) {
    scrollSpyCleanup();
    scrollSpyCleanup = null;
  }
  if (lockTimer) clearTimeout(lockTimer);
  lockedId = null;
}

function attachScrollSpy() {
  clearScrollSpy();

  const headings = document.querySelectorAll<HTMLElement>('.readme-content h1[id], .readme-content h2[id], .readme-content h3[id]');
  const links = document.querySelectorAll<HTMLElement>('.toc-link');
  if (headings.length < 2 || links.length === 0) return;

  const linkById = new Map<string, HTMLElement>();
  links.forEach((l) => {
    const href = l.getAttribute('href');
    if (href) linkById.set(href.replace('#', ''), l);
  });

  let activeId: string | null = null;

  function setActive(id: string) {
    if (id === activeId) return;
    if (activeId) linkById.get(activeId)?.classList.remove('active');
    activeId = id;
    linkById.get(id)?.classList.add('active');
  }

  let ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      if (lockedId && linkById.has(lockedId)) {
        const delta = window.scrollY - lastScrollY;
        if (Math.abs(delta) > 200) lockedId = null;
        else {
          setActive(lockedId);
          lastScrollY = window.scrollY;
          ticking = false;
          return;
        }
      }
      const threshold = window.scrollY + window.innerHeight * 0.25;
      let current: HTMLElement | null = null;
      for (const h of headings) {
        const docTop = h.getBoundingClientRect().top + window.scrollY;
        if (docTop <= threshold) current = h;
        else break;
      }
      if (current) setActive(current.id);
      lastScrollY = window.scrollY;
      ticking = false;
    });
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  lastScrollY = window.scrollY;

  const sidebar = document.querySelector<HTMLElement>('.toc-sidebar');
  if (sidebar) {
    sidebar.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const link = target.closest('a');
      if (!link) return;
      const href = link.getAttribute('href');
      if (!href) return;
      const id = href.replace('#', '');
      setActive(id);
      lockedId = id;
      if (lockTimer) clearTimeout(lockTimer);
      lockTimer = setTimeout(() => {
        lockedId = null;
        lockTimer = null;
      }, 1200);
    });
  }

  scrollSpyCleanup = () => {
    window.removeEventListener('scroll', onScroll);
  };
}

let tocDrawerCleanup: (() => void) | null = null;

function clearTocDrawer() {
  if (tocDrawerCleanup) {
    tocDrawerCleanup();
    tocDrawerCleanup = null;
  }
}

function attachTocDrawer() {
  clearTocDrawer();

  const toggleBtn = document.querySelector<HTMLElement>('.toc-menu-btn');
  const panel = document.querySelector<HTMLElement>('.toc-sidebar');
  const backdrop = document.querySelector<HTMLElement>('.toc-backdrop');
  if (!toggleBtn || !panel) return;

  const mq = window.matchMedia('(max-width: 768px)');

  function open() {
    if (!mq.matches) return;
    document.body.dataset.tocOpen = 'true';
    toggleBtn!.setAttribute('aria-expanded', 'true');
    document.body.style.overflow = 'hidden';
    panel!.focus();
  }

  function close() {
    delete document.body.dataset.tocOpen;
    toggleBtn!.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
    toggleBtn!.focus();
  }

  function toggle_() {
    if (document.body.dataset.tocOpen) close();
    else open();
  }

  toggleBtn.addEventListener('click', toggle_);
  backdrop?.addEventListener('click', close);

  panel.addEventListener('click', (e) => {
    const link = (e.target as HTMLElement).closest('a');
    if (link) close();
  });

  function onKey(e: KeyboardEvent) {
    if (e.key === 'Escape' && document.body.dataset.tocOpen) close();
  }
  document.addEventListener('keydown', onKey);

  function onMq() {
    if (!mq.matches && document.body.dataset.tocOpen) close();
  }
  mq.addEventListener('change', onMq);

  tocDrawerCleanup = () => {
    toggleBtn.removeEventListener('click', toggle_);
    backdrop?.removeEventListener('click', close);
    document.removeEventListener('keydown', onKey);
    mq.removeEventListener('change', onMq);
  };
}

function showDetail(slug: string) {
  const egg = eggs.find((e) => e.slug === slug);
  if (!egg) return;

  const html = DOMPurify.sanitize(marked.parse(egg.readme) as string);
  const { toc, content } = buildToc(html);

  app.innerHTML = `
    <div class="container">
      <a href="#" class="back-link" id="back"><i data-lucide="arrow-left"></i><span>Back to table</span></a>
      <header>
        <h1>${escapeHtml(egg.name)}</h1>
        <p>${escapeHtml(egg.description)}</p>
      </header>
      <div class="detail-actions">
        <a href="./eggs/${egg.slug}/egg.json" download class="btn btn-primary">Download egg</a>
        ${toc ? `<button type="button" class="btn toc-menu-btn" aria-expanded="false" aria-controls="toc-panel"><i data-lucide="list"></i><span>Contents</span></button>` : ''}
      </div>
      ${toc ? '<div class="toc-backdrop"></div>' : ''}
      <div class="detail-body">
        <div class="readme-content">${content}</div>
        ${toc ? `<aside class="toc-sidebar" id="toc-panel" tabindex="-1">${toc}</aside>` : ''}
      </div>
    </div>
    ${renderFooter()}
    ${renderScrollTopFab()}
  `;

  refreshIcons();
  attachScrollSpy();
  attachTocDrawer();
  attachScrollTopFab();

  app.querySelector('#back')!.addEventListener('click', (e) => {
    e.preventDefault();
    history.pushState({}, '', window.location.pathname);
    clearScrollSpy();
    clearTocDrawer();
    clearScrollTopFab();
    renderTable();
  });
}

function escapeHtml(str: string): string {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function renderScrollTopFab(): string {
  return `
    <button type="button" class="scroll-top-fab" aria-label="Scroll to top">
      <i data-lucide="arrow-up"></i>
    </button>
  `;
}

let scrollTopFabCleanup: (() => void) | null = null;

function clearScrollTopFab() {
  if (scrollTopFabCleanup) {
    scrollTopFabCleanup();
    scrollTopFabCleanup = null;
  }
}

function attachScrollTopFab() {
  clearScrollTopFab();

  const fab = document.querySelector<HTMLElement>('.scroll-top-fab');
  if (!fab) return;

  fab.addEventListener('click', () => {
    fab.classList.remove('visible');
    (document.activeElement as HTMLElement | null)?.blur?.();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  let ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      if (window.scrollY > 600) fab!.classList.add('visible');
      else fab!.classList.remove('visible');
      ticking = false;
    });
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  scrollTopFabCleanup = () => {
    window.removeEventListener('scroll', onScroll);
  };
}

function renderFooter(): string {
  const commitUrl = `https://github.com/SavageCore/pterodactyl-eggs/tree/${__COMMIT_HASH__}`;
  return `
    <footer class="footer">
      <a href="${commitUrl}" target="_blank" rel="noopener noreferrer" class="footer-link">
        <svg class="github-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>
        <span>${__SHORT_HASH__}</span>
      </a>
      <a href="https://github.com/SavageCore" target="_blank" rel="noopener noreferrer" class="footer-link">
        <span>Made with 🥚 by SavageCore</span>
      </a>
    </footer>
  `;
}

async function init() {
  currentTheme = initTheme();

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }

  try {
    const res = await fetch(`./data/eggs.json?v=${__SHORT_HASH__}`);
    eggs = await res.json();
    filteredEggs = [...eggs];
  } catch {
    eggs = [];
    filteredEggs = [];
  }

  fuse = new Fuse(eggs, {
    keys: ['name', 'description'],
    threshold: 0.3,
  });

  renderTable();
}

init();
