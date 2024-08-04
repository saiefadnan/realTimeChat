const socket = io('https://realtimechat-7aqr.onrender.com');
    document.getElementById('registerButton').addEventListener('click', () => {
    const email = document.getElementById('emailInput').value;
    const username = document.getElementById('usernameInput').value;
    const password = document.getElementById('passwordInput').value;
    const profilePic = document.getElementById('profilePic');
    const profile = profilePic.files[0];
    if (username.trim() && email.trim() && password.trim() && profile) {
        const reader = new FileReader();
        reader.onload = () => {
            const fileData = reader.result.split(',')[1];;
            socket.emit('register', {email, username ,password, profile: { name: profile.name, data: fileData, type: profile.type }});
        }
        reader.readAsDataURL(profile);
        document.getElementById('emailInput').value='';
        document.getElementById('usernameInput').value='';
        document.getElementById('passwordInput').value='';
    }else{
        console.error('No file selected');
        addNotify('All fields should be filled including profile picture!');
    }
  });

  document.getElementById('loginButton').addEventListener('click', () => {
    const email = document.getElementById('logemailInput').value;
    const password = document.getElementById('logpasswordInput').value;
    console.log(email,password);
    if (email.trim() && password.trim()) {
      socket.emit('login', email, password);
      document.getElementById('logemailInput').value='';
      document.getElementById('logpasswordInput').value='';
    }
  });

  document.getElementById('sendButton').addEventListener('click', () => {
    const recipient = document.getElementById('recipientInput').value;
    const message = document.getElementById('messageInput').value;
    if(recipient.trim() && message.trim() && recipient==='public'){
      socket.emit('public message', message);
      addMessageTo(`Me (public): ${message}`) ;
      document.getElementById('messageInput').value = '';
    }
    else if (recipient.trim() && message.trim()) {
      socket.emit('private message', { to: recipient, message });
      addMessageTo(`Me (${recipient}): ${message}`) ;
      document.getElementById('messageInput').value = '';
    }
    const fileinput = document.getElementById('fileInput');
    const file = fileinput.files[0];
    if(file && recipient.trim() && recipient==='public') {
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
            document.getElementById('fileInput').value = '';
    }
    else if(file && recipient.trim()) {
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
            document.getElementById('fileInput').value = '';
        }
  });

  socket.on('private message', ({ from, time, message, profile }) => {
    addMessage(`${from}: ${message}`,profile) ;
  });


  socket.on('public message', ({ from, time, message, profile  }) => {
    addMessage(`${from} (public): ${message}`,profile) ;
  });

  socket.on('private image',({from,time,fileData, profile  })=>{
    addImage(from,fileData,profile) ;
  })

  socket.on('public image',({from,time,fileData, profile  })=>{
    addImage(from,fileData,profile) ;
  })

  socket.on('private video',({from,time,fileData, profile  })=>{
    addVideo(from,fileData,profile) ;
  })

  socket.on('public video',({from,time,fileData, profile  })=>{
    addVideo(from,fileData,profile) ;
  })

  socket.on('private file',({from,time,fileData,fileName, profile  })=>{
    addFile(from,fileData,fileName,profile);
  })
  socket.on('public file',({from,time,fileData,fileName, profile })=>{
    addFile(from,fileData,fileName,profile);
  })
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
    const activeBar = document.getElementById('active');
    activeUsers.push('public');
    profile.push('https://images.pexels.com/photos/45201/kitty-cat-kitten-pet-45201.jpeg?auto=compress&cs=tinysrgb&w=600');
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
        userDiv.textContent = name;
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
    messageElement.style.padding = '8px';
    messageElement.style.margin = '10px';
    messageElement.style.textAlign = 'left';
    messageElement.style.width = '50%';
    messageElement.style.marginLeft = '70%';
    messageElement.innerHTML = `<strong>Me (${to}):</strong><br><img src="${imageData}" alt="Image" style="max-width: 200px; max-height: 200px;">`;
    messagesDiv.appendChild(messageElement);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
    //at ${new Date(time).toLocaleTimeString()}
}


function addImage(from, imageData,profile){
    const messagesDiv = document.getElementById('messages');
    const messageElement = document.createElement('div');
    const profileDiv = document.createElement('img');
    const messageContainer = document.createElement('div');
    messageElement.innerHTML = `<strong>${from}:</strong><br><img src="${imageData}" alt="Image" style="max-width: 200px; max-height: 200px;">`;

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
    //at ${new Date(time).toLocaleTimeString()}
}


function addVideoTo(to, videoData) {
    const messagesDiv = document.getElementById('messages');
    const messageElement = document.createElement('div');
    messageElement.style.padding = '8px';
    messageElement.style.margin = '10px';
    messageElement.style.textAlign = 'left';
    messageElement.style.width = '50%';
    messageElement.style.marginLeft = '70%';
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
    messageElement.style.marginLeft = '70%';
    messageElement.innerHTML = `<strong>Me (${to}):</strong><br><a href="${fileData}" download="${fileName}">${fileName}</a>`;
    messagesDiv.appendChild(messageElement);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}


function addMessage(message, profile) {
    const messagesDiv = document.getElementById('messages');
    const messageElement = document.createElement('div');
    const profileDiv = document.createElement('img');
    const messageContainer = document.createElement('div');
    messageElement.textContent = message;
    messageElement.style.backgroundColor = 'lightblue';
    messageElement.style.borderRadius = '10px';
    messageElement.style.margin = '10px';
    messageElement.style.textAlign = 'left';
    messageElement.style.padding = '10px';

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
  
  function addMessageTo(message) {
      const messagesDiv = document.getElementById('messages');
      const messageElement = document.createElement('div');
      messageElement.textContent = message;
      messageElement.style.backgroundColor = 'rgb(38, 158, 198)';
      messageElement.style.borderRadius = '10px';
      messageElement.style.padding = '10px';
      messageElement.style.margin = '10px';
      messageElement.style.textAlign = 'left';
      messageElement.style.width = '50%';
      messageElement.style.marginLeft = '45%';
      messagesDiv.appendChild(messageElement);
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