// import node dependencies
const path = require('path');
const fs = require('fs');
// import environment variables
require('dotenv').config();
// import additional dependencies
const express = require('express');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
// import database info.
const db = require('./src/db/models');
// import routes
const nodeRoutes = require('./src/routes/nodes');
const authRoutes = require('./src/routes/auth');
const userRoutes = require('./src/routes/users');
const textRoutes = require('./src/routes/text');
const urlRoutes = require('./src/routes/url');
// const imageRoutes = require('./src/routes/image');
const collectionRoutes = require('./src/routes/collections');
const associationRoutes = require('./src/routes/associations');
const portRoutes = require('./src/routes/port');
const fileRoutes = require('./src/routes/file');
// import auth middleware
const isAuth = require('./src/middleware/is-auth');

const debug = false;
// WARNING: setting this to TRUE will erase the
// database on the next server restart
const eraseDatabaseOnSync = false;

// set up 1 and only 1 dreaded "global variable"
// to store the base directory of the app when it is run
global.__basedir = __dirname;

// create data directory if it does not exist
let dataDirectory = path.join(__basedir, 'data');
if (!fs.existsSync(dataDirectory)) {
  fs.mkdirSync(dataDirectory);
}

// set up express app
const app = express();
// remove x-powered-by message for additional security.
app.disable('x-powered-by');

// var whitelist = ['http://localhost:3000', process.env.CLIENT_URL];
// var corsOptions = {
//   origin: function (origin, callback) {
//     console.log(origin);
//     if (whitelist.indexOf(origin) !== -1) {
//       callback(null, true);
//     } else {
//       callback(new Error('Not allowed by CORS'));
//     }
//   },
//   methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
//   credentials: true,
//   allowedHeaders: [
//     'Access-Control-Allow-Headers',
//     'Content-Type, Authorization, Content-Security-Policy',
//   ],
// };
// app.use(cors(corsOptions));

// Add headers (NOTE!!!!!! I should probably be using the CORS middleware package for this instead of what im doing here)
app.use((req, res, next) => {
  // disable cors (second parameter is a string for which URLs. * is for all, possible to seperate with commas within the string)
  // IDEA: so right now i have the client stored in URL but eventually it will probably be * or at least optional
  // res.setHeader('Access-Control-Allow-Origin', '*');
  const whitelist = [
    process.env.CLIENT_URL,
    'http://127.0.0.1:3000',
    'http://127.0.0.1:9000',
    'http://localhost:3000',
    'http://localhost:9000',
  ];
  let reqOrigin = req.get('origin');
  let origin = process.env.CLIENT_URL;
  if (whitelist.includes(reqOrigin)) {
    origin = reqOrigin;
  }
  res.setHeader('Access-Control-Allow-Origin', origin);
  // set this to true to allow cookies to be sent in.
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  // set which methods are allowed from outside
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE');
  // set which headers are allowed
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, Content-Security-Policy'
  );
  next();
});

// include contrib middleware.
app.use(bodyParser.json({ limit: '1mb' })); // for application/json
app.use(cookieParser()); // for cookies

// set up routes
app.use('/node', nodeRoutes);
app.use('/text', textRoutes);
app.use('/auth', authRoutes);
app.use('/user', userRoutes);
app.use('/url', urlRoutes);
app.use('/collection', collectionRoutes);
app.use('/association', associationRoutes);
app.use('/port', portRoutes);
app.use('/file', fileRoutes);

// TODO: the file directory should probably require permissions per image? not sure how that should work
app.use('/data', isAuth, express.static(path.join(__dirname, 'data'))); // file directory
// app.use('/port', isAuth, express.static(path.join(__dirname, 'port'))); // downloads directory
app.use('/public', isAuth, express.static(path.join(__dirname, 'public')));

if (process.env.FRONTEND_DEV_MODE) {
  console.log('serving pre-built client');
  // serve the React interface
  const clientPath = path.join(__dirname, '../client/');
  app.use(express.static(clientPath));
  app.use('*', express.static(clientPath));
}

if (debug) {
  // set up general error handling for dev.
  app.use((error, req, res, next) => {
    console.log(error);
    const status = error.statusCode || 500;
    const message = error.message;
    const data = error.data;
    process.send({ message: message, data: data });
    // res.status(status).json({ message: message, data: data });
    next();
  });
}

// TODO: i should not be calling sequelize.sync on every single server start.
// it should only be called intentionally on like...setup? all other changes
// should be applied via migrations
// start server
db.sequelize
  .sync({ force: eraseDatabaseOnSync })
  .then(async () => {
    app.listen(process.env.PORT, () => {
      console.log(`${process.env.APP_NAME} is listening on port ${process.env.PORT}!`);
      process.send('server-started');
    });
  })
  .catch((err) => {
    console.log(err);
  });
