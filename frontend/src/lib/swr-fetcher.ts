import { listProducts, listExperiments, getPerformanceInsights, getOperationsBrief, getMarketingCalendar } from './api';

export const swrKeys = {
  products: '/shopgenie/api/products',
  experiments: '/shopgenie/api/experiments',
  insights: '/shopgenie/api/performance/insights',
  brief: '/shopgenie/api/operations/brief',
  calendar: '/shopgenie/api/marketing/calendar',
};

export const swrFetcher = {
  products: () => listProducts(),
  experiments: (productId?: string | null) => listExperiments(productId),
  insights: () => getPerformanceInsights(),
  brief: () => getOperationsBrief(),
  calendar: () => getMarketingCalendar(),
};
