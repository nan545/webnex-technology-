export type Article = {
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  publishedAt: string;
  author: string;
  readingMinutes: number;
  content: string[];
};

export const articles: Article[] = [];
