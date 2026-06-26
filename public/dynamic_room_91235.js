(async function () {
    let socket = window.socket;

    const chunkSize = 512 * 1024;
    const items = document.getElementById('item-list');
    const activeRoom = document.getElementById('room-list');
    const roomNameInput = document.getElementById('room-name');
    const CurrentroomLabel = document.getElementById('current-room');
    const messagesDiv = document.getElementById('chat-content');
    const videoModal = document.getElementById('video-modal');

    const iceConfiguration = {
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'turn:relay.backups.cz', credential: 'webrtc', username: 'webrtc' }
        ]
    };

    let localConnection; // Defined in outer scope for signal handler access
    let currentRoom;
    let invitedUsers = [];
    let debounceTimer;

    function init() {
        const modalElems = document.querySelectorAll('.modal');
        M.Modal.init(modalElems);
        
        if (window.rooms) {
            window.rooms.forEach(room => addRoomToList(room.name));
        }
        updateLayout();
        window.addEventListener('resize', updateLayout);
    }

    function updateLayout() {
        const isMobile = window.innerWidth < 1000;
        const listHeader = document.getElementById('list-header');
        if (listHeader) listHeader.textContent = isMobile ? '' : 'Rooms';

        const userDivs = activeRoom.querySelectorAll('div');
        userDivs.forEach(div => {
            div.style.width = isMobile ? '70px' : '85%';
            div.style.margin = isMobile ? '5px' : '5px auto';
        });
    }

    async function handleSearch() {
        items.innerHTML = '';
        const query = document.getElementById('search').value.trim();
        if (query.length < 2) return;

        try {
            const data = await window.fetchData('/api/search', { query });
            if (data && data.querynames) {
                data.querynames.forEach(user => {
                    const list = document.createElement('div');
                    list.textContent = user.name;
                    list.className = 'list-box';
                    if (invitedUsers.includes(user.name)) {
                        list.style.backgroundColor = '#2980b9';
                    }
                    list.addEventListener('click', () => {
                        const idx = invitedUsers.indexOf(user.name);
                        if (idx > -1) {
                            invitedUsers.splice(idx, 1);
                            list.style.backgroundColor = '#333';
                        } else {
                            invitedUsers.push(user.name);
                            list.style.backgroundColor = '#2980b9';
                        }
                    });
                    items.appendChild(list);
                });
            }
        } catch (err) {
            console.error('[RoomSearch] Error:', err);
        }
    }

    function debounce(func, delay) {
        return (...args) => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => func(...args), delay);
        };
    }

    async function handleRoomCreate() {
        const name = roomNameInput.value.trim();
        if (!name) return M.toast({ html: 'Room name is required!', classes: 'rounded red' });

        if (window.rooms.some(r => r.name === name)) {
            return M.toast({ html: 'Room already exists!', classes: 'rounded red' });
        }

        window.rooms.push({ name });
        const inst = M.Modal.getInstance(document.getElementById('room-creation-modal'));
        inst.close();

        socket.emit('create-room', {
            room: { name, admin: window.userInfo.username }
        });
        addRoomToList(name);
    }

    function sendChunks(room, file, offset) {
        if (!socket || !socket.connected) {
            if (window.Pending) window.Pending(room, file, offset);
            return;
        }

        if (offset >= file.size) {
            window.updateUploadProgress(100, file.name);
            socket.emit('room file complete', {
                room: { name: room, admin: window.userInfo.username },
                fileType: file.type,
                fileName: file.name
            });
            return;
        }

        const percent = (offset / file.size) * 100;
        window.updateUploadProgress(percent, file.name);

        const slice = file.slice(offset, offset + chunkSize);
        const reader = new FileReader();
        reader.onload = () => {
            socket.emit('room file', { fileData: reader.result });
            sendChunks(room, file, offset + chunkSize);
        };
        reader.readAsArrayBuffer(slice);
    }

    async function sendMessage(rec = null, msg = null) {
        const messageInput = document.getElementById('message-input');
        let message = messageInput.value.trim();
        let targetRoom = currentRoom;

        if (rec && msg) {
            targetRoom = rec;
            message = msg;
        }

        if (message && targetRoom) {
            const date = new Date().toLocaleString();
            addMessageTo(message, date);

            if (!socket || !socket.connected) {
                if (window.Pending) window.Pending(targetRoom, message, -1);
                messageInput.value = '';
                return;
            }

            socket.emit('room message', {
                room: { name: targetRoom, admin: window.userInfo.username },
                message,
                date
            });
            messageInput.value = '';
        }

        const fileInputEl = document.getElementById('file-input');
        const file = fileInputEl.files[0];
        if (file && targetRoom) {
            document.getElementById('custom-file-upload').style.backgroundColor = '#2ecc71';
            sendChunks(targetRoom, file, 0);
        }
    }

    function addRoomToList(name) {
        const div = document.createElement('div');
        Object.assign(div.style, {
            height: '50px',
            color: '#ccc',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1px solid var(--border)',
            borderRadius: '16px',
            cursor: 'pointer',
            backgroundColor: 'var(--bg-item)',
            marginBottom: '10px',

            transition: 'transform 0.1s'
        });
        div.textContent = name;

        div.addEventListener('mouseover', () => div.style.transform = 'scale(0.95)');
        div.addEventListener('mouseout', () => div.style.transform = 'scale(1)');
        div.addEventListener('click', () => {
            currentRoom = name;
            activeRoom.querySelectorAll('div').forEach(d => {
                d.style.backgroundColor = 'var(--bg-item)';
                d.style.color = '#ccc';
            });
            div.style.backgroundColor = 'var(--accent)';
            div.style.color = '#000';
            currentRoom = name;
            CurrentroomLabel.textContent = `Room: ${name}`;
        });

        activeRoom.appendChild(div);
    }

    // WebRTC Logic
    async function startVideoCall() {
        if (!currentRoom) return M.toast({ html: 'Select a room first!', classes: 'rounded' });
        
        localConnection = new RTCPeerConnection(iceConfiguration);
        
        // Setup local stream (placeholder for UI improvement)
        localConnection.onicecandidate = e => {
            if (e.candidate) console.log('[WebRTC] New ICE candidate');
        };

        const offer = await localConnection.createOffer();
        await localConnection.setLocalDescription(offer);
        socket.emit('signal', { room: currentRoom, signal: offer });
        
        M.toast({ html: 'Calling room members...', classes: 'rounded blue' });
    }

    async function receiveVideoCall(signal) {
        const remoteConnection = new RTCPeerConnection(iceConfiguration);
        await remoteConnection.setRemoteDescription(new RTCSessionDescription(signal));
        const answer = await remoteConnection.createAnswer();
        await remoteConnection.setLocalDescription(answer);
        socket.emit('signal', { room: currentRoom, signal: answer });
    }

    // Initialize socket connection if missing
    if (!socket || !socket.connected) {
        socket = io();
        window.socket = socket;
        
        socket.on('connect', () => {
            console.log('[Room Socket] Connected');
            socket.emit('insert name', { jwtoken: Cookies.get('token') });
        });
    }

    // Socket Events
    socket.on('room-created', ({ notify }) => addFeedback(notify, 'green'));
    socket.on('invited', ({ notify }) => addFeedback(notify, 'blue'));
    socket.on('room message', ({ from, time, message, profile }) => {
        addMessage(from, message, new Date(time).toLocaleString(), profile);
    });

    socket.on('invitation', ({ name, notify }) => {
        addFeedback(notify, 'orange');
        if (!window.rooms.some(r => r.name === name)) {
            window.rooms.push({ name });
            addRoomToList(name);
        }
    });

    socket.on('signal', async ({ signal }) => {
        if (signal.type === 'offer') {
            await receiveVideoCall(signal);
        } else if (signal.type === 'answer' && localConnection) {
            await localConnection.setRemoteDescription(new RTCSessionDescription(signal));
        }
    });

    socket.on('room file', ({ from, time, fileData, profile }) => {
        const date = new Date(time).toLocaleString();
        if (from === window.userInfo.username) embedDriveFilesTo(date, fileData);
        else embedDriveFiles(date, from, fileData, profile);
    });

    // UI Feedback
    function addFeedback(msg, color) {
        const err = document.createElement('div');
        err.textContent = msg;
        Object.assign(err.style, {
            color: color === 'green' ? '#2ecc71' : color === 'blue' ? '#3498db' : '#f39c12',
            backgroundColor: '#222',
            borderRadius: '5px',
            padding: '8px',
            margin: '10px auto',
            width: 'fit-content',
            textAlign: 'center',
            fontSize: '13px'
        });
        messagesDiv.appendChild(err);
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
        setTimeout(() => err.remove(), 4000);
    }

    // Re-use identical message building functions for consistency with chat
    function addMessage(from, message, time, profile) {
        const finalContainer = document.createElement('div');
        finalContainer.className = 'final-container';
        const head = document.createElement('div');
        head.className = 'time-name-container';
        const nameLabel = document.createElement('span');
        nameLabel.textContent = from;
        nameLabel.style.color = '#3498db';
        const timeLabel = document.createElement('span');
        timeLabel.textContent = ` • ${time}`;
        timeLabel.style.fontSize = '10px';
        timeLabel.style.color = '#777';
        head.append(nameLabel, timeLabel);
        const body = document.createElement('div');
        body.className = 'message-receive-container';
        const img = document.createElement('img');
        img.src = profile;
        img.className = 'receiver-profile-container';
        const msgBox = document.createElement('div');
        msgBox.className = 'message-receive';
        msgBox.textContent = message;
        body.append(img, msgBox);
        finalContainer.append(head, body);
        messagesDiv.appendChild(finalContainer);
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
    }

    function addMessageTo(message, time) {
        const finalContainer = document.createElement('div');
        finalContainer.className = 'send-final-container';
        const timeLabel = document.createElement('div');
        timeLabel.textContent = time;
        timeLabel.style.fontSize = '10px';
        timeLabel.style.color = '#777';
        const body = document.createElement('div');
        body.className = 'message-send-container';
        const msgBox = document.createElement('div');
        msgBox.className = 'message-send';
        msgBox.textContent = message;
        body.appendChild(msgBox);
        finalContainer.append(timeLabel, body);
        messagesDiv.appendChild(finalContainer);
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
    }

    function embedDriveFiles(time, from, file_id, profile) {
        const container = document.createElement('div');
        container.className = 'message-receive-container';
        container.style.flexDirection = 'column';
        container.style.alignItems = 'flex-start';
        container.style.padding = '10px';
        const header = document.createElement('div');
        header.style.display = 'flex';
        header.style.gap = '10px';
        const img = document.createElement('img');
        img.src = profile;
        img.style.width = '40px'; img.style.height = '40px'; img.style.borderRadius = '50%';
        const info = document.createElement('div');
        const nameSpan = document.createElement('b'); nameSpan.textContent = from;
        const timeSpan = document.createElement('small'); timeSpan.textContent = ` ${time}`;
        info.append(nameSpan, timeSpan);
        header.append(img, info);
        const iframe = document.createElement('iframe');
        iframe.src = `https://drive.google.com/file/d/${file_id}/preview`;
        Object.assign(iframe.style, { width: '100%', maxWidth: '300px', height: '215px', border: 'none', borderRadius: '8px', backgroundColor: '#000' });
        container.append(header, iframe);
        messagesDiv.appendChild(container);
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
    }

    function embedDriveFilesTo(time, file_id) {
        const container = document.createElement('div');
        container.style.display = 'flex';
        container.style.flexDirection = 'column';
        container.style.alignItems = 'flex-end';
        container.style.padding = '10px';
        const timeLabel = document.createElement('small'); timeLabel.textContent = time;
        const iframe = document.createElement('iframe');
        iframe.src = `https://drive.google.com/file/d/${file_id}/preview`;
        Object.assign(iframe.style, { width: '100%', maxWidth: '300px', height: '215px', border: 'none', borderRadius: '8px', backgroundColor: '#000' });
        container.append(timeLabel, iframe);
        messagesDiv.appendChild(container);
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
    }

    // Listeners
    const searchInput = document.getElementById('search');
    if (searchInput) searchInput.addEventListener('input', debounce(handleSearch, 400));
    
    const createRoomBtn = document.getElementById('create-room-btn');
    if (createRoomBtn) createRoomBtn.addEventListener('click', handleRoomCreate);
    
    const inviteUserBtn = document.getElementById('invite-user-btn');
    if (inviteUserBtn) {
        inviteUserBtn.addEventListener('click', () => {
            if (!currentRoom) return M.toast({ html: 'Select a room!', classes: 'rounded' });
            socket.emit('invite', {
                room: { name: currentRoom, admin: window.userInfo.username },
                usernames: invitedUsers
            });
            invitedUsers = [];
            M.Modal.getInstance(document.getElementById('search-modal')).close();
        });
    }
    
    const sendBtn = document.getElementById('send-button');
    if (sendBtn) sendBtn.addEventListener('click', sendMessage);
    
    const videoBtn = document.getElementById('video-call-btn');
    if (videoBtn) videoBtn.addEventListener('click', startVideoCall);
    
    const fileInput = document.getElementById('file-input');
    if (fileInput) {
        fileInput.addEventListener('change', () => {
            const uploadBtn = document.getElementById('custom-file-upload');
            if (uploadBtn) uploadBtn.style.backgroundColor = '#e67e22';
        });
    }

    init();
})();