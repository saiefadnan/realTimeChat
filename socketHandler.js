const mongoose = require('mongoose');
const User = require('./mongodb/user');

function socketHandler(io){
    const users = {};
    const names = {};
    const photo ={};

    function emitActiveUsers (){
        activeUsers =  Object.values(names);
        profile = Object.values(photo);
        io.emit('activeUsers',{activeUsers,profile});
    }
    io.on('connection', (socket) =>{
        console.log('A user connected: ',socket.id);
        socket.on('show active-users',async()=>{
            if(Object.keys(names).length>0)emitActiveUsers();
        })
        socket.on('insert name',async({username,imageurl})=>{
            users[username] = socket.id;
            names[socket.id] = username;
            photo[socket.id] = imageurl
            console.log('username saved...');
            if(Object.keys(names).length>0)emitActiveUsers();
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
}

module.exports = socketHandler;












