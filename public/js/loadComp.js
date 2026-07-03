document.addEventListener('DOMContentLoaded',()=>{
    var elems = document.querySelectorAll('.sidenav');
    var instances = M.Sidenav.init(elems);
    if(!Cookies.get('token')) {
        var logouts = document.getElementsByClassName('nav-logout');
        for (let logout of logouts) {
            logout.style.display = 'none';
        }
        var chats = document.getElementsByClassName('nav-chat');
        for (let chat of chats) {
            chat.style.display = 'none';
        }
        var rooms = document.getElementsByClassName('nav-room');
        for (let room of rooms) {
            room.style.display = 'none';
        }
        window.loadPage('login.html','login');
    }
    else {
        var signups = document.getElementsByClassName('nav-signup');
        for (let signup of signups) {
            signup.style.display = 'none';
        }
        var logins = document.getElementsByClassName('nav-login');
        for (let login of logins) {
            login.style.display = 'none';
        }
        window.loadPage('chat.html','chat');
        
    }
})