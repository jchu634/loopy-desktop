// Copyright (c) 2014, The WebRTC project authors. All rights reserved.
// Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:
// Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
// Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.
// Neither the name of Google nor the names of its contributors may be used to endorse or promote products derived from this software without specific prior written permission.
// THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

const mediaSource = new MediaSource();

mediaSource.addEventListener('sourceopen', handleSourceOpen, false);
let mediaRecorder;
let recordedBlobs;
let sourceBuffer;
const frames = [];
let vidUrl;

let canvas;
let stream;
let blob;
let downloadDisabled = true;
let recordTimeout;
let encodeFinished = false;
let b64Str;
const recordButton = document.getElementById('record');



function handleSourceOpen(event) {
  console.log('MediaSource opened');
  sourceBuffer = mediaSource.addSourceBuffer('video/webm; codecs="vp8"');
  console.log('Source buffer: ', sourceBuffer);
}

function handleDataAvailable(event) {
  if (event.data && event.data.size > 0) {
    recordedBlobs.push(event.data);
  }
}

function handleStop(event) {
  console.log('Recorder stopped: S', event);
  const superBuffer = new Blob(recordedBlobs, {type: 'video/webm'});
}

function toggleRecording(self) {
  canvas = document.querySelector('canvas');
  stream = canvas?.captureStream(); // frames per second
  console.log('Started stream capture from canvas element: ', stream);
  if (self.textContent === "Start Recording GIF") {
    startRecording(self);
    encodeFinished = false;

  } else {
    stopRecording();
  }
}

async function startRecording(recordButton) {
  let options = {mimeType: 'video/webm'};
  recordedBlobs = [];
  mediaRecorder = new MediaRecorder(stream, options);

  console.log('Created MediaRecorder', mediaRecorder, 'with options', options);
  recordButton.textContent = 'Stop Recording';

  mediaRecorder.onstop = handleStop;
  mediaRecorder.ondataavailable = handleDataAvailable;
  mediaRecorder.start(100); // collect 100ms of data

  recordTimeout = setTimeout(stopRecording,30000);
  
  console.log('MediaRecorder started', mediaRecorder);

}
async function getVideoTrack(src) {
  const video = document.createElement("video");

  video.crossOrigin = "anonymous";
  video.id = 'tempVideo';
  video.src = src;
  document.body.append(video);
  
  await video.play();
  const [track] = video.captureStream().getVideoTracks();
  video.onended = (evt) => track.stop();
  return track;
}
function createCanvas(size){
  const canvas = document.createElement('canvas');
  canvas.width = size.w
  canvas.height = size.h

  canvas.style.position = 'absolute'
  canvas.style.top = '0'
  canvas.style.left = '0'
  canvas.style.width = `${size.w}px`
  canvas.style.height = `${size.h}px`

  return canvas
}
async function printFromImageBitmap(bitmap,scale=1){
  const canvas = createCanvas({ w: bitmap.width, h: bitmap.height })
  const ctx = canvas.getContext('bitmaprenderer')
  const bitmap2 = await createImageBitmap(bitmap)
  ctx.transferFromImageBitmap(bitmap2)
  printFromCanvas(ctx.canvas, scale)
}
async function stopRecording() {
  clearTimeout(recordTimeout);
  if (mediaRecorder.state != "inactive"){
    document.getElementById("record").textContent = 'Start Recording GIF'; //Hardcoded for condition in toggleRecording()
    await mediaRecorder.stop();
    
    let vidBlob = new Blob(recordedBlobs, {type: 'video/webm'});
    vidUrl = await getFileAsDataURL(vidBlob);  
    const track = await getVideoTrack(vidUrl);
    
    const processor = new MediaStreamTrackProcessor(track);
    const reader = processor.readable.getReader();
    readChunk();
    
    
    function readChunk() {
      reader.read().then(async({ done, value }) => {
        if (value) {
          const bitmap = await createImageBitmap(value);
          // printFromImageBitmap(bitmap);
          const index = frames.length;
          frames.push(bitmap);
          value.close();
          // console.log(totalLength);
        }
        if (!done) {
          readChunk();
        }else{
          document.body.removeChild(document.getElementById('tempVideo')); 
          // document.querySelector('span#download').disabled = false;
          document.querySelector('span#download').removeAttribute('disabled');
          
          downloadDisabled = false;
        }
      });
    }
  }




  
}

function getFileAsDataURL(blob){
  return new Promise((resolve,reject) =>{
    var fileRdr = new FileReader();
    fileRdr.onload = () => resolve(fileRdr.result);
    fileRdr.onerror = () => reject(fileRdr);
    fileRdr.readAsDataURL(blob);
  });
}

const displayedSize=500;
const scale = window.devicePixelRatio;

async function download(){
  if (!downloadDisabled){
    if (!encodeFinished){
      document.getElementById('gif_progress').style.display = 'block';
      let progressBar = document.getElementById('gif_bar');
      let width = 0;
      let interval = 100/frames.length;

      const encodeWorker = new Worker('js/GifWorker.js')
      encodeWorker.postMessage([frames])
      encodeWorker.onmessage = (e)=>{
        if (e.data[0] =='fin'){
          b64Str = e.data[1];
          var fileName = `gif-output-${(new Date().toGMTString().replace(/(\s|,|:)/g,''))}.gif`;
          let dwnlnk = document.createElement('a');
          dwnlnk.download = fileName;
          dwnlnk.href = b64Str;
          document.body.appendChild(dwnlnk);
          dwnlnk.click();
          document.body.removeChild(dwnlnk);
          encodeFinished = true;
          
          document.getElementById('gif_progress').style.display = 'none';

          //DEBUG: Downloads Original WEBM recording
          // let blob = new Blob(recordedBlobs, {type: 'video/webm'});
          // const url = window.URL.createObjectURL(blob);
          // const a = document.createElement('a');
          // a.style.display = 'none';
          // a.href = url;
          // a.download = `gif-output-${(new Date().toGMTString().replace(/(\s|,|:)/g,''))}.webm`;;     
          // document.body.appendChild(a);
          // a.click();
          
          // document.body.appendChild(a);
          // a.click();
          // setTimeout(() => {
          //   document.body.removeChild(a);
          //   window.URL.revokeObjectURL(url);
          // }, 100);
        }
        else{
          width+=interval;
          progressBar.style.width = width+"%";
        }
      }
    }
    else{
      var fileName = `gif-output-${(new Date().toGMTString().replace(/(\s|,|:)/g,''))}.gif`;
      let dwnlnk = document.createElement('a');
      dwnlnk.download = fileName;
      dwnlnk.href = b64Str;
      document.body.appendChild(dwnlnk);
      dwnlnk.click();
      document.body.removeChild(dwnlnk);
      encodeFinished = true;
    }
  }
  
}