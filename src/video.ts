import $ from "jquery";

export interface VideoStream{
    video:HTMLVideoElement,
    width:number,
    height:number,
    cleanup():void
    capture():HTMLImageElement
}
export function newAsyncVideo(onReady:(stream:VideoStream)=>void){

    let videoEl = $('<video class="hideFully" playsinline autoplay></video>')[0] as HTMLVideoElement
    $("body").append(videoEl)

    function handleSuccess(stream:MediaStream) {
        videoEl.srcObject = stream;
        onReady({
            video:videoEl,
            width:videoEl.videoWidth,
            height:videoEl.videoHeight,
            cleanup() {
                var stream = videoEl.srcObject;
                // @ts-ignore
                var tracks = stream.getTracks();
                for (var i = 0; i < tracks.length; i++) {
                    var track = tracks[i];
                    track.stop();
                }
                videoEl.srcObject = null;
                $(videoEl).remove()
            },
            capture(): HTMLImageElement {
                const canvas = document.createElement('canvas');
                canvas.height = videoEl.videoHeight;
                canvas.width = videoEl.videoWidth;
                var ctx = canvas.getContext('2d');
                ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
                var img = new Image();
                img.src = canvas.toDataURL();

                return img
            }
        })
    }

    function handleError(error:Error) {
        console.log('navigator.MediaDevices.getUserMedia error: ', error.message, error.name);
    }
    navigator.mediaDevices.getUserMedia({audio:false,video:true}).then(handleSuccess).catch(handleError);
}