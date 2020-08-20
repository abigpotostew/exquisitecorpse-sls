import * as p5 from "p5";

// why doesn't this work in the uload section
function unloadBuffers(buffers: p5.Graphics[]){
    for (var i = 0; i < buffers.length; ++i) {
        buffers[i].remove()
        // @ts-ignore
        buffers[i].canvas.height = 0
        // @ts-ignore
        buffers[i].canvas.width = 0
    }
    //pop all
}

export enum Stages {
    HEAD,
    TORSO,
    LEGS,
    END
}

export interface Stage {
    id: number
    name: string
}

export const HEAD_STAGE = {
    id: Stages.HEAD,
    name: "Head"
}
export const TORSO_STAGE = {
    id: Stages.TORSO,
    name: "Torso"
}
export const LEGS_STAGE = {
    id: Stages.LEGS,
    name: "Legs"
}
export  const END_STAGE = {
    id: Stages.END,
    name: "End"
}

export  function stageFromId(i: number): Stage {
    return [HEAD_STAGE, TORSO_STAGE, LEGS_STAGE, END_STAGE][i]
}

export function stageSelections(): Array<Stage> {
    return [HEAD_STAGE, TORSO_STAGE, LEGS_STAGE]
}


export function dashedLine(sketch: p5, x1: number, y1: number, x2: number, y2: number, l: number, g: number) {
    var pc = sketch.dist(x1, y1, x2, y2) / 100;
    var pcCount = 1;

    var lPercent, gPercent = 0;
    var currentPos = 0;
    var xx1, yy1, xx2, yy2 = 0;

    while (sketch.int(pcCount * pc) < l) {
        pcCount++
    }
    lPercent = pcCount;
    pcCount = 1;
    while (sketch.int(pcCount * pc) < g) {
        pcCount++
    }
    gPercent = pcCount;

    lPercent = lPercent / 100;
    gPercent = gPercent / 100;
    while (currentPos < 1) {
        xx1 = sketch.lerp(x1, x2, currentPos);
        yy1 = sketch.lerp(y1, y2, currentPos);
        xx2 = sketch.lerp(x1, x2, currentPos + lPercent);
        yy2 = sketch.lerp(y1, y2, currentPos + lPercent);
        if (x1 > x2) {
            if (xx2 < x2) {
                xx2 = x2;
            }
        }
        if (x1 < x2) {
            if (xx2 > x2) {
                xx2 = x2;
            }
        }
        if (y1 > y2) {
            if (yy2 < y2) {
                yy2 = y2;
            }
        }
        if (y1 < y2) {
            if (yy2 > y2) {
                yy2 = y2;
            }
        }

        sketch.line(xx1, yy1, xx2, yy2);
        currentPos = currentPos + lPercent + gPercent;
    }
}