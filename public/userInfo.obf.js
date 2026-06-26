/**
 * Sets the global user information in the browser window.
 * This is used to track the currently logged-in user and their profile picture.
 * @param {string} username - The username of the logged-in user.
 * @param {string} imageurl - The URL of the user's profile picture.
 */
export default function setUserInfo(username, imageurl) {
    if (!window.userInfo) {
        window.userInfo = {};
    }
    window.userInfo.status = !!username;
    window.userInfo.username = username;
    window.userInfo.imageurl = imageurl;
}