const jwt = require('jsonwebtoken');

// TODO: might add refresh tokens later.
exports.generateToken = ({ id }) => {
	const u = {
		uid: id.toString(),
	};
	// look at jwt.io for additional information.
	return (token = jwt.sign(u, process.env.JWT_SECRET, {
		// expiresIn: '1h', // expires in 1 hours
		expiresIn: '10m', // expires every 10 minutes
	}));
};

exports.generateRefreshToken = ({ id, password }) => {
	const u = {
		uid: id.toString(),
	};
	// look at jwt.io for additional information.
	return (token = jwt.sign(u, process.env.REFRESH_TOKEN_SECRET + password, {
		expiresIn: '3d', // expires every 3 days
	}));
};
