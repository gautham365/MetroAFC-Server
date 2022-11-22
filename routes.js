const express = require('express');
const router = express.Router();

// import the controller
const controller = require('./controller.js');

// define the routes
router.get('/', controller.hello);

router.get('/verifyToken', controller.verifyToken);
router.post('/login', controller.login);

router.post('/station/all', controller.isLoggedIn, controller.getAllStations);
router.post('/journeys/all', controller.isLoggedIn, controller.getAllJourneys);

router.post('/fetch/balance', controller.isLoggedIn ,controller.fetchBalance);
router.post('/entry', controller.isLoggedIn ,controller.entry);
router.post('/exit', controller.isLoggedIn ,controller.exit);

router.post('/payment/abort', controller.isLoggedIn ,controller.abortPayment);
router.post('/payment/generatePaymentId', controller.isLoggedIn ,controller.generatePaymentId);
router.post('/payment/getStatus', controller.isLoggedIn ,controller.getStatus);
router.post('/payment/verifyUser', controller.isLoggedIn ,controller.verifyUser);
router.post('/payment/assignUserToPaymentId', controller.isLoggedIn ,controller.assignUserToPaymentId);
router.post('/payment/getReceipt', controller.isLoggedIn ,controller.getReceipt);

router.post('/payment/getTransactionDetails' ,controller.getTransactionDetails);
router.post('/payment/callback' ,controller.paymentCallback);

router.post('/webhook/payment/finalStatus', controller.finalStatusWH);

router.get('/api/getAllTables', controller.getAllTables)
router.post('/api/getTable', controller.getTable)
router.post('/api/runQuery', controller.runQuery)
router.post('/api/updateRow', controller.updateRow)

// export the routes
module.exports = router;
