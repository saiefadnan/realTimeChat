const deactive_avtr = 'https://cdn.create.vista.com/api/media/small/456352818/stock-vector-users-profile-account-avatar-remove-user-icon-users';
const cron = require('node-cron');
const User = require('../mongodb/user');
const { admin, db} = require('../firebase');
const { StorageSharedKeyCredential} = require('@azure/storage-blob');
const {uploadImageToAzure, generateSasToken} = require('../azureUpload');
const {names, photos, users} = require('../socketHandler');
const { all } = require('axios');
const usernames=[];
const accountName = process.env.AZURE_ACCOUNT_NAME;
const accountKey = process.env.AZURE_ACCOUNT_KEY;
const init=true;
let io_;
const refreshToken = async(profilePicture)=>{
    const blobName = decodeURIComponent(profilePicture.substring(profilePicture.lastIndexOf('/')+1));
    console.log(blobName);
    const credential = new StorageSharedKeyCredential(accountName, accountKey);
    const sasToken = await generateSasToken(blobName,credential);
    return sasToken;
}
function assign(io){
    if(init){
        io_ = io;
    }
    else init= false;
}

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
            const sasToken = await refreshToken(user.profilePicture);
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

const chatData = async(req, res)=>{
    try{
        const {username} = req.body;
        console.log(username);
        const chatRef = db.collection('chat');
        const [sender,public,receiver]= await Promise.all([
            chatRef.where('sender','==',username).get(),
            chatRef.where('receiver','==','public').where('sender', '!=',username).get(),
            chatRef.where('receiver','==',username).get()
        ])

        const combineData = [...sender.docs,...public.docs,...receiver.docs];

        combineData.sort((a,b)=>{
           return  a.data().timestamp.toMillis()-b.data().timestamp.toMillis()}
        );

        res.status(200).json({
            chats: combineData.map((doc)=>({
                id: doc.id,
                ...doc.data(),
                imageUrl: photos[users[doc.data().sender]]?photos[users[doc.data().sender]]:deactive_avtr
            }))
        })
    }catch(err){
        console.error(err);
    }
}


const cleanUpOldChats = async()=>{
    try{
        console.log('yooo');
        const fiveHourAgoMillis = admin.firestore.Timestamp.now().toMillis() - (5*3600*1000);
        const fiveHourAgo = new admin.firestore.Timestamp( Math.floor(fiveHourAgoMillis/1000), (fiveHourAgoMillis%1000)*1000000);
        const chatRef = db.collection('chat');
        console.log(fiveHourAgo);
        const snapShot = await chatRef.where('timestamp', '<', fiveHourAgo).get();
        if(snapShot.empty){
            console.log('Database is already clean');
        }
        else{
            console.log(`Database is cleaning......(total: ${snapShot.docs.length})`);
            const batch = db.batch();
            snapShot.forEach((doc)=>{
                batch.delete(doc.ref);
            })
            await batch.commit();
            console.log('Database is clean');
        }
        //refresh token after 1 hr
            for(let socket_id in photos){
                const profilePic = photos[socket_id].substring(0,photos[socket_id].lastIndexOf('?'))
                const sasToken = await refreshToken(profilePic);
                photos[socket_id]=`${profilePic}?${sasToken}`;
            }
            let activeUsers,profile;
            if(names && photos){
                activeUsers = Object.values(names);
                profile = Object.values(photos);
            }
            io_.emit('init activeUsers',{activeUsers, profile});
            console.log('sas tokens refreshed...');

    }catch(err){
        console.error('Error cleaning database', err);
    }
}


cron.schedule('0 */1 * * *', cleanUpOldChats);

module.exports ={
    loginData,
    signinData,
    chatData,
    refreshToken,
    assign,
    usernames
}