require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../mongodb/user');
const {uploadImageToAzure} = require('../azureUpload');
const usernames=[];



const loginData = async(req,res)=>{
    try{
        const {email,password} = req.body;
        console.log(email);
        const user = await User.findOne({email}); 
        if(!user){
            return res.status(200).json({
                login: false,
                notify: `Invalid login attempt`
            });
        }
        const pass = await user.comparePassword(password);
        if(!pass){
            return res.status(200).json({
                login: false,
                notify: `Invalid login attempt`
            });
        }
        if(usernames.includes(user.username)){
            return res.status(200).json({
                login: false,
                notify: `You are currently logged in else where!`
            });
        }else if(user && pass){
            usernames.push(user.username);
            return res.status(200).json({
                    login:true,
                    notify: `Welcome ${user.username}!`,
                    username: user.username,
                    imageurl: user.profilePicture
            });
        }
    }
    catch(err){
        console.error(err);
        res.status(500).send('Error occured');
    }
}

const signinData = async(req,res)=>{
    try{
        const {email, username ,password, profile} = req.body;
        console.log(email);
        let user = await User.findOne({username});
        const emails = await User.findOne({email});
        if(!user && !emails && !usernames.includes(username)){
            let imageUrl="https://img6.arthub.ai/65f2201a-1b80.webp";
            if(profile) imageUrl = await uploadImageToAzure(profile);
            user = new User({username,password,email,profilePicture: imageUrl});
            await user.save();
            usernames.push(username);
            res.status(200).json({
                signin:true,
                notify: `Sucessfully registered!! Welcome ${user.username}!`,
                username: user.username,
                imageurl: imageUrl
            });
        }
        else{
            res.status(200).json({
                signin:false,
                notify: `Email or Username already exists! plz log in!`,
            });
        }
                
    }
    catch(err){
        console.error(err);
        res.status(500).send('Error occured');
    }
}

module.exports ={
    loginData,
    signinData,
    usernames
}