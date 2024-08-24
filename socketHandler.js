const {uploadFile, gatherChunks} = require('./Gdrive');
const { storeChats } = require('./storeChats');

const users = {};
const names = {};
const photos ={};

function socketHandler(io){
    const {usernames} = require('./controllers/controller');
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
        socket.on('insert name',async({username,imageurl})=>{
            if(!usernames.includes(username)) usernames.push(username);
            users[username] = socket.id;
            names[socket.id] = username;
            photos[socket.id] = imageurl
            console.log('username saved');
            if(Object.keys(names).length>0){
                emitActiveUsers('init',null,null,socket);
                emitActiveUsers('add',username,imageurl,socket);
            }
        })
        socket.on('private image',async({to,fileData,fileType})=>{
            const recipientSocketId = users[to];
            if(recipientSocketId){
                gatherChunks.push(fileData);
                io.to(recipientSocketId).emit('private image', {
                    from: names[socket.id],
                    time: Date.now(),
                    fileData: fileData,
                    profile: photos[socket.id],
                    state: false 
                });

            }
            else{
                gatherChunks.push(fileData);
            }
        })
    
        socket.on('public image',async({fileData, fileType})=>{
            // console.log('image sending...');
            gatherChunks.push(fileData);
            socket.broadcast.emit('public image',{
                from: names[socket.id],
                time: Date.now(),
                fileData: fileData,
                profile: photos[socket.id],
                state: false 
            })
        })
    
        socket.on('private video',async({to,fileData})=>{
            //console.log('video sending...');
            const recipientSocketId = users[to];
            if(recipientSocketId){
                gatherChunks.push(fileData);
                io.to(recipientSocketId).emit('private video', {
                    from: names[socket.id],
                    time: Date.now(),
                    fileData: fileData,
                    profile: photos[socket.id],
                    state: false 
                });
            }
            else{
                gatherChunks.push(fileData);
            }
        })
    
        socket.on('public video',async({fileData})=>{
            //console.log('video sending...');
            gatherChunks.push(fileData);
            socket.broadcast.emit('public video',{
                from: names[socket.id],
                time: Date.now(),
                fileData: fileData,
                profile: photos[socket.id],
                state: false 
            })
        })
    
        
        socket.on('public file',async({fileData, fileName})=>{
            gatherChunks.push(fileData);
            socket.broadcast.emit('public file',{
                from: names[socket.id],
                time: Date.now(),
                fileData: fileData,
                fileName: fileName,
                profile: photos[socket.id],
                state: false  
            })
        })
        socket.on('private file',async({to, fileData, fileName})=>{
            //console.log('file sending...');
            const recipientSocketId = users[to];
            if(recipientSocketId){
                gatherChunks.push(fileData);
                io.to(recipientSocketId).emit('private file', {
                    from: names[socket.id],
                    time: Date.now(),
                    fileData: fileData,
                    fileName: fileName,
                    profile: photos[socket.id],
                    state: false  
                });
            }
            else{
                gatherChunks.push(fileData);
            }
        })

        socket.on('complete', async({to, fileType, fileName})=>{
            const date = new Date(Date.now()).toLocaleString();
            if(to==='public'){
                if(fileType.startsWith('image/')){
                    const docUrl=await uploadFile('image',fileName, names[socket.id]);
                    console.log(docUrl);
                    await storeChats(names[socket.id], 'public', docUrl, date);
                    socket.broadcast.emit('public image',{
                        from: names[socket.id],
                        time: Date.now(),
                        fileData: null,
                        profile: photos[socket.id],
                        state: true
                    })
                }
                else if(fileType.startsWith('video/')){
                    const docUrl=await uploadFile('video',fileName, names[socket.id]);
                    await storeChats(names[socket.id], 'public', docUrl, date);
                    socket.broadcast.emit('public video',{
                        from: names[socket.id],
                        time: Date.now(),
                        fileData: null,
                        profile: photos[socket.id],
                        state: true
                    })
                }
                else{
                    const docUrl=await uploadFile('document',fileName, names[socket.id]);
                    await storeChats(names[socket.id], 'public', docUrl, date);
                    socket.broadcast.emit('public file',{
                        from: names[socket.id],
                        time: Date.now(),
                        fileData: null,
                        fileName: fileName,
                        profile: photos[socket.id],
                        state: true 
                    })
                }
            }
            else{
                const recipientSocketId = users[to];
                if(fileType.startsWith('image/')){
                    const docUrl=await uploadFile('image',fileName, names[socket.id]);
                    console.log('url.........',docUrl);
                    await storeChats(names[socket.id], names[recipientSocketId], docUrl, date);
                    if(recipientSocketId){
                        io.to(recipientSocketId).emit('private image', {
                            from: names[socket.id],
                            time: Date.now(),
                            fileData: null,
                            profile: photos[socket.id],
                            state: true 
                        });
                    }
                    else{
                        io.to(socket.id).emit('error',{
                            error: `${to} is not available`
                        });
                    }
                }
                else if(fileType.startsWith('video/')){
                    const docUrl=await uploadFile('video',fileName, names[socket.id]);
                    await storeChats(names[socket.id], names[recipientSocketId], docUrl, date);
                    if(recipientSocketId){
                        io.to(recipientSocketId).emit('private video', {
                            from: names[socket.id],
                            time: Date.now(),
                            fileData: null,
                            profile: photos[socket.id],
                            state: true 
                        });
                    }
                    else{
                        io.to(socket.id).emit('error',{
                            error: `${to} is not available`
                        });
                    }
                }
                else{
                    const docUrl=await uploadFile('document',fileName, names[socket.id]);
                    await storeChats(names[socket.id], names[recipientSocketId], docUrl, date);
                    if(recipientSocketId){
                        io.to(recipientSocketId).emit('private file', {
                            from: names[socket.id],
                            time: Date.now(),
                            fileData: null,
                            fileName: fileName,
                            profile: photos[socket.id],
                            state: true 
                        });
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
                await storeChats(names[socket.id], names[recipientSocketId], message, date);
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
            await storeChats(names[socket.id], 'public', message, date);
            socket.broadcast.emit('public message',{
                from: names[socket.id],
                time: Date.now(),
                message,
                profile: photos[socket.id] 
            })
        })
        socket.on('disconnect',()=>{
            console.log('A user disconnected: ',socket.id);
            const index = usernames.indexOf(names[socket.id]);
            if(index!==-1){
                usernames.splice(index,1);
                console.log('total concurrent active users ',usernames.length);
            }
            if(Object.keys(names).length>0)emitActiveUsers('remove',names[socket.id], photos[socket.id]);
            delete users[names[socket.id]];
            delete names[socket.id];
            delete photos[socket.id];
        });
    });
}

module.exports = { socketHandler, names, photos, users};












