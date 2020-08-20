export function hasSetUsername(): boolean {
    return document.cookie.split(';').some((item) => item.trim().startsWith('username='))
}

export function getUsername() {
    return decodeURI(document.cookie
        .split('; ')
        .find(row => row.startsWith('username'))
        .split('=')[1])
}

export const INVALID_USERNAME_MSG = "Username must be between 3 and 256 characters"
export function validUsername(username:string){
     return (username !== null && username.length > 3 && username.length < 256)
}

export function saveUsername(username: string){
    const encodedUsername = encodeURI(username)
    document.cookie = 'username=' + encodedUsername + ';path=/';
}