(function () {
    const loginBtn = document.getElementById('login-button');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const errorBox = document.getElementById('error-box');

    // Dynamically import helper to keep code clean and modular
    import('../js/loadfunc.js').then(({ updateNavState }) => {

        // Auth is handled by the navigation layer; removing redundant local check.


        async function handleLogin(e) {
            e.preventDefault();

            const email = emailInput.value.trim();
            const password = passwordInput.value.trim();

            if (!email) return showError('Email is missing');
            if (!password) return showError('Password is missing');

            // Feedback: Disable button and show loading state
            loginBtn.disabled = true;
            loginBtn.textContent = 'Authenticating...';
            errorBox.style.display = 'none';

            if (window.socket && window.socket.connected) {
                window.socket.disconnect();
            }

            try {
                const reqData = { email, password };
                const { login: success, notify, token } = await window.fetchData('/api/login', reqData);

                if (success) {
                    Cookies.set('token', token, { expires: 30, sameSite: 'Strict', secure: true });
                    showNote(notify);
                    updateNavState(true);
                    // Page transition handled in showNote
                } else {
                    showError(notify);
                }
            } catch (err) {
                showError('Network error. Please ensure the server is running.');
            } finally {
                loginBtn.disabled = false;
                loginBtn.textContent = 'Login';
            }
        }

        loginBtn.addEventListener('click', handleLogin);
        window.eventListeners.push({ element: loginBtn, event: 'click', handler: handleLogin });

        function showError(msg) {
            errorBox.style.display = 'block';
            errorBox.style.color = 'crimson';
            errorBox.textContent = msg;
        }

        function showNote(msg) {
            errorBox.style.display = 'block';
            errorBox.style.color = '#2ecc71'; // Industry green
            errorBox.textContent = msg;
            setTimeout(() => window.loadPage('chat.html', 'chat'), 800);
        }
    });

})();