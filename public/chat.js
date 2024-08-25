(async function(){
  let socket;
  const {createWorker, setLogging} = FFmpeg;
  setLogging(true);
  let receivedChunks = [];
  const chunkSize = 512*1024;
  if(sessionStorage.getItem('login')==='true'){
    if (window.socket && window.socket.connected){
        window.socket.emit('show active-users');
        retrieveChat();
    } 
    else {
      new Promise(resolve=>{
        connectWebSocket();
        retrieveChat();
        resolve();
      })
    }
  }
  async function retrieveChat(){
    const reqData ={
      username: sessionStorage.getItem('username')
    }
    const data = await window.fetchData('/api/getchats',reqData);
    document.getElementById('messages').innerHTML='';
    data.chats.forEach((chat)=>{
      if(chat.sender===sessionStorage.getItem('username')){
        if(chat.type!=='text')embedDriveFilesTo(chat.date,chat.content);
        else addMessageTo(chat.content,chat.date);
      }
      else {
        if(chat.type!=='text')embedDriveFiles(chat.date,chat.sender,chat.content,chat.imageUrl);
        else addMessage(chat.sender,chat.content, chat.date, chat.imageUrl)
      }
    })
  }
  function addPicture(picture){
    const profileDiv = document.getElementById('nav-profile-container').querySelector('img');
    if(picture){
        profileDiv.src=picture;
    }
  }
  async function convertToMp4(file){
    try{
      const worker = createWorker({
        logger: ({ message }) => console.log(message),
    });
      await worker.load();
      const arrayBuffer = await file.arrayBuffer();
      await worker.write('input.mkv', new Uint8Array(arrayBuffer));
      await  worker.transcode('input.mkv', 'output.mp4');
      const { data } = await worker.read('output.mp4');
      await worker.terminate();
      return new Blob([data], { type: 'video/mp4' });
    }catch(err){
      console.error(err);
      if(worker){
        await worker.terminate();
      }
    }
  }
  //send chunks....
  function sendChunks(recipient, file, offset){
    if(!socket.connected){
      console.log('not connected.....');
      window.Pending(recipient, file, offset);
      return;
    }
    if(offset>=file.size){
      socket.emit('complete',{to: recipient,fileType: file.type, fileName: file.name});
      window.clearPending();
      return;
    }
    const fileSlice = file.slice(offset,offset+chunkSize);
    if(recipient==='public'){
      const reader = new FileReader();
      reader.onload = async()=>{
        if (file.type.startsWith('image/')){
            socket.emit('public image', {fileData: reader.result, fileType: file.type});
        } else if (file.type.startsWith('video/')) {
          socket.emit('public video', {fileData: reader.result});
        } else {
            socket.emit('public file', {fileData: reader.result,fileName: file.name});
            //socket.emit('public file', {fileData, fileName: file.name, fileType: file.type });
        }
        sendChunks(recipient,file,offset+chunkSize);
      }
      reader.readAsArrayBuffer(fileSlice);
    }else{
      const reader = new FileReader();
        reader.onload = () => {
            if(file.type.startsWith('image/')) {
              socket.emit('private image', { to: recipient, fileData: reader.result, fileType: file.type});
            } 
            else if (file.type.startsWith('video/')) {
            socket.emit('private video', { to: recipient, fileData: reader.result});
          }
          else{
            socket.emit('private file', { to: recipient, fileData: reader.result, fileName: file.name});
          }
          sendChunks(recipient,file,offset+chunkSize);
        };
      reader.readAsArrayBuffer(fileSlice);
    }
    document.getElementById('file-input').value = '';
  }
  //send message
  async function sendMessage(rec=null, msg=null){
    let recipient = document.getElementById('recipientInput').value;
    let message = document.getElementById('messageInput').value;
    if(rec && msg){
      recipient = rec;
      message = msg;
    }
    if(recipient.trim() && message.trim() && recipient==='public'){
      const date = new Date(Date.now()).toLocaleString();
      addMessageTo(message, date) ;
      if(!socket.connected){
        console.log('not connected.....');
        window.Pending(recipient, message, -1);
        document.getElementById('messageInput').value = '';
        return;
      }
      socket.emit('public message', message, date);
    }
    else if (recipient.trim() && message.trim()) {
      const date = new Date(Date.now()).toLocaleString();
      addMessageTo(message, date) ;
      if(!socket.connected){
        console.log('not connected.....');
        window.Pending(recipient, message, -1);
        document.getElementById('messageInput').value = '';
        return;
      }
      socket.emit('private message', { to: recipient, message , date});
    }
    document.getElementById('messageInput').value = '';
    const fileinput = document.getElementById('file-input');
    let file = fileinput.files[0];
    if(file && recipient.trim()) {
      document.getElementById('custom-file-upload').style.backgroundColor = '#007bff';
      offset=0;
      if(file.type.startsWith('video/') && file.type!=='video/mp4'){
        file = await convertToMp4(file);
      }
      const reader = new FileReader();
      reader.onload = ()=>{
        const arrayBuffer = reader.result;
        const blobUrl = URL.createObjectURL(new Blob([arrayBuffer], { type: file.type }));
        if (file.type.startsWith('image/')) {
          addImageTo(new Date(Date.now()).toLocaleString(), blobUrl);
        } else if (file.type.startsWith('video/')) {
          addVideoTo(new Date(Date.now()).toLocaleString(), blobUrl);
        } else {
          addFileTo(new Date(Date.now()).toLocaleString(), blobUrl, file.name);
        }
      }
      reader.readAsArrayBuffer(file);
      sendChunks(recipient, file,0);
    }
  }
  //connect
  function connectWebSocket(){
    window.socket = io();
    window.socket.on('connect', function(){
      addError("Connected");
      window.socket.emit('insert name',{
        username: sessionStorage.getItem('username'),
        imageurl: sessionStorage.getItem('imageurl')
      })
      setTimeout(()=>{
      const pending = window.pending;
      if(pending.status && pending.offset>=0){
        console.log(pending.status);
        sendChunks(pending.recipient,pending.content,pending.offset);
      }
      else if(pending.status){
        sendMessage(pending.recipient,pending.content);
      }
      },5000)
    })
    addPicture(sessionStorage.getItem('imageurl'));
  }

if(window.socket){
  socket = window.socket;
  function closeAllSockets(){
    socket.off('disconnect');
    socket.off('private message');
    socket.off('public message');
    socket.off('private image');
    socket.off('public image');
    socket.off('private video');
    socket.off('public video');
    socket.off('private file');
    socket.off('public file');
    socket.off('error');
    socket.off('init activeUsers');
    socket.off('activeUsers');
    console.log('All sockets are closing.....');
  }
  //closing all sockets to prevent from creating redundant listeners
  closeAllSockets();
  //reconnect....
  socket.on('disconnect', function(){
      addError("Disconnected! Attempting to reconnect...");
  })
  //send message
  const sendButton = document.getElementById('sendButton');
  sendButton.addEventListener('click', sendMessage);
  window.eventListeners.push({element: sendButton, event: 'click', handler: sendMessage});
  //message
  socket.on('private message', ({ from, time, message, profile }) => {
    const date = new Date(time).toLocaleString();
    addMessage(from, message, date, profile) ;
  });

  socket.on('public message', ({ from, time, message, profile  }) => {
    const date = new Date(time).toLocaleString();
    addMessage(from, message, date, profile) ;
  });

  //image
  socket.on('private image',({from,time,fileData, profile, state })=>{
    receivedChunks.push(fileData);
    if(state){
      //console.log('sent success.........');
      const date = new Date(time).toLocaleString();
      const blob = new Blob(receivedChunks);
      const url = URL.createObjectURL(blob);
      addImage(date,from,url,profile);
      receivedChunks=[];
    }
  })

  socket.on('public image',({from,time,fileData, profile, state })=>{
    receivedChunks.push(fileData);
    if(state){
      //console.log('sent success.........');
      const date = new Date(time).toLocaleString();
      const blob = new Blob(receivedChunks);
      const url = URL.createObjectURL(blob);
      addImage(date,from,url,profile);
      receivedChunks=[];
    }
  })

  //video
  socket.on('private video',({from,time,fileData, profile, state})=>{
    receivedChunks.push(fileData);
    if(state){
      //console.log('sent success.........');
      const date = new Date(time).toLocaleString();
      const blob = new Blob(receivedChunks);
      const url = URL.createObjectURL(blob);
      addVideo(date, from,url,profile);
      receivedChunks=[];
    }
  })

  socket.on('public video',({from,time,fileData, profile, state })=>{
    receivedChunks.push(fileData);
    if(state){
      //console.log('sent success.........');
      const date = new Date(time).toLocaleString();
      const blob = new Blob(receivedChunks);
      const url = URL.createObjectURL(blob);
      addVideo(date, from,url,profile);
      receivedChunks=[];
    }
  })

  //file
  socket.on('private file',({from,time,fileData,fileName, profile, state })=>{
    receivedChunks.push(fileData);
    if(state){
      //console.log('sent success.........');
      const date = new Date(time).toLocaleString();
      const blob = new Blob(receivedChunks);
      const url = URL.createObjectURL(blob);
      addFile(date, from,url,fileName,profile);
      receivedChunks=[];
    }
  })
  socket.on('public file',({from,time,fileData,fileName, profile, state })=>{
    receivedChunks.push(fileData);
    if(state){
      //console.log('sent success.........');
      const date = new Date(time).toLocaleString();
      const blob = new Blob(receivedChunks);
      const url = URL.createObjectURL(blob);
      addFile(date, from,url,fileName,profile);
      receivedChunks=[];
    }
  })

//rest
  socket.on('error', ({error}) => {
    console.log('hell');
    addError(`${error}`) ;
  });

  function updateStyles() {
    if (window.innerWidth < 1000) {
      const userDivs = document.getElementById('active').querySelectorAll('div');
      userDivs.forEach((userDiv)=>{
        userDiv.style.width = '70px';
        userDiv.style.margin = '5px';
      })
    }
    else{
      const userDivs = document.getElementById('active').querySelectorAll('div');
      userDivs.forEach((userDiv)=>{
        userDiv.style.margin ='0';
        userDiv.style.marginTop ='5px';
        userDiv.style.width = '80%';
      })
    }
}

  function BuildActiveDiv(activeBar, name, profile_src){
    const userDiv = document.createElement('div');
    const userNameDiv = document.createElement('h5');
    const profileDiv = document.createElement('img');

    userDiv.style.height = '78px';
    userDiv.style.color = '#ccc';
    userDiv.style.display = 'flex';
    userDiv.style.flexDirection = 'column';
    userDiv.style.alignItems = 'center';
    userDiv.style.justifyContent = 'space-between';
    userDiv.style.border = '1px solid black'
    userDiv.style.borderRadius = '10px';
    userDiv.style.padding = '2.5px 0';
    userDiv.style.cursor = 'pointer'; 
    if(name!=='public') userDiv.style.backgroundColor = 'black';
    else userDiv.style.backgroundColor = 'crimson';

    profileDiv.src=profile_src;
    profileDiv.style.width = '60px';
    profileDiv.style.height = '60px';
    profileDiv.style.borderRadius = '50%';
    profileDiv.style.border = '2px solid #ccc';

    function Over(){userDiv.style.scale = 0.8;}
    function Out(){userDiv.style.scale = 1;}
    function Click(){
      document.getElementById('recipientInput').value= name;
      const unselectDivs = document.getElementById('active').querySelectorAll('div');
      unselectDivs.forEach((unselectDiv)=>{
        const name = unselectDiv.querySelector('h5').textContent;
        if(name!=='public')unselectDiv.style.backgroundColor = 'black';
        else unselectDiv.style.backgroundColor = 'crimson';
      })
      userDiv.style.backgroundColor = 'cadetblue';
    }
    userDiv.addEventListener('mouseover', Over);
    userDiv.addEventListener('mouseout', Out);
    userDiv.addEventListener('click', Click);

    window.eventListeners.push({element: userDiv, event: 'mouseover', handler: Over});
    window.eventListeners.push({element: userDiv, event: 'mouseout', handler: Out});
    window.eventListeners.push({element: userDiv, event: 'click', handler: Click});

    userDiv.appendChild(profileDiv);

    userNameDiv.style.padding = 0;
    userNameDiv.style.margin = 0;

    if(sessionStorage.getItem('username')===name)userNameDiv.textContent = `${name}(me)`;
    else userNameDiv.textContent = name;
    userDiv.appendChild(userNameDiv);
    activeBar.appendChild(userDiv);
   // console.log('added...');
  }

  function RemoveActiveDiv(activeBar, name){
    const userDivs = document.getElementById('active').querySelectorAll('div');
    for(let i=0;i<userDivs.length;++i){
      if(userDivs[i].querySelector('h5').textContent.trim()===name){
        activeBar.removeChild(userDivs[i]);
        //console.log('removed...');
        break;
      }
    }
  }

  socket.on('init activeUsers',({activeUsers, profile})=>{
    //console.log('init...');
      const activeBar = document.getElementById('active');
      const publicUrl='https://static.vecteezy.com/system/resources/thumbnails/001/760/457/small_2x/megaphone-loudspeaker-making-announcement-vector.jpg';
      activeBar.innerHTML='';
      BuildActiveDiv(activeBar,sessionStorage.getItem('username'), sessionStorage.getItem('imageurl'));
      BuildActiveDiv(activeBar,'public', publicUrl);
      activeUsers.forEach((name, index) => {
          if(name!=='public' && name!==sessionStorage.getItem('username')){
            BuildActiveDiv(activeBar,name, profile[index]);
          }
      });
      //console.log('init...');
    updateStyles();
    window.addEventListener('resize', updateStyles);
    window.eventListeners.push({element: window, event: 'resize', handler: updateStyles});
  });

  socket.on('activeUsers',({operation, name, photo})=>{
    const activeBar = document.getElementById('active');
      if(operation==='add'){
        BuildActiveDiv(activeBar,name, photo);
      }
      else if(operation==='remove'){
        RemoveActiveDiv(activeBar, name);
      }
    updateStyles();
  });


function addImageTo(time, imageData){
    const messagesDiv = document.getElementById('messages');
    const messageElement = document.createElement('div');
    messageElement.style.display = 'flex';
    messageElement.style.flexDirection = 'column';
    messageElement.style.alignItems = 'flex-end';
    messageElement.style.justifyContent = 'center';
    messageElement.style.padding = '8px';
    messageElement.style.textAlign = 'left';
    messageElement.style.width = '98%';
    messageElement.style.height = 'auto';
    messageElement.style.color = 'black';

    messageElement.innerHTML = 
    `<h5 style="width:90%;text-align: center;margin: 0;padding: 0;color: #ccc">${time}</h5>
    <img src="${imageData}" alt="Image" style="max-width: 215px; max-width: 215px;">`;
    messagesDiv.appendChild(messageElement);
    messageElement.querySelector('img').style.cursor = 'pointer';
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}


function addImage(time,from, imageData,profile){
    const messagesDiv = document.getElementById('messages');
    const messageElement = document.createElement('div');
    const profileDiv = document.createElement('img');
    const messageContainer = document.createElement('div');

    messageElement.innerHTML = 
    `<h5 style="width:100%;text-align: center;margin: 0;padding: 0;color: #ccc">${time}</h5>
    <h5 style="color: #ccc;margin: 0 10px;padding: 0;">${from}</h5>
    <img src="${imageData}" alt="Image" style="max-width: 215px; max-height: 215px;margin: 0;padding: 0;">`;
    messageElement.style.width= '100%';
    messageElement.style.height= 'auto';
    messageElement.style.display = 'flex';
    messageElement.style.flexDirection = 'column';
    messageElement.querySelector('img').style.cursor = 'pointer';
    messageContainer.style.alignItems = 'flex-start';
    messageContainer.style.justifyContent = 'center';
    

    profileDiv.src=profile;
    profileDiv.style.width = '70px';
    profileDiv.style.height = '70px';
    profileDiv.style.borderRadius = '50%';
    profileDiv.style.border = '1px soild #ccc';
    profileDiv.style.padding = '10px';

    messageContainer.style.width = '98%';
    messageContainer.style.height = 'auto';
    messageContainer.style.padding = '8px';
    messageContainer.appendChild(profileDiv);
    messageContainer.appendChild(messageElement);
    messageContainer.style.display = 'flex';
    messageContainer.style.justifyContent = 'flex-start';
    messageContainer.style.alignItems = 'flex-end';
    
    messagesDiv.appendChild(messageContainer);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}


function addVideoTo(time, videoData) {
    const messagesDiv = document.getElementById('messages');
    const messageElement = document.createElement('div');

    messageElement.style.display = 'flex';
    messageElement.style.flexDirection = 'column';
    messageElement.style.alignItems = 'flex-end';
    messageElement.style.justifyContent = 'center';
    messageElement.style.padding = '8px';
    messageElement.style.width = '98%';
    messageElement.style.height = 'auto';

    messageElement.innerHTML = 
    `<h5 style="width:90%;text-align: center;color: #ccc">${time}</h5>
    <video controls style="max-width: 230px; max-height: 230px;margin: 0;padding: 0;">
    <source src="${videoData}" type="video/mp4">
    <source src="${videoData}" type="video/webm">
    <source src="${videoData}" type="video/ogg">
    Your browser does not support the video tag.
    </video>`;
    messagesDiv.appendChild(messageElement);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

function addVideo(time,to, videoData, profile) {
    const messagesDiv = document.getElementById('messages');
    const messageElement = document.createElement('div');
    const profileDiv = document.createElement('img');
    const messageContainer = document.createElement('div');
    messageElement.innerHTML =
     `<h5 style="width:100%;text-align: center;margin: 0;padding: 0;color: #ccc">${time}</h5>
    <h5 style="color: #ccc;margin: 0 10px;padding: 0;">${to}</h5>
    <video controls style="max-width: 215px; max-height: 215px;">
      <source src="${videoData}" type="video/mp4">
      <source src="${videoData}" type="video/webm">
      <source src="${videoData}" type="video/ogg">
      Your browser does not support the video tag.
    </video>`;
    messageElement.style.width= '100%';
    messageElement.style.height= 'auto';
    messageElement.style.display = 'flex';
    messageElement.style.flexDirection = 'column';
    messageContainer.style.alignItems = 'flex-start';
    messageContainer.style.justifyContent = 'center';

    profileDiv.src=profile;
    profileDiv.style.width = '70px';
    profileDiv.style.height = '70px';
    profileDiv.style.borderRadius = '50%';
    profileDiv.style.border = '1px soild #ccc';
    profileDiv.style.padding = '10px';

    messageContainer.style.width = '98%';
    messageContainer.style.height = 'auto';
    messageContainer.style.padding = '8px';
    messageContainer.style.display = 'flex';
    messageContainer.style.justifyContent = 'flex-start';
    messageContainer.style.alignItems = 'flex-end';
    messageContainer.appendChild(profileDiv);
    messageContainer.appendChild(messageElement);
                      
    messagesDiv.appendChild(messageContainer);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}


function addFile(time, to, fileData, fileName, profile) {
    const messagesDiv = document.getElementById('messages');
    const messageElement = document.createElement('div');
    const profileDiv = document.createElement('img');
    const messageContainer = document.createElement('div');
    const finalContainer = document.createElement('div');
    const timeDiv = document.createElement('h5');
    const nameDiv = document.createElement('h5');
    const time_nameDiv = document.createElement('div');

    messageElement.innerHTML = `<a href="${fileData}" download="${fileName}">${fileName}</a>`;
    messageElement.className="message-receive";

    timeDiv.textContent=time;
    timeDiv.style.color = '#ccc';
    nameDiv.textContent=to;
    nameDiv.style.color = '#ccc';

    time_nameDiv.className = 'time-name-container';
    time_nameDiv.appendChild(nameDiv);
    time_nameDiv.appendChild(timeDiv);

    profileDiv.src=profile;
    profileDiv.className = 'receiver-profile-container';

    messageContainer.appendChild(profileDiv);
    messageContainer.appendChild(messageElement);
    messageContainer.className = 'message-receive-container';

    finalContainer.appendChild(time_nameDiv);
    finalContainer.appendChild(messageContainer);
    finalContainer.className ='final-container';

    messagesDiv.appendChild(finalContainer);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

function addFileTo(time, fileData, fileName) {
    const messagesDiv = document.getElementById('messages');
    const messageElement = document.createElement('div');
    const timeDiv = document.createElement('h5');
    const messageContainer = document.createElement('div');
    const finalContainer = document.createElement('div');

    timeDiv.textContent=time;
    timeDiv.className = 'time-container';
    messageElement.innerHTML = `<a href="${fileData}" download="${fileName}">${fileName}</a>`;
    messageElement.className="message-send";
    
    messageContainer.className = 'message-send-container';
    messageContainer.appendChild(messageElement);

    finalContainer.className ='send-final-container';
    finalContainer.appendChild(timeDiv);
    finalContainer.appendChild(messageContainer);
    

    messagesDiv.appendChild(finalContainer);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

}

function addMessage(from, message, time ,profile) {
  const messagesDiv = document.getElementById('messages');
  const messageElement = document.createElement('div');
  const profileDiv = document.createElement('img');
  const timeDiv = document.createElement('h5');
  const nameDiv = document.createElement('h5');
  const time_nameDiv = document.createElement('div');
  const messageContainer = document.createElement('div');
  const finalContainer = document.createElement('div');

  messageElement.textContent = message;
  messageElement.className="message-receive";

  timeDiv.textContent=time;
  timeDiv.style.color = '#ccc';
  nameDiv.textContent=from;
  nameDiv.style.color = '#ccc';

  time_nameDiv.appendChild(nameDiv);
  time_nameDiv.appendChild(timeDiv);
  time_nameDiv.className = 'time-name-container';

  
  profileDiv.src=profile;
  profileDiv.className = 'receiver-profile-container';

  messageContainer.appendChild(profileDiv);
  messageContainer.appendChild(messageElement);
  messageContainer.className = 'message-receive-container';

  finalContainer.className ='final-container';
  finalContainer.appendChild(time_nameDiv);
  finalContainer.appendChild(messageContainer);

  messagesDiv.appendChild(finalContainer);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;

}

function addMessageTo(message, time) {
  const messagesDiv = document.getElementById('messages');
  const messageElement = document.createElement('div');
  const timeDiv = document.createElement('h5');
  const messageContainer = document.createElement('div');
  const finalContainer = document.createElement('div');

  timeDiv.textContent=time;
  timeDiv.className = 'time-container';
  messageElement.textContent = message;
  messageElement.className="message-send";

  messageContainer.className = 'message-send-container';
  messageContainer.appendChild(messageElement);

  finalContainer.className ='send-final-container';
  finalContainer.appendChild(timeDiv);
  finalContainer.appendChild(messageContainer);

  messagesDiv.appendChild(finalContainer);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
}


  function addError(message) {
    const messagesDiv = document.getElementById('messages');
    const messageElement = document.createElement('div');
    messageElement.textContent = message;
    if(message!=='Connected')messageElement.style.color = 'crimson';
    else messageElement.style.color = 'green';
    messageElement.style.backgroundColor = 'lightblue';
    messageElement.style.borderRadius = '10px';
    messageElement.style.padding = '5px';
    messageElement.style.margin = '10px';
    messageElement.style.textAlign = 'center';
    messagesDiv.appendChild(messageElement);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;

    setTimeout(()=>{
      messageElement.style.opacity=0;
      messageElement.style.transition = 'opacity 2s ease-out'
      setTimeout(()=>{
        messageElement.remove();
      },2000)
    },5000)
  }
  function Load(){ document.getElementById('custom-file-upload').style.backgroundColor = 'crimson'; }
  const fileInput = document.getElementById('file-input');
  fileInput.addEventListener('change', Load);
  window.eventListeners.push({element: fileInput, event: 'change', handler: Load});

  function embedDriveFiles(time, to, file_id, profile){
    const messageElement = document.createElement('div');
    const messagesDiv = document.getElementById('messages');
    const profileDiv = document.createElement('img');
    const messageContainer = document.createElement('div');
    messageElement.innerHTML =
     `<h5 style="width:100%;text-align: center;margin: 0;padding: 0;color: #ccc">${time}</h5>
    <h5 style="color: #ccc;margin: 0 10px;padding: 0;">${to}</h5>
    <iframe src = https://drive.google.com/file/d/${file_id}/preview style="max-width: 215px; max-height: 215px; 
    border: none;
    overflow: hidden;
    transform: scale(1);
    transform-origin: 0 0;"
    />`;
    messageElement.style.width= '100%';
    messageElement.style.height= 'auto';
    messageElement.style.display = 'flex';
    messageElement.style.flexDirection = 'column';
    messageContainer.style.alignItems = 'flex-start';
    messageContainer.style.justifyContent = 'center';

    profileDiv.src=profile;
    profileDiv.style.width = '70px';
    profileDiv.style.height = '70px';
    profileDiv.style.borderRadius = '50%';
    profileDiv.style.border = '1px soild #ccc';
    profileDiv.style.padding = '10px';

    messageContainer.style.width = '98%';
    messageContainer.style.height = 'auto';
    messageContainer.style.padding = '8px';
    messageContainer.style.display = 'flex';
    messageContainer.style.justifyContent = 'flex-start';
    messageContainer.style.alignItems = 'flex-end';
    messageContainer.appendChild(profileDiv);
    messageContainer.appendChild(messageElement);
                      
    messagesDiv.appendChild(messageContainer);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;

  }

  function embedDriveFilesTo(time, file_id) {
    const messagesDiv = document.getElementById('messages');
    const messageElement = document.createElement('div');

    messageElement.style.display = 'flex';
    messageElement.style.flexDirection = 'column';
    messageElement.style.alignItems = 'flex-end';
    messageElement.style.justifyContent = 'center';
    messageElement.style.padding = '8px';
    messageElement.style.width = '98%';
    messageElement.style.height = 'auto';

    messageElement.innerHTML = 
    `<h5 style="width:90%;text-align: center;color: #ccc">${time}</h5>
    <iframe src = https://drive.google.com/file/d/${file_id}/preview style="max-width: 215px; max-height: 215px; 
    border: none;
    overflow: hidden;
    transform: scale(1);
    transform-origin: 0 0;"
    />`;
    messagesDiv.appendChild(messageElement);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

const chatHeader = document.getElementById('chat-header');
function Hide(){
  chatHeader.style.display='none';
}
chatHeader.addEventListener('click',Hide);
chatHeader.style.cursor='pointer';
eventListeners.push({element: chatHeader, event: 'click', handler: Hide});
})();