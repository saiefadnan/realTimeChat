require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../mongodb/user');
const { BlobServiceClient, StorageSharedKeyCredential} = require('@azure/storage-blob');
const {uploadImageToAzure, generateSasToken} = require('../azureUpload');
const usernames=[];
const accountName = process.env.AZURE_ACCOUNT_NAME;
const accountKey = process.env.AZURE_ACCOUNT_KEY;


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
            const blobName = decodeURIComponent(user.profilePicture.substring(user.profilePicture.lastIndexOf('/')+1));
            const credential = new StorageSharedKeyCredential(accountName, accountKey);
            const sasToken = await generateSasToken(blobName,credential);
            console.log('Token Refreshed....');
            return res.status(200).json({
                    login:true,
                    notify: `Welcome ${user.username}!`,
                    username: user.username,
                    imageurl: `${user.profilePicture}?${sasToken}`
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
            let blobPath_ = "https://img6.arthub.ai/65f2201a-1b80.webp";
            let sasToken_='';
            if(profile){
                const { blobPath, sasToken } = await uploadImageToAzure(profile);
                blobPath_ = blobPath;
                sasToken_ = sasToken;
            }
            user = new User({username,password,email,profilePicture: blobPath_});
            await user.save();
            usernames.push(username);
            res.status(200).json({
                signin:true,
                notify: `Sucessfully registered!! Welcome ${user.username}!`,
                username: user.username,
                imageurl: `${blobPath_}?${sasToken_}`
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