/**
 * The owner's category lists. Transactions store category names as text, so a rename must also
 * rewrite matching transactions, and a category is hidden rather than deleted.
 * The server imports this file, so local imports keep their .ts extension.
 */

import {
  CATEGORY_COLORS,
  DEFAULT_EXPENSE_CATEGORY,
  DEFAULT_INCOME_CATEGORY,
  EXPENSE_CATEGORIES,
  FALLBACK_EXPENSE_CATEGORY,
  FALLBACK_INCOME_CATEGORY,
  INCOME_CATEGORIES,
  SUBCATEGORIES,
} from './constants.ts';

export type CategoryType = 'expense' | 'income';

export interface CategoryItem {
  name: string;
  hidden?: boolean;
  /** Earlier names, so offline parser results still reach a renamed category. */
  aliases?: string[];
}

export interface CategoryEntry extends CategoryItem {
  color?: string;
  subCategories: CategoryItem[];
}

export interface CategoryConfig {
  expense: CategoryEntry[];
  income: CategoryEntry[];
}

export interface AiCategoryLists {
  expense: string[];
  income: string[];
  subCategories: Record<string, string[]>;
}

export type NameChange =
  | { kind: 'category'; type: CategoryType; from: string; to: string }
  | { kind: 'subCategory'; type: CategoryType; category: string; from: string; to: string };

export const MAX_NAME_LENGTH = 40;
const MAX_CATEGORIES = 60;
const MAX_SUBCATEGORIES = 40;
const MAX_ALIASES = 10;
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;

const PALETTE = [
  '#0EA5E9',
  '#F43F5E',
  '#D946EF',
  '#8B5CF6',
  '#EF4444',
  '#22D3EE',
  '#F59E0B',
  '#2563EB',
  '#6366F1',
  '#0D9488',
  '#10B981',
  '#65A30D',
];

function compareNames(left: { name: string }, right: { name: string }): number {
  return left.name.localeCompare(right.name, 'id', { sensitivity: 'base' });
}

function sameName(left: string, right: string): boolean {
  return left.toLocaleLowerCase('id') === right.toLocaleLowerCase('id');
}

function toEntry(name: string): CategoryEntry {
  return {
    name,
    subCategories: (SUBCATEGORIES[name] ?? []).map((subCategory) => ({ name: subCategory })),
  };
}

export function buildDefaultCategories(): CategoryConfig {
  return {
    expense: EXPENSE_CATEGORIES.map(toEntry),
    income: INCOME_CATEGORIES.map(toEntry),
  };
}

export function fallbackCategory(type: CategoryType): string {
  return type === 'income' ? FALLBACK_INCOME_CATEGORY : FALLBACK_EXPENSE_CATEGORY;
}

/** Unrecognised AI results land here, so these stay visible under their own names. */
export function isLockedCategory(type: CategoryType, name: string): boolean {
  return name === fallbackCategory(type);
}

export function visibleCategoryNames(config: CategoryConfig, type: CategoryType): string[] {
  return config[type].filter((entry) => !entry.hidden).map((entry) => entry.name);
}

export function allCategoryNames(config: CategoryConfig): string[] {
  return [...config.expense, ...config.income].map((entry) => entry.name);
}

export function visibleSubCategories(config: CategoryConfig, category: string): string[] {
  const names = [...config.expense, ...config.income]
    .filter((entry) => entry.name === category)
    .flatMap((entry) => entry.subCategories)
    .filter((item) => !item.hidden)
    .map((item) => item.name);
  return [...new Set(names)];
}

export function defaultCategory(config: CategoryConfig, type: CategoryType): string {
  const preferred = type === 'income' ? DEFAULT_INCOME_CATEGORY : DEFAULT_EXPENSE_CATEGORY;
  const visible = visibleCategoryNames(config, type);
  return visible.includes(preferred) ? preferred : fallbackCategory(type);
}

export function categoryColor(config: CategoryConfig, name: string): string {
  const custom = [...config.expense, ...config.income].find((entry) => entry.name === name)?.color;
  if (custom) return custom;
  if (CATEGORY_COLORS[name]) return CATEGORY_COLORS[name];

  let hash = 0;
  for (const character of name) {
    hash = (hash * 31 + character.charCodeAt(0)) % PALETTE.length;
  }
  return PALETTE[hash];
}

function findByNameOrAlias<T extends CategoryItem>(items: T[], name: unknown): T | undefined {
  if (typeof name !== 'string') return undefined;
  return (
    items.find((item) => item.name === name) ?? items.find((item) => item.aliases?.includes(name))
  );
}

/** Maps an AI or parser result onto the owner's lists, so an unknown value is never saved. */
export function normalizeSelection(
  config: CategoryConfig,
  type: CategoryType,
  category: unknown,
  subCategory: unknown
): { category: string; subCategory: string } {
  const found = findByNameOrAlias(config[type], category);
  if (!found || found.hidden) {
    return { category: fallbackCategory(type), subCategory: '' };
  }

  const foundSub = findByNameOrAlias(found.subCategories, subCategory);
  return {
    category: found.name,
    subCategory: foundSub && !foundSub.hidden ? foundSub.name : '',
  };
}

