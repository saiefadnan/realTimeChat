const express = require('express');
const router = express.Router();
const {loginData, signinData, chatData} = require('../controllers/controller');

router.post('/login', loginData);
router.post('/signin',signinData);
router.post('/getchats', chatData)
module.exports = router;