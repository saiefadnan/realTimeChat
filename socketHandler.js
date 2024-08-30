const { Socket } = require('socket.io');
const {uploadFile, gatherChunks} = require('./Gdrive');
const { storeChats } = require('./storeChats');
const jwt = require('jsonwebtoken');
const secretKey = process.env.JWT_SECRET;

const users = {};
const names = {};
const photos ={};
const socIns ={};

function socketHandler(io){
    emitActiveUsers = function(operation, name, photo, socket){
        activeUsers = Object.values(names);
        profile = Object.values(photos);
        if(operation==='init' || operation==='refresh'){
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
        socket.on('insert name',async( {jwtoken})=>{
            let username, imageurl;
            try{
                const decoded= jwt.verify(jwtoken, secretKey);
                username = decoded.username;
                imageurl = decoded.imageurl;
            }catch(err){
                console.error(err);
            }
            if(!users[username]){
                users[username] = socket.id;
                names[socket.id] = username;
                photos[socket.id] = imageurl;
                socIns[username]= socket;
                console.log('username saved');
                if(Object.keys(names).length>0){
                    emitActiveUsers('init',null,null,socket);
                    emitActiveUsers('add',username,imageurl,socket);
                }
            }
            else{
                io.to(socket.id).emit('error',{
                    error: '999'
                });
            }
        })

        socket.on('private image',async({to,fileData,fileType})=>{
            gatherChunks.push(fileData);
        })
        socket.on('public image',async({fileData, fileType})=>{
            gatherChunks.push(fileData);
        })
        socket.on('private video',async({to,fileData})=>{
            gatherChunks.push(fileData);
        })
        socket.on('public video',async({fileData})=>{
            gatherChunks.push(fileData);
        })
        socket.on('public file',async({fileData, fileName})=>{
            gatherChunks.push(fileData);
        })
        socket.on('private file',async({to, fileData, fileName})=>{
            gatherChunks.push(fileData);
        })

        socket.on('complete', async({to, fileType, fileName})=>{
            const date = new Date(Date.now()).toLocaleString();
            if(to==='public'){
                if(fileType.startsWith('image/')){
                    const docUrl=await uploadFile('image',fileName);
                    await storeChats(names[socket.id], 'public', docUrl, 'image', date);
                    io.emit('public image',{
                        from: names[socket.id],
                        time: Date.now(),
                        fileData: docUrl,
                        profile: photos[socket.id],
                        state: true
                    })
                }
                else if(fileType.startsWith('video/')){
                    const docUrl=await uploadFile('video',fileName);
                    await storeChats(names[socket.id], 'public', docUrl, 'video', date);
                    io.emit('public video',{
                        from: names[socket.id],
                        time: Date.now(),
                        fileData: docUrl,
                        profile: photos[socket.id],
                        state: true
                    })
                }
                else{
                    const docUrl=await uploadFile('document',fileName);
                    await storeChats(names[socket.id], 'public', docUrl, 'document', date);
                    io.emit('public file',{
                        from: names[socket.id],
                        time: Date.now(),
                        fileData: docUrl,
                        fileName: fileName,
                        profile: photos[socket.id],
                        state: true 
                    })
                }
            }
            else{
                const recipientSocketId = users[to];
                if(fileType.startsWith('image/')){
                    const docUrl=await uploadFile('image',fileName);
                    console.log('url.........',docUrl);
                    await storeChats(names[socket.id], names[recipientSocketId], docUrl, 'image', date);
                    if(recipientSocketId){
                        const sockets = [recipientSocketId, socket.id];
                        sockets.forEach((id)=>{
                            io.to(id).emit('private image', {
                                from: names[socket.id],
                                time: Date.now(),
                                fileData: docUrl,
                                profile: photos[socket.id],
                                state: true 
                            });
                        })
                    }
                    else{
                        io.to(socket.id).emit('error',{
                            error: `${to} is not available`
                        });
                    }
                }
                else if(fileType.startsWith('video/')){
                    const docUrl=await uploadFile('video',fileName);
                    await storeChats(names[socket.id], names[recipientSocketId], docUrl, 'video', date);
                    if(recipientSocketId){
                        const sockets = [recipientSocketId, socket.id];
                        sockets.forEach((id)=>{
                        io.to(id).emit('private video', {
                            from: names[socket.id],
                            time: Date.now(),
                            fileData: docUrl,
                            profile: photos[socket.id],
                            state: true 
                        });
                    })
                    }
                    else{
                        io.to(socket.id).emit('error',{
                            error: `${to} is not available`
                        });
                    }
                }
                else{
                    const docUrl=await uploadFile('document',fileName);
                    await storeChats(names[socket.id], names[recipientSocketId], docUrl, 'document', date);
                    if(recipientSocketId){
                        const sockets = [recipientSocketId, socket.id];
                        sockets.forEach((id)=>{
                        io.to(id).emit('private file', {
                            from: names[socket.id],
                            time: Date.now(),
                            fileData: docUrl,
                            fileName: fileName,
                            profile: photos[socket.id],
                            state: true 
                        });
                    })
                    }
                    else{
                        io.to(socket.id).emit('error',{
                            error: `${to} is not available`
                        });
                    }
                }
            }
        })
        
        socket.on('private message',async({to,message,date})=>{
            const recipientSocketId = users[to];
            if(recipientSocketId){
                await storeChats(names[socket.id], names[recipientSocketId], message, 'text', date);
                io.to(recipientSocketId).emit('private message',{
                    from: names[socket.id],
                    time: Date.now(),
                    message,
                    profile: photos[socket.id] 
                });
            }
            else{
                io.to(socket.id).emit('error',{
                    error: `${to} is not available`
                });
            }
        });
    
        socket.on('public message', async(message, date)=>{
            await storeChats(names[socket.id], 'public', message, 'text', date);
            socket.broadcast.emit('public message',{
                from: names[socket.id],
                time: Date.now(),
                message,
                profile: photos[socket.id] 
            })
        })
        //room
        socket.on('create-room',({room})=>{
            socket.join(room.name);
            console.log(room.name);
            io.to(room.name).emit('room-created',{notify: `Room ${room.name} created by ${room.admin}`});
        })

        socket.on('invite',({room, usernames})=>{
            for(let i=0;i< usernames.length;++i){
                if(socIns[usernames[i]])socIns[usernames[i]].join(room.name);
                else{
                    //store in database
                }
            }
            console.log(room.name);
            socket.broadcast.to(room.name).emit('invitation', {
                name: room.name, 
                notify: `${names[socket.id]} has added u in ${room.name}`
            })
            io.to(socket.id).emit('invited',{
                notify: `${usernames} are invited`
            });
        })

        socket.on('room message', ({room, message, date})=>{
            socket.broadcast.to(room.name).emit('room message',{
                from: names[socket.id],
                time: Date.now(),
                message,
                profile: photos[socket.id] 
            })
        })

        socket.on('room file',async({fileData})=>{
            gatherChunks.push(fileData);
        })

        socket.on('room file complete', async({room, fileType, fileName})=>{
            //const date = new Date(Date.now()).toLocaleString();
            if(fileType.startsWith('image/')){
                const docUrl=await uploadFile('image',fileName);
                //await storeChats(names[socket.id], 'public', docUrl, 'image', date);
                io.to(room.name).emit('room file',{
                    from: names[socket.id],
                    time: Date.now(),
                    fileData: docUrl,
                    profile: photos[socket.id]
                })
            }
            else if(fileType.startsWith('video/')){
                const docUrl=await uploadFile('video',fileName);
                // await storeChats(names[socket.id], 'public', docUrl, 'video', date);
                console.log(room.name,'video...',docUrl);
                io.to(room.name).emit('room file',{
                    from: names[socket.id],
                    time: Date.now(),
                    fileData: docUrl,
                    profile: photos[socket.id]
                })
            }
            else{
                const docUrl=await uploadFile('document',fileName);
                // await storeChats(names[socket.id], 'public', docUrl, 'document', date);
                io.to(room.name).emit('room file',{
                    from: names[socket.id],
                    time: Date.now(),
                    fileData: docUrl,
                    fileName: fileName,
                    profile: photos[socket.id]
                })
            }
        })

        //disconnect
        socket.on('disconnect',()=>{
            console.log('A user disconnected: ',socket.id);
            if(Object.keys(names).length>0)emitActiveUsers('remove',names[socket.id], photos[socket.id]);
            delete users[names[socket.id]];
            delete names[socket.id];
            delete photos[socket.id];
            console.log('total concurrent active users ',Object.keys(users).length);
        });
    });
}

module.exports = { socketHandler, names, photos, users};












