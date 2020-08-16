
function hasSetUsername():boolean {
    return document.cookie.split(';').some((item) => item.trim().startsWith('username='))
}