/**
 * Guard for the routes that read and write through the mongoose models
 * (profile, mood check-ins, PHQ-9 and GAD-7).
 *
 * The server stores users and chats with Sequelize and never opens a MongoDB
 * connection. Without this guard a request to one of those routes waited ten
 * seconds for mongoose to give up and then failed with a 500. It now answers
 * at once and says the feature is not available.
 */

const mongoose = require('mongoose');

const CONNECTED = 1;

const requireMongo = (req, res, next) => {
  if (mongoose.connection.readyState === CONNECTED) {
    return next();
  }

  res.status(503).json({
    success: false,
    code: 'FEATURE_UNAVAILABLE',
    message: 'This feature is not available on this server.'
  });
};

module.exports = { requireMongo };
