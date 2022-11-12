const expressTypes = require("express");
const mysqlTypes = require("mysql");
const { Server } = require("socket.io");
function calculateFare(c1, c2) {
  return Math.abs(c1[0] - c2[0]) + Math.abs(c1[1] - c2[1]);
}

function delay(time) {
  return new Promise((resolve) => setTimeout(resolve, time));
}

// define the controller
const controller = {
  hello: (
    /** @type {expressTypes.Request} */ req,
    /** @type {expressTypes.Response} */ res
  ) => {
    // call the model
    const data = { data: "Hello World!" };
    // send the response
    res.send(data);
  },
  verifyToken: (
    /** @type {expressTypes.Request} */ req,
    /** @type {expressTypes.Response} */ res
  ) => {
    /** @type {mysqlTypes.Pool}  */
    const db = req.app.get("db");
    let token = req.query.token || "";
    db.query(
      `select username from sessions where token="${token}";`,
      async (err, rows, fields) => {
        if (err) {
          console.log(err);
          return res.status(500).json({ error: err.sqlMessage });
        }
        if (rows.length === 0) {
          return res.status(401).json({ error: "Invalid token" });
        }
        // get users name from profile

        db.query(
          `select name from profile where username="${rows[0].username}";`,
          async (err, rows1, fields) => {
            if (err) {
              console.log(err);
              return res.status(500).json({ error: err.sqlMessage });
            }
            if (rows1.length === 0) {
              return res.status(401).json({ error: "Invalid token" });
            }
            return res
              .status(200)
              .json({
                token: token,
                username: rows[0].username,
                name: rows1[0].name,
              });
          }
        );
      }
    );
  },
  isLoggedIn: async (
    /** @type {expressTypes.Request} */ req,
    /** @type {expressTypes.Response} */ res,
    next
  ) => {
    // await delay(1000);

    /** @type {mysqlTypes.Pool}  */
    const db = req.app.get("db");
    console.log(req.url);
    db.query(
      `select username from sessions where token="${req.body.token || ""}";`,
      async (err, rows, fields) => {
        if (err) {
          console.log(err);
          return res.status(500).json({ error: err.sqlMessage });
        }
        if (rows.length === 0) {
          return res.status(401).json({ error: "Invalid token" });
        }

        req.body.username = rows[0].username;
        next();
      }
    );
  },
  login: async (
    /** @type {expressTypes.Request} */ req,
    /** @type {expressTypes.Response} */ res
  ) => {
    // await delay(1000);
    let { username, password, privilege } = req.body;
    privilege = privilege ? privilege : "USER";
    /** @type {mysqlTypes.Pool}  */
    const db = req.app.get("db");
    // console.log(username, password);
    db.query(
      "SELECT role FROM credentials WHERE username = ? AND password = ?",
      [username || "", password || ""],
      (err, rowsM, fields) => {
        if (err) {
          // console.log('Error: ',err.sqlMessage);
          return res.status(500).json({ token: null, error: err.sqlMessage });
        }
        if (rowsM.length === 0) {
          // console.log('Error: Invalid username or password');
          return res
            .status(401)
            .json({ token: null, error: "Invalid username or password" });
        }

        if (rowsM[0].role !== "ADMIN" && privilege === "ADMIN") {
          return res
            .status(401)
            .json({ token: null, error: "Invalid privilege" });
        }
        // console.log(rowsM.length);
        db.query(
          `select name, username, card_number from profile where username="${username}"; `,
          async (err, rows, fields) => {
            if (err) {
              // console.log('Error: ',err.sqlMessage);
              return res
                .status(500)
                .json({ token: null, error: err.sqlMessage });
            }
            // generate a token and insert it into sessions table
            const { generateApiKey } = require("generate-api-key");
            const token = generateApiKey({
              method: "string",
              pool: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789",
              length: 50,
            });

            await db.query(
              `insert into sessions (username, token) values ("${username}", "${token}") on DUPLICATE KEY update token="${token}";`
            );

            return res.json({ ...rows[0], ...rowsM[0], token });
          }
        );
      }
    );
  },
  entry: async (
    /** @type {expressTypes.Request} */ req,
    /** @type {expressTypes.Response} */ res
  ) => {
    let { username, code } = req.body;
    /** @type {mysqlTypes.Pool}  */
    const db = req.app.get("db");

    db.query(
      `select current_status, card_number, balance from profile where username="${username}";`,
      async (err, rows, fields) => {
        if (err) {
          console.log(err);
          return res.status(500).json({ error: err.sqlMessage });
        }

        console.log(rows[0]);

        // check if user is already in
        if (rows[0].current_status !== null) {
          return res.json({ error: "Already IN" });
        }

        // check if user has a valid card
        if (rows[0].card_number === null) {
          return res.json({ error: "No card" });
        }

        // check if user card has minimum balance of 50rs
        if (rows[0].balance < 50) {
          return res.json({ error: "Insufficient balance" });
        }

        // make an ENTRY in the transactions table
        db.query(
          `insert into transactions (username, type, station) values ("${username}", "ENTRY", "${code}");`,
          (err, rows1, fields) => {
            if (err) {
              console.log(err);
              return res.json({ error: err.sqlMessage });
            }

            return res.json({
              token: null,
              code: null,
              error: null,
              balance: rows[0].balance,
            });
          }
        );
      }
    );
  },
  exit: (
    /** @type {expressTypes.Request} */ req,
    /** @type {expressTypes.Response} */ res
  ) => {
    let { username, code } = req.body;
    const db = req.app.get("db");

    db.query(
      `select current_status, card_number, balance from profile where username="${username}";`,
      async (err, rows, fields) => {
        if (err) {
          console.log(err);
          return res.status(500).json({ error: err.sqlMessage });
        }

        console.log(rows[0]);

        // check if user is already in
        if (rows[0].current_status === null) {
          return res.json({ error: "First take a entry" });
        }

        // check if user has a valid card
        if (rows[0].card_number === null) {
          return res.json({ error: "No card" });
        }

        // calaculate the fare
        let fare = 0;
        db.query(
          `select * from stations where station_code in ("${rows[0].current_status}","${code}") ;`,
          async (err, rows1, fields) => {
            if (err) {
              console.log(err);
              return res.json({ error: err.sqlMessage });
            }
            // console.log(rows1);

            // check if current_status is equal to code
            if (rows[0].current_status === code) fare = 0;
            else
              fare = calculateFare(
                rows1[0].point.split(","),
                rows1[1]?.point?.split(",")
              );

            let newBalance = rows[0].balance - fare;
            // update the balance
            db.query(
              `update profile set balance = ${newBalance} where username="${username}";`,
              async (err, rows2, fields) => {
                if (err) {
                  console.log(err);
                  return res.json({ error: err.sqlMessage });
                }
              }
            );

            // make an EXIT in the transactions table
            db.query(
              `insert into transactions (username, type, station, fare) values ("${username}", "EXIT", "${code}", "${fare}");`,
              (err, rows1, fields) => {
                if (err) {
                  console.log(err);
                  return res.json({ error: err.sqlMessage });
                }

                return res.json({
                  token: null,
                  code: null,
                  error: null,
                  balance: newBalance,
                  charged: fare,
                });
              }
            );
          }
        );
      }
    );
  },
  getAllStations: (
    /** @type {expressTypes.Request} */ req,
    /** @type {expressTypes.Response} */ res
  ) => {
    /** @type {mysqlTypes.Pool}  */
    const db = req.app.get("db");

    db.query(`select * from stations;`, async (err, rows, fields) => {
      if (err) {
        console.log("Error: ", err.sqlMessage);
        return res.status(500).json({ error: err.sqlMessage });
      }

      if (rows.length === 0) {
        return res.status(400).json({ error: "No stations found" });
      }

      return res.json({ stations: rows });
    });
  },
  getAllJourneys: (
    /** @type {expressTypes.Request} */ req,
    /** @type {expressTypes.Response} */ res
  ) => {
    let { username } = req.body;
    /** @type {mysqlTypes.Pool}  */
    const db = req.app.get("db");

    db.query(`select * from journeys;`, async (err, rows, fields) => {
      if (err) {
        console.log("Error: ", err.sqlMessage);
        return res.status(500).json({ error: err.sqlMessage });
      }

      if (rows.length === 0) {
        return res.status(400).json({ error: "No journeys found" });
      }

      return res.json({ journeys: rows });
    });
  },
  finalStatusWH: (
    /** @type {expressTypes.Request} */ req,
    /** @type {expressTypes.Response} */ res
  ) => {
    console.log("get", req.query);
    res.json({ status: "OK" });
  },
  finalStatusWHP: (
    /** @type {expressTypes.Request} */ req,
    /** @type {expressTypes.Response} */ res
  ) => {
    /** @type {mysqlTypes.Pool}  */
    const db = req.app.get("db");

    console.log("post", req);
    res.json({ status: "OK" });
  },
  abortPayment: (
    /** @type {expressTypes.Request} */ req,
    /** @type {expressTypes.Response} */ res
  ) => {
    let { username, payment_id } = req.body;
    if (!payment_id) {
      return res.status(400).json({ error: "Invalid payment ID" });
    }
    /** @type {mysqlTypes.Pool}  */
    const db = req.app.get("db");

    // insert into payments table and check if unique

    db.query(
      `delete from payments where payment_id="${payment_id}" AND status in ("TXN_INIT","TXN_ASSIGNED");`,
      async (err, rows, fields) => {
        if (err) {
          console.log("Error: ", err.sqlMessage);
          return res.status(500).json({ error: err.sqlMessage });
        }

        return res.json({ payment_id });
      }
    );
  },
  generatePaymentId: (
    /** @type {expressTypes.Request} */ req,
    /** @type {expressTypes.Response} */ res
  ) => {
    let { username, amount } = req.body;
    if (parseInt(amount) < 1) {
      return res.status(400).json({ error: "Invalid amount" });
    }
    /** @type {mysqlTypes.Pool}  */
    const db = req.app.get("db");

    // generate a token and insert it into sessions table
    const payment_id = 'MTP' + new Date().getTime();

    // insert into payments table and check if unique
    db.query(
      `insert into payments (agent, payment_id, txn_amount) values ("${username}", "${payment_id}", "${amount}");`,
      async (err, rows, fields) => {
        if (err) {
          console.log("Error: ", err.sqlMessage);
          return res.status(500).json({ error: err.sqlMessage });
        }

        return res.json({ payment_id });
      }
    );
  },
  getStatus: (
    /** @type {expressTypes.Request} */ req,
    /** @type {expressTypes.Response} */ res
  ) => {
    let { username, payment_id } = req.body;
    if (!payment_id) {
      return res.status(400).json({ error: "Invalid payment ID" });
    }
    /** @type {mysqlTypes.Pool}  */
    const db = req.app.get("db");

    // insert into payments table and check if unique
    db.query(
      `select status from payments where payment_id="${payment_id}";`,
      async (err, rows, fields) => {
        if (err) {
          console.log("Error: ", err.sqlMessage);
          return res.status(500).json({ error: err.sqlMessage });
        }

        if (rows.length === 0) {
          return res.status(400).json({ error: "No payment found" });
        }

        if (rows[0].status !== "TXN_INIT") {
          return res
            .status(400)
            .json({ error: "Transaction already completed" });
        }

        return res.json({ payment_id });
      }
    );
  },
  verifyUser: (
    /** @type {expressTypes.Request} */ req,
    /** @type {expressTypes.Response} */ res
  ) => {
    let { username, payment_id } = req.body;
    /** @type {mysqlTypes.Pool}  */
    const db = req.app.get("db");

    db.query(
      `select username, status from payments where payment_id="${payment_id}";`,
      async (err, rows, fields) => {
        if (err) {
          console.log("Error: ", err.sqlMessage);
          return res.status(500).json({ error: err.sqlMessage });
        }

        if (rows.length === 0) {
          return res.status(400).json({ error: "Invalid payment_id" });
        }

        if (
          rows[0].status === "TXN_INIT" ||
          rows[0].status === "TXN_DISCARDED"
        ) {
          return res.status(400).json({ error: "Invalid payment" });
        }

        db.query(
          `select name, balance, card_number from profile where username="${username}";`,
          async (err, rows1, fields) => {
            if (err) {
              console.log("Error: ", err.sqlMessage);
              return res.status(500).json({ error: err.sqlMessage });
            }

            if (rows1.length === 0) {
              return res.status(400).json({ error: "Invalid username" });
            }

            return res.json({ data: rows1[0] });
          }
        );
      }
    );
  },
  assignUserToPaymentId: (
    /** @type {expressTypes.Request} */ req,
    /** @type {expressTypes.Response} */ res
  ) => {
    let { username, payment_id } = req.body;

    console.log(-1)

    /** @type {mysqlTypes.Pool}  */
    const db = req.app.get("db");

    /** @type {Server} */
    const io = req.app.get("socket");

    // insert into payments table and check if unique
    db.query(
      `select txn_amount,agent from payments where payment_id="${payment_id}"`,
      async (err, rows, fields) => {
        if (err) {
          console.log("Error: ", err.sqlMessage);
          return res.json({ error: err.sqlMessage });
        }

        if (rows.length === 0) {
          console.log("Error: ", "No payment found");
          return res.json({ error: "Invalid payment_id" });
        }
        console.log(1)
        db.query(
          `update payments set username="${username}",status="TXN_ASSIGNED" where payment_id="${payment_id}";`,
          async (err1, rows1, fields1) => {
            if (err1) {
              console.log("Error: ", err.sqlMessage);
              return res.json({ error: err.sqlMessage });
            }
            // console.log(rows[0]);
            console.log(2)

            let agentSocId = await new Promise((resolve, reject) => {
              db.query(
                `select * from sessions where username="${rows[0].agent}" ;`,
                (err2, rows2) => {
                  if (err2) {
                    // console.log(err);
                    return reject(err2.sqlMessage);
                  }
                  console.log(3)

                //   console.log(rows[0].agent,rows2);
                  if (rows2?.length === 0) {
                    return reject("No agent found");
                    }
                  resolve({ err: false, rows: rows2 });
                }
              );
            }).catch((err) => {
              return {err: err.sqlMessage};
            });

            console.log(4)


            if (!agentSocId.err) {
                console.log(agentSocId?.rows[0]?.socket_id)
              io.to(agentSocId?.rows[0]?.socket_id).emit("assigned", { username: username });
            }

            console.log(5)


            res.json({
              amount: rows[0].txn_amount,
              token: null,
              payment_id: null,
              error: null,
            });
          }
        );
      }
    );
  },
  getReceipt: (
    /** @type {expressTypes.Request} */ req,
    /** @type {expressTypes.Response} */ res
  ) => {
    let { username, payment_id } = req.body;
    if (!payment_id) {
      return res.status(400).json({ error: "Invalid payment ID" });
    }
    /** @type {mysqlTypes.Pool}  */
    const db = req.app.get("db");

    // console.log(payment_id)

    // insert into payments table and check if unique
    db.query(
      `select txn_amount,currency,username,payment_mode,gateway_name,status,last_updated  from payments where payment_id="${payment_id}";`,
      async (err, rows, fields) => {
        if (err) {
          console.log("Error: ", err.sqlMessage);
          return res.status(500).json({ error: err.sqlMessage });
        }

        if (rows.length === 0) {
          return res.status(400).json({ error: "No payment found" });
        }

        if (
          rows[0].status !== "TXN_SUCCESS" &&
          rows[0].status !== "TXN_FAILURE"
        ) {
          return res.status(400).json({ error: "Invalid payment" });
        }

        return res.json({ receipt: rows[0] });
      }
    );
  },
  getTransactionDetails: (
    /** @type {expressTypes.Request} */ req,
    /** @type {expressTypes.Response} */ res
  ) => {
    let { payment_id } = req.body;
    if (!payment_id) {
      return res.status(400).json({ error: "Invalid payment ID" });
    }
    /** @type {mysqlTypes.Pool}  */
    const db = req.app.get("db");

    // insert into payments table and check if unique
    db.query(
      `select payment_id, txn_amount, status from payments where payment_id="${payment_id}";`,
      async (err, rows, fields) => {
        if (err) {
          console.log("Error: ", err.sqlMessage);
          return res.status(500).json({ error: err.sqlMessage });
        }

        if (rows.length === 0) {
          return res.status(400).json({ error: "No payment found" });
        }

        if (rows[0].status !== "TXN_ASSIGNED") {
          return res
            .status(400)
            .json({ error: "Transaction Invalid" });
        }

        return res.json({ data: rows[0] });
      }
    );
  },
  paymentCallback: (
    /** @type {expressTypes.Request} */ req,
    /** @type {expressTypes.Response} */ res
  ) => {
    let { ORDERID,
    TXNAMOUNT,
    PAYMENTMODE,
    CURRENCY,
    STATUS,
    GATEWAYNAME,
    BANKNAME } = req.body;

    /** @type {mysqlTypes.Pool}  */
    const db = req.app.get("db");

    // insert into payments table and check if unique
    db.query(
      `select txn_amount,agent from payments where payment_id="${ORDERID}"`,
      async (err, rows, fields) => {
        if (err) {
          console.log("Error: ", err.sqlMessage);
          return res.status(500).json({ error: err.sqlMessage });
        }

        if (rows.length === 0) {
          return res.status(400).json({ error: "Invalid payment_id" });
        }

        db.query(
          `update payments set txn_amount="${TXNAMOUNT}",status="${STATUS}",payment_mode="${PAYMENTMODE}",currency="${CURRENCY}",gateway_name="${GATEWAYNAME}",bank_name="${BANKNAME}",order_id="${ORDERID}" where payment_id="${ORDERID}";`,
          async (err1, rows1, fields1) => {
            if (err1) {
              console.log("Error: ", err.sqlMessage);
              return res.status(400).json({ error: err.sqlMessage });
            }
            // console.log(rows[0]);


            const admin = req.app.get("fcm")
            var topic = 'general';


var message = {
  notification: {
    title: STATUS==='TXN_SUCCESS'?`Topup of Rs. ${TXNAMOUNT} successful`: `Topup failed`,
    body: 'at Metro Terminal'
  },
  topic: topic
};

admin.messaging().send(message)
  .then((response) => {
    console.log('Successfully sent message:', response);
  })
  .catch((error) => {
    console.log('Error sending message:', error);
});
            

            res.json({
              success: true
            });
          }
        );
      }
    );
  },
};

// export the controller
module.exports = controller;


// select cast(substring_index ("-7,0",',',1) AS int)+5 AS STRING;
