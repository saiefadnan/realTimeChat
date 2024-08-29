(async function(){
    let debounceTimer;
    const search = document.getElementById('search');
    const clear = document.getElementById('clear');
    const roomCreate = document.getElementById('create-room');
    const roomName =  document.getElementById('room-name');
    const activeRoom = document.getElementById('room-list');
    let currentRoom;
    const roomHeader = document.getElementById('room-header');
    function load() {
        var elems = document.querySelectorAll('.modal');
        var instances = M.Modal.init(elems);
        for(let room of  window.rooms){
            addList(room.name);
        }
    }

    function clearSearch(){document.getElementById('search').value = '';}
    function debounce(func, delay) {
        return function (...args) {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => func.apply(this, args), delay);
        };
    }
    async function handleSearch(){
        const items = document.getElementById('item-list');
        items.innerHTML='';
        const query=document.getElementById('search').value;
        if(query.length<2) return;
        const data = await fetchData('/api/search',{query: query});
        Array.from(data.querynames).forEach((user)=>{
            const list = document.createElement('div');
            list.textContent = user.name;
            list.className = 'list-box';
            items.appendChild(list);
        })
    }

    async function handleSubmit(){
        const input = roomName.value;
        if(input.trim()){
            window.rooms.push({name:input});
            var instance = M.Modal.getInstance(document.getElementById('room-creation-modal'));
            instance.close();
            addError(`room ${input} created!`);
            addList(input);
        }
        else{
            M.toast({html: 'Room name is required!', classes: 'rounded'});
        }
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
            const unselectDivs = document.getElementById('room-list').querySelectorAll('div');
            unselectDivs.forEach((unselectDiv)=>{ unselectDiv.style.backgroundColor = 'black';})
            userDiv.style.backgroundColor = 'cadetblue';
            roomHeader.textContent =name;
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

    load();

    search.addEventListener('input', debounce(handleSearch,500));
    clear.addEventListener('click', clearSearch);
    roomCreate.addEventListener('click',handleSubmit);
    window.eventListeners.push({element: search, event: 'input',debounce});
    window.eventListeners.push({element: clear, event: 'click',clearSearch});
    window.eventListeners.push({element: roomCreate, event: 'click',handleSubmit});
})();
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  