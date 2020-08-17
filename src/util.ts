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