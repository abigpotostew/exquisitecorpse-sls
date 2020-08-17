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

