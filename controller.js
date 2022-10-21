function calculateFare(c1,c2) {
    return Math.abs(c1[0]-c2[0]) + Math.abs(c1[1]-c2[1])
}

function delay(time) {
    return new Promise(resolve => setTimeout(resolve, time));
}

// define the controller
const controller = {
    hello: (req, res) => {
        // call the model
        const data = {data: "Hello World!"};
        // send the response
        res.send(data);
    },
    verifyToken: (req, res) => {
        const db = req.app.get('db');
        let token = req.query.token || "";
        db.query(`select username from sessions where token="${token}";`, async (err, rows, fields) => {
            if (err) {
                console.log(err);
                return res.status(500).json({error: err.sqlMessage});
            }
            if (rows.length === 0) {
                return res.status(401).json({error: "Invalid token"});
            }
            // get users name from profile

            db.query(`select name from profile where username="${rows[0].username}";`, async (err, rows1, fields) => {
                if (err) {
                    console.log(err);
                    return res.status(500).json({error: err.sqlMessage});
                }
                if (rows1.length === 0) {
                    return res.status(401).json({error: "Invalid token"});
                }
                return res.status(200).json({token: token, username: rows[0].username, name: rows1[0].name});
            });
        });
    },
    isLoggedIn: async (req, res, next) => {
        await delay(1000);

        const db = req.app.get('db');
        console.log(req.body);
        db.query(`select username from sessions where token="${req.body.token || ""}";`, async (err, rows, fields) => {
            if (err) {
                console.log(err);
                return res.status(500).json({error: err.sqlMessage});
            }
            if (rows.length === 0) {
                return res.status(401).json({error: "Invalid token"});
            }

            req.body.username = rows[0].username;
            next();
        });
    },
    login: async (req, res) => {
        await delay(1000);
        let { username, password, privilege } = req.body;
        privilege = privilege ? privilege : "USER"
        const db = req.app.get('db');
        // console.log(username, password);
        db.query('SELECT role FROM credentials WHERE username = ? AND password = ?', [username || "", password || ""], (err, rowsM, fields) => {
            if (err) {
                // console.log('Error: ',err.sqlMessage);
                return res.status(500).json({token: null, error: err.sqlMessage});
            }
            if (rowsM.length === 0) {
                // console.log('Error: Invalid username or password');
                return res.status(401).json({token: null, error: 'Invalid username or password'});
            }

            

            if (rowsM[0].role !== "ADMIN" && privilege === "ADMIN") {
                return res.status(401).json({token: null, error: 'Invalid privilege'});
            }
            // console.log(rowsM.length);
            db.query(`select name, username, card_number from profile where username="${username}"; `, async (err, rows, fields) => {
                if (err) {
                    // console.log('Error: ',err.sqlMessage);
                    return res.status(500).json({token: null, error: err.sqlMessage});
                    }
                    // generate a token and insert it into sessions table
                    const { generateApiKey } = require('generate-api-key');
                    const token = generateApiKey({
                        method: 'string',
                        pool: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789',
                        length: 50
                      });

                    await db.query(`insert into sessions (username, token) values ("${username}", "${token}") on DUPLICATE KEY update token="${token}";`);

                    return res.json({...rows[0], ...rowsM[0],token});
                })
            
        });
    },
    entry: async (req, res) => {

        let { username, code } = req.body;
        const db = req.app.get('db');

        
        db.query(`select current_status, card_number, balance from profile where username="${username}";`, async (err, rows, fields) => {
            if (err) {
                console.log(err);
                return res.status(500).json({error: err.sqlMessage});
            }
            
            console.log(rows[0]);

            // check if user is already in
            if (rows[0].current_status !== null ) {
                return res.json({error: "Already IN"});
            }
            
            // check if user has a valid card
            if (rows[0].card_number === null) {
                return res.json({error: "No card"});
            }

            // check if user card has minimum balance of 50rs
            if (rows[0].balance < 50) {
                return res.json({error: "Insufficient balance"});
            }

            // make an ENTRY in the transactions table
            db.query(`insert into transactions (username, type, station) values ("${username}", "ENTRY", "${code}");`, (err, rows1, fields) => {
                if (err) {
                    console.log(err);
                    return res.json({error: err.sqlMessage});
                }

                return res.json({ token: null, code: null, error: null, balance: rows[0].balance });
            });
            
            
        });
    },
    exit: (req, res) => {
        let { username, code } = req.body;
        const db = req.app.get('db') ;

        
        db.query(`select current_status, card_number, balance from profile where username="${username}";`, async (err, rows, fields) => {
            if (err) {
                console.log(err);
                return res.status(500).json({error: err.sqlMessage});
            }
            
            console.log(rows[0]);

            // check if user is already in
            if (rows[0].current_status === null ) {
                return res.json({error: "First take a entry"});
            }

           
            
            // check if user has a valid card
            if (rows[0].card_number === null) {
                return res.json({error: "No card"});
            }


            // calaculate the fare
            let fare = 0;
            db.query(`select * from stations where station_code in ("${rows[0].current_status}","${code}") ;`, async (err, rows1, fields) => {
                if (err) {
                    console.log(err);
                    return res.json({error: err.sqlMessage});
                }
                // console.log(rows1);

             // check if current_status is equal to code
            if (rows[0].current_status === code) 
                fare = 0;
            else
                fare = calculateFare(rows1[0].point.split(','), rows1[1]?.point?.split(','));

            let newBalance = rows[0].balance - fare;
            // update the balance
            db.query(`update profile set balance = ${newBalance} where username="${username}";`, async (err, rows2, fields) => {
                if (err) {
                    console.log(err);
                    return res.json({error: err.sqlMessage});
                }
            });

            // make an EXIT in the transactions table
            db.query(`insert into transactions (username, type, station, fare) values ("${username}", "EXIT", "${code}", "${fare}");`, (err, rows1, fields) => {
                if (err) {
                    console.log(err);
                    return res.json({error: err.sqlMessage});
                }

                return res.json({ token: null, code: null, error: null, balance: newBalance, charged: fare });
            });
        });
        });
    },
    getAllStations: (req, res) => {

        const db = req.app.get('db');

        db.query(`select * from stations;`, async (err, rows, fields) => {
            if (err) {
                console.log('Error: ',err.sqlMessage);
                return res.status(500).json({error: err.sqlMessage});
            }

            if (rows.length === 0) {
                return res.status(400).json({error: "No stations found"});
            }

            return res.json({stations: rows})
        });
    },
    getAllJourneys: (req, res) => {
        let { username } = req.body;
        const db = req.app.get('db');

        db.query(`select * from journeys;`, async (err, rows, fields) => {
            if (err) {
                console.log('Error: ',err.sqlMessage);
                return res.status(500).json({error: err.sqlMessage});
            }

            if (rows.length === 0) {
                return res.status(400).json({error: "No journeys found"});
            }

            return res.json({journeys: rows})
        });
    },
    finalStatusWH: (req, res) => {
        console.log("get",req.query);
        res.json({status: "OK"});
    },
    finalStatusWHP: (req, res) => {
        console.log("post",req.body);
        res.json({status: "OK"});
    },
};

// export the controller
module.exports = controller;


// select cast(substring_index ("-7,0",',',1) AS int)+5 AS STRING;