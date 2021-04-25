onmessage = function(e){
    console.log("Worker: ");
    postMessage("Hello")
}