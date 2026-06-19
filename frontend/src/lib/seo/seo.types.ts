export type SeoCategoryStatus = 'good' | 'warning' | 'poor';

export type SeoCategoryResult = {
  id: string;
  label: string;
  score: number;
  maxScore: number;
  status: SeoCategoryStatus;
};

export type SeoTipPriority = 'high' | 'medium' | 'low';

export type SeoTip = {
  priority: SeoTipPriority;
  category: string;
  message: string;
  suggestion: string;
  fieldPath?: string;
};

export type SeoGrade = 'A' | 'B' | 'C' | 'D' | 'F';

export type SeoAnalysisResult = {
  score: number;
  grade: SeoGrade;
  categories: SeoCategoryResult[];
  tips: SeoTip[];
};

export type SeoSummaryItem = {
  key: string;
  label: string;
  score: number;
  grade: SeoGrade;
};

export type StringField = {
  path: string;
  value: string;
};
