(function () {
    const profileInput = document.getElementById('profile-pic');
    const signupForm = document.getElementById('signup-form');
    const signupBtn = document.getElementById('signup-button');
    const errorBox = document.getElementById('error-box');
    const previewImg = document.getElementById('profile-container').querySelector('img');

    // Dynamically import helper
    import('./loadfunc.js').then(({ updateNavState }) => {

        function handleProfilePreview(event) {
            const file = event.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (e) => { previewImg.src = e.target.result; };
                reader.readAsDataURL(file);
            }
        }
        profileInput.addEventListener('change', handleProfilePreview);
        window.eventListeners.push({ element: profileInput, event: 'change', handler: handleProfilePreview });

        async function handleSignup(e) {
            e.preventDefault();

            const email = document.getElementById('email').value.trim();
            const username = document.getElementById('username').value.trim();
            const password = document.getElementById('password').value.trim();
            const profileFile = profileInput.files[0];

            if (!email) return showError('Email is required');
            if (!username) return showError('Username is required');
            if (!password) return showError('Password is required');

            // Loading state
            signupBtn.disabled = true;
            signupBtn.textContent = 'Creating Account...';
            errorBox.style.display = 'none';

            if (window.socket && window.socket.connected) {
                window.socket.disconnect();
            }

            const reqData = { email, username, password, profile: false };

            const performSignup = async (data) => {
                try {
                    const { signin: success, notify, token } = await window.fetchData('/api/signin', data);
                    if (success) {
                        Cookies.set('token', token, { expires: 30, secure: true, sameSite: 'Strict' });
                        showNote(notify);
                        updateNavState(true);
                    } else {
                        showError(notify);
                    }
                } catch (err) {
                    showError('Connection error. Please try again later.');
                } finally {
                    signupBtn.disabled = false;
                    signupBtn.textContent = 'Signup';
                }
            };

            if (profileFile) {
                const reader = new FileReader();
                reader.onload = async () => {
                    reqData.profile = {
                        name: profileFile.name,
                        type: profileFile.type,
                        data: reader.result.split(',')[1]
                    };
                    await performSignup(reqData);
                };
                reader.readAsDataURL(profileFile);
            } else {
                await performSignup(reqData);
            }
        }

        signupForm.addEventListener('submit', handleSignup);
        window.eventListeners.push({ element: signupForm, event: 'submit', handler: handleSignup });

        function showError(msg) {
            errorBox.style.display = 'block';
            errorBox.style.color = 'crimson';
            errorBox.textContent = msg;
        }

        function showNote(msg) {
            errorBox.style.display = 'block';
            errorBox.style.color = '#2ecc71';
            errorBox.textContent = msg;
            setTimeout(() => window.loadPage('chat.html', 'chat'), 1000);
        }
    });

})();
