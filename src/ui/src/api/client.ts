import type { AppType } from '@api/app';
import { hc } from 'hono/client';

// Vite proxy を使う前提で baseURL は "/"
export const client = hc<AppType>('/');
