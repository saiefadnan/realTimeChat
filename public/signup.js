document.getElementById('profile-pic').addEventListener('change',(event)=>{
        const image = document.getElementById('profile-container').querySelector('img');
        const avatar = event.target.files[0];
        if(avatar){
            const reader = new FileReader();
            reader.onload = function(e){
                image.src = e.target.result;
            }
            reader.readAsDataURL(avatar);
        }

})

document.getElementById('registerButton').addEventListener('click',async(e)=>{
    e.preventDefault();
    const avatar = document.getElementById('profile-pic');
    const email = document.getElementById('emailInput').value;
    const username = document.getElementById('usernameInput').value;
    const password = document.getElementById('passwordInput').value;
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
                const {signin,notify,username,imageurl} = await fetchData('/api/signin',reqData);
                if(signin){
                    shownote(notify,username,imageurl);
                }
                else{
                    showerror(notify);
                }
            }
            reader.readAsDataURL(profile);
        }else{
            const {signin,notify,username,imageurl} = await fetchData('/api/signin',reqData);
                if(signin){
                    shownote(notify,username,imageurl);
                }
            else{
                showerror(notify);
            }
        }
    }
})

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