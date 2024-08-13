(function(){

  function addPicture(picture){
    //console.log(picture);
    const profileDiv = document.getElementById('nav-profile-container').querySelector('img');
    if(picture){
        profileDiv.src=picture;
    }
  }
if(sessionStorage.getItem('login')==='true'){
    if (window.socket && window.socket.connected) {
        //console.log('WebSocket is connected.');
        window.socket.emit('show active-users');
    } 
    else{
      const url = 'https://realtimechat-7aqr.onrender.com';
        window.socket = io();
        //console.log('u are connecting...');
        addPicture(sessionStorage.getItem('imageurl'));
        window.socket.emit('insert name',{
            username: sessionStorage.getItem('username'),
            imageurl: sessionStorage.getItem('imageurl')
    });
    }
}
else{
    //console.log('No connection');
}

if(window.socket){
    const socket = window.socket;
    document.getElementById('sendButton').addEventListener('click', () => {
    const recipient = document.getElementById('recipientInput').value;
    const message = document.getElementById('messageInput').value;
    if(recipient.trim() && message.trim() && recipient==='public'){
      addMessageTo(message, new Date(Date.now()).toLocaleString()) ;
      socket.emit('public message', message);
      document.getElementById('messageInput').value = '';
    }
    else if (recipient.trim() && message.trim()) {
      addMessageTo(message, new Date(Date.now()).toLocaleString()) ;
      socket.emit('private message', { to: recipient, message });
      document.getElementById('messageInput').value = '';
    }
    const fileinput = document.getElementById('file-input');
    const file = fileinput.files[0];
    if(file && recipient.trim() && recipient==='public') {
        document.getElementById('custom-file-upload').style.backgroundColor = '#007bff';
        const reader = new FileReader();
        reader.onload = () => {
            const fileData = reader.result;
            if (file.type.startsWith('image/')) {
                socket.emit('public image', {fileData });
                addImageTo(new Date(Date.now()).toLocaleString(), fileData);
            } else if (file.type.startsWith('video/')) {
                //console.log('video..');
                socket.emit('public video', {fileData });
                addVideoTo(new Date(Date.now()).toLocaleString(), fileData);
            } else {
                socket.emit('public file', {fileData ,fileName: file.name});
                //socket.emit('public file', {fileData, fileName: file.name, fileType: file.type });
                addFileTo(new Date(Date.now()).toLocaleString(), fileData, file.name);
            }
            };
            reader.readAsDataURL(file);
            document.getElementById('file-input').value = '';
    }
    else if(file && recipient.trim()) {
        document.getElementById('custom-file-upload').style.backgroundColor = '#007bff';
        const reader = new FileReader();
        reader.onload = () => {
            const fileData = reader.result;
            if (file.type.startsWith('image/')) {
                socket.emit('private image', { to: recipient, fileData });
                addImageTo(new Date(Date.now()).toLocaleString(), fileData);
            } else if (file.type.startsWith('video/')) {
                socket.emit('private video', { to: recipient, fileData });
                addVideoTo(new Date(Date.now()).toLocaleString(), fileData);
            } else {
                socket.emit('private file', { to: recipient, fileData ,fileName: file.name});
                addFileTo(new Date(Date.now()).toLocaleString(), fileData, file.name);
            }
            };
            reader.readAsDataURL(file);
            document.getElementById('file-input').value = '';
        }
  });

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
  socket.on('private image',({from,time,fileData, profile  })=>{
    const date = new Date(time).toLocaleString();
    addImage(date,from,fileData,profile) ;
  })

  socket.on('public image',({from,time,fileData, profile  })=>{
    const date = new Date(time).toLocaleString();
    addImage(date,from,fileData,profile) ;
  })

  //video

  socket.on('private video',({from,time,fileData, profile  })=>{
    const date = new Date(time).toLocaleString();
    addVideo(date, from,fileData,profile) ;
  })

  socket.on('public video',({from,time,fileData, profile  })=>{
    const date = new Date(time).toLocaleString();
    addVideo(date, from,fileData,profile) ;
  })

  //file

  socket.on('private file',({from,time,fileData,fileName, profile  })=>{
    const date = new Date(time).toLocaleString();
    addFile(date, from,fileData,fileName,profile);
  })
  socket.on('public file',({from,time,fileData,fileName, profile })=>{
    const date = new Date(time).toLocaleString();
    addFile(date, from,fileData,fileName,profile);
  })

//rest

  socket.on('error', ({error}) => {
    addError(`${error}`) ;
  });

  function updateStyles() {
    if (window.innerWidth < 1000) {
      //console.log('again...');
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

  socket.on('activeUsers',({activeUsers, profile})=>{
    if(!activeUsers.includes('public')){
        activeUsers.push('public');
        profile.push('https://static.vecteezy.com/system/resources/thumbnails/001/760/457/small_2x/megaphone-loudspeaker-making-announcement-vector.jpg');
    }
    const activeBar = document.getElementById('active');
    activeBar.innerHTML = ''; 
    activeUsers.forEach((name, index) => {
        const userDiv = document.createElement('div');
        const userNameDiv = document.createElement('h5');
        const profileDiv = document.createElement('img');
        const profileUrl = profile[index];

        if(name!=='public') userDiv.style.backgroundColor = 'black';
        else userDiv.style.backgroundColor = 'crimson';
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

        profileDiv.src=profileUrl;
        profileDiv.style.width = '60px';
        profileDiv.style.height = '60px';
        profileDiv.style.borderRadius = '50%';
        profileDiv.style.border = '2px solid #ccc';

        userDiv.addEventListener('mouseover', () => {
            userDiv.style.scale = 0.8;
        });
        userDiv.addEventListener('click', () => {
          document.getElementById('recipientInput').value= name;
          const unselectDivs = document.getElementById('active').querySelectorAll('div');
          unselectDivs.forEach((unselectDiv)=>{
            const name = unselectDiv.querySelector('h5').textContent;
            if(name!=='public')unselectDiv.style.backgroundColor = 'black';
            else unselectDiv.style.backgroundColor = 'crimson';
          })
          userDiv.style.backgroundColor = 'cadetblue';
        });
        userDiv.addEventListener('mouseout', () => {
          userDiv.style.scale = 1;
        });
        
        userDiv.appendChild(profileDiv);
        userNameDiv.style.padding = 0;
        userNameDiv.style.margin = 0;
        if(sessionStorage.getItem('username')===name)userNameDiv.textContent = `${name}(me)`;
        else userNameDiv.textContent = name;
        userDiv.appendChild(userNameDiv);
        activeBar.appendChild(userDiv);
        activeBar.scrollTop = activeBar.scrollHeight;
        updateStyles();
        window.addEventListener('resize', updateStyles);
    });
  });


function addImageTo(time, imageData){
    const messagesDiv = document.getElementById('messages');
    const messageElement = document.createElement('div');
    //const modal = document.createElement('div');
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
    `<h5 style="width:90%;text-align: center;margin: 0;padding: 0;margin-right: 70px;">${time}</h5>
    <img src="${imageData}" alt="Image" style="max-width: 215px; max-width: 215px;margin-right: 70px;">`;
    messagesDiv.appendChild(messageElement);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
    messageElement.querySelector('img').style.cursor = 'pointer';
    
    // messageElement.querySelector('img').addEventListener('click',()=>{
    //     if(messageElement.querySelector('img').style.width=='200px'){
    //         console.log('asda');
    //         modal.style.position = 'fixed';
    //         modal.style.top = '50%';
    //         modal.style.left = '50%';
    //         modal.style.transform = 'translate(-50%, -50%)';
    //         modal.style.width = '100%';
    //         modal.style.height = '100%';
    //         modal.style.backgroundColor = '#ccc';
    //         modal.style.zIndex = '1000';
    //     }
    //     else{
    //         modal.style.display = 'none';
    //     }
    // })
}


function addImage(time,from, imageData,profile){
    const messagesDiv = document.getElementById('messages');
    const messageElement = document.createElement('div');
    const profileDiv = document.createElement('img');
    const messageContainer = document.createElement('div');

    messageElement.innerHTML = 
    `<h5 style="width:100%;text-align: center;margin: 0;padding: 0;">${time}</h5>
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
    messageElement.style.color = '#333';

    messageElement.innerHTML = 
    `<h5 style="width:90%;text-align: center;margin-right: 70px;">${time}</h5>
    <video controls style="max-width: 215px; max-height: 215px;margin: 0;padding: 0;margin-right:70px;">
      <source src="${videoData}" type="video/mp4">Your browser does not support the video tag.
    </video>`;
    messagesDiv.appendChild(messageElement);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

function addVideo(time,to, videoData, profile) {
  // console.log('video received...');
    const messagesDiv = document.getElementById('messages');
    const messageElement = document.createElement('div');
    const profileDiv = document.createElement('img');
    const messageContainer = document.createElement('div');
    messageElement.innerHTML =
     `<h5 style="width:100%;text-align: center;margin: 0;padding: 0;">${time}</h5>
    <h5 style="color: #ccc;margin: 0 10px;padding: 0;">${to}</h5>
    <video controls style="max-width: 215px; max-height: 215px;">
      <source src="${videoData}" type="video/mp4">
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
    messageElement.style.color = 'crimson';
    messageElement.style.backgroundColor = 'lightblue';
    messageElement.style.borderRadius = '10px';
    messageElement.style.padding = '5px';
    messageElement.style.margin = '10px';
    messageElement.style.textAlign = 'center';
    messagesDiv.appendChild(messageElement);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
  }

}})();
document.getElementById('file-input').addEventListener('change',()=>{
  document.getElementById('custom-file-upload').style.backgroundColor = 'crimson'
})