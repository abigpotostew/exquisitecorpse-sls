import _ from "lodash";

// History tracks objects in groups. Groups can be undone and redone altogether.
export class History<T> {

    currGroup: number
    history: Item<T>[][]

    constructor() {
        this.currGroup = 0
        // this.currItem=-1
        this.history = new Array<Item<T>[]>()
    }

    // Undo's the current history group.
    undo() {
        this.currGroup -= 1
        if (this.currGroup < 0) {
            this.currGroup = 0
        }
    }

    // Redo's any previous undo's made since the last startGroup.
    redo() {
        if (this.currGroup < this.history.length) {
            this.currGroup += 1
        }
    }

    // Returns groups oldest to newest.
    getHistory(): T[][] {

        let active = _.slice(this.history, 0, this.currGroup)
        const out = _.map(active, function (group: Item<T>[]) {
            return _.map(group, function (i: Item<T>) {
                return i.obj
            })
        })

        return out;
    }

    // Create a new history group that will be "undone" in a group. Clears any previous undone groups.
    startGroup() {
        if (this.currGroup < this.history.length) {
            this.history = _.slice(this.history, 0, this.currGroup)
        }
        this.history.push(new Array<Item<T>>())
        this.currGroup += 1
    }

    // Add an object to the current group. Must call startGroup at least once before calling this.
    add(obj: T) {
        this.history[this.currGroup - 1].push({obj: obj, time: new Date()})
    }
}

interface Item<T> {
    obj: T
    time: Date
}
