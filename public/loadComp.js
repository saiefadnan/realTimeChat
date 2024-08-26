document.addEventListener('DOMContentLoaded',()=>{
    if(!Cookies.get('token')) window.loadPage('login.html');
    else window.loadPage('chat.html');
})