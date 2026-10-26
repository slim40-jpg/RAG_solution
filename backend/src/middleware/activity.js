import { ActivityLog } from '../models/index.js';

export const logActivity = (action, entityType) => {
  return async (req, res, next) => {
    const originalJson = res.json;
    
    res.json = function(data) {
      // Log after response is sent
      if (req.user) {
        ActivityLog.create({
          userId: req.user.id,
          action,
          entityType,
          entityId: req.params.id || req.body.id,
          details: {
            method: req.method,
            path: req.path,
            query: req.query,
            body: req.body
          },
          ipAddress: req.ip,
          userAgent: req.headers['user-agent']
        }).catch(console.error);
      }
      
      originalJson.call(this, data);
    };
    
    next();
  };
};