function cleanName(value: string): string {
  const name = value.trim().replace(/\s+/g, ' ');
  if (!name) throw new Error('Nama wajib diisi.');
  if (name.length > MAX_NAME_LENGTH) {
    throw new Error(`Nama maksimal ${MAX_NAME_LENGTH} karakter.`);
  }
  if (CONTROL_CHARACTERS.test(name)) throw new Error('Nama memuat karakter yang tidak valid.');
  return name;
}

function assertUnique(items: CategoryItem[], name: string, currentName?: string): void {
  const duplicate = items.some((item) => item.name !== currentName && sameName(item.name, name));
  if (duplicate) throw new Error(`"${name}" sudah ada.`);
}

function requireEntry(config: CategoryConfig, type: CategoryType, name: string): CategoryEntry {
  const entry = config[type].find((item) => item.name === name);
  if (!entry) throw new Error(`Kategori "${name}" tidak ditemukan.`);
  return entry;
}

function renamedItem<T extends CategoryItem>(item: T, name: string): T {
  const aliases = [...new Set([item.name, ...(item.aliases ?? [])])]
    .filter((alias) => alias !== name)
    .slice(0, MAX_ALIASES);
  return { ...item, name, aliases };
}

function withEntries(config: CategoryConfig, type: CategoryType, entries: CategoryEntry[]) {
  return { ...config, [type]: [...entries].sort(compareNames) };
}

function withEntry(
  config: CategoryConfig,
  type: CategoryType,
  name: string,
  update: (entry: CategoryEntry) => CategoryEntry
): CategoryConfig {
  requireEntry(config, type, name);
  return withEntries(
    config,
    type,
    config[type].map((entry) => (entry.name === name ? update(entry) : entry))
  );
}

export function addCategory(
  config: CategoryConfig,
  type: CategoryType,
  value: string
): CategoryConfig {
  const name = cleanName(value);
  assertUnique(config[type], name);
  if (config[type].length >= MAX_CATEGORIES) {
    throw new Error(`Maksimal ${MAX_CATEGORIES} kategori.`);
  }
  return withEntries(config, type, [...config[type], { name, subCategories: [] }]);
}

export function setCategoryHidden(
  config: CategoryConfig,
  type: CategoryType,
  name: string,
  hidden: boolean
): CategoryConfig {
  if (hidden && isLockedCategory(type, name)) {
    throw new Error(`"${name}" dipakai sebagai kategori cadangan, jadi tidak bisa disembunyikan.`);
  }
  return withEntry(config, type, name, (entry) => ({ ...entry, hidden }));
}

export function addSubCategory(
  config: CategoryConfig,
  type: CategoryType,
  category: string,
  value: string
): CategoryConfig {
  const name = cleanName(value);
  const { subCategories } = requireEntry(config, type, category);
  assertUnique(subCategories, name);
  if (subCategories.length >= MAX_SUBCATEGORIES) {
    throw new Error(`Maksimal ${MAX_SUBCATEGORIES} subkategori.`);
  }
  return withEntry(config, type, category, (entry) => ({
    ...entry,
    subCategories: [...entry.subCategories, { name }].sort(compareNames),
  }));
}

export function setSubCategoryHidden(
  config: CategoryConfig,
  type: CategoryType,
  category: string,
  name: string,
  hidden: boolean
): CategoryConfig {
  return withEntry(config, type, category, (entry) => ({
    ...entry,
    subCategories: entry.subCategories.map((item) =>
      item.name === name ? { ...item, hidden } : item
    ),
  }));
}

/** Checks the new name and returns the change. Throws when the rename is not allowed. */
export function prepareCategoryRename(
  config: CategoryConfig,
  type: CategoryType,
  from: string,
  value: string
): NameChange {
  if (isLockedCategory(type, from)) {
    throw new Error(`"${from}" dipakai sebagai kategori cadangan, jadi namanya tidak bisa diubah.`);
  }
  requireEntry(config, type, from);
  const to = cleanName(value);
  assertUnique(config[type], to, from);
  return { kind: 'category', type, from, to };
}

export function prepareSubCategoryRename(
  config: CategoryConfig,
  type: CategoryType,
  category: string,
  from: string,
  value: string
): NameChange {
  const entry = requireEntry(config, type, category);
  if (!entry.subCategories.some((item) => item.name === from)) {
    throw new Error(`Subkategori "${from}" tidak ditemukan.`);
  }
  const to = cleanName(value);
  assertUnique(entry.subCategories, to, from);
  return { kind: 'subCategory', type, category, from, to };
}

