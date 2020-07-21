const sketchHolder = (sketch) => {

    // const queryParameters = {
    //     "head":
    // }

    const imageFormat = "image/png";
    const imageQuality = 1.0

    const HEAD_STAGE = 0
    const TORSO_STAGE = 1
    const LEGS_STAGE = 2
    const stageSections = [HEAD_STAGE, TORSO_STAGE, LEGS_STAGE]
    const END_STAGE = 3

    var stage = HEAD_STAGE

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

    var activeDrawingInfo=null


    function setupInstructions() {

        let instructions = ""
        switch (stage) {
            case HEAD_STAGE:
                instructions = "You are drawing the head in the top section. Draw an exquisite head and be sure to draw hints for where the torso should connect. When complete, generate a share URL and give it to the second artist.";
                break;
            case TORSO_STAGE:
                instructions = "You are drawing the torso in the middle section. Be sure to connect your torso to the head using the hint lines given by the first artist. Similarly make sure to draw hints for where the legs should connect to your torso. When complete, generate a share URL and give it to the third artist.";
                break;
            case LEGS_STAGE:
                instructions = "You are drawing the legs in the bottom section. Be sure to connect your legs to the torso hint lines given by the second artist. When complete, generate the final a share URL and share it with all artists. This final URL will reveal the exquisite corpse.";
                break;
            case END_STAGE:
                instructions = "Marvel! The exquisite corpse is complete. Refresh the page if any body parts are missing."
        }
        var instrBox = document.getElementById("stageInstructions");
        instrBox.innerText = instructions
    }

    sketch.setup = () => {
        sketch.createCanvas(800, 1200);
        sketch.background(0);

        loadData(sketch)
        if (stage === END_STAGE) {
            sketch.noLoop()
        }

        setupInstructions()

        $("#copyShareUrlBtn").click(function () {
            generateShareURL();
        })

        $('input:radio[name="drawMode"]').change(
            function () {
                if (this.checked && this.value === DRAWMODE_DRAW) {
                    drawMode = DRAWMODE_DRAW
                } else if (this.checked && this.value === DRAWMODE_ERASE) {
                    drawMode = DRAWMODE_ERASE
                }
            })
    };

    sketch.draw = () => {
        if (!sketch.focused){
            activeDrawingInfo=null
        }

        sketch.background(255)

        sketch.noSmooth()
        var i = 0
        _.each(buffers, function (buffer) {
            sketch.image(buffer, 0, sectionHeight * i, sectionWidth, sectionHeightMid)
            ++i
        })
        sketch.smooth()

        if (stage !== END_STAGE) {
            _.each(stageSections, function (i) {
                if (stage > i) {
                    sketch.fillStyle = "#999"
                    sketch.rect(0, sectionHeight * i, sketch.width, sectionHeight)
                }

                sketch.stroke(0, 0, 255)
                sketch.strokeWeight(2)
                sketch.line(0, sectionHeight * i, sketch.width, sectionHeight * i)
            })
        }
    };

    sketch.keyPressed = (e) => {
        if (e.key == 'r') {
            //reset?
        }
    }

    function generateShareURL() {
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
            /* Select the text field */
            copyText.select();
            copyText.setSelectionRange(0, 99999); /*For mobile devices*/
            /* Copy the text inside the text field */
            document.execCommand("copy");
        });
    }

    sketch.keyReleased = (e) => {
    }

    sketch.mousePressed = (e)=>{
        if (stage !== END_STAGE) {
            let xy = getLocalPosition(e)
            activeDrawingInfo={previousX:xy[0], previousY:xy[1]}
        }
    }

    sketch.mouseReleased = (e) => {
        activeDrawingInfo = null
    }

    function getLocalPosition(e){
        let x = sketch.map(e.offsetX, 0, sketch.width, 0, bufferWidth)
        let y = sketch.map(e.offsetY, stage * sectionHeight, stage * sectionHeight + sectionHeightMid, 0, bufferHeightMid)
        return [x,y]
    }

    sketch.mouseDragged = (e) => {
        if (stage !== END_STAGE) {
            //do drawing

            // allow draw in a segment
            let drawSize = 5
            if (drawMode === DRAWMODE_DRAW) {
                drawBuffer.noStroke()
                drawBuffer.fill(0)
            } else if (drawMode === DRAWMODE_ERASE) {
                drawBuffer.noStroke()
                drawBuffer.fill(255, 255, 255, 255)
                drawBuffer.erase()
                drawSize *= 2
            }

            let xy = getLocalPosition(e)
            let x=xy[0]
            let y=xy[1]

            drawBuffer.stroke(0)//black
            drawBuffer.strokeWeight(drawSize)
            drawBuffer.line(activeDrawingInfo.previousX, activeDrawingInfo.previousY, x, y)
            // drawBuffer.circle(x, y, drawSize)
            drawBuffer.noErase()

            activeDrawingInfo.previousX = x
            activeDrawingInfo.previousY = y

            return false
        }
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

        for (var i = 0; i < 3; ++i) {
            let imgHolder = $("#imageDataLoader" + i)
            if (imgHolder.length === 0) {
                break
            }
            stage = i + 1

            buffers.push(sketch.createGraphics(bufferWidth, bufferHeightMid)) //todo get this height figure out
            buffers[i].clear()

            let img = document.getElementById("imageDataLoader" + i)
            buffers[i].canvas.getContext("2d").drawImage(img, 0, 0, bufferWidth, bufferHeightMid)//, bufferWidth, bufferHeightMid)
        }
        if (stage !== END_STAGE) {
            //draw buffer
            drawBuffer = sketch.createGraphics(bufferWidth, bufferHeightMid)
            buffers.push(drawBuffer)
            drawBuffer.clear()
        }
    }
};

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

if (document.cookie.split(';').some((item) => item.trim().startsWith('username='))) {
    const usernameValue = document.cookie
        .split('; ')
        .find(row => row.startsWith('username'))
        .split('=')[1];

    $("#usernameValueContainer")[0].innerHTML = "User: " + usernameValue

    let gameId = getSegmentId();
    if (gameId !== null) {
        //get the segments and follow parent chain up
        // fetch with username header
        var segments = [];

        function loadSegmentImage(segmentIdx) {
            let s = segments[segmentIdx]
            var oReq = new XMLHttpRequest();
            oReq.open("get", s.url, true);
            oReq.responseType = "text";
            oReq.onload = function (oEvent) {

                var blob = oReq.response;
                $("body").append('<img class="hideFully" src="" id="imageDataLoader' + segmentIdx + '">')
                let img = document.getElementById("imageDataLoader" + segmentIdx)
                img.src = blob
                console.log("finished loading image " + segmentIdx)
                if (segmentIdx === segments.length - 1) {
                    console.log("sketch ready")
                    let myp5 = new p5(sketchHolder, "sketchContainer");
                } else {
                    loadSegmentImage(segmentIdx + 1)
                }
            };
            oReq.send(null);
        }

        function loadSegment(segmentId) {
            $.get("/api/v1/segments/" + segmentId, function (data) {
                segments.push(data)
                if (data.parent !== null && data.parent !== "") {
                    loadSegment(data.parent)
                } else {
                    //set segments in the images and
                    segments.reverse()// head torso tail etc

                    loadSegmentImage(0)
                }
            }).fail(function () {
                console.error("failed to load game ", gameId)
            });
        }

        loadSegment(gameId)
    } else {
        let myp5 = new p5(sketchHolder, "sketchContainer");
    }
}


