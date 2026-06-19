import { Injectable } from '@nestjs/common';
import { analyzeSiteContent } from './analyze-site-content';
import type { SeoAnalysisResult, SeoSummaryItem } from './seo.types';
import { SITE_CONTENT_FILES } from '../site-content.registry';

const PAGE_KEYS = ['home', 'services', 'contact'] as const;

@Injectable()
export class SeoAnalyzerService {
  analyze(contentKey: string, content: Record<string, unknown>): SeoAnalysisResult {
    return analyzeSiteContent(contentKey, content);
  }

  buildSummary(
    entries: Array<{ key: string; content: Record<string, unknown> }>,
  ): SeoSummaryItem[] {
    return entries.map(({ key, content }) => {
      const result = analyzeSiteContent(key, content);
      const meta = Object.values(SITE_CONTENT_FILES).find((f) => f.key === key);
      return {
        key,
        label: meta?.label ?? key,
        score: result.score,
        grade: result.grade,
      };
    });
  }

  pageKeysForSummary(): readonly string[] {
    return PAGE_KEYS;
  }
}
