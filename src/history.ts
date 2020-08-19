import _ from "lodash";

export class History<T> {

    currGroup:number
    // currItem:number
    history: Item<T>[][]


    constructor() {
        this.currGroup=-1
        // this.currItem=-1
        this.history = new Array<Item<T>[]>()
    }

// add with timestamp. dynamically do time
    // stroke start
    // stroke stop

    //undo-- either to last stroke or timestamp
    //redo

    // api to retreive all data to be drawn
    getHistory(): T[][] {

        const out = _.map(this.history, function (group:Item<T>[]) {
            return _.map(group, function (i:Item<T>) {
                return i.obj
            })
        })

        return out;
    }

    startGroup(){
        this.history.push(new Array<Item<T>>())
        this.currGroup += 1
    }

    add(obj:T){
        this.history[this.currGroup].push({obj:obj, time:new Date()})
    }

    // stopGroup(){
    //     this.history
    // }
}

interface Item<T>{
    obj:T
    time:Date
}
