import NodeCache from 'node-cache';

// Cache streams for 24 hours (86400 seconds)
const streamCache = new NodeCache({ stdTTL: 86400, checkperiod: 3600 });

export const cacheService = {
  get: (key) => streamCache.get(key),
  
  set: (key, value, ttl = 86400) => streamCache.set(key, value, ttl),
  
  has: (key) => streamCache.has(key),
  
  del: (key) => streamCache.del(key),
  
  clear: () => streamCache.flushAll(),
  
  getStats: () => streamCache.getStats()
};

export default cacheService;
