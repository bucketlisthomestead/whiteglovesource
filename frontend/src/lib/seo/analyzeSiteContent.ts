import type {
  SeoAnalysisResult,
  SeoCategoryResult,
  SeoCategoryStatus,
  SeoGrade,
  SeoTip,
  StringField,
} from './seo.types';

const DEFAULT_KEYWORDS = [
  'moving',
  'delivery',
  'white glove',
  'white-glove',
  'interior designer',
  'furniture',
  'installation',
  'storage',
  'receiving',
  'high point',
  'triad',
  'designer',
  'logistics',
];

const PAGE_MIN_WORDS: Record<string, number> = {
  home: 300,
  services: 250,
  contact: 80,
  header: 20,
  footer: 40,
};

const CATEGORY_WEIGHTS = {
  title: 15,
  metaDescription: 15,
  headings: 15,
  contentLength: 15,
  readability: 10,
  keywords: 15,
  linksCtas: 10,
  imagesAlt: 5,
} as const;

const CTA_FIELD_NAMES = new Set([
  'primaryCta',
  'secondaryCta',
  'cta',
  'ctaText',
  'buttonText',
]);

const HEADING_FIELD_NAMES = new Set(['title', 'eyebrow', 'heading', 'headline']);

const SKIP_PATH_SEGMENTS = new Set(['icon', 'stage', 'condition', 'phoneHref']);

export function walkStringFields(
  value: unknown,
  path = '',
  results: StringField[] = [],
): StringField[] {
  if (typeof value === 'string') {
    results.push({ path: path || 'root', value });
    return results;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      walkStringFields(item, path ? `${path}[${index}]` : `[${index}]`, results);
    });
    return results;
  }
  if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      const childPath = path ? `${path}.${key}` : key;
      walkStringFields(child, childPath, results);
    }
  }
  return results;
}

