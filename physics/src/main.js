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
var pointList = [];
var secondaryList = [];
for(var i =0; i < 30; i++){
    pointList.push(new Point(Math.random() * 150, Math.random() * 150));
    secondaryList.push(new Point(0,0))
}
var myPolygon = new Polygon(...pointList);
var shape2 = new Polygon(...secondaryList);
var oldShapes = [];


/**
 * @param {MouseEvent} event 
 */
function updateMouse(event){
    var canvasRect = canvas.getBoundingClientRect();
    mouseLocation.x = event.clientX - canvasRect.left;
    mouseLocation.y = event.clientY - canvasRect.top;
    myPolygon.center = mouseLocation;
}

canvas.onmousemove = updateMouse;

var mouseDeg = 0;

/**
 * @param {WheelEvent} event 
 */
 function updateRotation(event){
    var deg = event.deltaY / 25;
    var rad = deg * Math.PI / 180;
    myPolygon.center = new Point(0, 0);

    myPolygon.points.forEach((p)=>{
        var ox = p.x;
        var oy = p.y;
        p.x = Math.cos(rad) * ox - Math.sin(rad) * oy;
        p.y = Math.sin(rad) * ox + Math.cos(rad) * oy;
    });

    myPolygon.center = mouseLocation;
}

canvas.onwheel = updateRotation;

function updateShape2(e){
    var oldPoints = [];
    for(var i = 0; i < myPolygon.points.length; i++){
        oldPoints.push(
            new Point(
            shape2.points[i].x, 
            shape2.points[i].y
            )
            
        );
        shape2.points[i].x = myPolygon.points[i].x;
        shape2.points[i].y = myPolygon.points[i].y;
    }
    oldShapes.push(new Polygon(...oldPoints));


}

canvas.onclick = updateShape2;

function draw(){
    
    ctx.clearRect(0, 0, 300, 300);

    var colRes = Polygon.checkCollision(myPolygon, shape2);
    
    ctx.beginPath();
    ctx.moveTo(myPolygon.points[0].x, myPolygon.points[0].y);
    myPolygon.points.forEach((p) =>{
        ctx.lineTo(p.x, p.y);
    });
    ctx.closePath();
    ctx.strokeStyle = "red";
    ctx.stroke();

    oldShapes.forEach((poly) =>{
        ctx.beginPath();
        ctx.moveTo(poly.points[0].x, poly.points[0].y);
        poly.points.forEach((p) =>{
            ctx.lineTo(p.x, p.y);
        });
        ctx.closePath();
        ctx.strokeStyle = "green";
        var colRes2 = Polygon.checkCollision(myPolygon, poly);
        if(colRes2.length > 0){
            ctx.fillStyle="rgba(255, 0, 0, 0.5)";
            ctx.fill();
    
            ctx.fillStyle="blue";
            colRes2.forEach((p) => {
                ctx.fillRect(p.x, p.y, 10, 10);
            })
        }
        ctx.stroke();
    })

    ctx.beginPath();
    ctx.moveTo(shape2.points[0].x, shape2.points[0].y);
    shape2.points.forEach((p) =>{
        ctx.lineTo(p.x, p.y);
    });
    ctx.closePath();
    ctx.strokeStyle = "green";
    
    if(colRes.length > 0){
        ctx.fillStyle="rgba(255, 0, 0, 0.5)";
        ctx.fill();

        ctx.fillStyle="blue";
        colRes.forEach((p) => {
            ctx.fillRect(p.x, p.y, 10, 10);
        })
    }
    ctx.stroke();
    

    requestAnimationFrame(draw);
}
draw();
