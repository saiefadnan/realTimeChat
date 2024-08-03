const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const path = require('path');
const User = require('./mongodb/user');
require('dotenv').config();
const bodyParser = require('body-parser');
const {uploadImageToAzure} = require('./azureUpload');
const cors = require('cors');
//const { receiveMessageOnPort } = require('worker_threads');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
      origin: 'https://real-time-chat-git-main-saiefadnans-projects.vercel.app',
      methods: ['GET', 'POST'],
      credentials: true
    }
  });
  
  app.use(cors({
    origin: 'https://real-time-chat-git-main-saiefadnans-projects.vercel.app',
    methods: ['GET', 'POST'],
    credentials: true
  }));

const users={};
const names={};
const photo={};
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));
function emitActiveUsers (){
    activeUsers =  Object.values(names);
    profile = Object.values(photo);
    io.emit('activeUsers',{activeUsers,profile});
}

function status(msg){
    io.emit('notify',{
        notify: msg
    });
}

status('Connecting...');

mongoose.connect('mongodb+srv://saiefadnan078:eYGjkUILy43UTRYl@cluster-chatapp.thnof8a.mongodb.net/?retryWrites=true&w=majority&appName=Cluster-chatApp',{
    useNewUrlParser: true,
    useUnifiedTopology: true
})
.then(()=>{
    console.log('MongoDB connected');
    status('Connected');
})
.catch(err => {
    console.error(err);
    status('Network error..');
});

app.use(express.static(path.join(__dirname,'public')));