export function applyNameChange(config: CategoryConfig, change: NameChange): CategoryConfig {
  if (change.kind === 'category') {
    const color = categoryColor(config, change.from); // The chart keeps its colour after a rename.
    const entries = config[change.type].map((entry) =>
      entry.name === change.from ? { ...renamedItem(entry, change.to), color } : entry
    );
    return withEntries(config, change.type, entries);
  }

  return withEntry(config, change.type, change.category, (entry) => ({
    ...entry,
    subCategories: entry.subCategories
      .map((item) => (item.name === change.from ? renamedItem(item, change.to) : item))
      .sort(compareNames),
  }));
}

interface TransactionCategoryFields {
  id: string;
  type: string;
  category: string;
  subCategory?: string;
}

/** A name can exist on both the income and expense side, so the type must match too. */
export function findAffectedTransactionIds(
  transactions: TransactionCategoryFields[],
  change: NameChange
): string[] {
  return transactions
    .filter((tx) => {
      if (tx.type !== change.type) return false;
      return change.kind === 'category'
        ? tx.category === change.from
        : tx.category === change.category && tx.subCategory === change.from;
    })
    .map((tx) => tx.id);
}

export function changedFields(change: NameChange): Record<string, string> {
  return change.kind === 'category' ? { category: change.to } : { subCategory: change.to };
}

function parseItem(value: unknown): CategoryItem | null {
  if (typeof value !== 'object' || value === null) return null;
  const raw = value as Record<string, unknown>;
  if (typeof raw.name !== 'string' || !raw.name.trim()) return null;

  return {
    name: raw.name,
    ...(raw.hidden === true ? { hidden: true } : {}),
    ...(Array.isArray(raw.aliases)
      ? { aliases: raw.aliases.filter((alias): alias is string => typeof alias === 'string') }
      : {}),
  };
}

function parseSide(value: unknown, type: CategoryType, defaults: CategoryEntry[]): CategoryEntry[] {
  if (!Array.isArray(value)) return defaults;

  const entries: CategoryEntry[] = [];
  for (const rawEntry of value) {
    const item = parseItem(rawEntry);
    if (!item) return defaults;
    const raw = rawEntry as Record<string, unknown>;
    entries.push({
      ...item,
      ...(typeof raw.color === 'string' ? { color: raw.color } : {}),
      subCategories: (Array.isArray(raw.subCategories) ? raw.subCategories : [])
        .map(parseItem)
        .filter((sub): sub is CategoryItem => sub !== null),
    });
  }

  const fallback = fallbackCategory(type);
  const withFallback = entries.some((entry) => entry.name === fallback)
    ? entries
    : [...entries, toEntry(fallback)];
  return withFallback
    .map((entry) => (entry.name === fallback ? { ...entry, hidden: false } : entry))
    .sort(compareNames);
}

/** Reads a stored document. A damaged side falls back to the built-in list. */
export function parseCategoryConfig(value: unknown): CategoryConfig {
  const defaults = buildDefaultCategories();
  if (typeof value !== 'object' || value === null) return defaults;
  const raw = value as Record<string, unknown>;
  return {
    expense: parseSide(raw.expense, 'expense', defaults.expense),
    income: parseSide(raw.income, 'income', defaults.income),
  };
}

export function toAiCategoryLists(config: CategoryConfig): AiCategoryLists {
  const subCategories: Record<string, string[]> = {};
  for (const name of allCategoryNames(config)) {
    const subs = visibleSubCategories(config, name);
    if (subs.length > 0) subCategories[name] = subs;
  }
  return {
    expense: visibleCategoryNames(config, 'expense'),
    income: visibleCategoryNames(config, 'income'),
    subCategories,
  };
}

function safeNames(value: unknown, limit: number): string[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > limit) return null;
  const valid = value.every(
    (name) =>
      typeof name === 'string' &&
      name.length > 0 &&
      name.length <= MAX_NAME_LENGTH &&
      !CONTROL_CHARACTERS.test(name)
  );
  return valid ? (value as string[]) : null;
}

/** The server trusts nothing from the request: a bad list means the built-in one is used. */
export function resolveAiCategoryLists(value: unknown): AiCategoryLists {
  const defaults = toAiCategoryLists(buildDefaultCategories());
  if (typeof value !== 'object' || value === null) return defaults;

  const raw = value as Record<string, unknown>;
  const expense = safeNames(raw.expense, MAX_CATEGORIES);
  const income = safeNames(raw.income, MAX_CATEGORIES);
  if (!expense || !income) return defaults;

  const subCategories: Record<string, string[]> = {};
  if (typeof raw.subCategories === 'object' && raw.subCategories !== null) {
    for (const name of [...expense, ...income]) {
      const subs = safeNames(
        (raw.subCategories as Record<string, unknown>)[name],
        MAX_SUBCATEGORIES
      );
      if (subs) subCategories[name] = subs;
    }
  }

  return { expense, income, subCategories };
}

export function buildSubCategoryGuide(lists: AiCategoryLists): string {
  return Object.entries(lists.subCategories)
    .map(([category, options]) => `  - ${category}: ${options.join(', ')}`)
    .join('\n');
}
