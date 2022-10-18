const config = require('config');
// express boiler plate
const express = require('express');
const app = express();
const cors = require('cors');
const bodyParser = require('body-parser');
const port = config.get('port') || 8000;

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
        console.log('Error: ',err.sqlMessage);
        return;
    }
    console.log('Connection established to Host: ',config.get('database.host'));
});

app.set('db',connection);

// execute a query
// connection.query('SELECT * FROM users', (err, rows, fields) => {
//     if (err) {
//         console.log('Error: ',err.sqlMessage);
//         return;
//     }
//     console.log('Data received from Db:\n');
//     console.log(rows);
// }); 


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

// start the server
app.listen(port, () => console.log(`Metro Sever is running on ${port}!`));

// Language: javascript