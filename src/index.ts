import * as _ from 'lodash';
import $ from "jquery";
import * as p5 from "p5"
import Graphics from "p5"
import * as Clipboard from "clipboard";
import * as Util from "./util";
import {MyP5} from "./extension";
import {History} from "./history";
import {getSegmentId, pathTest} from "./page";
import {getUsername, hasSetUsername, INVALID_USERNAME_MSG, saveUsername, validUsername} from "./auth";
import {load, Segment, SketchData} from "./data";

const allP5s = new Array<p5>();

class ActiveDrawInfo {
    previousX: number
    previousY: number

    constructor(previousX: number, previousY: number) {
        this.previousX = previousX;
        this.previousY = previousY;
    }
}

function newSketchContainerEl() {
    let container = $("#sketchContainer")
    let sketchContainer = $('<span></span>')
    container.append(sketchContainer)
    return sketchContainer[0]
}

interface Drawn {
    //color, position, size
    // mode- draw/erase
    color: string
    position: number[]
    strokeWidth: number
    mode: string
}

const imageFormat = "image/png";
const imageQuality = 1.0
const DRAWMODE_DRAW = "Draw"
const DRAWMODE_ERASE = "Erase"

class Controller {

    container: HTMLElement
    sketch: MyP5
    loadedSegmentsMetadata: SketchData

    stage = Util.HEAD_STAGE
    p5cnv: p5.Renderer
    drawMode: string = DRAWMODE_DRAW
    penColor: string = "#000000" //hex string
    penSize: number = 5

    surfaceScalar = 1.0//const
    bufferWidth: number
    bufferHeight: number
    bufferHeightMid: number
    sectionWidth: number
    sectionHeight: number
    sectionHeightMid: number
    drawBuffer: p5.Graphics
    buffers = new Array<p5.Graphics>()

    activeDrawingInfo: ActiveDrawInfo = null

    debugText: string

    history: History<Drawn>

    constructor(sketch: MyP5, loadedSegmentsMetadata: SketchData, container: HTMLElement) {
        this.sketch = sketch;
        this.loadedSegmentsMetadata = loadedSegmentsMetadata;
        this.container = container
        this.history = new History<Drawn>()
    }

    setup() {
        this.p5cnv = this.sketch.createCanvas(800, 1200);
        this.sketch.background(0);

        this.loadData(this.sketch)

        $(window).on("unload", () => {
            this.Unload()
        });

        $(document.body).on("unload", () => {
            this.Unload()
        })

        $("a").on("click", () => {
            this.Unload()
        })

        if (this.stage === Util.END_STAGE || !hasSetUsername()) {
            this.sketch.noLoop()
        }

        if (hasSetUsername() && !pathTest("gallery")) {
            this.setupInstructions()
        }

        if (pathTest("gallery")) {
            this.setupGalleryMessage()
            return
        }

        $("#copyShareUrlBtn").click(() => {
            this.generateShareURL();
        })

        let controller = this
        $('input[type=radio][name="drawMode"]').on("click", function () {
            let input = this as HTMLInputElement
            if (input.checked && input.value === DRAWMODE_DRAW) {
                controller.drawMode = DRAWMODE_DRAW
            } else if (input.checked && input.value === DRAWMODE_ERASE) {
                controller.drawMode = DRAWMODE_ERASE
            }
        })

        $("#penSizeControlRange").on("change", function () {
            let input = this as HTMLInputElement
            controller.penSize = parseInt(input.value)
        })

        $("#penColor").on("change", function () {
            let input = this as HTMLInputElement
            controller.penColor = input.value
        })

        $("#undoButton").on("click", () => {
            this.history.undo()
        })
        $("#redoButton").on("click", () => {
            this.history.redo()
        })
    }

    private setupGalleryMessage() {
        const creatorsSentence = "Drawn by " + this.getCreatorsList() + "."
        const lastSegment = this.loadedSegmentsMetadata.lastSegment
        let url = this.createSegmentUrl(lastSegment.id);
        $(this.container).prepend('<p>' + creatorsSentence + ' <a href="' + url + '" target="_blank">Direct Link</a></p>')
    }

