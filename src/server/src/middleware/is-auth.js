const jwt = require('jsonwebtoken');
const tokens = require('../util/tokens');
const { user } = require('../db/models');

// check authentication
module.exports = async (req, res, next) => {
  try {
    const token = req.cookies.jwt;
    const refreshToken = req.cookies.refreshToken;
    // if refresh token is missing throw error
    if (!refreshToken) {
      res.sendStatus(401);
      const error = new Error('Not Authenticated');
      error.statusCode = 401;
      throw error;
    }
    let decodedToken;
    let decodedRefreshToken;
    let uid = jwt.decode(refreshToken).uid;
    // decode tokens
    try {
      decodedToken = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      // if the main token is expired try the refresh token
      try {
        let profile = await user.findOne({ where: { id: uid } });
        decodedRefreshToken = jwt.verify(
          refreshToken,
          process.env.REFRESH_TOKEN_SECRET + profile.password
        );
        if (decodedRefreshToken) {
          const newToken = tokens.generateToken(profile);
          const newRefreshToken = tokens.generateRefreshToken(profile);
          // update the token
          res.cookie('jwt', newToken, {
            httpOnly: true,
            sameSite: true,
            expires: new Date(Date.now() + 15 * 60000),
          });
          res.cookie('refreshToken', newRefreshToken, {
            httpOnly: true,
            sameSite: true,
            expires: new Date(Date.now() + 60 * 60000 * 24 * 3),
          });
        }
      } catch (err) {
        res.sendStatus(401);
        err.statusCode = 500;
        throw err;
      }
    }
    // if there are no decoded tokens at this point, throw error
    if (!decodedToken && !decodedRefreshToken) {
      res.sendStatus(401);
      const error = new Error('Not Authenticated');
      error.statusCode = 401;
      throw error;
    }
    // if we get this far, store uid on req.user.
    req.user = { uid };
    next();
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
};
