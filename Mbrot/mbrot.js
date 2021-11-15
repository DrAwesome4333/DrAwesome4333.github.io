// @ts-check
var CANVAS = document.createElement("canvas");
var ct = CANVAS.getContext('2d');
//document.body.append(CANVAS);
CANVAS.width = 500;
CANVAS.height = 500;
var width = CANVAS.getBoundingClientRect().width;
var height = CANVAS.getBoundingClientRect().height;

// Webgl Canvas
var GL_CANVAS = document.createElement("canvas");
var gl = GL_CANVAS.getContext("webgl2");
document.body.append(GL_CANVAS);
GL_CANVAS.width = window.innerHeight;
GL_CANVAS.height = window.innerHeight;

gl.clearColor(0.0, 1.0, 0.0, 1.0);
gl.enable(gl.DEPTH_TEST);
gl.depthFunc(gl.LEQUAL);
gl.clearDepth(1.0);
gl.disable(gl.CULL_FACE);

var vab = gl.createVertexArray();

var gl_width = gl.drawingBufferWidth;
var gl_height = gl.drawingBufferHeight;

var vertex_source = `#version 300 es
in vec2 pos;
in vec2 coords;
out vec2 _pos;
void main(){
    gl_Position = vec4(pos.x, pos.y , 0.0, 1.0);
    // Interpolate a float for later conversion to double
    _pos = coords;
}
`
var frag_source = `#version 300 es
precision highp float;

in vec2 _pos;
float iteration;
out vec4 color;
float PI;
vec2 z;

void next(inout vec2 val, in vec2 pos){
    vec2 temp = vec2(val.x, val.y);
    val.x = temp.x * temp.x - temp.y * temp.y;
    val.y = temp.y * temp.x * 2.0;
    val += pos;
}

void main(){
    PI = 3.1415926535897932384626433832795;
    z = vec2(0.0, 0.0);
    iteration = 0.0;
    for(float i = 0.0; i < 180.0; i += 1.0){
        next(z, _pos);
        if(z.x * z.x + z.y * z.y > 4.0){
            iteration = i + 1.0;
            break;
        }
    }
    
    if(iteration != 0.0){
        iteration = 180.0 - iteration;
    }

    iteration *= (1.0/180.0);

    color = vec4(abs(cos(iteration * PI)), 0.0, abs(sin(iteration * PI)), 1.0);

    if(iteration == 0.0){
        color = vec4(0.0,0.0,0.0,1.0);
    }
}

`


// builds our webgl program
function buildProgram(gl, vertexShaderSource, fragmentShaderSource){
			
    var vertShader = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vertShader, vertexShaderSource);
    gl.compileShader(vertShader);
    if (!gl.getShaderParameter(vertShader, gl.COMPILE_STATUS)) {
        throw "ERROR IN VERTEX SHADER : " + gl.getShaderInfoLog(vertShader);
    }

    var fragShader = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fragShader, fragmentShaderSource);
    gl.compileShader(fragShader);
    if (!gl.getShaderParameter(fragShader, gl.COMPILE_STATUS)) {
        throw "ERROR IN FRAG SHADER : " + gl.getShaderInfoLog(fragShader);
    }

    var program = gl.createProgram();
    gl.attachShader(program, vertShader);
    gl.attachShader(program, fragShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        throw "Unknown error in program";
    }

   return program;
}

var posBuffer = gl.createBuffer();
var coordBuffer = gl.createBuffer();
var eleBuffer = gl.createBuffer();
var posArray = new Float32Array([-1.0,1.0, -1.0,-1.0, 1.0,-1.0, 1.0,1.0]);
var coordArray = new Float32Array([-1.0,1.0, -1.0,-1.0, 1.0,-1.0, 1.0,1.0]);

var mainProgram = buildProgram(gl, vertex_source, frag_source);
gl.useProgram(mainProgram);

gl.bindVertexArray(vab);

var posLoc = gl.getAttribLocation(mainProgram, "pos");
var coordLoc = gl.getAttribLocation(mainProgram, "coords");

gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
gl.bufferData(gl.ARRAY_BUFFER, posArray, gl.STATIC_DRAW);

gl.enableVertexAttribArray(posLoc);
gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 2*4, 0);

gl.bindBuffer(gl.ARRAY_BUFFER, coordBuffer);
gl.bufferData(gl.ARRAY_BUFFER, coordArray, gl.STATIC_DRAW);

