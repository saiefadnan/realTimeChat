const mongoose = require('mongoose');
const User = require('./mongodb/user');
const {usernames} = require('./controllers/controller');

function socketHandler(io){
    const users = {};
    const names = {};
    const photos ={};

    function emitActiveUsers (operation, name, photo, socket){
        activeUsers = Object.values(names);
        profile = Object.values(photos);
        console.log(operation);
        if(operation==='init'){
            io.to(socket.id).emit('init activeUsers',{activeUsers, profile});
        }
        else if(operation==='add'){
            socket.broadcast.emit('activeUsers',{operation, name, photo});
        }
        else io.emit('activeUsers',{operation, name});
    }
    io.on('connection', (socket) =>{
        console.log('A user connected: ',socket.id);
        socket.on('show active-users',async()=>{
            if(Object.keys(names).length>0)emitActiveUsers('init',null,null,socket);
        })
        socket.on('insert name',async({username,imageurl})=>{
            users[username] = socket.id;
            names[socket.id] = username;
            photos[socket.id] = imageurl
            console.log('username saved');
            if(Object.keys(names).length>0){
                emitActiveUsers('init',null,null,socket);
                emitActiveUsers('add',username,imageurl,socket);
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
                    profile: photos[socket.id] 
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
                    profile: photos[socket.id] 
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
                    profile: photos[socket.id] 
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
                    profile: photos[socket.id] 
                })
            }
        })
    
        
        socket.on('public file',async({fileData, fileName})=>{
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
                    profile: photos[socket.id] 
                })
            }
        })
        socket.on('private file',async({to, fileData, fileName})=>{
            console.log('file sending...');
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
                    profile: photos[socket.id] 
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
                    profile: photos[socket.id] 
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
                    profile: photos[socket.id] 
                })
            }
        })
        socket.on('disconnect',()=>{
            console.log('A user disconnected: ',socket.id);
            const index = usernames.indexOf(names[socket.id]);
            if(index!==-1){
                usernames.splice(index,1);
                console.log('total concurrent active users ',usernames.length);
            }
            delete users[names[socket.id]];
            if(Object.keys(names).length>0)emitActiveUsers('remove',names[socket.id], photos[socket.id]);
            delete names[socket.id];
            delete photos[socket.id];
        });
    });
}

module.exports = socketHandler;












