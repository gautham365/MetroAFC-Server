const config = require('config');
// express boiler plate
const express = require('express');
const http = require('http');
const app = express();
const cors = require('cors');
const bodyParser = require('body-parser');
const port = config.get('port') || 8000;

// create a socket server
const { Server } = require("socket.io");
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

// handle socket events
const socketHandler = require('./sockethandler');


// import the routes
const routes = require('./routes');

// create a mysql instance
const mysql = require('mysql');
const connection = mysql.createPool({
    host: config.get('database.host') || '',
    user: config.get('database.username') || '',
    password: config.get('database.password') || '',
    database: config.get('database.db') || '',
    
});

connection.getConnection((err) => {
    if (err) {
        console.log('Error: ',err);
        return;
    }
    console.log('Connection established to Host: ',config.get('database.host'));
});

app.set('db',connection);
app.set('socket',io);

// use the middlewares
app.use(cors());
app.use(bodyParser.json());
app.use(
    express.urlencoded({
      extended: true
    })
  )  

// use the routes
app.use('/', routes);

// use socket Handler
socketHandler(io,connection);

// connect to FCM
const admin = require("firebase-admin");
const serviceAccount = require('./metro-afc-firebase-adminsdk-nlwt3-842663b74e.json');

admin.initializeApp({
  	credential: admin.credential.cert(serviceAccount),
	databaseURL: "https://metro-afc-default-rtdb.firebaseio.com"
});



app.set('fcm',admin);

// start the server
app.listen(port, () => console.log(`Metro Sever is running on ${port}!`));

// start socket
server.listen(8001, () => {
  console.log("Socket server is running...");
});
// Language: javascript