    private setupInstructions() {
        let instructions = ""
        if (hasSetUsername()) {
            switch (this.stage) {
                case Util.HEAD_STAGE:
                    instructions = "You are drawing the head in the top section. Be sure to draw hint lines for where the torso should connect in the middle section. When complete, save and copy the share URL and give it to the second artist.";
                    break;
                case Util.TORSO_STAGE:
                    instructions = "You are drawing the torso in the middle section. Be sure to connect your torso to the head using the hint lines given by the first artist. Similarly make sure to draw hints for where the legs should connect to your torso. When complete, save and copy the share URL and give it to the third artist.";
                    break;
                case Util.LEGS_STAGE:
                    instructions = "You are drawing the legs in the bottom section. Be sure to connect your legs to the torso hint lines given by the second artist. When complete, save and copy the final share URL and share it with all artists. This final URL will reveal the exquisite corpse.";
                    break;
                case Util.END_STAGE:
                    instructions = "Behold! The exquisite corpse is complete. "
            }

            var instrBoxEl = document.getElementById("stageInstructions")
            instrBoxEl.innerText = ""; // clear it
            var instrBox = $(instrBoxEl);
            instrBox.append('<p>' + instructions + '</p>')

            let isMobile = window.matchMedia("only screen and (max-width: 760px)").matches;

            if (isMobile) {
                //Conditional script here
                var mobile = "For the best mobile experience use landscape orientation."
                instrBox.append('<p>' + mobile + '</p>')
            }

            if (this.stage.id === Util.END_STAGE.id && this.loadedSegmentsMetadata !== null) {
                let creatorsSentence = "Drawn by " + this.getCreatorsList() + "."
                $(instrBox).append('<p>' + creatorsSentence + '</p>')
            }
        }
        // is missing username, default instructions notify user
    }

    private Unload() {
        for (var i = 0; i < this.buffers.length; ++i) {
            this.buffers[i].remove()
            // @ts-ignore
            this.buffers[i].canvas.height = 0
            // @ts-ignore
            this.buffers[i].canvas.width = 0
        }
        this.buffers = []
        this.sketch.remove()
        // @ts-ignore
        this.sketch.canvas.height = 0
        // @ts-ignore
        this.sketch.canvas.width = 0
        console.log("removed buffers and sketch")
    }

    private drawingAllowed() {
        return this.stage !== Util.END_STAGE
    }

