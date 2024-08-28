(async function(){
  let socket;
  const chunkSize = 512*1024;

  // 1)retrieveChat
  (function(_0x2de039,_0x29f5c0){const _0x49f946=_0x52b0,_0x35d642=_0x2de039();while(!![]){try{const _0x457feb=-parseInt(_0x49f946(0x15a))/0x1*(-parseInt(_0x49f946(0x159))/0x2)+parseInt(_0x49f946(0x148))/0x3+parseInt(_0x49f946(0x153))/0x4+-parseInt(_0x49f946(0x155))/0x5+-parseInt(_0x49f946(0x150))/0x6*(-parseInt(_0x49f946(0x154))/0x7)+parseInt(_0x49f946(0x158))/0x8+-parseInt(_0x49f946(0x152))/0x9;if(_0x457feb===_0x29f5c0)break;else _0x35d642['push'](_0x35d642['shift']());}catch(_0x4bce91){_0x35d642['push'](_0x35d642['shift']());}}}(_0x4161,0xeed4a));async function retrieveChat(){const _0x49cd48=_0x52b0,_0x1f40e0={'username':window[_0x49cd48(0x14d)][_0x49cd48(0x156)]},_0x63cb2c=await window[_0x49cd48(0x149)](_0x49cd48(0x14f),_0x1f40e0),_0x7cb28b=document[_0x49cd48(0x146)](_0x49cd48(0x157));if(!_0x7cb28b)return;if(_0x7cb28b)_0x7cb28b[_0x49cd48(0x15c)]='';_0x63cb2c[_0x49cd48(0x14a)][_0x49cd48(0x145)](_0x152023=>{const _0x143504=_0x49cd48;if(_0x152023[_0x143504(0x151)]===window['userInfo'][_0x143504(0x156)]){if(_0x152023[_0x143504(0x147)]!=='text')embedDriveFilesTo(_0x152023[_0x143504(0x14c)],_0x152023['content']);else addMessageTo(_0x152023[_0x143504(0x14b)],_0x152023[_0x143504(0x14c)]);}else{if(_0x152023[_0x143504(0x147)]!==_0x143504(0x14e))embedDriveFiles(_0x152023[_0x143504(0x14c)],_0x152023[_0x143504(0x151)],_0x152023[_0x143504(0x14b)],_0x152023[_0x143504(0x15b)]);else addMessage(_0x152023[_0x143504(0x151)],_0x152023[_0x143504(0x14b)],_0x152023[_0x143504(0x14c)],_0x152023[_0x143504(0x15b)]);}});}function _0x52b0(_0x370f21,_0x194c87){const _0x416101=_0x4161();return _0x52b0=function(_0x52b0b3,_0x30b3f4){_0x52b0b3=_0x52b0b3-0x145;let _0x4bd317=_0x416101[_0x52b0b3];return _0x4bd317;},_0x52b0(_0x370f21,_0x194c87);}function _0x4161(){const _0x39b1bd=['username','chat-content','10152296dmKvZs','72368mZcRfC','1nZnzXw','imageUrl','innerHTML','forEach','getElementById','type','521622bCoXMR','fetchData','chats','content','date','userInfo','text','/api/getchats','6582GVuhDO','sender','13404780FrLTSG','7639252FsdGRp','3031RXvyyB','6981195rOdLtm'];_0x4161=function(){return _0x39b1bd;};return _0x4161();}

  // 2)connectWebSocket
  function _0x1725(_0x2e048f,_0x124e24){const _0xcd510a=_0xcd51();return _0x1725=function(_0x1725ee,_0x15fe8f){_0x1725ee=_0x1725ee-0x13e;let _0xded32=_0xcd510a[_0x1725ee];return _0xded32;},_0x1725(_0x2e048f,_0x124e24);}(function(_0xab3bea,_0x513195){const _0x1e263f=_0x1725,_0x4f6402=_0xab3bea();while(!![]){try{const _0x35291a=-parseInt(_0x1e263f(0x150))/0x1+parseInt(_0x1e263f(0x14d))/0x2*(parseInt(_0x1e263f(0x13f))/0x3)+-parseInt(_0x1e263f(0x141))/0x4+parseInt(_0x1e263f(0x14f))/0x5*(parseInt(_0x1e263f(0x13e))/0x6)+parseInt(_0x1e263f(0x148))/0x7+parseInt(_0x1e263f(0x140))/0x8+-parseInt(_0x1e263f(0x14e))/0x9;if(_0x35291a===_0x513195)break;else _0x4f6402['push'](_0x4f6402['shift']());}catch(_0x1981e8){_0x4f6402['push'](_0x4f6402['shift']());}}}(_0xcd51,0x41395));function _0xcd51(){const _0x57e650=['offset','insert\x20name','get','connect','recipient','3017203kwVifZ','pending','token','content','status','212QurctQ','4935078pyiTqT','5LYfPIe','394669sxOcXk','1950762Whkvkb','7788dfyano','2918808ebyiKO','744060ECtCOb','socket'];_0xcd51=function(){return _0x57e650;};return _0xcd51();}async function connectWebSocket(){const _0x3737b8=_0x1725;window[_0x3737b8(0x142)]=io(),window['socket']['on'](_0x3737b8(0x146),function(){const _0x5d6248=_0x3737b8;window[_0x5d6248(0x142)]['emit'](_0x5d6248(0x144),{'jwtoken':Cookies[_0x5d6248(0x145)](_0x5d6248(0x14a))});}),addError('Connected'),setTimeout(()=>{const _0xcf74d0=_0x3737b8,_0x25b75a=window[_0xcf74d0(0x149)];if(_0x25b75a[_0xcf74d0(0x14c)]&&_0x25b75a['offset']>=0x0)sendChunks(_0x25b75a[_0xcf74d0(0x147)],_0x25b75a[_0xcf74d0(0x14b)],_0x25b75a[_0xcf74d0(0x143)]);else _0x25b75a['status']&&sendMessage(_0x25b75a[_0xcf74d0(0x147)],_0x25b75a[_0xcf74d0(0x14b)]);},0x1388);}

  function closeAllSockets(socket){
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
    //console.log('All sockets are closing...');
  }
  function addPicture(picture){
    const profileDiv = document.getElementById('nav-profile');
    if(picture){
        profileDiv.src=picture;
    }
  }
  async function getUserInfo(){
    const reqData = {
      token: Cookies.get('token')
    }
    const data = await window.fetchData('/api/userData',reqData);
    setUserInfo(data.userinfo.username, data.userinfo.imageurl);
    addPicture(data.userinfo.imageurl);
  }

  if(Cookies.get('token')){
    if (window.socket && window.socket.connected){
      new Promise(async(resolve)=>{
        await getUserInfo();
        await retrieveChat();
        window.socket.emit('show active-users');
        resolve();
      })
    } 
    else {
      new Promise(async(resolve)=>{
        await connectWebSocket();
        await getUserInfo();
        await retrieveChat();
        resolve();
      })
    }
  }
  //send chunks....
  function sendChunks(recipient, file, offset){
    if(!socket.connected){
      //console.log('not connected.....');
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
    let message = document.getElementById('message-input').value;
    if(rec && msg){
      recipient = rec;
      message = msg;
    }
    if(recipient.trim() && message.trim() && recipient==='public'){
      const date = new Date(Date.now()).toLocaleString();
      addMessageTo(message, date) ;
      if(!socket.connected){
        //console.log('not connected.....');
        window.Pending(recipient, message, -1);
        document.getElementById('message-input').value = '';
        return;
      }
      socket.emit('public message', message, date);
      document.getElementById('message-input').value = '';
    }
    else if (recipient.trim() && message.trim()) {
      const date = new Date(Date.now()).toLocaleString();
      addMessageTo(message, date) ;
      if(!socket.connected){
        //console.log('not connected.....');
        window.Pending(recipient, message, -1);
        document.getElementById('message-input').value = '';
        return;
      }
      socket.emit('private message', { to: recipient, message , date});
      document.getElementById('message-input').value = '';
    }
    const fileinput = document.getElementById('file-input');
    let file = fileinput.files[0];
    if(file && recipient.trim()) {
      document.getElementById('custom-file-upload').style.backgroundColor = '#007bff';
      offset=0;
      sendChunks(recipient, file,0);
    }
  }

if(window.socket){
  socket = window.socket;
  //closing all sockets to prevent from creating redundant listeners
  closeAllSockets(socket);
  //reconnect....
  socket.on('disconnect', function(){
      addError("Disconnected! Attempting to reconnect...");
  })
  //send message
  const sendButton = document.getElementById('send-button');
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
    if(state){
      const date = new Date(time).toLocaleString();
      if(from===window.userInfo.username)embedDriveFilesTo(date,fileData)
      else embedDriveFiles(date,from,fileData,profile)
    }
  })

  //video
  socket.on('private video',({from,time,fileData, profile, state})=>{
    if(state){
      const date = new Date(time).toLocaleString();
      if(from===window.userInfo.username)embedDriveFilesTo(date,fileData)
      else  embedDriveFiles(date,from,fileData,profile)
    }
  })


  //file
  socket.on('private file',({from,time,fileData,fileName, profile, state })=>{
    if(state){
      const date = new Date(time).toLocaleString();
      if(from===window.userInfo.username)embedDriveFilesTo(date,fileData)
      else embedDriveFiles(date,from,fileData,profile)
    }
  })

  // 3)public image
  socket.on('public image',({from,time,fileData, profile, state })=>{
    if(state){
      const date = new Date(time).toLocaleString();
      if(from===window.userInfo.username)embedDriveFilesTo(date,fileData)
      else embedDriveFiles(date,from,fileData,profile)
    }
  })

  // 4)public video
  socket.on('public video',({from,time,fileData, profile, state })=>{
    if(state){
      const date = new Date(time).toLocaleString();
      if(from===window.userInfo.username)embedDriveFilesTo(date,fileData)
      else embedDriveFiles(date,from,fileData,profile)
    }
  })

  // 5)public file
  socket.on('public file',({from,time,fileData,fileName, profile, state })=>{
    if(state){
      const date = new Date(time).toLocaleString();
      if(from===window.userInfo.username)embedDriveFilesTo(date,fileData)
      else embedDriveFiles(date,from,fileData,profile)
    }
  })

  // 6)init activeUsers
  socket.on('init activeUsers',({activeUsers, profile})=>{
    const activeBar = document.getElementById('active');
    const publicUrl='https://static.vecteezy.com/system/resources/thumbnails/001/760/457/small_2x/megaphone-loudspeaker-making-announcement-vector.jpg';
    activeBar.innerHTML='';
    BuildActiveDiv(activeBar, window.userInfo.username, window.userInfo.imageurl);
    BuildActiveDiv(activeBar,'public', publicUrl);
    activeUsers.forEach((name, index) => {
        if(name!=='public' && name!==window.userInfo.username){
          BuildActiveDiv(activeBar,name, profile[index]);
        }
    });
  updateStyles();
  window.addEventListener('resize', updateStyles);
  window.eventListeners.push({element: window, event: 'resize', handler: updateStyles});
});

//rest
  socket.on('error', ({error}) => {
    if(error==='999') {
      loadPage('login.html','login');
    }
    else addError(`${error}`) ;
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


// 7)BuildActiveDiv
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
    userDiv.style.overflowX = 'auto'; 
    userDiv.style.overflowY = 'hidden';
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
    userNameDiv.style.margin = 'auto';
    userNameDiv.style.fontSize = 'small';
    userNameDiv.style.fontWeight = 'bold';
    if(window.userInfo.username===name)userNameDiv.textContent = `${name}(me)`;
    else userNameDiv.textContent = name;
    userDiv.appendChild(userNameDiv);
    activeBar.appendChild(userDiv);
  }


  
  function RemoveActiveDiv(activeBar, name){
    const userDivs = document.getElementById('active').querySelectorAll('div');
    for(let i=0;i<userDivs.length;++i){
      if(userDivs[i].querySelector('h5').textContent.trim()===name){
        activeBar.removeChild(userDivs[i]);
        break;
      }
    }
  }


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
}

function addMessage(from, message, time ,profile) {
  const messagesDiv = document.getElementById('chat-content');
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
  timeDiv.className = 'time-container';
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
  const messagesDiv = document.getElementById('chat-content');
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
    console.log(message);
    const messagesDiv = document.getElementById('chat-content');
    if(!messagesDiv) return;
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
      },5000)
    },5000)
  }
  function Load(){ document.getElementById('custom-file-upload').style.backgroundColor = 'crimson'; }
  const fileInput = document.getElementById('file-input');
  fileInput.addEventListener('change', Load);
  window.eventListeners.push({element: fileInput, event: 'change', handler: Load});

  function embedDriveFiles(time, to, file_id, profile){
    const messageElement = document.createElement('div');
    const messagesDiv = document.getElementById('chat-content');
    const profileDiv = document.createElement('img');
    const messageContainer = document.createElement('div');
    messageElement.innerHTML =
     `<h5 style="width:100%;text-align: center;margin: 0;padding: 0;color: #ccc;font-size:small;">${time}</h5>
    <h5 style="color: #ccc;margin: 0 10px;padding: 0;">${to}</h5>
    <iframe src = https://drive.google.com/file/d/${file_id}/preview 
    style="max-width: 300px; 
    height: 215px; 
    border: none;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;"
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
      console.log('hellou');
    const messagesDiv = document.getElementById('chat-content');
    const messageElement = document.createElement('div');

    messageElement.style.display = 'flex';
    messageElement.style.flexDirection = 'column';
    messageElement.style.alignItems = 'flex-end';
    messageElement.style.justifyContent = 'center';
    messageElement.style.padding = '8px';
    messageElement.style.width = '98%';
    messageElement.style.height = 'auto';

    messageElement.innerHTML = 
    `<h5 style="width:90%;text-align: center;color: #ccc;font-size:small;">${time}</h5>
    <iframe src = https://drive.google.com/file/d/${file_id}/preview 
    style="max-width: 300px; 
    height: 215px; 
    border: none;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden"
    />`;
    messagesDiv.appendChild(messageElement);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

})();