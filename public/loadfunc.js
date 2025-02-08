function cleanUp(existingScript){
    // console.log(window.eventListeners.length);
    existingScript.remove();
    window.eventListeners.forEach(({element, event, handler}) => {
        element.removeEventListener(event,handler);
    });
    window.eventListeners.length = 0;
    const page = document.getElementById('page');
    if(page){
        while(page.firstChild){
            page.removeChild(page.firstChild);
        }
    }
    //('clean....');
}
function closeAllSockets(socket){
    console.log('all sockets closing...');
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
    socket.off('room-created');
    socket.off('invited');
    socket.off('room message');
    socket.off('invitation');
    socket.off('room file');
}
export function loadPage(content,element=null){
    const page= `dynamic_${content.replace('.html','')}_91235.html`;
    fetch(page)
    .then(response=>{
        if(!response.ok){
            throw new Error('Network status not good',response.statusText);
        }
        return response.text();
    })
    .then(data=>{
            const script = document.createElement('script');
            const Script = page.replace('.html','.js');
            const existingScripts = document.querySelectorAll('script');
            if(existingScripts){
                existingScripts?.forEach((existingScript)=>{
                    const srcName = existingScript?.getAttribute('src');
                    if(srcName && srcName.includes('dynamic_') && srcName.includes('_91235')){
                        cleanUp(existingScript);
                        if(window.socket) closeAllSockets(window.socket);
                    }
                })
            }
            
            document.getElementById('page').innerHTML=data;
            script.src = Script;
            script.onload = () => {
                //console.log(`${Script} loaded successfully`);
            };
            script.onerror = (error) => {
                console.error('Error loading script', error);
            };
            if(element){
                const links = document.querySelectorAll('.tab');
                links.forEach((link)=>{link.classList.remove('clicked')});
                document.getElementById(element).classList.toggle('clicked');
            }
            document.body.appendChild(script);
            
    })
    .catch(error=>{
        console.error('Content fetched failed',error);
    })
}

export function toggleColor(element){
    //console.log('clicked..');
    const links = document.querySelectorAll('.tab');
    links.forEach((link)=>{link.classList.remove('clicked')});
    element.classList.toggle('clicked');
}

export function handleLogout(){
    Cookies.remove('token');
        window.loadPage('login.html','login');
        var logouts = document.getElementsByClassName('nav-logout');
        for (let logout of logouts) {
            logout.style.display = 'none';
        }

        var signups = document.getElementsByClassName('nav-signup');
        for (let signup of signups) {
            signup.style.display = 'block';
        }

        var logins = document.getElementsByClassName('nav-login');
        for (let login of logins) {
            login.style.display = 'block';
        }
        var chats = document.getElementsByClassName('nav-chat');
        for (let chat of chats) {
            chat.style.display = 'none';
        }
        var rooms = document.getElementsByClassName('nav-room');
        for (let room of rooms) {
            room.style.display = 'none';
        }
        var profileDivs = document.getElementsByClassName('circle responsive-img');
        Array.from(profileDivs).forEach((profileDiv)=>{
            profileDiv.src="https://gifdb.com/images/high/eren-yeager-blowing-hair-o63aaatimhxaojbu.gif";
        })
}