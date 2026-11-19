import { z } from 'zod';

export const paginationSchema = {
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
};

export const paginate = ({ page, limit }) => ({ limit, offset: (page - 1) * limit });
export const pageMeta = (total, { page, limit }) => ({ total, page, limit, pages: Math.ceil(total / limit) });