io.on('connection', (socket) =>{
    console.log('A user connected: ',socket.id);
    socket.on('register',async({email, username,password,profile})=>{
        try{
            let user = await User.findOne({username});
            let emails = await User.findOne({email});
            if(!user && !emails){
                const imageUrl = await uploadImageToAzure(profile);
                user = new User({username,password,email,profilePicture: imageUrl});
                await user.save();
                users[username]=socket.id;
                names[socket.id]=username;
                photo[socket.id]=imageUrl;
                io.to(socket.id).emit('notify',{
                    notify: `Registration successful!! Logged in as : ${user.username}`
                });
                io.to(socket.id).emit('profilePicture',{
                    picture: imageUrl
                });
                if(Object.keys(names).length>0)emitActiveUsers();
            }
            else{
                io.to(socket.id).emit('error',{
                    error: 'Already exists.Choose another name or email!'
                });
            }
            
        }catch(err){
            console.error('Error registering user:', err);
        }
    })

    socket.on('login',async(email,password)=>{
        console.log(password,email);
        try{
            const user = await User.findOne({email});
            console.log(user.username);
            const pass = await user.comparePassword(password);
            if(user && pass && !users[user.username] && !names[socket.id]){
                users[user.username]=socket.id;
                names[socket.id]=user.username;
                photo[socket.id]=user.profilePicture;
                io.to(socket.id).emit('notify',{
                    notify: `Logged in as : ${user.username}`,
                    picture: user.profilePicture
                });
                io.to(socket.id).emit('profilePicture',{
                    picture: user.profilePicture
                });
                console.log(user.profilePicture);

                if(Object.keys(names).length>0)emitActiveUsers();
            }
            else if(!user || !pass){
                io.to(socket.id).emit('error',{
                    error: `Invalid login attempt with: ${email}`
                });
            }
            // else if(users[user.username] && names[socket.id]){
            //     io.to(socket.id).emit('error',{
            //         error: `Already logged in with: ${email}`
            //     });
            // }
        }catch(error){
            console.error('Error logging in user:', error);
        }
    })

    socket.on('private image',async({to,fileData})=>{
        const recipientSocketId = users[to];
        if(!names[socket.id]){
            io.to(socket.id).emit('error',{
                error: 'You are not logged in! Message not sent!'
            });
        }
        else if(recipientSocketId){
            io.to(recipientSocketId).emit('private image', {
                from: names[socket.id],
                time: Date.now(),
                fileData: fileData,
                profile: photo[socket.id] 
            });
        }
        else{
            io.to(socket.id).emit('error',{
                error: `${to} is disconnected or not available`
            });
        }
    })

    socket.on('public image',async({fileData})=>{
        console.log('image sending...');
        if(!names[socket.id]){
            io.to(socket.id).emit('error',{
                error: 'You are not logged in! Message not sent!'
            });
        }
        else{
            socket.broadcast.emit('public image',{
                from: names[socket.id],
                time: Date.now(),
                fileData: fileData,
                profile: photo[socket.id] 
            })
        }
    })

    socket.on('private video',async({to,fileData})=>{
        console.log('video sending...');
        const recipientSocketId = users[to];
        if(!names[socket.id]){
            io.to(socket.id).emit('error',{
                error: 'You are not logged in! Message not sent!'
            });
        }
        else if(recipientSocketId){
            io.to(recipientSocketId).emit('private video', {
                from: names[socket.id],
                time: Date.now(),
                fileData: fileData,
                profile: photo[socket.id] 
            });
        }
        else{
            io.to(socket.id).emit('error',{
                error: `${to} is disconnected or not available`
            });
        }
    })

    socket.on('public video',async({fileData})=>{
        console.log('video sending...');
        if(!names[socket.id]){
            io.to(socket.id).emit('error',{
                error: 'You are not logged in! Message not sent!'
            });
        }
        else{
            socket.broadcast.emit('public video',{
                from: names[socket.id],
                time: Date.now(),
                fileData: fileData,
                profile: photo[socket.id] 
            })
        }
    })

    
    socket.on('public file',async({fileData, fileName})=>{
        // console.log('Received image data:', imageData);
        if(!names[socket.id]){
            io.to(socket.id).emit('error',{
                error: 'You are not logged in! Message not sent!'
            });
        }
        else{
            socket.broadcast.emit('public file',{
                from: names[socket.id],
                time: Date.now(),
                fileData: fileData,
                fileName: fileName,
                profile: photo[socket.id] 
            })
        }
    })
    socket.on('private file',async({to, fileData, fileName})=>{
        console.log('video sending...');
        const recipientSocketId = users[to];
        if(!names[socket.id]){
            io.to(socket.id).emit('error',{
                error: 'You are not logged in! Message not sent!'
            });
        }
        else if(recipientSocketId){
            io.to(recipientSocketId).emit('private file', {
                from: names[socket.id],
                time: Date.now(),
                fileData: fileData,
                fileName: fileName,
                profile: photo[socket.id] 
            });
        }
        else{
            io.to(socket.id).emit('error',{
                error: `${to} is disconnected or not available`
            });
        }
    })
    
    socket.on('private message',async({to,message})=>{
        const recipientSocketId = users[to];
        console.log(message,to,recipientSocketId);
        if(!names[socket.id]){
            io.to(socket.id).emit('error',{
                error: 'You are not logged in! Message not sent!'
            });
        }
        else if(recipientSocketId){
            io.to(recipientSocketId).emit('private message',{
                from: names[socket.id],
                time: Date.now(),
                message,
                profile: photo[socket.id] 
        });
        }
        else{
            io.to(socket.id).emit('error',{
                error: `${to} is disconnected or not available`
            });
        }
    });

    socket.on('public message', async(message)=>{
        if(!names[socket.id]){
            io.to(socket.id).emit('error',{
                error: 'You are not logged in! Message not sent!'
            });
        }
        else{
            socket.broadcast.emit('public message',{
                from: names[socket.id],
                time: Date.now(),
                message,
                profile: photo[socket.id] 
            })
        }
    })
    socket.on('disconnect',()=>{
        console.log('A user disconnected: ',socket.id);
        delete users[names[socket.id]];
        delete names[socket.id];
        delete photo[socket.id];
        if(Object.keys(names).length>0)emitActiveUsers();
    });
});


const PORT =4000;
server.listen(PORT,()=>{
    console.log(`Server is running on port ${PORT}`);
});


// mongodb+srv://saiefadnan078:eYGjkUILy43UTRYl@cluster-chatapp.thnof8a.mongodb.net/?retryWrites=true&w=majority&appName=Cluster-chatApp