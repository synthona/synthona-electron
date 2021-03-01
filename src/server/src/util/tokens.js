const jwt = require('jsonwebtoken');

// TODO: might add refresh tokens later.
exports.generateToken = (user) => {
  const u = {
    uid: user.id.toString(),
  };
  // look at jwt.io for additional information.
  return (token = jwt.sign(u, process.env.JWT_SECRET, {
    // expiresIn: '1h', // expires in 1 hours
    expiresIn: '10m', // expires every 10 minutes
  }));
};

exports.generateRefreshToken = (user) => {
  const u = {
    uid: user.id.toString(),
  };
  // look at jwt.io for additional information.
  return (token = jwt.sign(u, process.env.REFRESH_TOKEN_SECRET + user.password, {
    expiresIn: '3d', // expires every 3 days
  }));
};
