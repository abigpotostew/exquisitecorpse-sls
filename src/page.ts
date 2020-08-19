type PageNames = "index" | "gallery" | "about" | "game";

export function pathTest(page: PageNames): boolean {
    let regGame = new RegExp('^\/' + page + '$');
    return regGame.test(location.pathname)
}

export function getSegmentId(): string {
    let regGame = /^\/game\/(\w+)$/;
    if (regGame.test(location.pathname)) {
        //get game id
        return regGame.exec(location.pathname)[1];
    }
    return null
}