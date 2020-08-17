import * as _ from 'lodash';
import $ from "jquery";
import * as p5 from "p5"
import Graphics from "p5"
import * as Clipboard from "clipboard";

const allP5s = new Array<p5>();

type PageNames = "index" | "gallery" | "about" | "game";

function pathTest(page: PageNames): boolean {
    let regGame = new RegExp('^\/' + page + '$');
    return regGame.test(location.pathname)
}

class ActiveDrawInfo {
    previousX: number
    previousY: number
    yo: string

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

function getSegmentId(): string {
    let regGame = /^\/game\/(\w+)$/;
    if (regGame.test(location.pathname)) {
        //get game id
        return regGame.exec(location.pathname)[1];
    }
    return null
}

interface Segment {
    parent: string,
    creator: string,
    order: number,
    id: string,
    sortBy: string,
    group: string
}

interface MyP5Funcs {
    // keyReleased(event?: object): void;
    // touchReleased(event?: object): void;
}

class MyP5 extends p5 implements MyP5Funcs{

    movedX: number;
    movedY: number;

    constructor(sketch: (...args: any[]) => any, node?: HTMLElement) {
        super(sketch, node)
    }

    // keyPressed = (event?: object): void => {
    // };
    // keyReleased = (event?: object): void => {
    // };
    // touchReleased = (event?: object): void => {
    // };
}

function hasSetUsername(): boolean {
    return document.cookie.split(';').some((item) => item.trim().startsWith('username='))
}

function newSketch(loadedSegmentsMetadata: Map<string, Segment>, containerEl: HTMLElement) {
    const sketchHolder = (sketch: MyP5) => {
        const imageFormat = "image/png";
        const imageQuality = 1.0

        enum Stages {
            HEAD,
            TORSO,
            LEGS,
            END
        }

        interface Stage {
            id: number
            name: string
        }

        const HEAD_STAGE = {
            id: Stages.HEAD,
            name: "Head"
        }
        const TORSO_STAGE = {
            id: Stages.TORSO,
            name: "Torso"
        }
        const LEGS_STAGE = {
            id: Stages.LEGS,
            name: "Legs"
        }
        const END_STAGE = {
            id: Stages.END,
            name: "End"
        }

        function stageFromId(i: number): Stage {
            return [HEAD_STAGE, TORSO_STAGE, LEGS_STAGE, END_STAGE][i]
        }

        function stageSelections(): Array<Stage> {
            return [HEAD_STAGE, TORSO_STAGE, LEGS_STAGE]
        }

        var stage = HEAD_STAGE
        var p5cnv

        const DRAWMODE_DRAW = "Draw"
        const DRAWMODE_ERASE = "Erase"
        var drawMode = DRAWMODE_DRAW

        const surfaceScalar = 1.0

        var bufferWidth: number
        var bufferHeight: number
        var bufferHeightMid: number
        var sectionWidth: number
        var sectionHeight: number
        var sectionHeightMid: number
        var drawBuffer: p5.Graphics
        var buffers = new Array<p5.Graphics>()

        //forward declaration

        var activeDrawingInfo: ActiveDrawInfo = null

        var debugText: string = null

        function setupInstructions() {

            let instructions = ""
            if (hasSetUsername()) {
                switch (stage) {
                    case HEAD_STAGE:
                        instructions = "You are drawing the head in the top section. Be sure to draw hint lines for where the torso should connect in the middle section. When complete, save and copy the share URL and give it to the second artist.";
                        break;
                    case TORSO_STAGE:
                        instructions = "You are drawing the torso in the middle section. Be sure to connect your torso to the head using the hint lines given by the first artist. Similarly make sure to draw hints for where the legs should connect to your torso. When complete, save and copy the share URL and give it to the third artist.";
                        break;
                    case LEGS_STAGE:
                        instructions = "You are drawing the legs in the bottom section. Be sure to connect your legs to the torso hint lines given by the second artist. When complete, save and copy the final share URL and share it with all artists. This final URL will reveal the exquisite corpse.";
                        break;
                    case END_STAGE:
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

                if (stage.id === END_STAGE.id && loadedSegmentsMetadata !== null) {
                    let creatorsSentence = "Drawn by " + getCreatorsList(loadedSegmentsMetadata) + "."
                    $(instrBox).append('<p>' + creatorsSentence + '</p>')
                }
            }
            // is missing username, default instructions notify user
        }

        function Unload() {
            for (var i = 0; i < buffers.length; ++i) {
                buffers[i].remove()
                // @ts-ignore
                buffers[i].canvas.height = 0
                // @ts-ignore
                buffers[i].canvas.width = 0
            }
            buffers = []
            sketch.remove()
            // @ts-ignore
            sketch.canvas.height = 0
            // @ts-ignore
            sketch.canvas.width = 0
            console.log("removed buffers and sketch")
        }

        sketch.setup = () => {
            p5cnv = sketch.createCanvas(800, 1200);
            sketch.background(0);

            loadData(sketch)

            $(window).on("unload", function (e) {
                Unload()
            });

            $(document.body).on("unload", function (e) {
                Unload()
            })

            $("a").on("click", function (e) {
                Unload()
            })

            if (stage === END_STAGE || !hasSetUsername()) {
                sketch.noLoop()
            }


            if (hasSetUsername() && !pathTest("gallery")) {
                setupInstructions()
            }

            $("#copyShareUrlBtn").click(function () {
                generateShareURL();
            })

            $('input[type=radio][name="drawMode"]').on("click",function () {
                let thi = this as HTMLInputElement
                if (thi.checked && thi.value === DRAWMODE_DRAW) {
                    drawMode = DRAWMODE_DRAW
                } else if (thi.checked && thi.value === DRAWMODE_ERASE) {
                    drawMode = DRAWMODE_ERASE
                }
            })

        };

        function drawingAllowed() {
            return stage !== END_STAGE
        }

        function dashedLine(sketch: p5, x1: number, y1: number, x2: number, y2: number, l: number, g: number) {
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

        sketch.draw = () => {
            if (!sketch.focused) {
                // console.debug("lost focus removing mouse events")
                activeDrawingInfo = null
            }

            sketch.background(255)

            sketch.noSmooth()
            var i = 0
            _.each(buffers, function (buffer) {
                sketch.image(buffer, 0, sectionHeight * i, sectionWidth, sectionHeightMid)
                ++i
            })
            sketch.smooth()

            if (drawingAllowed()) {
                _.each(stageSelections(), function (i: Stage) {
                    if (stage.id > i.id) {
                        sketch.push()
                        sketch.fill("#DDD")
                        sketch.rect(0, sectionHeight * i.id, sketch.width, sectionHeight)
                        sketch.textSize(18);
                        sketch.fill("#000")
                        sketch.noStroke()
                        sketch.text("(" + i.name + " hidden)", sketch.width / 2 - 50, sectionHeight * i.id + sectionHeight / 2);
                        sketch.pop()
                    }

                    if (i.id != Stages.HEAD) {
                        sketch.stroke(0, 0, 255)
                        sketch.strokeWeight(2)
                        // sketch.line(0, sectionHeight * i, sketch.width, sectionHeight * i)
                        dashedLine(sketch, 0, sectionHeight * i.id, sketch.width, sectionHeight * i.id, null, null)
                        if (stage.id + 1 === i.id) {
                            sketch.noStroke()
                            sketch.fill(0, 0, 255)
                            sketch.textSize(12)
                            sketch.text("Draw hint lines below this line", 3, 12 + 2 + sectionHeight * i.id)
                        }
                    }
                })
            }

            drawMouse()

            if (debugText) {
                sketch.push()
                sketch.textSize(10);
                sketch.fill("#000")
                sketch.noStroke()
                sketch.text(debugText, 10, 10)
                sketch.pop()
            }

            if (!drawingAllowed()){
                // //remove all buffers to free memory
                // _.each(buffers, function (buffer) {
                //     buffer.remove()
                // })
                // console.log("cleared buffers")
                // buffers = null
                for (var i = 0; i < buffers.length; ++i) {
                    buffers[i].remove()
                    // @ts-ignore
                    buffers[i].canvas.height = 0
                    // @ts-ignore
                    buffers[i].canvas.width = 0
                }
                buffers = []
            }
        };

        function drawMouse() {
            // user drawing logic:
            if (drawingAllowed() && activeDrawingInfo !== null) {
                //do drawing
                let drawSize = 5
                if (drawMode === DRAWMODE_DRAW) {
                    // drawBuffer.noErase()
                    drawBuffer.push()
                    console.debug("drawing stroke")
                    drawBuffer.fill(0)
                    drawBuffer.stroke(0)


                } else if (drawMode === DRAWMODE_ERASE) {
                    console.log("drawing erase")
                    // @ts-ignore
                    drawBuffer.erase()
                    drawBuffer.push()
                    drawBuffer.fill(0)
                    drawBuffer.stroke(0)
                    drawSize *= 2
                }
                // draw upon the first time the user clicks
                if (activeDrawingInfo.previousX !== null && sketch.movedX === 0 && sketch.movedY === 0) {
                    return
                }

                let xy = null
                if (sketch.touches && sketch.touches.length > 0) {
                    // sketch.mouseX, sketch.mouseY

                    // xy = getLocalPosition(stage, [sketch.touches[0].x, sketch.touches[0].y, sketch.touches[0].x, sketch.touches[0].y])
                    let px = activeDrawingInfo.previousX;
                    let py = activeDrawingInfo.previousY;
                    // @ts-ignore
                    if (px === null) px = sketch.touches[0].x
                    // @ts-ignore
                    if (py === null) py = sketch.touches[0].y

                    // @ts-ignore
                    xy = getLocalPosition(stage.id, [px, py, sketch.touches[0].x, sketch.touches[0].y])

                    // @ts-ignore
                    activeDrawingInfo.previousX = sketch.touches[0].x
                    // @ts-ignore
                    activeDrawingInfo.previousY = sketch.touches[0].y
                } else {
                    xy = getLocalPosition(stage.id, [sketch.pmouseX, sketch.pmouseY, sketch.mouseX, sketch.mouseY])

                    activeDrawingInfo.previousX = sketch.mouseX
                    activeDrawingInfo.previousY = sketch.mouseY
                }

                drawBuffer.strokeWeight(drawSize)
                drawBuffer.translate(-drawSize, -drawSize)
                drawBuffer.line(xy[0], xy[1], xy[2], xy[3])

                drawBuffer.pop()
                // @ts-ignore
                drawBuffer.noErase()
            }
        }

        sketch.keyPressed = () => {
            // @ts-ignore
            if (sketch.keyCode == 'r') {
                //reset?
            }
        }


        function generateShareURL() {
            if (stage === END_STAGE) {
                return
            }

            function serialize(buf: Graphics) {
                // @ts-ignore
                var data = buf.canvas.toDataURL(imageFormat, imageQuality);
                return data
            }

            let latestBufferData = serialize(buffers[stage.id])

            let gameId = getSegmentId()
            let path = "/api/v1/segments/"
            if (gameId !== null) {
                path = path + gameId;
            }
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
                const myUrlWithParams = new URL(window.location.protocol + "//" + window.location.host + "/game/" + gameIdNew);


                var copyText = document.getElementById("shareUrl") as HTMLInputElement;
                copyText.value = myUrlWithParams.href;


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

        function iosCopyToClipboard(el: HTMLInputElement) {
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


        sketch.keyReleased = () => {
            if (!drawingAllowed()) return


            if (sketch.key === 'd' || sketch.key === 'D') {
                drawMode = DRAWMODE_DRAW
                $('#drawModeDraw')[0].setAttribute("checked", "true")
                $('#drawModeErase')[0].removeAttribute("checked")
            }

            if (sketch.key === 'e' || sketch.key === 'E') {
                drawMode = DRAWMODE_ERASE
                $('#drawModeDraw')[0].removeAttribute("checked")
                $('#drawModeErase')[0].setAttribute("checked", "true")
            }

        }

        sketch.mousePressed = (e) => {
            if (drawingAllowed() && mouseEventOnCanvas(e)) {
                console.debug("mouse pressed")
                activeDrawingInfo = new ActiveDrawInfo(null, null)
                return false
            }
        }


        sketch.mouseReleased = (e) => {
            if (!drawingAllowed()) return
            console.debug('mouse released')
            activeDrawingInfo = null
        }

        // @ts-ignore
        sketch.touchReleased = (e) => {
            if (!drawingAllowed()) return
            console.debug('touch released')
            activeDrawingInfo = null
        }

        function touchStarted(e: any) {
            if (drawingAllowed() && mouseEventOnCanvas(e)) {
                console.debug("touch started canvas")
                activeDrawingInfo = new ActiveDrawInfo(null, null)
                return false
            }
        }

        sketch.touchStarted = (e) => {
            if (!drawingAllowed()) return
            console.debug("touch started")
            return touchStarted(e)
        }
        sketch.touchMoved = (e) => {
            if (!drawingAllowed()) return
            let on = mouseEventOnCanvas(e)
            if (on && sketch.touches && sketch.touches.length > 1) {
                // console.log("multiple touches allowing zooming default")
                activeDrawingInfo = null
                return true// allow default and don't allow drawing
            } else {
                return !on
            }
        }

        function getLocalPosition(i: number, se: number[]) {
            return [se[0], se[1] - i * sectionHeight, se[2], se[3] - i * sectionHeight]
        }

        function mouseEventOnCanvas(e: any) {
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

        sketch.mouseDragged = (e) => {
            if (!drawingAllowed()) return
            console.debug("mouse dragged")
            return !mouseEventOnCanvas(e)
        }

        function loadData(sketch: p5) {
            // setup buffer and draw area sizes
            let midEdgeScalar = 0.07
            sectionWidth = sketch.width
            sectionHeight = Math.floor(sketch.height / 3)
            sectionHeightMid = sectionHeight + sectionHeight * midEdgeScalar

            bufferWidth = Math.floor(sketch.width * surfaceScalar)
            bufferHeight = Math.floor(sketch.height / 3 * surfaceScalar)
            let bufferHeightEdge = Math.floor(bufferHeight * midEdgeScalar)
            bufferHeightMid = bufferHeight + bufferHeightEdge

            if (loadedSegmentsMetadata) {
                let idsOnly: string[] = []
                for (let l of loadedSegmentsMetadata.keys()) {
                    idsOnly.push(l)
                }
                let sortedSegments = _.sortBy(idsOnly, function (k: string) {
                    return loadedSegmentsMetadata.get(k).order
                })

                var i = 0
                _.each(sortedSegments, function (key: string) {
                    let imgHolder = $("#imageDataLoader" + key)
                    if (imgHolder.length === 0) {
                        return
                    }
                    stage = stageFromId((i) + 1)


                    buffers.push(sketch.createGraphics(bufferWidth, bufferHeightMid)) //todo get this height figure out
                    buffers[i].clear()

                    let img = document.getElementById("imageDataLoader" + key)
                    // @ts-ignore
                    buffers[i].canvas.getContext("2d").drawImage(img, 0, 0, bufferWidth, bufferHeightMid)//, bufferWidth, bufferHeightMid)
                    i += 1
                    img.remove()

                })
            }
            if (stage !== END_STAGE) {
                //draw buffer
                drawBuffer = sketch.createGraphics(bufferWidth, bufferHeightMid)
                buffers.push(drawBuffer)
                drawBuffer.clear()
            }
        }
    }
    const thisp5 = new MyP5(sketchHolder, containerEl);
    allP5s.push(thisp5)
}


function arrayToSentence(arr: string[]) {
    var last = arr.pop();
    return arr.join(', ') + ' and ' + last;
}

function getCreatorsList(loadedSegmentsMetadata: Map<string, Segment>) {
    let idsOnly: string[] = []
    for (let l of loadedSegmentsMetadata.keys()) {
        idsOnly.push(l)
    }
    let creators = _.map(idsOnly, function (k: string) {
        return loadedSegmentsMetadata.get(k).creator
    })
    creators = _.uniq(creators)
    if (creators.length > 1) {
        return arrayToSentence(creators.reverse())
    } else {
        return creators[0]
    }
}

// const sketchHolder =
new Clipboard('#shareUrlCopyBtn');

$("#saveSetUsernameBtn").on("click", function () {
    var username = ($("#usernameEnteredText")[0] as HTMLInputElement).value
    if (username === null || username.length < 3 || username.length > 256) {
        location.reload()
        throw new Error("Username must be between 3 and 256 characters")
    }

    var now = new Date();
    var time = now.getTime();
    var expireTime = time + 48 * 60 * 60 * 1000; //48 hours
    now.setTime(expireTime);
    document.cookie = 'username=' + username + ';expires=' + now.toUTCString() + ';path=/';

    location.reload();
})

function main() {

    // function loadSegments(segments:Map<String,Segment>, containerEl:HTMLElement) {
    //     _.each(segments, function (v:Segment,key:string,l?:any) {
    //         let s = v
    //         var oReq = new XMLHttpRequest();
    //         oReq.open("get", s.url, true);
    //         oReq.responseType = "text";
    //         oReq.onload = function (oEvent) {
    //
    //             var blob = oReq.response;
    //             $("body").append('<img class="hideFully" src="" id="imageDataLoader' + key + '">')
    //             let img = document.getElementById("imageDataLoader" + key)
    //             img.onload = function () {
    //                 console.log("finished loading image " + key)
    //                 segments[key].loaded=true
    //                 let allLoaded = _.every(_.keys(segments), function(i) {
    //                     return segments[i].loaded
    //                 })
    //                 if (allLoaded) {
    //                     console.log("sketch ready")
    //                     loadedSegmentsMetadata = segments
    //                     newSketch(segments, containerEl)
    //                 }
    //             }
    //             img.src = blob
    //
    //         };
    //         oReq.send(null);
    //     })
    // }

    function extractDataFromImg(img: HTMLImageElement): Segment {
        let el = $(img)
        let id = el.data("id")
        return {
            "parent": el.data("parent"),
            "creator": el.data("creator"),
            "order": el.data("order"),
            "id": id,
            "sortBy": id,
            "group": el.data("group")
        }
    }

    function loadSegmentsFromTemplate(containerEl: HTMLElement) {
        let segments = new Map<string, Segment>()
        // var i = 0
        let els = $('.imageDataLoader').each(function () {
            let data = extractDataFromImg(this as HTMLImageElement)
            segments.set(data.id, data)
        })
        newSketch(segments, containerEl)
    }


    function loadGallery(){
        // hide instructions
        // $("#instructionsContainer").addClass("hideFully")

        let allSegments :Segment[]=[]
        let allSegmentsKeyId = new Map<string,Segment>()
        let completeSegmentIds:string[] = []
        var i = 0
        let els = $('.imageDataLoader').each(function(){
            let data = extractDataFromImg(this as HTMLImageElement)
            allSegments.push(data)
            allSegmentsKeyId.set(data.id, data)
            if (data.order === 2){
                completeSegmentIds.push(data.id)
            }
        })
        completeSegmentIds.sort()

        let groupByGroup = _.groupBy(allSegments, function (s) {
            return s.group
        })

        // ordered by sort id
        _.each(completeSegmentIds, function (c:string) {
            let group = groupByGroup[allSegmentsKeyId.get(c).group]
            let segments = new Map<string,Segment>()
            for (let s of group){
                segments.set(s.id, s)
            }
            // let segments = _.indexBy(group, function(i){
            //     return i.id
            // })
            // let segments = groupByGroup[allSegmentsKeyId[c].group]
            newSketch(segments, newSketchContainerEl())
        })
    }

    function getUsername() {
        return document.cookie
            .split('; ')
            .find(row => row.startsWith('username'))
            .split('=')[1];
    }

    if (hasSetUsername()) {
        const usernameValue = getUsername();
        ($("#usernameValueContainer")[0] as HTMLInputElement).value = "User: " + usernameValue
    }


    if (pathTest("gallery")) {
        //do gallery
        loadGallery()
        return
    } else if (pathTest("about")) {
        return
    }

    const gameId = getSegmentId()
    if (gameId !== null) {
        loadSegmentsFromTemplate(newSketchContainerEl())
    } else {
        newSketch(null, newSketchContainerEl())
    }
}

main()