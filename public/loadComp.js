document.addEventListener('DOMContentLoaded',()=>{
    var elems = document.querySelectorAll('.sidenav');
    var instances = M.Sidenav.init(elems);
    if(!Cookies.get('token')) window.loadPage('login.html');
    else window.loadPage('chat.html');
})