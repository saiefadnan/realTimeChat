(async function(){
    const socket = window.socket;
    const chunkSize = 512*1024;
    const invited = [];
    const roomModal = document.getElementById('room-creation-modal');
    const searchModal = document.getElementById('search-modal');
    const search = document.getElementById('search');
    const clear = document.getElementById('clear');
    const roomCreate = document.getElementById('create-room');
    const roomName =  document.getElementById('room-name');
    const activeRoom = document.getElementById('room-list');
    const inviteBtn = document.getElementById('invite-user');
    const items = document.getElementById('item-list');
    const Currentroom = document.getElementById('current-room');
    const sendButton = document.getElementById('send-button');
    const fileInput = document.getElementById('file-input');
    const videoBtn = document.getElementById('video-call-btn');
    const localVideo = document.getElementById('localVideo');
    const remoteVideo = document.getElementById('remoteVideo');
    const exitVideo = document.getElementById('exit-video');
    const videoModal = document.getElementById('video-modal');
    const listHeader  = document.getElementById('list-header');
    const messagesDiv = document.getElementById('chat-content');
    let debounceTimer;
    let localStream = null;
    let remoteStream = null;
    let currentRoom;
    let peerConnection;
    const configuration = {
      iceServers: [
          {
              urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302']
          }
      ],
      iceCandidatePoolSize: 8
  };
    function load() {
        var elems = document.querySelectorAll('.modal');
        var instances = M.Modal.init(elems);
        for(let room of  window.rooms){
            addList(room.name);
        }
        updateStyles();
        window.addEventListener('resize',updateStyles);
    }
    function Load(){ 
      document.getElementById('custom-file-upload').style.backgroundColor = 'crimson'; 
    }
    function sendChunks(room, file, offset){
      if(!socket.connected){
        window.Pending(room, file, offset);
        return;
      }
      if(offset>=file.size){
        socket.emit('room file complete',{
        room: {
          name: room,
          admin: window.userInfo.username,
        },
          fileType: file.type, fileName: file.name});
        window.clearPending();
        return;
      }
      const fileSlice = file.slice(offset,offset+chunkSize);
      const reader = new FileReader();
      reader.onload = async()=>{
          socket.emit('room file', {fileData: reader.result});
          sendChunks(room,file,offset+chunkSize);
      }
      reader.readAsArrayBuffer(fileSlice);
      document.getElementById('file-input').value = '';
    }

    function updateStyles() {
      if (window.innerWidth < 1000) {
        listHeader.textContent='';
        const userDivs = activeRoom.querySelectorAll('div');
        userDivs.forEach((userDiv)=>{
          userDiv.style.width = '70px';
          userDiv.style.margin = '5px';
        })
      }
      else{
        listHeader.textContent='Rooms';
        const userDivs = activeRoom.querySelectorAll('div');
        userDivs.forEach((userDiv)=>{
          userDiv.style.margin ='0';
          userDiv.style.marginTop ='5px';
          userDiv.style.width = '80%';
        })
      }
    }

    function clearSearch(){search.value = '';}
    function debounce(func, delay) {
        return function (...args) {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => func.apply(this, args), delay);
        };
    }
    async function Invite(){
      if(currentRoom===undefined){
        M.toast({html: 'Select a room from list!', classes: 'rounded'});
      }else{
        socket.emit('invite',{
          room:{
            name: currentRoom,
            admin: window.userInfo.username,
          },
          usernames: invited
        });
      }
      invited.length = 0 ;
      var instance = M.Modal.getInstance(searchModal);
      instance.close();
    }
    async function handleInvite(list, username){
      if(list.style.backgroundColor ==='blue'){
        list.style.backgroundColor ='#333';
        invited.splice(invited.indexOf(username),1);
      }
      else {
        list.style.backgroundColor ='blue'
        invited.push(username);
      }
    }
    async function handleSearch(){
        items.innerHTML='';
        const query=search.value;
        if(query.length<2) return;
        const data = await fetchData('/api/search',{query: query});
        Array.from(data.querynames).forEach((user)=>{
            const list = document.createElement('div');
            list.textContent = user.name;
            list.className = 'list-box';
            if(invited.includes(user.name)){
              list.style.backgroundColor ='blue';
            }
            items.appendChild(list);
            list.addEventListener('click',()=>handleInvite(list,user.name));
            window.eventListeners.push({element: list, event: 'click', handler: handleInvite});
        })
    }

    async function handleSubmit(){
        const input = roomName.value;
        if(window.rooms.some(room => room.name===input)){
          M.toast({html: 'Room name already exists!', classes: 'rounded'});
        }
        else if(input.trim()){
          window.rooms.push({name:input});
          var instance = M.Modal.getInstance(roomModal);
          instance.close();
          socket.emit('create-room',{
          room: {
              name: input,
              admin: window.userInfo.username,
            }
          })
            addList(input);
        }
        else{
            M.toast({html: 'Room name is required!', classes: 'rounded'});
        }
    }
    async function sendMessage(rec=null, msg=null){
      let message = document.getElementById('message-input').value;
      if(rec && msg){
        currentRoom = rec;
        message = msg;
      }
      if(message.trim() && currentRoom.trim()){
        const date = new Date(Date.now()).toLocaleString();
        addMessageTo(message, date) ;
        if(!socket.connected){
          window.Pending(currentRoom, message, -1);
          document.getElementById('message-input').value = '';
          return;
        }
        socket.emit('room message', {
        room: {
          name: currentRoom,
          admin: window.userInfo.username,
        },
        message, 
        date});
        document.getElementById('message-input').value = '';
      }
      const fileinput = document.getElementById('file-input');
      let file = fileinput.files[0];
      if(file && currentRoom.trim()) {
        document.getElementById('custom-file-upload').style.backgroundColor = '#007bff';
        offset=0;
        sendChunks(currentRoom, file,0);
      }
    }
    function addError(message) {
        console.log(message);
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

    function addList(name){
        const userDiv = document.createElement('div');
        const userNameDiv = document.createElement('h5');
        
        userDiv.style.height = '50px';
        userDiv.style.width = '100px';
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
        userDiv.textContent = name;
        userDiv.style.backgroundColor = 'black';
        
        function Over(){userDiv.style.scale = 0.8;}
        function Out(){userDiv.style.scale = 1;}
        function Click(){
            currentRoom = name;
            const unselectDivs = document.getElementById('room-list').querySelectorAll('div');
            unselectDivs.forEach((unselectDiv)=>{ unselectDiv.style.backgroundColor = 'black';})
            userDiv.style.backgroundColor = 'cadetblue';
            Currentroom.textContent = `Room: ${name}`;
        }
        userDiv.addEventListener('mouseover', Over);
        userDiv.addEventListener('mouseout', Out);
        userDiv.addEventListener('click', Click);
        window.eventListeners.push({element: userDiv, event: 'mouseover', handler: Over});
        window.eventListeners.push({element: userDiv, event: 'mouseout', handler: Out});
        window.eventListeners.push({element: userDiv, event: 'click', handler: Click});

        userNameDiv.style.padding = 0;
        userNameDiv.style.margin = 'auto';
        userNameDiv.style.fontSize = 'small';
        userNameDiv.style.fontWeight = 'bold';
        userDiv.appendChild(userNameDiv);
        activeRoom.appendChild(userDiv);
    }
    function addMessageTo(message, time) {
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

    function addMessage(from, message, time ,profile) {
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
      nameDiv.style.marginLeft = '30px';
      nameDiv.style.color = '#ccc';
      nameDiv.style.fontSize = 'small';
    
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

  function embedDriveFiles(time, to, file_id, profile){
    const messageElement = document.createElement('div');
    const profileDiv = document.createElement('img');
    const messageContainer = document.createElement('div');
    messageElement.innerHTML =
     `<h5 style="width:100%;text-align: center;margin: 0;padding: 0;color: #ccc;font-size:small;">${time}</h5>
    <h5 style="color: #ccc;margin: 0 10px;padding: 0;font-size:small;">${to}</h5>
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

    async function videoCall(){
      try{
          console.log('yooo');
          if(localStream) return;
          localStream = await navigator.mediaDevices.getUserMedia({video: true, audio: true})
          remoteStream = new MediaStream();
          peerConnection = new RTCPeerConnection(configuration);

          localStream.getTracks().forEach(track=>{
            peerConnection.addTrack(track, localStream);
          })

          peerConnection.ontrack = event =>{
            event.streams[0].getTracks().forEach(track=>{
              remoteStream.addTrack(track,remoteStream);
            })
          }
          localVideo.srcObject = localStream;
          remoteVideo.srcObject = remoteStream;

          peerConnection.onicecandidate = event =>{
            if(event.candidate){
              socket.emit('signal',{
                room: currentRoom,
                from: window.userInfo,
                signal: {
                  candidate: event.candidate.toJSON()
                }
              })
            }
          }

          const offer = await peerConnection.createOffer();
          await peerConnection.setLocalDescription(offer);

          socket.emit('signal',{
            room: currentRoom,
            from: window.userInfo,
            signal: {
              sdp: offer.sdp,
              type: offer.type
            }
          })

        }catch(err){
            console.error('Error accessing media devices.', err);
        }
      }

    function exitVideoCall(){
      if(localStream){
        localStream.getTracks().forEach(track=>track.stop());
        localVideo.srcObject=null;
        remoteVideo.srcObject=null;
        localStream=null;
      }
      if(peerConnection){
        peerConnection.close();
        peerConnection = null;
      }
      else{
        console.log('Already off...');
      }
    }

    load();

    

    socket.on('room-created',({notify})=>{
      addError(notify);
    })

    socket.on('invited',({notify})=>{
      addError(notify);
    })
    socket.on('room message',({from, time, message, profile})=>{
      const date = new Date(time).toLocaleString();
      addMessage(from, message, date, profile)
    })

    socket.on('invitation',({name,notify})=>{
      addError(notify);
      if(!window.rooms.includes(name)){
        window.rooms.push({name: name});
        addList(name);
      }
      else{
        //already added
        addError('You are already added');
      }
    })

    async function receiveVideoCall(){
      try{
        console.log('receive');
        var instance = M.Modal.getInstance(videoModal);
        instance.open();
        localStream = await navigator.mediaDevices.getUserMedia({video: true, audio: true})
        remoteStream = new MediaStream();
        localVideo.srcObject = localStream;
        peerConnection = new RTCPeerConnection(configuration);
        localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

        peerConnection.ontrack = event =>{
          event.streams[0].getTracks().forEach(track=>{
            remoteStream.addTrack(track,remoteStream);
          })
        }
        localVideo.srcObject = localStream;
        remoteVideo.srcObject = remoteStream;
        //await createPeerConnection();

        peerConnection.onicecandidate = event =>{
          if(event.candidate){
            socket.emit('signal',{
              room: currentRoom,
              from: window.userInfo,
              signal: {
                candidate: event.candidate.toJSON()
              }
            })
          }
        }

      }catch(err){
          console.error('Error accessing media devices.', err);
      }
    }

    socket.on('signal',async(data)=>{
      if(!peerConnection){
        await receiveVideoCall();
      }
      if(data.signal.sdp){
        const desp = new RTCSessionDescription(data.signal);
        if (!peerConnection.remoteDescription && desp.type === 'answer') {
          await peerConnection.setRemoteDescription(desp);
        }
        else if(desp.type === 'offer'){
          await peerConnection.setRemoteDescription(desp);
          const answer =  await peerConnection.createAnswer();
          await peerConnection.setLocalDescription(answer);
          socket.emit('signal',{
            room: currentRoom,
            from: window.userInfo,
            signal: answer
          })
        }
      }
      if(data.signal.candidate){
        const candidate = new RTCIceCandidate(data.signal.candidate);
        await peerConnection.addIceCandidate(candidate);
      }
    })

    socket.on('room file',({from, time, fileData, fileName, profile})=>{
      const date = new Date(time).toLocaleString();
      if(from===window.userInfo.username)embedDriveFilesTo(date,fileData)
      else embedDriveFiles(date,from,fileData,profile)
    })

    fileInput.addEventListener('change', Load);
    search.addEventListener('input', debounce(handleSearch,500));
    clear.addEventListener('click', clearSearch);
    roomCreate.addEventListener('click',handleSubmit);
    inviteBtn.addEventListener('click',Invite);
    sendButton.addEventListener('click', sendMessage);
    videoBtn.addEventListener('click',videoCall);
    exitVideo.addEventListener('click', exitVideoCall)

    window.eventListeners.push({element: search, event: 'input',handler: debounce});
    window.eventListeners.push({element: clear, event: 'click',handler: clearSearch});
    window.eventListeners.push({element: roomCreate, event: 'click',handler: handleSubmit});
    window.eventListeners.push({element: window, event: 'resize', handler: updateStyles});
    window.eventListeners.push({element: sendButton, event: 'click', handler: sendMessage});
    window.eventListeners.push({element: fileInput, event: 'change', handler: Load});
    window.eventListeners.push({element: inviteBtn, event: 'click', handler: Invite});
    window.eventListeners.push({element: videoBtn, event: 'click', handler: videoCall});
    window.eventListeners.push({element: exitVideo, event: 'click', handler: exitVideoCall});
})();
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  