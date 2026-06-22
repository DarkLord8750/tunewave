import NodeCache from 'node-cache';

// Cache streams for 15 minutes, metadata for 1 hour
export const streamCache = new NodeCache({ stdTTL: 900, checkperiod: 120 });
export const metadataCache = new NodeCache({ stdTTL: 3600, checkperiod: 600 });