function getAtPath(obj: unknown, path: string): unknown {
  if (!path || path === 'root') return obj;
  const segments = path.replace(/\[(\d+)\]/g, '.$1').split('.').filter(Boolean);
  let current: unknown = obj;
  for (const segment of segments) {
    if (current == null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

function getStringAtPath(obj: unknown, path: string): string {
  const value = getAtPath(obj, path);
  return typeof value === 'string' ? value.trim() : '';
}

function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).filter(Boolean).length;
}

function joinPlainText(fields: StringField[]): string {
  return fields
    .filter((f) => !shouldSkipField(f.path))
    .map((f) => f.value)
    .join(' ');
}

function shouldSkipField(path: string): boolean {
  const segments = path.split(/[.[\]]/).filter(Boolean);
  return segments.some((s) => SKIP_PATH_SEGMENTS.has(s));
}

function lastSegment(path: string): string {
  const match = path.match(/(?:\.|\[)(\w+)\]?$/);
  return match?.[1] ?? path;
}

function categoryStatus(score: number, maxScore: number): SeoCategoryStatus {
  const ratio = maxScore > 0 ? score / maxScore : 0;
  if (ratio >= 0.8) return 'good';
  if (ratio >= 0.5) return 'warning';
  return 'poor';
}

function scoreToGrade(score: number): SeoGrade {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}

function resolvePrimaryTitle(content: Record<string, unknown>): {
  text: string;
  path: string | null;
} {
  const metaTitle = getStringAtPath(content, 'seo.metaTitle');
  if (metaTitle) return { text: metaTitle, path: 'seo.metaTitle' };

  for (const path of ['hero.title', 'pageHeader.title']) {
    const text = getStringAtPath(content, path);
    if (text) return { text, path };
  }

  const fields = walkStringFields(content);
  const titleField = fields.find(
    (f) => lastSegment(f.path) === 'title' && f.value.trim() && !shouldSkipField(f.path),
  );
  return titleField
    ? { text: titleField.value.trim(), path: titleField.path }
    : { text: '', path: null };
}

function resolveMetaDescription(content: Record<string, unknown>): {
  text: string;
  path: string | null;
  inferred: boolean;
} {
  const meta = getStringAtPath(content, 'seo.metaDescription');
  if (meta) return { text: meta, path: 'seo.metaDescription', inferred: false };

  for (const path of ['hero.subtitle', 'pageHeader.subtitle', 'tagline']) {
    const text = getStringAtPath(content, path);
    if (text) return { text, path, inferred: true };
  }

  const fields = walkStringFields(content);
  const descField = fields.find(
    (f) =>
      (lastSegment(f.path) === 'description' || lastSegment(f.path) === 'subtitle') &&
      f.value.trim().length >= 40 &&
      !shouldSkipField(f.path),
  );
  return descField
    ? { text: descField.value.trim(), path: descField.path, inferred: true }
    : { text: '', path: null, inferred: false };
}

function analyzeTitle(
  content: Record<string, unknown>,
  tips: SeoTip[],
): SeoCategoryResult {
  const maxScore = CATEGORY_WEIGHTS.title;
  const { text, path } = resolvePrimaryTitle(content);
  let score = 0;

  if (!text) {
    tips.push({
      priority: 'high',
      category: 'title',
      message: 'No primary page title found.',
      suggestion:
        'Add seo.metaTitle or ensure hero.title / pageHeader.title is filled with a clear headline.',
      fieldPath: 'seo.metaTitle',
    });
    return {
      id: 'title',
      label: 'Title / Headline',
      score,
      maxScore,
      status: 'poor',
    };
  }

  score += 6;
  const len = text.length;
  if (len >= 30 && len <= 70) {
    score += 9;
  } else if (len >= 20 && len <= 80) {
    score += 6;
    tips.push({
      priority: 'medium',
      category: 'title',
      message: `Title length is ${len} characters (ideal: 50–60).`,
      suggestion: 'Shorten or expand the title so it fits search result snippets without truncation.',
      fieldPath: path ?? undefined,
    });
  } else {
    score += 2;
    tips.push({
      priority: 'high',
      category: 'title',
      message: `Title length is ${len} characters — outside the recommended range.`,
      suggestion: 'Aim for 50–60 characters: specific, keyword-rich, and readable in search results.',
      fieldPath: path ?? undefined,
    });
  }

  if (!getStringAtPath(content, 'seo.metaTitle') && path !== 'seo.metaTitle') {
    tips.push({
      priority: 'medium',
      category: 'title',
      message: 'No dedicated SEO meta title set.',
      suggestion:
        'Add seo.metaTitle for search engines while keeping your on-page hero or header title for visitors.',
      fieldPath: 'seo.metaTitle',
    });
  }

  return {
    id: 'title',
    label: 'Title / Headline',
    score: Math.min(score, maxScore),
    maxScore,
    status: categoryStatus(Math.min(score, maxScore), maxScore),
  };
}

function analyzeMetaDescription(
  content: Record<string, unknown>,
  tips: SeoTip[],
): SeoCategoryResult {
  const maxScore = CATEGORY_WEIGHTS.metaDescription;
  const { text, path, inferred } = resolveMetaDescription(content);
  let score = 0;

  if (!text) {
    tips.push({
      priority: 'high',
      category: 'metaDescription',
      message: 'No meta description or intro copy found.',
      suggestion:
        'Add seo.metaDescription (120–160 characters) summarizing the page for search results.',
      fieldPath: 'seo.metaDescription',
    });
    return {
      id: 'metaDescription',
      label: 'Meta Description',
      score,
      maxScore,
      status: 'poor',
    };
  }

  score += inferred ? 4 : 8;
  const len = text.length;
  if (len >= 120 && len <= 160) {
    score += 7;
  } else if (len >= 90 && len <= 180) {
    score += 4;
    tips.push({
      priority: 'medium',
      category: 'metaDescription',
      message: `Description is ${len} characters (ideal: 120–160).`,
      suggestion: 'Tune length so the full description displays in Google without being cut off.',
      fieldPath: path ?? 'seo.metaDescription',
    });
  } else {
    score += 1;
    tips.push({
      priority: 'high',
      category: 'metaDescription',
      message: `Description is ${len} characters — too short or too long for search snippets.`,
      suggestion: 'Write 120–160 characters that include your service and location.',
      fieldPath: path ?? 'seo.metaDescription',
    });
  }

  if (inferred) {
    tips.push({
      priority: 'medium',
      category: 'metaDescription',
      message: 'Meta description is inferred from page copy, not a dedicated SEO field.',
      suggestion:
        'Add seo.metaDescription tailored for search results rather than reusing hero subtitle text.',
      fieldPath: 'seo.metaDescription',
    });
  }

  return {
    id: 'metaDescription',
    label: 'Meta Description',
    score: Math.min(score, maxScore),
    maxScore,
    status: categoryStatus(Math.min(score, maxScore), maxScore),
  };
}

function analyzeHeadings(
  content: Record<string, unknown>,
  fields: StringField[],
  tips: SeoTip[],
): SeoCategoryResult {
  const maxScore = CATEGORY_WEIGHTS.headings;
  let score = 0;

  const h1 = resolvePrimaryTitle(content);
  if (h1.text) score += 6;
  else {
    tips.push({
      priority: 'high',
      category: 'headings',
      message: 'Missing H1-equivalent headline (hero or page header title).',
      suggestion: 'Every page needs one clear primary headline.',
      fieldPath: 'hero.title',
    });
  }

  const headings = fields.filter(
    (f) =>
      HEADING_FIELD_NAMES.has(lastSegment(f.path)) &&
      !shouldSkipField(f.path) &&
      f.path !== h1.path,
  );
  const filledHeadings = headings.filter((h) => h.value.trim().length > 0);
  const emptyHeadings = headings.filter((h) => !h.value.trim());

  if (filledHeadings.length >= 2) score += 5;
  else if (filledHeadings.length >= 1) score += 3;
  else {
    tips.push({
      priority: 'medium',
      category: 'headings',
      message: 'Few section headings detected.',
      suggestion: 'Use descriptive title fields for each major section to improve scanability and SEO.',
    });
  }

  if (emptyHeadings.length > 0) {
    score = Math.max(0, score - 2);
    tips.push({
      priority: 'medium',
      category: 'headings',
      message: `${emptyHeadings.length} empty heading field(s) found.`,
      suggestion: 'Remove or fill empty title/eyebrow fields — blank headings hurt structure signals.',
      fieldPath: emptyHeadings[0]?.path,
    });
  } else {
    score += 4;
  }

  const duplicateTitles = new Map<string, string[]>();
  for (const h of filledHeadings) {
    const key = h.value.trim().toLowerCase();
    const list = duplicateTitles.get(key) ?? [];
    list.push(h.path);
    duplicateTitles.set(key, list);
  }
  const dupes = [...duplicateTitles.entries()].filter(([, paths]) => paths.length > 1);
  if (dupes.length > 0) {
    score = Math.max(0, score - 2);
    tips.push({
      priority: 'low',
      category: 'headings',
      message: 'Duplicate section headings detected.',
      suggestion: 'Vary section titles to cover different topics and keywords.',
      fieldPath: dupes[0][1][0],
    });
  } else {
    score += 2;
  }

  return {
    id: 'headings',
    label: 'Heading Structure',
    score: Math.min(score, maxScore),
    maxScore,
    status: categoryStatus(Math.min(score, maxScore), maxScore),
  };
}

function analyzeContentLength(
  contentKey: string,
  plainText: string,
  tips: SeoTip[],
): SeoCategoryResult {
  const maxScore = CATEGORY_WEIGHTS.contentLength;
  const words = countWords(plainText);
  const minimum = PAGE_MIN_WORDS[contentKey] ?? 150;
  let score = 0;

  if (words >= minimum * 1.5) score = maxScore;
  else if (words >= minimum) score = Math.round(maxScore * 0.85);
  else if (words >= minimum * 0.6) {
    score = Math.round(maxScore * 0.5);
    tips.push({
      priority: 'medium',
      category: 'contentLength',
      message: `Page has ~${words} words (target: ${minimum}+ for ${contentKey}).`,
      suggestion: 'Expand service descriptions or add supporting copy to improve topical depth.',
    });
  } else {
    score = Math.round(maxScore * 0.2);
    tips.push({
      priority: 'high',
      category: 'contentLength',
      message: `Thin content: ~${words} words (target: ${minimum}+).`,
      suggestion:
        'Add substantive copy describing services, location, and value — search engines favor helpful pages.',
    });
  }

  return {
    id: 'contentLength',
    label: 'Content Length',
    score,
    maxScore,
    status: categoryStatus(score, maxScore),
  };
}

function analyzeReadability(
  fields: StringField[],
  tips: SeoTip[],
): SeoCategoryResult {
  const maxScore = CATEGORY_WEIGHTS.readability;
  const proseFields = fields.filter(
    (f) =>
      !shouldSkipField(f.path) &&
      !CTA_FIELD_NAMES.has(lastSegment(f.path)) &&
      f.value.trim().length > 20,
  );

  if (proseFields.length === 0) {
    return {
      id: 'readability',
      label: 'Readability',
      score: Math.round(maxScore * 0.3),
      maxScore,
      status: 'poor',
    };
  }

  let totalSentences = 0;
  let totalWords = 0;
  let longSentences = 0;

  for (const field of proseFields) {
    const sentences = field.value.split(/[.!?]+/).filter((s) => s.trim().length > 0);
    for (const sentence of sentences) {
      const words = countWords(sentence);
      if (words === 0) continue;
      totalSentences += 1;
      totalWords += words;
      if (words > 30) longSentences += 1;
    }
  }

  const avgSentenceLength = totalSentences > 0 ? totalWords / totalSentences : 0;
  let score = 0;

  if (avgSentenceLength >= 12 && avgSentenceLength <= 22) score += 6;
  else if (avgSentenceLength >= 8 && avgSentenceLength <= 28) {
    score += 4;
    tips.push({
      priority: 'low',
      category: 'readability',
      message: `Average sentence length is ${Math.round(avgSentenceLength)} words.`,
      suggestion: 'Aim for 15–20 words per sentence for easier scanning.',
    });
  } else {
    score += 2;
    tips.push({
      priority: 'medium',
      category: 'readability',
      message: `Sentences average ${Math.round(avgSentenceLength)} words — may be hard to read.`,
      suggestion: 'Break up long sentences in descriptions and subtitles.',
    });
  }

  const longRatio = totalSentences > 0 ? longSentences / totalSentences : 0;
  if (longRatio <= 0.15) score += 4;
  else if (longRatio <= 0.3) score += 2;
  else {
    tips.push({
      priority: 'medium',
      category: 'readability',
      message: `${Math.round(longRatio * 100)}% of sentences exceed 30 words.`,
      suggestion: 'Split long sentences in body copy and service descriptions.',
    });
  }

  return {
    id: 'readability',
    label: 'Readability',
    score: Math.min(score, maxScore),
    maxScore,
    status: categoryStatus(Math.min(score, maxScore), maxScore),
  };
}

function analyzeKeywords(
  plainText: string,
  keywords: string[],
  tips: SeoTip[],
): SeoCategoryResult {
  const maxScore = CATEGORY_WEIGHTS.keywords;
  const lower = plainText.toLowerCase();
  const matched = keywords.filter((kw) => lower.includes(kw.toLowerCase()));
  const ratio = keywords.length > 0 ? matched.length / keywords.length : 0;
  let score = 0;

  if (ratio >= 0.6) score = maxScore;
  else if (ratio >= 0.4) score = Math.round(maxScore * 0.75);
  else if (ratio >= 0.25) score = Math.round(maxScore * 0.5);
  else score = Math.round(maxScore * 0.25);

  const missing = keywords.filter((kw) => !lower.includes(kw.toLowerCase())).slice(0, 5);
  if (missing.length > 0 && ratio < 0.6) {
    tips.push({
      priority: ratio < 0.25 ? 'high' : 'medium',
      category: 'keywords',
      message: `Missing relevant terms: ${missing.join(', ')}.`,
      suggestion:
        'Weave service and location keywords naturally into titles, descriptions, and body copy.',
    });
  }

  return {
    id: 'keywords',
    label: 'Keywords & Local SEO',
    score,
    maxScore,
    status: categoryStatus(score, maxScore),
  };
}

function analyzeLinksAndCtas(
  fields: StringField[],
  tips: SeoTip[],
): SeoCategoryResult {
  const maxScore = CATEGORY_WEIGHTS.linksCtas;
  let score = 0;

  const ctas = fields.filter((f) => CTA_FIELD_NAMES.has(lastSegment(f.path)));
  const filledCtas = ctas.filter((f) => f.value.trim().length > 0);
  const weakCtas = filledCtas.filter((f) => {
    const v = f.value.trim().toLowerCase();
    return v === 'click here' || v === 'learn more' || v === 'submit' || v.length < 4;
  });

  if (filledCtas.length >= 2) score += 5;
  else if (filledCtas.length >= 1) score += 3;
  else {
    tips.push({
      priority: 'high',
      category: 'linksCtas',
      message: 'No call-to-action text found.',
      suggestion: 'Add action-oriented CTA fields (e.g. primaryCta, cta) with specific next steps.',
    });
  }

  if (weakCtas.length > 0) {
    score = Math.max(0, score - 2);
    tips.push({
      priority: 'medium',
      category: 'linksCtas',
      message: 'Generic or weak CTA text detected.',
      suggestion: 'Use descriptive CTAs like "Request a Quote" instead of "Click here".',
      fieldPath: weakCtas[0]?.path,
    });
  } else if (filledCtas.length > 0) {
    score += 3;
  }

  const linkLabels = fields.filter(
    (f) => lastSegment(f.path) === 'label' && f.path.includes('Links'),
  );
  const descriptiveLabels = linkLabels.filter((f) => f.value.trim().length >= 3);

  if (descriptiveLabels.length >= 2) score += 2;
  else if (linkLabels.length === 0 && filledCtas.length > 0) score += 2;

  return {
    id: 'linksCtas',
    label: 'Links & CTAs',
    score: Math.min(score, maxScore),
    maxScore,
    status: categoryStatus(Math.min(score, maxScore), maxScore),
  };
}

function analyzeImageAlt(
  content: Record<string, unknown>,
  tips: SeoTip[],
): SeoCategoryResult {
  const maxScore = CATEGORY_WEIGHTS.imagesAlt;
  const imageFields = findImageAltFields(content);

  if (imageFields.length === 0) {
    return {
      id: 'imagesAlt',
      label: 'Image Alt Text',
      score: maxScore,
      maxScore,
      status: 'good',
    };
  }

  const filled = imageFields.filter((f) => f.value.trim().length >= 3);
  const ratio = filled.length / imageFields.length;
  let score = 0;

  if (ratio >= 1) score = maxScore;
  else if (ratio >= 0.5) {
    score = Math.round(maxScore * 0.6);
    const missing = imageFields.find((f) => !f.value.trim());
    tips.push({
      priority: 'medium',
      category: 'imagesAlt',
      message: `${imageFields.length - filled.length} image(s) missing alt text.`,
      suggestion: 'Add descriptive alt text for accessibility and image search.',
      fieldPath: missing?.path,
    });
  } else {
    score = Math.round(maxScore * 0.2);
    tips.push({
      priority: 'high',
      category: 'imagesAlt',
      message: 'Most image alt fields are empty.',
      suggestion: 'Describe each image briefly — what it shows and why it matters.',
      fieldPath: imageFields.find((f) => !f.value.trim())?.path,
    });
  }

  return {
    id: 'imagesAlt',
    label: 'Image Alt Text',
    score,
    maxScore,
    status: categoryStatus(score, maxScore),
  };
}

function findImageAltFields(
  value: unknown,
  path = '',
  results: StringField[] = [],
): StringField[] {
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      findImageAltFields(item, path ? `${path}[${index}]` : `[${index}]`, results);
    });
    return results;
  }
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const hasImageRef =
      typeof obj.src === 'string' ||
      typeof obj.url === 'string' ||
      typeof obj.image === 'string' ||
      typeof obj.imageUrl === 'string';

    if (hasImageRef || 'alt' in obj || 'imageAlt' in obj) {
      const alt =
        typeof obj.alt === 'string'
          ? obj.alt
          : typeof obj.imageAlt === 'string'
            ? obj.imageAlt
            : '';
      results.push({ path: path ? `${path}.alt` : 'alt', value: alt });
    }

    for (const [key, child] of Object.entries(obj)) {
      if (key === 'alt' || key === 'imageAlt') continue;
      findImageAltFields(child, path ? `${path}.${key}` : key, results);
    }
  }
  return results;
}

export type AnalyzeSiteContentOptions = {
  keywords?: string[];
};

export function analyzeSiteContent(
  contentKey: string,
  content: Record<string, unknown>,
  options: AnalyzeSiteContentOptions = {},
): SeoAnalysisResult {
  const keywords = options.keywords ?? DEFAULT_KEYWORDS;
  const fields = walkStringFields(content);
  const plainText = joinPlainText(fields);
  const tips: SeoTip[] = [];

  const categories: SeoCategoryResult[] = [
    analyzeTitle(content, tips),
    analyzeMetaDescription(content, tips),
    analyzeHeadings(content, fields, tips),
    analyzeContentLength(contentKey, plainText, tips),
    analyzeReadability(fields, tips),
    analyzeKeywords(plainText, keywords, tips),
    analyzeLinksAndCtas(fields, tips),
    analyzeImageAlt(content, tips),
  ];

  const score = Math.round(
    categories.reduce((sum, cat) => sum + cat.score, 0),
  );

  const priorityOrder = { high: 0, medium: 1, low: 2 };
  tips.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  return {
    score,
    grade: scoreToGrade(score),
    categories,
    tips,
  };
}

export { DEFAULT_KEYWORDS, PAGE_MIN_WORDS };
