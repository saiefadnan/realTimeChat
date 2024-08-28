(function(){
  const login = document.getElementById('login-button');
  if(Cookies.get('token')){
    showerror('Seems like u are already logged in!');
  }
  async function Login(e){
    e.preventDefault();
      const email = document.getElementById('email').value;
      const password = document.getElementById('password').value;
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
            const {login,notify, token} = await window.fetchData('/api/login',reqData);
            if(login){
              Cookies.set('token', token, { expires: 30, secure: true, sameSite: 'Strict' });
              shownote(notify);
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

  function shownote(msg){
      const errorbox = document.getElementById('error-box');
      errorbox.style.display = 'block';
      errorbox.style.color = 'green'
      errorbox.textContent = msg;
      window.loadPage('chat.html', 'chat');
  }

})()