const axios  = require("axios");
const { Server } = require("socket.io");

const socketHandler = (/** @type {Server} */io, /** @type {mysqlTypes.Pool}  */db) => {

    const removeSocketId = async (id) => {
      await new Promise((resolve, reject)=>{
        db.query(`update sessions set socket_id=NULL where socket_id="${id}" ;`, (err, rows) => {
          if (err) {
              console.log(err);
              reject(err);
          }
          // console.log(rows);
          resolve({err: false,rows});
      })
      }).catch(err=> { return err.sqlMessage })
    }

    io.on("connection", async (socket) => {
        var auth;
        const token = socket.handshake.query.token;
        // const db = dbO;
        try {
            auth = await axios.get(`http://localhost:8000/verifyToken?token=${token}`)
            // console.log(auth)
            // db.query(`SELECT * FROM sessions;`, (err, rows) => {
            //     if (err) {
            //         console.log(err);
            //         return;
            //     }
            //     console.log(rows);
            //   })
            auth = { ...auth?.data, socket_id: socket.id, success: true }
        } catch (error) {
            // console.log(error?.response?.data)
            auth = { ...error?.response?.data, success: false, token: token }
            // auth.success = false
        }
        // auth = await axios.get(`http://localhost:8000/verifyToken?token=${socket.handshake.auth.token}`)
        console.log(auth)

        if (! auth?.success) {
            io.to(socket.id).emit("auth", auth);
            removeSocketId(socket.id);
            // return io.in(socket.id).disconnectSockets();
            return socket.disconnect(true);
        }

        let socIns = await new Promise((resolve, reject)=>{
          db.query(`update sessions set socket_id="${socket.id}" where token="${token}";`, (err, rows) => {
            if (err) {
                // console.log(err);
                reject(err);
            }
            // console.log(rows);
            resolve({err: false,rows});
        })
        }).catch(err=> { return err.sqlMessage }) 

        // console.log(socIns)
        if (socIns.err) {
            removeSocketId(socket.id);
            return socket.disconnect();
        }

        socket.on("auth",data=>{ 
          socketToken = data.token;
          console.log(socket.id) 
        });
        /////
        socket.on("test",data => {
          // socket.emit("payment_notification",{transaction_id: "123123", amt: "389", from_name: data});
          socket.broadcast.emit("assigned","THis is a test");
          // socket.emit("payment_notification",{transaction_id: "123128", amt: "89", from_name: "Robert Downey Jr"});
          
          // socket.emit("payment_notification",{transaction_id: "123173", amt: "78", from_name: "Tom Cruise"});
        });
       
        // io.to("a").emit("payment_notification","paid2");
        // io.sockets.in("a").emit("payment_notification","paid3");
      
        socket.on("disconnect",data => {
          removeSocketId(socket.id);
          console.log("user disconnected "+socket.id)
        }); 
        console.log(socket.handshake.query.token);
      });
}

module.exports = socketHandler;