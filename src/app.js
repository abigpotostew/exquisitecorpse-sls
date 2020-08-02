import * as _ from 'lodash';

var allP5s = []
function newSketch(loadedSegmentsMetadata, containerEl) {
const sketchHolder = (sketch) => {
    const imageFormat = "image/png";
    const imageQuality = 1.0

    const HEAD_STAGE = 0
    const TORSO_STAGE = 1
    const LEGS_STAGE = 2
    const stageSections = [HEAD_STAGE, TORSO_STAGE, LEGS_STAGE]
    const stageNames = {
        [HEAD_STAGE]: "Head",
        [TORSO_STAGE]: "Torso",
        [LEGS_STAGE]: "Legs",
    }
    const END_STAGE = 3

    var stage = HEAD_STAGE
    var p5cnv

    const DRAWMODE_DRAW = "Draw"
    const DRAWMODE_ERASE = "Erase"
    var drawMode = DRAWMODE_DRAW

    const surfaceScalar = 1.0

    var bufferWidth
    var bufferHeight
    var bufferHeightMid
    var sectionWidth
    var sectionHeight
    var sectionHeightMid
    var drawBuffer
    var buffers = []

    //forward declaration
    var loadData

    var activeDrawingInfo = null

    var debugText=null

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

            if (stage === END_STAGE && loadedSegmentsMetadata !== null) {
                let creatorsSentence = "Drawn by " + getCreatorsList(loadedSegmentsMetadata) + "."
                $(instrBox).append('<p>' + creatorsSentence + '</p>')
            }
        }
        // is missing username, default instructions notify user
    }

    sketch.setup = () => {
        p5cnv = sketch.createCanvas(800, 1200);
        sketch.background(0);

        loadData(sketch)
        if (stage === END_STAGE || !hasSetUsername()) {
            sketch.noLoop()
        }

        if (hasSetUsername() && !isGallery()){
            setupInstructions()
        }

        $("#copyShareUrlBtn").click(function () {
            generateShareURL();
        })

        $('input:radio[name="drawMode"]').change(function () {
            if (this.checked && this.value === DRAWMODE_DRAW) {
                drawMode = DRAWMODE_DRAW
            } else if (this.checked && this.value === DRAWMODE_ERASE) {
                drawMode = DRAWMODE_ERASE
            }
        })
    };

    function drawingAllowed(){
        return stage !== END_STAGE
    }

    function dashedLine(sketch, x1, y1, x2, y2, l, g) {
        var pc = sketch.dist(x1, y1, x2, y2) / 100;
        var pcCount = 1;
        var lPercent = gPercent = 0;
        var currentPos = 0;
        var xx1 = yy1 = xx2 = yy2 = 0;

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
            _.each(stageSections, function (i) {
                if (stage > i) {
                    sketch.push()
                    sketch.fill("#DDD")
                    sketch.rect(0, sectionHeight * i, sketch.width, sectionHeight)
                    sketch.textSize(18);
                    sketch.fill("#000")
                    sketch.noStroke()
                    sketch.text("(" + stageNames[i] + " hidden)", sketch.width / 2 - 50, sectionHeight * i + sectionHeight / 2);
                    sketch.pop()
                }

                if (i!=0) {
                    sketch.stroke(0, 0, 255)
                    sketch.strokeWeight(2)
                    // sketch.line(0, sectionHeight * i, sketch.width, sectionHeight * i)
                    dashedLine(sketch, 0, sectionHeight * i, sketch.width, sectionHeight * i)
                    if (stage+1===i){
                        sketch.noStroke()
                        sketch.fill(0,0,255)
                        sketch.textSize(12)
                        sketch.text("Draw hint lines below this line", 3, 12+2+sectionHeight * i)
                    }
                }
            })
        }

        drawMouse()

        if (debugText){
            sketch.push()
            sketch.textSize(10);
            sketch.fill("#000")
            sketch.noStroke()
            sketch.text(debugText, 10,10)
            sketch.pop()
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
                if (px===null) px = sketch.touches[0].x
                if (py===null) py = sketch.touches[0].y
                xy = getLocalPosition(stage, [px, py, sketch.touches[0].x, sketch.touches[0].y])

                activeDrawingInfo.previousX = sketch.touches[0].x
                activeDrawingInfo.previousY = sketch.touches[0].y
            } else {
                xy = getLocalPosition(stage, [sketch.pmouseX, sketch.pmouseY, sketch.mouseX, sketch.mouseY])

                activeDrawingInfo.previousX = sketch.mouseX
                activeDrawingInfo.previousY = sketch.mouseY
            }

            drawBuffer.strokeWeight(drawSize)
            drawBuffer.translate(-drawSize, -drawSize)
            drawBuffer.line(xy[0], xy[1], xy[2], xy[3])

            drawBuffer.pop()
            drawBuffer.noErase()
        }
    }

    sketch.keyPressed = (e) => {
        if (e.key == 'r') {
            //reset?
        }
    }


    function generateShareURL() {
        if (stage === END_STAGE) {
            return
        }

        function serialize(buf) {
            var data = buf.canvas.toDataURL(imageFormat, imageQuality);
            return data
        }

        let latestBufferData = serialize(buffers[stage])

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



            var copyText = document.getElementById("shareUrl");
            copyText.value = myUrlWithParams.href;


            var oldEditable = copyText.contenteditable
            var oldReadonly = copyText.readonly
            copyText.contenteditable = "true"
            copyText.readonly = "false"
            /* Select the text field */
            copyText.select();
            copyText.setSelectionRange(0, 99999); /*For mobile devices*/
            /* Copy the text inside the text field */
            copyText.contenteditable = oldEditable
            copyText.readonly = oldReadonly
            document.execCommand("copy");
        });
    }

    function iosCopyToClipboard(el) {
        var oldContentEditable = el.contentEditable,
            oldReadOnly = el.readOnly,
            range = document.createRange();

        el.contentEditable = true;
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

    sketch.keyReleased = (e) => {
        if (!drawingAllowed()) return
        if (e.key === 'd' || e.key === 'D') {
            drawMode = DRAWMODE_DRAW
            $('#drawModeDraw')[0].setAttribute("checked", "true")
            $('#drawModeErase')[0].removeAttribute("checked")
        }
        if (e.key === 'e' || e.key === 'E') {
            drawMode = DRAWMODE_ERASE
            $('#drawModeDraw')[0].removeAttribute("checked")
            $('#drawModeErase')[0].setAttribute("checked", "true")
        }

    }

    sketch.mousePressed = (e) => {
        if (drawingAllowed() && mouseEventOnCanvas(e)) {
            console.debug("mouse pressed")
            activeDrawingInfo = {previousX:null, previousY:null}
            return false
        }
    }



    sketch.mouseReleased = (e) => {
        if (!drawingAllowed()) return
        console.debug('mouse released')
        activeDrawingInfo = null
    }
    sketch.touchReleased = (e) => {
        if (!drawingAllowed()) return
        console.debug('touch released')
        activeDrawingInfo = null
    }
    function touchStarted(e){
        if (drawingAllowed() && mouseEventOnCanvas(e)) {
            console.debug("touch started canvas")
            activeDrawingInfo = {previousX:null, previousY:null}
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
        if(on && sketch.touches && sketch.touches.length>1){
            return false
        }
        // console.debug("touch moved")
        return !on
    }

    function getLocalPosition(i, se) {
        return [se[0], se[1] - i * sectionHeight, se[2], se[3] - i * sectionHeight]
    }

    function mouseEventOnCanvas(e) {
        let cvsEl = $(".p5Canvas")[0]
        // mouse event
        let target = e.explicitOriginalTarget
        if (!target){
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

    loadData = function (sketch) {
        // setup buffer and draw area sizes
        let midEdgeScalar = 0.07
        sectionWidth = sketch.width
        sectionHeight = Math.floor(sketch.height / 3)
        sectionHeightMid = sectionHeight + sectionHeight * midEdgeScalar

        bufferWidth = Math.floor(sketch.width * surfaceScalar)
        bufferHeight = Math.floor(sketch.height / 3 * surfaceScalar)
        let bufferHeightEdge = Math.floor(bufferHeight * midEdgeScalar)
        bufferHeightMid = bufferHeight + bufferHeightEdge
        let sortedSegments = _.sortBy(_.keys(loadedSegmentsMetadata), function (k) {
            return loadedSegmentsMetadata[k].order
        })
        var i = 0
        _.each(sortedSegments, function (key) {
            let imgHolder = $("#imageDataLoader" + key)
            if (imgHolder.length === 0) {
                return
            }
            stage = (i) + 1


            buffers.push(sketch.createGraphics(bufferWidth, bufferHeightMid)) //todo get this height figure out
            buffers[i].clear()

            let img = document.getElementById("imageDataLoader" + key)
            buffers[i].canvas.getContext("2d").drawImage(img, 0, 0, bufferWidth, bufferHeightMid)//, bufferWidth, bufferHeightMid)
            i+=1
            img.remove()

        })
        if (stage !== END_STAGE) {
            //draw buffer
            drawBuffer = sketch.createGraphics(bufferWidth, bufferHeightMid)
            buffers.push(drawBuffer)
            drawBuffer.clear()
        }
    }
}
    // if (currentp5) currentp5.remove()
    let thisp5 = new p5(sketchHolder, containerEl);
    allP5s.push(thisp5)
}


function arrayToSentence(arr) {
    var last = arr.pop();
    return arr.join(', ') + ' and ' + last;
}

function getCreatorsList(loadedSegmentsMetadata){
    let creators = _.map(_.keys(loadedSegmentsMetadata), function (k) {
        return loadedSegmentsMetadata[k].creator
    })
    creators = _.uniq(creators)
    if (creators.length > 1){
        return arrayToSentence(creators)
    }else{
        return creators[0]
    }
}

// const sketchHolder =
new ClipboardJS('#shareUrlCopyBtn');

$("#saveSetUsernameBtn").click(function () {
    var username = $("#usernameEnteredText")[0].value
    if (username === null || username.length < 3 || username.length > 256) {
        location.reload()
        throw new Error("Username must be between 3 and 256 characters")
    }

    var now = new Date();
    var time = now.getTime();
    var expireTime = time + 48 * 60 * 60 * 1000; //48 hours
    now.setTime(expireTime);
    document.cookie = 'username=' + username + ';expires=' + now.toGMTString() + ';path=/';

    location.reload();
})

function getSegmentId() {
    let regGame = /^\/game\/(\w+)$/;
    if (regGame.test(location.pathname)) {
        //get game id
        return regGame.exec(location.pathname)[1];
    }
    return null
}

function isGallery() {
     let regGame = /^\/gallery$/;
    return regGame.test(location.pathname)
}

function isAbout() {
    let regGame = /^\/about$/;
    return regGame.test(location.pathname)
}

function hasSetUsername() {
    return document.cookie.split(';').some((item) => item.trim().startsWith('username='))
}

function getUsername() {
    return document.cookie
        .split('; ')
        .find(row => row.startsWith('username'))
        .split('=')[1];
}

if (hasSetUsername()) {
    const usernameValue = getUsername();
    $("#usernameValueContainer")[0].value = "User: " + usernameValue
}

function newSketchContainerEl(){
    let container = $("#sketchContainer")
    let sketchContainer = $('<span></span>')
    container.append(sketchContainer)
    return sketchContainer[0]
}

(function () {

    function loadSegments(segments, containerEl) {
        _.each(segments, function (v,key,list) {
            let s = v
            var oReq = new XMLHttpRequest();
            oReq.open("get", s.url, true);
            oReq.responseType = "text";
            oReq.onload = function (oEvent) {

                var blob = oReq.response;
                $("body").append('<img class="hideFully" src="" id="imageDataLoader' + key + '">')
                let img = document.getElementById("imageDataLoader" + key)
                img.onload = function () {
                    console.log("finished loading image " + key)
                    segments[key].loaded=true
                    let allLoaded = _.every(_.keys(segments), function(i) {
                        return segments[i].loaded
                    })
                    if (allLoaded) {
                        console.log("sketch ready")
                        loadedSegmentsMetadata = segments
                        newSketch(segments, containerEl)
                    }
                }
                img.src = blob

            };
            oReq.send(null);
        })
    }

    function extractDataFromImg(img){
        let el = $(img)
        let id = el.data("id")
        return {
            "parent": el.data("parent"),
            "creator": el.data("creator"),
            "order": parseInt(el.data("order")),
            "id": id,
            "sortBy": id,
            "group": el.data("group")
        }
    }

    function loadSegmentsFromTemplate(containerEl) {
        let segments = {}
        // var i = 0
        let els = $('.imageDataLoader').each(function(){
            let data = extractDataFromImg(this)
            segments[data.id] = data
        })
        newSketch(segments, containerEl)
    }
    //deprecated
    //load each base64 encoded image sequentially then load into a sketch using loadSegments
    function loadSegment(segmentId, segments, containerEl) {
        $.ajax({
            method: "GET",
            url: "/api/v1/segments/" + segmentId,
        }).fail(function (e) {
            console.error("failed to load game ", gameId)
            console.error(e)
        }).done(function (data) {
            segments[segmentId] = data
            if (data.parent !== null && data.parent !== "") {
                loadSegment(data.parent, segments, containerEl)
            } else {
                loadSegments(segments, containerEl)
            }
        });
    }

    function loadGallery(){
        // hide instructions
        // $("#instructionsContainer").addClass("hideFully")

        let allSegments = []
        let allSegmentsKeyId = {}
        let completeSegmentIds = []
        var i = 0
        let els = $('.imageDataLoader').each(function(){
            let data = extractDataFromImg(this)
            allSegments.push(data)
            allSegmentsKeyId[data.id] = data
            if (data.order === 2){
                completeSegmentIds.push(data.id)
            }
        })
        completeSegmentIds.sort(function (a,b) {
            return a.sortBy > b.sortBy
        })

        let groupByGroup = _.groupBy(allSegments, function (s) {
            return s.group
        })

        // ordered by sort id
        _.each(completeSegmentIds, function (c) {
            let segments = _.indexBy(groupByGroup[allSegmentsKeyId[c].group], function(i){
                return i.id
            })
            // let segments = groupByGroup[allSegmentsKeyId[c].group]
            newSketch(segments, newSketchContainerEl())
        })
    }

    if (isGallery()){
        loadGallery()
        return
    }

    if (isAbout()){
        return
    }

    let gameId = getSegmentId();
    if (gameId !== null) {
        //get the segments and follow parent chain up
        loadSegmentsFromTemplate(newSketchContainerEl())
    } else {
        // new game
        newSketch(null, newSketchContainerEl())
    }
})()