(function(){
    const profile = document.getElementById('profile-pic');
    const signup = document.getElementById('signup-button');

    function Profile(event){
        const image = document.getElementById('profile-container').querySelector('img');
        const avatar = event.target.files[0];
        if(avatar){
            const reader = new FileReader();
            reader.onload = function(e){
                image.src = e.target.result;
            }
            reader.readAsDataURL(avatar);
        }
    }
    profile.addEventListener('change', Profile);
    window.eventListeners.push({element: profile, event: 'change', handler: Profile});

    async function Signup(e){
        e.preventDefault();
        const avatar = document.getElementById('profile-pic');
        const email = document.getElementById('email').value;
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        const profile = avatar.files[0];
        const reqData ={
            email: email,
            username: username,
            password: password,
            profile: profile?{ 
                name: profile.name, 
                type: profile.type 
            }:false
        }
        if(!email.trim()){
            showerror('Email is missing');
        }
        else if(!username.trim()){
            showerror('Username is missing');
        }
        else if(!password.trim()){
            showerror('Password is missing');
        }
        else{
            if (window.socket && window.socket.connected) {
                window.socket.disconnect();
            } 
            if(profile){
                const reader = new FileReader();
                reader.onload = async() => {
                const fileData = reader.result.split(',')[1];
                reqData.profile.data = fileData;
                    const {signin,notify,token} = await fetchData('/api/signin',reqData);
                    if(signin){
                        Cookies.set('token', token, { expires: 30, secure: true, sameSite: 'Strict' });
                        shownote(notify);
                    }
                    else{
                        showerror(notify);
                    }
                }
                reader.readAsDataURL(profile);
            }else{
                const {signin,notify,token} = await fetchData('/api/signin',reqData);
                    if(signin){
                        Cookies.set('token', token, { expires: 30, secure: true, sameSite: 'Strict' });
                        shownote(notify);
                    }
                else{
                    showerror(notify);
                }
            }
        }
    }
    signup.addEventListener('click', Signup);
    window.eventListeners.push({element: signup, event: 'click', handler: Signup});

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

})();