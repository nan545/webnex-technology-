export type Article = {
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  publishedAt: string;
  author: string;
  readingMinutes: number;
  content: string[];
  image?: { src: string; alt: string };
};

export const articles: Article[] = [];
