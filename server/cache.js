const Redis = require('ioredis');
const dotenv = require('dotenv');

dotenv.config();

const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD,
  retryStrategy: (times) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  }
});

// Cache middleware
const cache = (duration) => {
  return (req, res, next) => {
    const key = `cache:${req.originalUrl || req.url}`;
    
    redis.get(key, (err, data) => {
      if (err) return next();
      
      if (data) {
        res.send(JSON.parse(data));
      } else {
        res.originalSend = res.send;
        res.send = (body) => {
          redis.setex(key, duration, JSON.stringify(body));
          res.originalSend(body);
        };
        next();
      }
    });
  };
};

// Clear cache for specific route
const clearCache = (pattern) => {
  return (req, res, next) => {
    redis.keys(pattern, (err, keys) => {
      if (err) return next();
      
      if (keys.length) {
        redis.del(keys);
      }
      next();
    });
  };
};

module.exports = {
  redis,
  cache,
  clearCache
}; 