    private dashedLine(sketch: p5, x1: number, y1: number, x2: number, y2: number, l: number, g: number) {
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

    draw() {
        const sketch = this.sketch
        const controller = this
        if (!this.sketch.focused) {
            // console.debug("lost focus removing mouse events")
            this.activeDrawingInfo = null
        }

        this.sketch.background(255)

        this.sketch.noSmooth()
        var i = 0
        _.each(this.buffers, function (buffer) {
            controller.sketch.image(buffer, 0, controller.sectionHeight * i, controller.sectionWidth, controller.sectionHeightMid)
            ++i
        })
        this.sketch.smooth()

        if (this.drawingAllowed()) {
            _.each(Util.stageSelections(), function (i: Util.Stage) {
                if (controller.stage.id > i.id) {
                    sketch.push()
                    sketch.fill("#DDD")
                    sketch.rect(0, controller.sectionHeight * i.id, sketch.width, controller.sectionHeight)
                    sketch.textSize(18);
                    sketch.fill("#000")
                    sketch.noStroke()
                    sketch.text("(" + i.name + " hidden)", sketch.width / 2 - 50, controller.sectionHeight * i.id + controller.sectionHeight / 2);
                    sketch.pop()
                }

                if (i.id != Util.Stages.HEAD) {
                    sketch.stroke(0, 0, 255)
                    sketch.strokeWeight(2)
                    // sketch.line(0, sectionHeight * i, sketch.width, sectionHeight * i)
                    controller.dashedLine(sketch, 0, controller.sectionHeight * i.id, sketch.width, controller.sectionHeight * i.id, null, null)
                    if (controller.stage.id + 1 === i.id) {
                        sketch.noStroke()
                        sketch.fill(0, 0, 255)
                        sketch.textSize(12)
                        sketch.text("Draw hint lines below this line", 3, 12 + 2 + controller.sectionHeight * i.id)
                    }
                }
            })
        }

        this.recordDrawStroke()

        this.drawAll()

        if (this.debugText) {
            sketch.push()
            sketch.textSize(10);
            sketch.fill("#000")
            sketch.noStroke()
            sketch.text(this.debugText, 10, 10)
            sketch.pop()
        }

        if (!this.drawingAllowed()) {
            // //remove all buffers to free memory
            // _.each(buffers, function (buffer) {
            //     buffer.remove()
            // })
            // buffers = null
            // console.log("cleared buffers")
            //todo why doesn't this work!?
            // unloadBuffers(buffers)
            for (var i = 0; i < this.buffers.length; ++i) {
                this.buffers[i].remove()
                // @ts-ignore
                this.buffers[i].canvas.height = 0
                // @ts-ignore
                this.buffers[i].canvas.width = 0
            }
            this.buffers = []
        }
    }

    recordDrawStroke() {
        // user drawing logic:
        if (this.drawingAllowed() && this.activeDrawingInfo !== null) {
            //do drawing
            let drawSize = this.penSize
            let penColor = this.penColor

            // draw the pen cursor
            this.sketch.push()
            this.sketch.noFill()
            this.sketch.stroke(0)
            // this.sketch.translate(-drawSize/2, -drawSize/2)
            this.sketch.ellipse(this.sketch.mouseX, this.sketch.mouseY, drawSize, drawSize)
            this.sketch.pop()

            // draw upon the first time the user clicks
            if (this.activeDrawingInfo.previousX !== null && this.sketch.movedX === 0 && this.sketch.movedY === 0) {
                return
            }

            let xy = null
            if (this.sketch.touches && this.sketch.touches.length > 0) {

                let px = this.activeDrawingInfo.previousX;
                let py = this.activeDrawingInfo.previousY;
                // @ts-ignore
                if (px === null) px = this.sketch.touches[0].x
                // @ts-ignore
                if (py === null) py = this.sketch.touches[0].y

                // @ts-ignore
                xy = this.getLocalPosition(this.stage.id, [px, py, this.sketch.touches[0].x, this.sketch.touches[0].y])

                // @ts-ignore
                this.activeDrawingInfo.previousX = this.sketch.touches[0].x
                // @ts-ignore
                this.activeDrawingInfo.previousY = this.sketch.touches[0].y
            } else {
                xy = this.getLocalPosition(this.stage.id, [this.sketch.pmouseX, this.sketch.pmouseY, this.sketch.mouseX, this.sketch.mouseY])

                this.activeDrawingInfo.previousX = this.sketch.mouseX
                this.activeDrawingInfo.previousY = this.sketch.mouseY
            }

            let drawn: Drawn = {
                color: penColor,
                strokeWidth: drawSize,
                position: xy,
                mode: this.drawMode
            }
            this.history.add(drawn)
        }
    }

    private drawAll() {
        if (!this.drawingAllowed()) {
            return
        }
        this.drawBuffer.clear()
        const drawHistory = this.history.getHistory()
        for (let i = 0; i < drawHistory.length; i++) {
            const group = drawHistory[i]
            let px = group[0].position[0],
                py = group[0].position[1],
                drawSize = 0,
                penColor = ""
            for (let j = 0; j < group.length; j++) {
                const item = group[j]
                drawSize = item.strokeWidth
                penColor = item.color
                if (item.mode === DRAWMODE_DRAW) {
                    this.drawBuffer.push()
                    this.drawBuffer.fill(0)
                    this.drawBuffer.stroke(penColor)
                } else if (item.mode === DRAWMODE_ERASE) {
                    // @ts-ignore
                    this.drawBuffer.erase()
                    this.drawBuffer.push()
                    this.drawBuffer.fill(0)
                    this.drawBuffer.stroke(0)
                }
                this.drawBuffer.strokeWeight(drawSize)
                this.drawBuffer.line(px, py, item.position[0], item.position[1])
                this.drawBuffer.pop()
                // @ts-ignore
                this.drawBuffer.noErase()

                px = item.position[0]
                py = item.position[1]
            }
        }
    }

    private generateShareURL() {
        if (this.stage === Util.END_STAGE) {
            return
        }

        function serialize(buf: Graphics) {
            // @ts-ignore
            var data = buf.canvas.toDataURL(imageFormat, imageQuality);
            return data
        }

        let latestBufferData = serialize(this.buffers[this.stage.id])

        let gameId = getSegmentId()
        let path = "/api/v1/segments/"

        if (gameId !== null) {
            path = path + gameId;
        }
        let controller = this
        $.ajax({
            method: "POST",
            url: path,
            data: latestBufferData,
            beforeSend: function (xhr, settings) {
                xhr.setRequestHeader("Content-Type", "image/png")
            }
        }).fail(function (e) {
            console.error("failed to save segment ", gameId)
        }).done(function (data) {
            let gameIdNew = data.id
            const url = controller.createSegmentUrl(gameIdNew)

            var copyText = document.getElementById("shareUrl") as HTMLInputElement;
            copyText.value = url;


            var oldEditable = copyText.contentEditable
            var oldReadonly = copyText.readOnly
            copyText.contentEditable = "true"
            copyText.readOnly = false
            /* Select the text field */
            copyText.select();
            copyText.setSelectionRange(0, 99999); /*For mobile devices*/
            /* Copy the text inside the text field */
            copyText.contentEditable = oldEditable
            copyText.readOnly = oldReadonly
            document.execCommand("copy");
        });
    }

    private createSegmentUrl(segmentId: string): string {
        return new URL(window.location.protocol + "//" + window.location.host + "/game/" + segmentId).href;

    }

    private iosCopyToClipboard(el: HTMLInputElement) {
        var oldContentEditable = el.contentEditable,
            oldReadOnly = el.readOnly,
            range = document.createRange();

        el.contentEditable = "true";
        el.readOnly = false;
        range.selectNodeContents(el);

        var s = window.getSelection();
        s.removeAllRanges();
        s.addRange(range);

        el.setSelectionRange(0, 999999); // A big number, to cover anything that could be inside the element.

        el.contentEditable = oldContentEditable;
        el.readOnly = oldReadOnly;

        document.execCommand('copy');
    }

    keyPressed() {

    }

    keyReleased() {
        if (!this.drawingAllowed()) return


        if (this.sketch.key === 'd' || this.sketch.key === 'D') {
            this.drawMode = DRAWMODE_DRAW
            $('#drawModeDraw')[0].setAttribute("checked", "true")
            $('#drawModeErase')[0].removeAttribute("checked")
        }

        if (this.sketch.key === 'e' || this.sketch.key === 'E') {
            this.drawMode = DRAWMODE_ERASE
            $('#drawModeDraw')[0].removeAttribute("checked")
            $('#drawModeErase')[0].setAttribute("checked", "true")
        }

        // undo behavior
        if (this.sketch.key === 'z' || this.sketch.key === 'Z') {
            this.history.undo()
        }

        // redo behavior
        if (this.sketch.key === 'r' || this.sketch.key === 'R') {
            this.history.redo()
        }
    }

    mousePressed = (e: object | undefined) => {
        if (this.drawingAllowed() && this.mouseEventOnCanvas(e)) {
            console.debug("mouse pressed")
            this.startDrawing()
            return false
        }
    }

    mouseReleased(e: object | undefined) {
        if (!this.drawingAllowed()) return
        console.debug('mouse released')
        this.stopDrawing()
    }

    touchReleased(e: object | undefined) {
        if (!this.drawingAllowed()) return
        console.debug('touch released')
        this.stopDrawing()
    }

    private touchStartedImpl(e: any) {
        if (this.drawingAllowed() && this.mouseEventOnCanvas(e)) {
            console.debug("touch started canvas")
            this.startDrawing()
            return false
        }
    }

    touchStarted(e: object | undefined) {
        if (!this.drawingAllowed()) return
        console.debug("touch started")
        return this.touchStartedImpl(e)
    }

    touchMoved(e: object | undefined) {
        if (!this.drawingAllowed()) return
        let on = this.mouseEventOnCanvas(e)
        if (on && this.sketch.touches && this.sketch.touches.length > 1) {
            // console.log("multiple touches allowing zooming default")
            this.stopDrawing()
            return true// allow default and don't allow drawing
        } else {
            return !on
        }
    }

    private startDrawing() {
        this.history.startGroup()
        this.activeDrawingInfo = new ActiveDrawInfo(null, null)
    }

    private stopDrawing() {
        this.activeDrawingInfo = null
    }

    private getLocalPosition(i: number, se: number[]) {
        return [se[0], se[1] - i * this.sectionHeight, se[2], se[3] - i * this.sectionHeight]
    }

    private mouseEventOnCanvas(e: any) {
        let cvsEl = $(".p5Canvas")[0]
        // mouse event
        let target = e.explicitOriginalTarget
        if (!target) {
            //e.target is for touch event
            target = e.target
            if (!target) {
                console.error("Cannot find mouse or touch event target")
            }
        }
        return target === cvsEl
    }

    mouseDragged(e: object | undefined) {
        if (!this.drawingAllowed()) return
        console.debug("mouse dragged")
        return !this.mouseEventOnCanvas(e)
    }

    private loadData(sketch: p5) {
        // setup buffer and draw area sizes
        let midEdgeScalar = 0.07
        this.sectionWidth = sketch.width
        this.sectionHeight = Math.floor(sketch.height / 3)
        this.sectionHeightMid = this.sectionHeight + this.sectionHeight * midEdgeScalar

        this.bufferWidth = Math.floor(sketch.width * this.surfaceScalar)
        this.bufferHeight = Math.floor(sketch.height / 3 * this.surfaceScalar)
        let bufferHeightEdge = Math.floor(this.bufferHeight * midEdgeScalar)
        this.bufferHeightMid = this.bufferHeight + bufferHeightEdge

        const controller = this
        if (this.loadedSegmentsMetadata) {

            let sortedSegments = controller.loadedSegmentsMetadata.segments

            var i = 0
            _.each(sortedSegments, function (segment: Segment) {
                let imgHolder = $("#imageDataLoader" + segment.id)
                if (imgHolder.length === 0) {
                    return
                }
                controller.stage = Util.stageFromId((i) + 1)


                controller.buffers.push(sketch.createGraphics(controller.bufferWidth, controller.bufferHeightMid)) //todo get this height figure out
                controller.buffers[i].clear()

                let img = document.getElementById("imageDataLoader" + segment.id)
                // @ts-ignore
                controller.buffers[i].canvas.getContext("2d").drawImage(img, 0, 0, controller.bufferWidth, controller.bufferHeightMid)//, bufferWidth, bufferHeightMid)
                i += 1
                img.remove()

            })
        }
        if (this.stage !== Util.END_STAGE) {
            //draw buffer
            this.drawBuffer = sketch.createGraphics(this.bufferWidth, this.bufferHeightMid)
            this.buffers.push(this.drawBuffer)
            this.drawBuffer.clear()
        }
    }

    private arrayToSentence(arr: string[]) {
        var last = arr.pop();
        return arr.join(', ') + ' and ' + last;
    }

    private getCreatorsList() {
        let creators = _.map(this.loadedSegmentsMetadata.segments, function (s: Segment) {
            return s.creator
        })

        creators = _.uniq(creators)
        if (creators.length > 1) {
            return this.arrayToSentence(creators.reverse())
        } else {
            return creators[0]
        }
    }
}

function newSketch(loadedSegmentsMetadata: SketchData, containerEl: HTMLElement) {
    const sketchHolderNew = (sketch: MyP5) => {
        const controller = new Controller(sketch, loadedSegmentsMetadata, containerEl)
        sketch.setup = () => {
            controller.setup()
        }
        sketch.draw = () => {
            controller.draw()
        }
        sketch.keyPressed = () => {
            controller.keyPressed()
        }
        sketch.keyReleased = () => {
            controller.keyReleased()
        }
        sketch.mouseReleased = (e) => {
            controller.mouseReleased(e)
        }
        sketch.mousePressed = (e) => {
            controller.mousePressed(e)
        }
        // @ts-ignore
        sketch.touchReleased = (e) => {
            controller.touchReleased(e)
        }
        sketch.touchStarted = (e) => {
            controller.touchStarted(e)
        }
        sketch.touchMoved = (e) => {
            return controller.touchMoved(e)
        }
        sketch.mouseDragged = (e) => {
            return controller.mouseDragged(e)
        }
    }
    const thisp5 = new MyP5(sketchHolderNew, containerEl);
    allP5s.push(thisp5)
}

new Clipboard('#shareUrlCopyBtn');

$("#saveSetUsernameBtn").on("click", function () {
    var username = ($("#usernameEnteredText")[0] as HTMLInputElement).value
    if (!validUsername(username)) {
        alert(INVALID_USERNAME_MSG)
        location.reload()
        return
    }
    saveUsername(username)
    location.reload();
})

function main() {

    if (hasSetUsername()) {
        const usernameValue = getUsername();
        ($("#usernameValueContainer")[0] as HTMLInputElement).value = "User: " + usernameValue
    }

    if (pathTest("about")) {
        return
    }

    const datas = load()
    if (datas === null) {
        newSketch(null, newSketchContainerEl())
    } else {
        _.each(datas, function (data) {
            newSketch(data, newSketchContainerEl())
        })
    }
}

main()