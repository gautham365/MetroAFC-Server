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

router.post('/entry', controller.isLoggedIn ,controller.entry);
router.post('/exit', controller.isLoggedIn ,controller.exit);

router.get('/webhook/payment/finalStatus', controller.finalStatusWH);
router.post('/webhook/payment/finalStatus', controller.finalStatusWHP);

// export the routes
module.exports = router;