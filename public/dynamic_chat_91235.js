(async function () {
    let socket;
    const chunkSize = 512 * 1024;
    const listHeader = document.getElementById('list-header');
    const active = document.getElementById('active');
    const sendButton = document.getElementById('send-button');
    const messagesDiv = document.getElementById('chat-content');

    /**
     * Fetches chat history for the current user and populates the UI.
     */
    async function retrieveChat() {
        try {
            const reqData = { username: window.userInfo.username };
            const data = await window.fetchData('/api/getchats', reqData);

            const chatContent = document.getElementById('chat-content');
            if (chatContent) {
                chatContent.innerHTML = '';
            }

            if (data && data.chats) {
                data.chats.forEach(chat => {
                    const isSelf = (chat.sender === window.userInfo.username);
                    const timeStr = new Date(chat.timestamp).toLocaleString();

                    if (isSelf) {
                        if (chat.type !== 'text') embedDriveFilesTo(timeStr, chat.content);
                        else addMessageTo(chat.content, timeStr);
                    } else {
                        if (chat.type !== 'text') embedDriveFiles(timeStr, chat.sender, chat.content, chat.imageUrl);
                        else addMessage(chat.sender, chat.content, timeStr, chat.imageUrl);
                    }
                });
            }
        } catch (err) {
            console.error('[Chat] Failed to retrieve history:', err);
            addError('Failed to load chat history.');
        }
    }

    /**
     * Initializes Socket.IO connection and sets up identity registration.
     */
    async function connectWebSocket() {
        socket = io(); // Assign to outer scope 'socket' variable
        window.socket = socket;

        socket.on('connect', () => {
            console.log('[Socket] Connected');
            socket.emit('insert name', { jwtoken: Cookies.get('token') });
            addError('Connected');

            // Handle pending messages/files if any
            setTimeout(() => {
                const pending = window.PendingStore; // Assuming global store or logic
                if (pending && pending.status) {
                    if (pending.offset >= 0) sendChunks(pending.recipient, pending.file, pending.offset);
                    else sendMessage(pending.recipient, pending.content);
                }
            }, 5000);
        });

        // Initialize listeners once socket is connected
        setupSocketListeners();
    }

    function addPicture(picture) {
        const profileDivs = document.querySelectorAll('.circle.responsive-img');
        if (picture) {
            profileDivs.forEach((img) => { img.src = picture; });
        }
    }

    async function getUserInfo() {
        try {
            const reqData = { token: Cookies.get('token') };
            const data = await window.fetchData('/api/userData', reqData);
            if (data && data.userinfo) {
                // setUserInfo is globally available from userInfo.obf.js (which we unobfuscated)
                window.setUserInfo(data.userinfo.username, data.userinfo.imageurl);
                addPicture(data.userinfo.imageurl);
            }
        } catch (err) {
            console.error('[Chat] Failed to fetch user info:', err);
        }
    }

    // Startup Logic
    if (Cookies.get('token')) {
        const recipientInput = document.getElementById('recipientInput');
        if (recipientInput) recipientInput.value = 'public'; // Default to public

        await getUserInfo();
        await connectWebSocket();
        await retrieveChat();
        socket.emit('show active-users');
    }


    // Typing storage
    let typingTimer;
    let isTyping = false;
    const typingUsers = new Set();

    // UI Setup: Typing Indicator Box
    const chatContainer = document.getElementById('chat-container');
    const typingIndicator = document.createElement('div');
    typingIndicator.className = 'typing-indicator-box';
    typingIndicator.innerHTML = '<span id="typing-text"></span><div class="typing-dots"><span></span><span></span><span></span></div>';
    if (chatContainer) {
        chatContainer.insertBefore(typingIndicator, document.querySelector('.chat-footer'));
    }

    /**
     * Handles segmented file uploads for large images/videos.
     */
    function sendChunks(recipient, file, offset) {
        if (!socket || !socket.connected) {
            if (window.Pending) window.Pending(recipient, file, offset);
            return;
        }

        if (offset >= file.size) {
            window.updateUploadProgress(100, file.name);
            socket.emit('complete', { to: recipient, fileType: file.type, fileName: file.name });
            if (window.clearPending) window.clearPending();
            return;
        }

        const percent = (offset / file.size) * 100;
        window.updateUploadProgress(percent, file.name);

        const fileSlice = file.slice(offset, offset + chunkSize);
        const reader = new FileReader();

        reader.onload = () => {
            const payload = { fileData: reader.result, fileType: file.type, fileName: file.name };
            if (recipient !== 'public') payload.to = recipient;

            let eventName;
            if (file.type.startsWith('image/')) eventName = recipient === 'public' ? 'public image' : 'private image';
            else if (file.type.startsWith('video/')) eventName = recipient === 'public' ? 'public video' : 'private video';
            else eventName = recipient === 'public' ? 'public file' : 'private file';

            socket.emit(eventName, payload);
            sendChunks(recipient, file, offset + chunkSize);
        };

        reader.readAsArrayBuffer(fileSlice);
        document.getElementById('file-input').value = '';
    }

    async function _handleKeyPress(e) {
        if (e.key === "Enter") sendMessage();
    }

    async function sendMessage(rec = null, msg = null) {
        const recipientInput = document.getElementById('recipientInput');
        const messageInput = document.getElementById('message-input');
        const fileInput = document.getElementById('file-input');

        let recipient = recipientInput.value.trim();
        let message = messageInput.value.trim();

        if (rec && msg) {
            recipient = rec;
            message = msg;
        }

        if (recipient && message) {
            const date = new Date().toLocaleString();
            addMessageTo(message, date);

            if (!socket || !socket.connected) {
                if (window.Pending) window.Pending(recipient, message, -1);
                messageInput.value = '';
                return;
            }

            const event = (recipient === 'public') ? 'public message' : 'private message';
            const payload = (recipient === 'public') ? [message, date] : [{ to: recipient, message, date }];
            socket.emit(event, ...payload);
            messageInput.value = '';
        }

        const file = fileInput.files[0];
        if (file && recipient) {
            document.getElementById('custom-file-upload').style.backgroundColor = '#007bff';
            sendChunks(recipient, file, 0); // Reset offset to 0
        }
    }

    function setupSocketListeners() {
        socket.on('disconnect', () => {
            addError("Connection lost. Reconnecting...");
        });

        socket.on('private message', ({ from, time, message, profile }) => {
            addMessage(from, message, new Date(time).toLocaleString(), profile);
        });

        socket.on('public message', ({ from, time, message, profile }) => {
            addMessage(from, message, new Date(time).toLocaleString(), profile);
        });

        // Image/Video/File Handlers
        const mediaEvents = ['private image', 'private video', 'private file', 'public image', 'public video', 'public file'];
        mediaEvents.forEach(event => {
            socket.on(event, ({ from, time, fileData, profile, state }) => {
                if (!state) return;
                const date = new Date(time).toLocaleString();
                if (from === window.userInfo.username) embedDriveFilesTo(date, fileData);
                else embedDriveFiles(date, from, fileData, profile);
            });
        });

        socket.on('init activeUsers', ({ activeUsers, profile, moods }) => {
            const publicUrl = 'https://static.vecteezy.com/system/resources/thumbnails/001/760/457/small_2x/megaphone-loudspeaker-making-announcement-vector.jpg';
            active.innerHTML = '';
            const publicDiv = BuildActiveDiv(active, 'public', publicUrl); // Public room always first
            if (publicDiv) publicDiv.style.backgroundColor = '#2980b9'; // Default selection

            activeUsers.forEach((name, index) => {
                if (name !== 'public' && name !== window.userInfo.username) {
                    const mood = moods ? moods[index] : '';
                    BuildActiveDiv(active, name, profile[index], mood);
                }
            });
            updateStyles();
        });

        socket.on('activeUsers', ({ operation, name, photo, mood }) => {
            if (operation === 'add' || operation === 'update') {
                BuildActiveDiv(active, name, photo, mood);
            } else if (operation === 'remove') {
                RemoveActiveDiv(active, name);
            }
            updateStyles();
        });

        socket.on('user-typing', ({ from, to }) => {
            const currentRecipient = document.getElementById('recipientInput').value;
            if (to === 'public' && currentRecipient === 'public') {
                typingUsers.add(from);
                updateTypingUI();
            } else if (to === 'private' && currentRecipient === from) {
                typingUsers.add(from);
                updateTypingUI();
            }
        });

        socket.on('user-stop-typing', ({ from }) => {
            typingUsers.delete(from);
            updateTypingUI();
        });


        socket.on('error', ({ error }) => {
            if (error === '999') window.loadPage('login.html', 'login');
            else addError(error);
        });
    }

    // UI Helpers
    sendButton.addEventListener('click', sendMessage);
    const messageInput = document.getElementById('message-input');
    messageInput.addEventListener('keypress', _handleKeyPress);
    messageInput.addEventListener('input', () => {
        if (!isTyping) {
            isTyping = true;
            socket.emit('typing', { to: document.getElementById('recipientInput').value });
        }
        clearTimeout(typingTimer);
        typingTimer = setTimeout(() => {
            isTyping = false;
            socket.emit('stop-typing', { to: document.getElementById('recipientInput').value });
        }, 3000);
    });

    window.addEventListener('resize', updateStyles);

    // Mood Picker Logic
    const moodModal = document.getElementById('mood-modal');
    if (moodModal) {
        M.Modal.init(moodModal);
        const moodBtn = document.getElementById('mood-btn');
        if (moodBtn) {
            moodBtn.addEventListener('click', () => {
                M.Modal.getInstance(moodModal).open();
            });
        }

        document.querySelectorAll('.mood-option').forEach(opt => {
            opt.addEventListener('click', () => {
                const mood = opt.getAttribute('data-mood');
                socket.emit('update-mood', { mood });
                M.Modal.getInstance(moodModal).close();
                M.toast({ html: `Vibe set to ${mood}!`, classes: 'rounded' });
            });
        });
    }

    function updateTypingUI() {

        const textEl = document.getElementById('typing-text');
        if (typingUsers.size > 0) {
            const names = Array.from(typingUsers);
            textEl.textContent = names.length > 1 ? `${names[0]} and others are typing` : `${names[0]} is typing`;
            typingIndicator.style.display = 'flex';
        } else {
            typingIndicator.style.display = 'none';
        }
    }


    function updateStyles() {
        const isMobile = window.innerWidth < 1000;
        const listHeader = document.getElementById('list-header');
        if (listHeader) listHeader.textContent = isMobile ? '' : 'Active Homies';
        const userDivs = active.querySelectorAll('div');
        userDivs.forEach(div => {
            div.style.width = isMobile ? '70px' : '85%';
            div.style.margin = isMobile ? '5px' : '5px auto';
        });
    }

    function BuildActiveDiv(activeBar, name, profile_src, mood = '') {
        if (window.userInfo.username === name) return;

        // Prevent duplicates
        RemoveActiveDiv(activeBar, name);

        const userDiv = document.createElement('div');
        userDiv.className = 'active-pulse'; // Gen Z Glow
        const userNameDiv = document.createElement('h5');
        const profileImg = document.createElement('img');
        
        Object.assign(userDiv.style, {
            height: '70px',
            color: '#ccc',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1px solid var(--border)',
            borderRadius: '16px',
            cursor: 'pointer',
            backgroundColor: name === 'public' ? '#e74c3c' : '#111',
            transition: 'transform 0.2s ease',
            position: 'relative'
        });

        profileImg.src = profile_src || 'https://via.placeholder.com/60';
        Object.assign(profileImg.style, {
            width: '55px',
            height: '55px',
            borderRadius: '50%',
            border: '2px solid #555',
            objectFit: 'cover'
        });

        // Wrap image and badge in a relative container to prevent stretching
        const imgWrapper = document.createElement('div');
        imgWrapper.style.position = 'relative';
        imgWrapper.style.width = '55px';
        imgWrapper.style.height = '55px';
        imgWrapper.appendChild(profileImg);

        if (mood) {
            const moodBadge = document.createElement('div');
            moodBadge.className = 'mood-badge';
            moodBadge.textContent = mood;
            imgWrapper.appendChild(moodBadge);
        }

        userDiv.addEventListener('mouseover', () => { userDiv.style.transform = 'scale(0.95)'; });
        userDiv.addEventListener('mouseout', () => { userDiv.style.transform = 'scale(1)'; });
        userDiv.addEventListener('click', () => {
            document.getElementById('recipientInput').value = name;
            typingUsers.clear(); // Clear typing on switch
            updateTypingUI();
            active.querySelectorAll('div').forEach(d => {
                const head = d.querySelector('h5');
                if (head) {
                  const headName = head.textContent;
                  d.style.backgroundColor = headName === 'public' ? '#e74c3c' : '#111';
                }
            });
            userDiv.style.backgroundColor = '#2980b9';
        });

        userNameDiv.textContent = name;
        userNameDiv.style.display = 'none';

        userDiv.appendChild(imgWrapper);
        userDiv.appendChild(userNameDiv);
        activeBar.appendChild(userDiv);
        return userDiv;
    }




    function RemoveActiveDiv(activeBar, name) {
        const divs = activeBar.querySelectorAll('div');
        for (const div of divs) {
            const h5 = div.querySelector('h5');
            if (h5 && h5.textContent === name) {
                div.remove();
                break;
            }
        }
    }

    function addMessage(from, message, time, profile) {
        const finalContainer = document.createElement('div');
        finalContainer.className = 'final-container';

        const head = document.createElement('div');
        head.className = 'time-name-container';
        head.style.marginBottom = '2px';

        const nameLabel = document.createElement('span');
        nameLabel.textContent = from;
        nameLabel.style.fontWeight = 'bold';
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
        timeLabel.style.marginBottom = '2px';

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

    function addError(message) {
        const err = document.createElement('div');
        err.textContent = message;
        Object.assign(err.style, {
            color: message === 'Connected' ? '#2ecc71' : '#e74c3c',
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
        setTimeout(() => {
            err.style.opacity = '0';
            err.style.transition = 'opacity 1s';
            setTimeout(() => err.remove(), 1000);
        }, 3000);
    }

    function embedDriveFiles(time, from, file_id, profile) {
        const container = document.createElement('div');
        container.className = 'message-receive-container';
        container.style.flexDirection = 'column';
        container.style.alignItems = 'flex-start';
        container.style.padding = '10px';

        const header = document.createElement('div');
        header.style.display = 'flex';
        header.style.alignItems = 'center';
        header.style.gap = '10px';

        const img = document.createElement('img');
        img.src = profile;
        img.style.width = '40px';
        img.style.height = '40px';
        img.style.borderRadius = '50%';

        const info = document.createElement('div');
        const nameSpan = document.createElement('b');
        nameSpan.textContent = from;
        const timeSpan = document.createElement('small');
        timeSpan.textContent = ` ${time}`;
        timeSpan.style.color = '#777';
        info.append(nameSpan, timeSpan);

        header.append(img, info);

        const iframe = document.createElement('iframe');
        iframe.src = `https://drive.google.com/file/d/${file_id}/preview`;
        Object.assign(iframe.style, {
            width: '100%',
            maxWidth: '300px',
            height: '215px',
            border: 'none',
            marginTop: '5px',
            borderRadius: '8px',
            backgroundColor: '#000'
        });

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

        const timeLabel = document.createElement('small');
        timeLabel.textContent = time;
        timeLabel.style.color = '#777';

        const iframe = document.createElement('iframe');
        iframe.src = `https://drive.google.com/file/d/${file_id}/preview`;
        Object.assign(iframe.style, {
            width: '100%',
            maxWidth: '300px',
            height: '215px',
            border: 'none',
            marginTop: '5px',
            borderRadius: '8px',
            backgroundColor: '#000'
        });

        container.append(timeLabel, iframe);
        messagesDiv.appendChild(container);
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
    }

    const fileInputEl = document.getElementById('file-input');
    if (fileInputEl) {
        fileInputEl.addEventListener('change', () => {
            const uploadBtn = document.getElementById('custom-file-upload');
            if (uploadBtn) uploadBtn.style.backgroundColor = '#e67e22';
        });
    }
})();