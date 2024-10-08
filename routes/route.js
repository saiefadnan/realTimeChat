const express = require('express');
const router = express.Router();
const {loginData, signinData, chatData, getUserInfo, queryUser} = require('../controllers/controller');

router.post('/login', loginData);
router.post('/signin',signinData);
router.post('/userData',getUserInfo);
router.post('/getchats', chatData)
router.post('/search', queryUser)
module.exports = router;