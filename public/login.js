(function(){
  const login = document.getElementById('loginButton');

  async function Login(e){
    e.preventDefault();
      const email = document.getElementById('logemailInput').value;
      const password = document.getElementById('logpasswordInput').value;
      if(!email.trim()){
          showerror('Email is missing');
      }
      else if(!password.trim()){
          showerror('Password is missing');
      }else{
        if (window.socket && window.socket.connected) {
          window.socket.disconnect();
        } 
          const reqData ={
              email: email,
              password: password
            }
            const {login,notify,username,imageurl} = await window.fetchData('/api/login',reqData);
            if(login){
              shownote(notify,username,imageurl);
            }
            else{
              showerror(notify);
            }
      }
  }


  login.addEventListener('click', Login);
  window.eventListeners.push({element: login, event: 'click', handler: Login});

  function showerror(field){
      const errorbox = document.getElementById('error-box');
      errorbox.style.display = 'block';
      errorbox.textContent = field;
  }

  function shownote(msg,username,imageurl){
      const errorbox = document.getElementById('error-box');
      errorbox.style.display = 'block';
      errorbox.style.color = 'green'
      errorbox.textContent = msg;
      sessionStorage.setItem('login','true');
      sessionStorage.setItem('username',username);
      sessionStorage.setItem('imageurl',imageurl);
      window.loadPage('chat.html');
  }

})()