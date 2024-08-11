const express = require('express');
const router = express.Router();
const {loginData, signinData} = require('../controllers/controller');

router.post('/login', loginData);
router.post('/signin',signinData)
module.exports = router;