gl.enableVertexAttribArray(coordLoc);
gl.vertexAttribPointer(coordLoc, 2, gl.FLOAT, false, 2*4, 0);


gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, eleBuffer);
gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array([0, 1, 2, 0, 2, 3]), gl.STATIC_DRAW);


gl.bindVertexArray(null);



gl.viewport(0,0,gl_width,gl_height);
/**
 * Creates a complex number, Treat as Immutable
 * @param {number} real the real component of the number
 * @param {number} imag the imaginary component of the number
 */
function ComplexNumber(real, imag){
    this.getReal = function(){
        return real;
    }

    this.getImag = function(){
        return imag
    }

    /**
     * Adds two complex numbers
     * @param {ComplexNumber} other 
     * @returns Resulting Complex Number
     */
    this.add = function(other){
        let nReal = real + other.getReal();
        let nImag = imag + other.getImag();
        return new ComplexNumber(nReal, nImag);
    }


    /**
     * Adds two complex numbers
     * @param {ComplexNumber} other 
     * @returns Resulting Complex Number
     */
    this.multiply = function(other){
        let nReal = real * other.getReal() + imag * other.getImag() * -1;
        let nImag = real * other.getImag() + imag * other.getReal();
        return new ComplexNumber(nReal, nImag);
    }

    this.square = function(){
        return this.multiply(this);
    }

    /**
     * 
     * @param {ComplexNumber} other 
     * @returns 
     */
    this.equal = function(other){
        return real == other.getReal() && imag == other.getImag();
    }

    this.toString = function(){
        return `${real} + ${imag}i`;
    }
}

/**
 * 
 * @param {ComplexNumber} c 
 */
function mBrot(c){
    // Check 5 iterations to see how the set grows with this C
    let z = new ComplexNumber(0, 0);
    function next(){
        z = z.square().add(c);
    }

    function myAbs(){
        return z.getImag() ** 2 + z.getReal() ** 2;
    }

    for(let i = 0; i < 180; i ++){
        if (myAbs() > 4){
            return i;
        }
        next();
    }
    return 0;
}

function draw2D(r){

    var range = r;
    var OFF_X = 0.25;
    var OFF_Y = 0;
    var SCALE_X = (2 * range)/(width);
    var SCALE_Y = (2 * range)/(height);
    ct.fillStyle = "black";
    for(var x = -range + OFF_X; x <= range + OFF_X; x += SCALE_X){
        for(var y = -range + OFF_Y; y <= range + OFF_Y; y += SCALE_Y){
            var res = mBrot(new ComplexNumber(x, y));
            var red = Math.cos(res * Math.PI/90)*255;
            var blu = Math.sin(res * Math.PI/90)*255;
            if(res == 0){
                red = 0;
                blu = 0;
            }
            ct.fillStyle = `rgb(${red}, 0, ${blu})`
            ct.fillRect((x + range - OFF_X) / SCALE_X + 0.5, (y + range - OFF_Y) / SCALE_Y + 0.5, 1, 1)
            
        }
    }
    //setTimeout(draw, 1000, [r/2])
}

function drawWbgl(r){
    
    var OFF_X = cx;
    var OFF_Y = cy;
    gl.useProgram(mainProgram);
    
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.bindVertexArray(vab);
    coordArray = new Float32Array([-r+OFF_X,r+OFF_Y, -r+OFF_X,-r+OFF_Y, r+OFF_X,-r+OFF_Y, r+OFF_X,r+OFF_Y]);
    gl.bindBuffer(gl.ARRAY_BUFFER, coordBuffer);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, coordArray);

    gl.useProgram(mainProgram);
    gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT,0);
    gl.bindVertexArray(null);
    gl.flush();
}
//draw2D(2);
drawWbgl(1);
var ranged = 1;
var cx = 0;
var cy = 0;

/**
 * @param {WheelEvent} e
 */
function theWheel(e){
    e.preventDefault();
    ranged += ranged * e.deltaY/1000;
    drawWbgl(ranged);
}
GL_CANVAS.addEventListener("wheel",theWheel);

function md(e){
    var X = e.clientX - GL_CANVAS.getBoundingClientRect().left - gl_width/2;
    var Y = e.clientY - GL_CANVAS.getBoundingClientRect().top - gl_height/2;
    cx += (X/gl_width) * ranged*2;
    cy += -(Y/gl_height) * ranged*2;
    drawWbgl(ranged);
}
GL_CANVAS.addEventListener("click", md)