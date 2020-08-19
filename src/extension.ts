import * as p5 from "p5"

// MyP5 Adds some missing fields for @types/p5
export class MyP5 extends p5 {
    movedX: number;
    movedY: number;

    constructor(sketch: (...args: any[]) => any, node?: HTMLElement) {
        super(sketch, node)
    }
}