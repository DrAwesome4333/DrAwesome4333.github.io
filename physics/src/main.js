//@ts-check
import {Point, Vector, Line, Polygon } from "./modules/geometry.js";

var canvas = document.createElement("canvas");
var ctx = canvas.getContext('2d');

canvas.style.border = "1px solid black";
canvas.style.position = "absolute";
canvas.style.left = "0px";
canvas.style.right = "0px";
canvas.style.marginRight = "auto";
canvas.style.marginLeft = "auto";
canvas.style.width = "300px";
canvas.style.height = "300px";
canvas.width = 300;
canvas.height = 300;

document.body.appendChild(canvas);

var mouseLocation = new Point(0, 0);
var mouseVec = new Vector(50, 0);
var mouseLine = new Line(mouseLocation, mouseVec);
var line2 = new Line(new Point(0, 0), mouseVec);
var lines = [];


/**
 * @param {MouseEvent} event 
 */
function updateMouse(event){
    var canvasRect = canvas.getBoundingClientRect();
    mouseLocation.x = event.clientX - canvasRect.left;
    mouseLocation.y = event.clientY - canvasRect.top;
    mouseVec.x = Math.cos(mouseDeg * Math.PI / 180) * mouseMag;
    mouseVec.y = Math.sin(mouseDeg * Math.PI / 180) * mouseMag;
    mouseLine.v = mouseVec;// As v does not keep the object linked
}

canvas.onmousemove = updateMouse;

var mouseDeg = 0;
var mouseMag = 100;

/**
 * @param {WheelEvent} event 
 */
 function updateRotation(event){
    mouseDeg += event.deltaY / 10;
    mouseVec.x = Math.cos(mouseDeg * Math.PI / 180) * mouseMag;
    mouseVec.y = Math.sin(mouseDeg * Math.PI / 180) * mouseMag;
    mouseLine.v = mouseVec;// As v does not keep the object linked
}

canvas.onwheel = updateRotation;

function updateLine2(e){
    var oldLine = new Line(new Point(line2.p1.x, line2.p1.y), line2.v);
    lines.push(oldLine);
    line2.p1.x = mouseLine.p1.x;
    line2.p1.y = mouseLine.p1.y;
    line2.v = mouseLine.v;
}

canvas.onclick = updateLine2;

function draw(){
    ctx.clearRect(0, 0, 300, 300);
    ctx.beginPath();
    ctx.moveTo(mouseLine.p1.x, mouseLine.p1.y);
    ctx.lineTo(mouseLine.p2.x, mouseLine.p2.y);
    ctx.strokeStyle="red";
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(line2.p1.x, line2.p1.y);
    ctx.lineTo(line2.p2.x, line2.p2.y);
    ctx.strokeStyle="green";
    ctx.stroke();
    
    var intr = Line.getIntersect(mouseLine, line2);
    if(intr.t != NaN){
        ctx.fillStyle="blue";
        if(0 <= intr.t && intr.t <= 1){
            // Check other line segment
            var intr2 = Line.getIntersect(line2, mouseLine);
            if(0 <= intr2.t && intr2.t <= 1)
                ctx.fillStyle="green";
        }

        ctx.fillRect(intr.point.x, intr.point.y, 10, 10);
    }

    for(var i = 0; i < lines.length; i ++){
        var ln = lines[i];
        ctx.beginPath();
        ctx.moveTo(ln.p1.x, ln.p1.y);
        ctx.lineTo(ln.p2.x, ln.p2.y);
        ctx.strokeStyle="blue";
        ctx.stroke();
        
        var intr = Line.getIntersect(mouseLine, ln);
        if(intr.t != NaN){
            ctx.fillStyle="blue";
            if(0 <= intr.t && intr.t <= 1){
                // Check other line segment
                var intr2 = Line.getIntersect(ln, mouseLine);
                if(0 <= intr2.t && intr2.t <= 1)
                    ctx.fillStyle="green";
            }

            ctx.fillRect(intr.point.x, intr.point.y, 10, 10);
        }
    }
    mouseDeg ++;
    mouseVec.x = Math.cos(mouseDeg * Math.PI / 180) * mouseMag;
    mouseVec.y = Math.sin(mouseDeg * Math.PI / 180) * mouseMag;
    mouseLine.v = mouseVec;// As v does not keep the object linked

    
    requestAnimationFrame(draw);
}
draw();
