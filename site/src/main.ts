import './style.css';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import Fuse from 'fuse.js';
import { createAtom, batch } from '@tanstack/store';
import { createIcons, ArrowLeft, ArrowRight, ArrowUp, ArrowDown, ChevronsUpDown, Sun, Moon, Monitor, List } from 'lucide';
import {
  constructTable,
  tableFeatures,
  rowSortingFeature,
  rowPaginationFeature,
  columnFilteringFeature,
  createSortedRowModel,
  createFilteredRowModel,
  createPaginatedRowModel,
  sortFn_alphanumeric,
  sortFn_basic,
  type ColumnDef,
  type Table,
  type Row,
  type Cell,
  type SortingState,
  type PaginationState,
} from '@tanstack/table-core';
import type { TableReactivityBindings } from '@tanstack/table-core/reactivity';

const subscriptions = new Set<() => void>();

const lucideIcons = { ArrowLeft, ArrowRight, ArrowUp, ArrowDown, ChevronsUpDown, Sun, Moon, Monitor, List };
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
  fileName: string;
  downloadPath: string;
  readmePath: string;
}

marked.setOptions({ gfm: true, breaks: true });

const app = document.getElementById('app')!;

let eggs: Egg[] = [];
let fuse: Fuse<Egg>;
let filteredEggs: Egg[] = [];

const features = tableFeatures({
  coreReactivityFeature: vanillaReactivity,
  rowSortingFeature,
  rowPaginationFeature,
  columnFilteringFeature,
  sortedRowModel: createSortedRowModel(),
  filteredRowModel: createFilteredRowModel(),
  paginatedRowModel: createPaginatedRowModel(),
  sortFns: {
    alphanumeric: sortFn_alphanumeric,
    basic: sortFn_basic,
  },
});

type EggFeatures = typeof features;

const SORTABLE_COLUMN_IDS = ['name', 'variables'] as const;
const DEFAULT_SORT: SortingState = [{ id: 'name', desc: false }];
const DEFAULT_PAGE_SIZE = 25;

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
let currentPagination: PaginationState = { pageIndex: 0, pageSize: DEFAULT_PAGE_SIZE };

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

function getStoredPageSize(): number {
  const stored = localStorage.getItem('egg-catalog-page-size');
  if (stored) {
    const n = Number(stored);
    if ([10, 25, 50, 100].includes(n)) return n;
  }
  return DEFAULT_PAGE_SIZE;
}

function getStoredPageIndex(): number {
  const stored = localStorage.getItem('egg-catalog-page-index');
  if (stored) {
    const n = Number(stored);
    if (Number.isInteger(n) && n >= 0) return n;
  }
  return 0;
}

function savePagination(pagination: PaginationState) {
  localStorage.setItem('egg-catalog-page-size', String(pagination.pageSize));
  localStorage.setItem('egg-catalog-page-index', String(pagination.pageIndex));
}

