(function(){
if(sessionStorage.getItem('login')==='true'){
    if (window.socket && window.socket.connected) {
        console.log('WebSocket is connected.');
        window.socket.emit('show active-users');
    } 
    else{
      const url = 'https://realtimechat-7aqr.onrender.com';
        window.socket = io(url);
        console.log('u are connecting...');
        window.socket.emit('insert name',{
            username: sessionStorage.getItem('username'),
            imageurl: sessionStorage.getItem('imageurl')
    });
    }
}
else{
    console.log('No connection');
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
                addImageTo(recipient, fileData);
            } else if (file.type.startsWith('video/')) {
                console.log('video..');
                socket.emit('public video', {fileData });
                addVideoTo(recipient, fileData);
            } else {
                socket.emit('public file', {fileData ,fileName: file.name});
                //socket.emit('public file', {fileData, fileName: file.name, fileType: file.type });
                addFileTo(recipient, fileData, file.name);
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
                addImageTo(recipient, fileData);
            } else if (file.type.startsWith('video/')) {
                socket.emit('private video', { to: recipient, fileData });
                addVideoTo(recipient, fileData);
            } else {
                socket.emit('private file', { to: recipient, fileData ,fileName: file.name});
                addFileTo(recipient, fileData, file.name);
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
    addImage(from,fileData,profile) ;
  })

  socket.on('public image',({from,time,fileData, profile  })=>{
    addImage(from,fileData,profile) ;
  })

  //video

  socket.on('private video',({from,time,fileData, profile  })=>{
    addVideo(from,fileData,profile) ;
  })

  socket.on('public video',({from,time,fileData, profile  })=>{
    addVideo(from,fileData,profile) ;
  })

  //file

  socket.on('private file',({from,time,fileData,fileName, profile  })=>{
    addFile(from,fileData,fileName,profile);
  })
  socket.on('public file',({from,time,fileData,fileName, profile })=>{
    addFile(from,fileData,fileName,profile);
  })

//rest

  socket.on('error', ({error}) => {
    addError(`${error}`) ;
  });

  socket.on('notify',({notify})=>{
    addNotify(`${notify}`);
  });

  socket.on('profilePicture',({picture})=>{
    addPicture(picture);
  })


  socket.on('activeUsers',({activeUsers, profile})=>{
    console.log('active users....');
    const activeBar = document.getElementById('active');
    if(!activeUsers.includes('public')){
        activeUsers.push('public');
        profile.push('https://images.pexels.com/photos/45201/kitty-cat-kitten-pet-45201.jpeg?auto=compress&cs=tinysrgb&w=600');
    }
    activeBar.innerHTML = ''; 
    activeUsers.forEach((name, index) => {
        const userDiv = document.createElement('div');
        const profileDiv = document.createElement('img');
        const profileUrl = profile[index];
        console.log(profileUrl);
        userDiv.style.height = '70px';
        userDiv.style.width = '80%';
        if(name!=='public') userDiv.style.backgroundColor = 'lightgreen';
        else userDiv.style.backgroundColor = 'crimson';
        userDiv.style.display = 'flex';
        userDiv.style.alignItems = 'center';
        userDiv.style.justifyContent = 'space-between';
        userDiv.style.border = '1px solid black'
        userDiv.style.borderRadius = '10px';
        userDiv.style.padding = '0 20px';
        if(sessionStorage.getItem('username')===name)userDiv.textContent = `${name}(me)`;
        else userDiv.textContent = name;
        userDiv.style.marginTop ='5px';

        profileDiv.src=profileUrl;
        profileDiv.style.width = '60px';
        profileDiv.style.height = '60px';
        profileDiv.style.borderRadius = '50%';
        profileDiv.style.border = '1px soild #ccc';
        userDiv.addEventListener('mouseover', () => {
            userDiv.style.backgroundColor = 'cadetblue';
            userDiv.style.cursor = 'pointer'; 
        });
        userDiv.addEventListener('click', () => {
            document.getElementById('recipientInput').value=`${name}`;
        });
        userDiv.addEventListener('mouseout', () => {
            if(name!=='public')userDiv.style.backgroundColor = 'lightgreen';
            else userDiv.style.backgroundColor = 'crimson';
        });
        userDiv.appendChild(profileDiv);
        activeBar.appendChild(userDiv);
        activeBar.scrollTop = activeBar.scrollHeight;
    });
  });


function addImageTo(to, imageData){
    const messagesDiv = document.getElementById('messages');
    const messageElement = document.createElement('div');
    const modal = document.createElement('div');
    messageElement.style.padding = '8px';
    messageElement.style.margin = '10px';
    messageElement.style.textAlign = 'left';
    messageElement.style.width = '35%';
    messageElement.style.marginLeft = '85%';
    messageElement.innerHTML = `<strong>Me (${to}):</strong><br><img src="${imageData}" alt="Image" style="max-width: 150px; max-width: 150px;">`;
    messagesDiv.appendChild(messageElement);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
    messageElement.querySelector('img').style.cursor = 'pointer';
    
    messageElement.querySelector('img').addEventListener('click',()=>{
        if(messageElement.querySelector('img').style.width=='200px'){
            console.log('asda');
            modal.style.position = 'fixed';
            modal.style.top = '50%';
            modal.style.left = '50%';
            modal.style.transform = 'translate(-50%, -50%)';
            modal.style.width = '100%';
            modal.style.height = '100%';
            modal.style.backgroundColor = '#ccc';
            modal.style.zIndex = '1000';
        }
        else{
            modal.style.display = 'none';
        }
    })
}


function addImage(from, imageData,profile){
    const messagesDiv = document.getElementById('messages');
    const messageElement = document.createElement('div');
    const profileDiv = document.createElement('img');
    const messageContainer = document.createElement('div');
    messageElement.innerHTML = `<strong>${from}:</strong><br><img src="${imageData}" alt="Image" style="max-width: 215px; max-height: 215px;">`;

    profileDiv.src=profile;
    profileDiv.style.width = '70px';
    profileDiv.style.height = '70px';
    profileDiv.style.borderRadius = '50%';
    profileDiv.style.border = '1px soild #ccc';
    profileDiv.style.padding = '10px';

    messageContainer.style.width = '50%';
    messageContainer.appendChild(profileDiv);
    messageContainer.appendChild(messageElement);
    messageContainer.style.display = 'flex';
    messageContainer.style.justifyContent = 'center';
    messageContainer.style.alignItems = 'center';
    messageElement.style.width= '95%';
    messagesDiv.appendChild(messageContainer);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}


function addVideoTo(to, videoData) {
    const messagesDiv = document.getElementById('messages');
    const messageElement = document.createElement('div');
    messageElement.style.padding = '8px';
    messageElement.style.margin = '10px';
    messageElement.style.textAlign = 'left';
    messageElement.style.width = '50%';
    messageElement.style.marginLeft = '85%';
    messageElement.innerHTML = `<strong>Me (${to}):</strong><br><video controls style="max-width: 200px; max-height: 200px;">
                            <source src="${videoData}" type="video/mp4">
                            Your browser does not support the video tag.
                          </video>`;
    messagesDiv.appendChild(messageElement);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

function addVideo(to, videoData, profile) {
    const messagesDiv = document.getElementById('messages');
    const messageElement = document.createElement('div');
    const profileDiv = document.createElement('img');
    const messageContainer = document.createElement('div');
    messageElement.innerHTML = `<strong>To ${to}:</strong><br><video controls style="max-width: 200px; max-height: 200px;">
                            <source src="${videoData}" type="video/mp4">
                            Your browser does not support the video tag.
                          </video>`;
    profileDiv.src=profile;
    profileDiv.style.width = '70px';
    profileDiv.style.height = '70px';
    profileDiv.style.borderRadius = '50%';
    profileDiv.style.border = '1px soild #ccc';
    profileDiv.style.padding = '10px';
                      
    messageContainer.style.width = '50%';
    messageContainer.appendChild(profileDiv);
    messageContainer.appendChild(messageElement);
    messageContainer.style.display = 'flex';
    messageContainer.style.justifyContent = 'center';
    messageContainer.style.alignItems = 'center';
    messageElement.style.width= '95%';
    messagesDiv.appendChild(messageContainer);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}


function addFile(to, fileData, fileName, profile) {
    const messagesDiv = document.getElementById('messages');
    const messageElement = document.createElement('div');
    const profileDiv = document.createElement('img');
    const messageContainer = document.createElement('div');
    messageElement.innerHTML = `<strong>${to}:</strong><br><a href="${fileData}" download="${fileName}">${fileName}</a>`;

    profileDiv.src=profile;
    profileDiv.style.width = '70px';
    profileDiv.style.height = '70px';
    profileDiv.style.borderRadius = '50%';
    profileDiv.style.border = '1px soild #ccc';
    profileDiv.style.padding = '10px';
                      
    messageContainer.style.width = '50%';
    messageContainer.appendChild(profileDiv);
    messageContainer.appendChild(messageElement);
    messageContainer.style.display = 'flex';
    messageContainer.style.justifyContent = 'center';
    messageContainer.style.alignItems = 'center';
    messageElement.style.width= '95%';
    messagesDiv.appendChild(messageContainer);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

function addFileTo(to, fileData, fileName) {
    const messagesDiv = document.getElementById('messages');
    const messageElement = document.createElement('div');
    messageElement.style.padding = '8px';
    messageElement.style.margin = '10px';
    messageElement.style.textAlign = 'left';
    messageElement.style.width = '50%';
    messageElement.style.marginLeft = '85%';
    messageElement.innerHTML = `<strong>Me (${to}):</strong><br><a href="${fileData}" download="${fileName}">${fileName}</a>`;
    messagesDiv.appendChild(messageElement);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}


function addMessage(from, message, time ,profile) {
    const messagesDiv = document.getElementById('messages');
    const messageElement = document.createElement('div');
    const profileDiv = document.createElement('img');
    const timeDiv = document.createElement('h6');
    const nameDiv = document.createElement('h6');
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

    messageContainer.className = 'message-container';
    messageContainer.appendChild(profileDiv);
    messageContainer.appendChild(messageElement);

    finalContainer.className ='final-container';
    finalContainer.appendChild(time_nameDiv);
    finalContainer.appendChild(messageContainer);

    messagesDiv.appendChild(finalContainer);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;

  }
  
  function addMessageTo(message, time) {
    const messagesDiv = document.getElementById('messages');
    const messageElement = document.createElement('div');
    const timeDiv = document.createElement('h6');
    const messageContainer = document.createElement('div');
    const finalContainer = document.createElement('div');

    messageElement.textContent = message;
    messageElement.className="message-send";
    timeDiv.textContent=time;
    timeDiv.className = 'time-container';
    timeDiv.style.color = '#ccc';

    messageContainer.className = 'message-container';
    messageContainer.appendChild(messageElement);

    finalContainer.className ='final-container';
    finalContainer.appendChild(timeDiv);
    finalContainer.style.marginLeft = '50%'
    finalContainer.appendChild(messageContainer);

    messagesDiv.appendChild(finalContainer);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
  }
function addNotify(message) {
    const notifyDiv = document.getElementById('info');
    const messageElement = document.createElement('div');
    messageElement.textContent = message;
    messageElement.style.margin = '20px';
    messageElement.style.backgroundColor = 'lightgreen';
    messageElement.style.padding = '8px';
    notifyDiv.appendChild(messageElement);
    notifyDiv.scrollTop = notifyDiv.scrollHeight;
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
  
  function addPicture(picture){
    console.log(picture);
    const profileDiv = document.getElementById('profile-container').querySelector('img');
    if(picture){
        profileDiv.src=picture;
    }
  }

}})();

document.getElementById('file-input').addEventListener('change',()=>{
        document.getElementById('custom-file-upload').style.backgroundColor = 'crimson'
})