function createTableInstance(data: Egg[]) {
  if (tableUnsubscribe) {
    tableUnsubscribe();
    tableUnsubscribe = null;
  }
  const initialSorting = getStoredSorting();
  lastSavedSorting = JSON.stringify(initialSorting);
  const storedPageSize = getStoredPageSize();
  const storedPageIndex = getStoredPageIndex();
  const instance = constructTable({
    features,
    data,
    columns,
    enableSortingRemoval: false,
    initialState: {
      sorting: initialSorting,
      pagination: {
        pageSize: storedPageSize,
        pageIndex: Math.min(storedPageIndex, Math.max(0, Math.ceil(data.length / storedPageSize) - 1)),
      },
    },
  });
  const sub = instance.store.subscribe((currentVal) => {
    saveSorting(currentVal.sorting);
    savePagination(currentVal.pagination);
    currentPagination = currentVal.pagination;
    requestAnimationFrame(() => {
      renderRows();
      updateSortArrows(instance);
      updatePaginationControls(instance);
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

function updatePaginationControls(instance: Table<EggFeatures, Egg>) {
  const pageCount = instance.getPageCount();
  const { pageIndex, pageSize } = currentPagination;
  const label = document.querySelector<HTMLElement>('.pagination-label');
  if (label) label.textContent = `Page ${pageIndex + 1} of ${pageCount}`;
  const prevBtn = document.querySelector<HTMLButtonElement>('.pagination-prev');
  const nextBtn = document.querySelector<HTMLButtonElement>('.pagination-next');
  if (prevBtn) prevBtn.disabled = !instance.getCanPreviousPage();
  if (nextBtn) nextBtn.disabled = !instance.getCanNextPage();
  const sizeSelect = document.querySelector<HTMLSelectElement>('.pagination-size');
  if (sizeSelect) sizeSelect.value = String(pageSize);
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

function renderPaginationBar(): string {
  return `
    <div class="pagination">
      <button type="button" class="btn pagination-prev"><i data-lucide="arrow-left"></i><span>Prev</span></button>
      <span class="pagination-label">Page 1 of 1</span>
      <button type="button" class="btn pagination-next"><span>Next</span><i data-lucide="arrow-right"></i></button>
      <select class="pagination-size" aria-label="Page size">
        <option value="10">10</option>
        <option value="25">25</option>
        <option value="50">50</option>
        <option value="100">100</option>
      </select>
    </div>
  `;
}

function attachPaginationListeners() {
  const prevBtn = document.querySelector<HTMLButtonElement>('.pagination-prev');
  const nextBtn = document.querySelector<HTMLButtonElement>('.pagination-next');
  const sizeSelect = document.querySelector<HTMLSelectElement>('.pagination-size');
  prevBtn?.addEventListener('click', () => table.previousPage());
  nextBtn?.addEventListener('click', () => table.nextPage());
  sizeSelect?.addEventListener('change', () => {
    table.setPageSize(Number(sizeSelect.value));
  });
}

function isSeeded(): boolean {
  return eggs.length > 0 && eggs[0].slug.startsWith('seeded-');
}

function renderTable() {
  clearScrollSpy();
  clearTocDrawer();
  clearScrollTopFab();
  const seededBadge = isSeeded() ? '<span class="seeded-badge">Seeded test data</span>' : '';
  app.innerHTML = `
    <div class="container">
      <header>
        <h1>Pterodactyl Egg</h1>
        <p class="subtitle">${eggs.length} egg${eggs.length !== 1 ? 's' : ''} available${seededBadge}</p>
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
      ${renderPaginationBar()}
    </div>
    ${renderFooter()}
    ${renderScrollTopFab()}
  `;

  createTableInstance(filteredEggs);
  updateSortArrows(table);
  updatePaginationControls(table);
  renderRows();

  refreshIcons();
  attachThemeListeners();
  attachScrollTopFab();
  attachPaginationListeners();

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
    table.setPageIndex(0);
    updateSortArrows(table);
    updatePaginationControls(table);
    renderRows();
  });
}

function renderRows() {
  const tbody = app.querySelector('tbody')!;
  const rows = table.getPaginatedRowModel().rows;

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

const readmeCache = new Map<string, string>();

async function showDetail(slug: string) {
  const egg = eggs.find((e) => e.slug === slug);
  if (!egg) return;

  app.innerHTML = `
    <div class="container">
      <a href="#" class="back-link" id="back"><i data-lucide="arrow-left"></i><span>Back to table</span></a>
      <header>
        <h1>${escapeHtml(egg.name)}</h1>
        <p>${escapeHtml(egg.description)}</p>
      </header>
      <div class="detail-actions">
        <a href="./${egg.downloadPath}" download="${egg.fileName}" class="btn btn-primary">Download egg</a>
        <button type="button" class="btn toc-menu-btn" aria-expanded="false" aria-controls="toc-panel" style="visibility:hidden"><i data-lucide="list"></i><span>Contents</span></button>
      </div>
      <div class="detail-body">
        <div class="readme-content">
          <p class="readme-loading">Loading...</p>
        </div>
      </div>
    </div>
    ${renderFooter()}
    ${renderScrollTopFab()}
  `;

  refreshIcons();
  attachScrollTopFab();

  const contentEl = app.querySelector<HTMLElement>('.readme-content')!;

  const renderReadme = (markdown: string) => {
    const html = DOMPurify.sanitize(marked.parse(markdown) as string);
    const { toc, content } = buildToc(html);
    app.querySelector('.detail-actions')!.innerHTML = `
      <a href="./${egg.downloadPath}" download="${egg.fileName}" class="btn btn-primary">Download egg</a>
      ${toc ? `<button type="button" class="btn toc-menu-btn" aria-expanded="false" aria-controls="toc-panel"><i data-lucide="list"></i><span>Contents</span></button>` : ''}
    `;
    app.querySelector('.detail-body')!.innerHTML = `
      <div class="readme-content">${content}</div>
      ${toc ? `<aside class="toc-sidebar" id="toc-panel" tabindex="-1">${toc}</aside>` : ''}
    `;
    refreshIcons();
    attachScrollSpy();
    attachTocDrawer();
  };

  const renderError = () => {
    contentEl.innerHTML = `<p class="readme-error">Failed to load README. <button type="button" class="btn" id="readme-retry">Retry</button></p>`;
    refreshIcons();
    app.querySelector('#readme-retry')!.addEventListener('click', () => {
      readmeCache.delete(slug);
      showDetail(slug);
    });
  };

  if (readmeCache.has(slug)) {
    renderReadme(readmeCache.get(slug)!);
  } else {
    try {
      const res = await fetch(`./${egg.readmePath}?v=${__SHORT_HASH__}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      readmeCache.set(slug, text);
      renderReadme(text);
    } catch {
      renderError();
    }
  }

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

  function updateFabVisibility() {
    const scrollY = window.scrollY;
    const innerHeight = window.innerHeight;
    const docHeight = document.documentElement.scrollHeight;
    const threshold = 200;
    const nearBottom = scrollY + innerHeight >= docHeight - 100;
    if (scrollY > threshold || nearBottom) {
      fab!.classList.add('visible');
    } else {
      fab!.classList.remove('visible');
    }
  }

  let ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      updateFabVisibility();
      ticking = false;
    });
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', updateFabVisibility, { passive: true });
  updateFabVisibility();

  scrollTopFabCleanup = () => {
    window.removeEventListener('scroll', onScroll);
    window.removeEventListener('resize', updateFabVisibility);
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
