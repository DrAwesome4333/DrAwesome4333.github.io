// @ts-check

// Webgl Canvas
var GL_CANVAS = document.createElement("canvas");
var GL = GL_CANVAS.getContext("webgl2");
document.body.append(GL_CANVAS);
GL_CANVAS.width = window.innerHeight;
GL_CANVAS.height = window.innerHeight - 100;

GL.clearColor(0.0, 1.0, 0.0, 1.0);
GL.enable(GL.DEPTH_TEST);
GL.depthFunc(GL.LEQUAL);
GL.clearDepth(1.0);
GL.disable(GL.CULL_FACE);

var V_ARRAY_BUFFER = GL.createVertexArray();

var GL_WIDTH = GL.drawingBufferWidth;
var GL_HEIGHT = GL.drawingBufferHeight;

var vertex_source = `#version 300 es
in vec2 pos;
in vec2 coords;
out vec2 _pos;
void main(){
    gl_Position = vec4(pos.x, pos.y , 0.0, 1.0);
    _pos = coords;
}
`
var mandelbrot_frag_source = `#version 300 es
precision highp float;

const float PI = 3.1415926535897932384626433832795;
const int COLOR_COUNT = 255;

uniform sampler2D color_palette;
in vec2 _pos;
int iteration;
out vec4 color;
vec2 z;
vec2 c;

void next(inout vec2 z, in vec2 c){
    // save old value
    vec2 temp = z;
    // calculate new ones
    z.x = temp.x * temp.x - temp.y * temp.y;
    z.y = temp.y * temp.x * 2.0;
    z += c;
}

void main(){
    z = vec2(0.0, 0.0);
    c = _pos;
    iteration = COLOR_COUNT;

    for(int i = 0; i < COLOR_COUNT; i += 1){
        next(z, c);
        if(z.x * z.x + z.y * z.y > 4.0){
            iteration = i;
            break;
        }
    }
    
    color = texture(color_palette, vec2(float(iteration) / float(COLOR_COUNT), 0.0));
}`

var julia_frag_source = `#version 300 es
precision highp float;

const float PI = 3.1415926535897932384626433832795;
const int COLOR_COUNT = 255;

uniform sampler2D color_palette;
in vec2 _pos;
int iteration;
out vec4 color;
vec2 z;
vec2 c;

void next(inout vec2 z, in vec2 c){
    // save old value
    vec2 temp = z;
    // calculate new ones
    z.x = temp.x * temp.x - temp.y * temp.y;
    z.y = temp.y * temp.x * 2.0;
    z += c;
}

void main(){
    z = _pos;
    c = vec2(-1.0, 0.0);
    iteration = COLOR_COUNT;

    for(int i = 0; i < COLOR_COUNT; i += 1){
        next(z, c);
        if(z.x * z.x + z.y * z.y > 4.0){
            iteration = i;
            break;
        }
    }
    
    color = texture(color_palette, vec2(float(iteration) / float(COLOR_COUNT), 0.0));
}`

var ship_frag_source = `#version 300 es
precision highp float;

const float PI = 3.1415926535897932384626433832795;
const int COLOR_COUNT = 255;

uniform sampler2D color_palette;
in vec2 _pos;
int iteration;
out vec4 color;
vec2 z;
vec2 c;

void next(inout vec2 z, in vec2 c){
    // save old value
    vec2 temp = z;
    // calculate new ones
    z.x = temp.x * temp.x - temp.y * temp.y;
    z.y = 2.0 * abs(temp.x * temp.y);
    z -= c;
}

void main(){
    z = _pos;
    c = vec2(-0.598, 0.9226);
    iteration = COLOR_COUNT;

    for(int i = 0; i < COLOR_COUNT; i += 1){
        next(z, c);
        if(z.x * z.x + z.y * z.y > 4.0){
            iteration = i;
            break;
        }
    }
    
    color = texture(color_palette, vec2(float(iteration) / float(COLOR_COUNT), 0.0));
}`

/**
 * 
 * @param {WebGL2RenderingContext} gl 
 * @param {WebGLProgram} shader 
 */
function Fractal(gl, shader){
    var vArrayBuffer = gl.createVertexArray();
    gl.bindVertexArray(vArrayBuffer);
    gl.useProgram(shader);
    var posLoc = gl.getAttribLocation(shader, "pos");
    var coordLoc = gl.getAttribLocation(shader, "coords");

    gl.bindBuffer(gl.ARRAY_BUFFER, POS_BUFFER);
    gl.bufferData(gl.ARRAY_BUFFER, POS_ARRAY, gl.STATIC_DRAW);

    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 2*4, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, COORD_BUFFER);
    gl.bufferData(gl.ARRAY_BUFFER, DEFAULT_COORD_ARRAY, gl.STATIC_DRAW);

    gl.enableVertexAttribArray(coordLoc);
    gl.vertexAttribPointer(coordLoc, 2, gl.FLOAT, false, 2*4, 0);

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ELE_BUFFER);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array([0, 1, 2, 0, 2, 3]), GL.STATIC_DRAW);

    gl.bindVertexArray(null);

    this.draw = function(AXIS_LEN, CX, CY){
        gl.useProgram(shader);
        gl.bindVertexArray(vArrayBuffer);

        DEFAULT_COORD_ARRAY = new Float32Array([-AXIS_LEN/2+CX,AXIS_LEN/2+CY, -AXIS_LEN/2+CX,-AXIS_LEN/2+CY, AXIS_LEN/2+CX,-AXIS_LEN/2+CY, AXIS_LEN/2+CX,AXIS_LEN/2+CY]);
        gl.bindBuffer(gl.ARRAY_BUFFER, COORD_BUFFER);
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, DEFAULT_COORD_ARRAY);
    
        gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT,0);
        gl.bindVertexArray(null);
        gl.flush();
    }
}

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

var POS_BUFFER = GL.createBuffer();
var COORD_BUFFER = GL.createBuffer();
var ELE_BUFFER = GL.createBuffer();
var POS_ARRAY = new Float32Array([-1.0,1.0, -1.0,-1.0, 1.0,-1.0, 1.0,1.0]);
var DEFAULT_COORD_ARRAY = new Float32Array([-1.0,1.0, -1.0,-1.0, 1.0,-1.0, 1.0,1.0]);

var mandelbrot = new Fractal(GL, buildProgram(GL, vertex_source, mandelbrot_frag_source));
var julia = new Fractal(GL, buildProgram(GL, vertex_source, julia_frag_source));
var ship = new Fractal(GL, buildProgram(GL, vertex_source, ship_frag_source));
var currentFractal = mandelbrot;

GL.activeTexture(GL.TEXTURE0)
var COLOR_PALETTE = GL.createTexture();
GL.bindTexture(GL.TEXTURE_2D, COLOR_PALETTE);

// Create texture for for gradient
var gradCanvas = document.createElement('canvas');
gradCanvas.width = 256;
gradCanvas.height = 1;
var ct = gradCanvas.getContext('2d');
var grad = ct.createLinearGradient(0, 0, 256, 0);
grad.addColorStop(0/6, "#ff0000");
grad.addColorStop(1/6, "#00ff00");
grad.addColorStop(2/6, "#0000ff");
grad.addColorStop(3/6, "#ffff00");
grad.addColorStop(4/6, "#ff00ff");
grad.addColorStop(5/6, "#00ffff");
grad.addColorStop(6/6, "#000000");
ct.fillStyle = grad;
ct.fillRect(0,0,256,1);

GL.texImage2D(GL.TEXTURE_2D, 0, GL.RGBA, GL.RGBA, GL.UNSIGNED_BYTE, gradCanvas);

GL.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_MIN_FILTER, GL.LINEAR);
GL.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_WRAP_S, GL.CLAMP_TO_EDGE);
GL.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_WRAP_T, GL.CLAMP_TO_EDGE);

GL.bindVertexArray(null);
GL.viewport(0, 0, GL_WIDTH, GL_HEIGHT);

function changeFractal(){
    // @ts-ignore
    var fractalName = document.getElementById('fractal').value;
    switch(fractalName){
        case 'julia':
            currentFractal = julia;
            break;
        case 'mandelbrot':
            currentFractal = mandelbrot;
            break;
        case 'ship':
            currentFractal = ship;
            break;
    }
    drawWbgl()
}

function drawWbgl(){
    currentFractal.draw(axisLen, cx, cy);
}


var axisLen = 4;
var cx = 0;
var cy = 0;
drawWbgl();

/**
 * @param {WheelEvent} e
 */
function zoom(e){
    e.preventDefault();
    axisLen += axisLen * e.deltaY/1000;
    drawWbgl();
    updateGUI()
}
GL_CANVAS.addEventListener("wheel", zoom);

/**
 * Updates the center of the fractal to where the user clicked
 * @param {MouseEvent} e 
 */
function updateCenter(e){
    var X = e.clientX - GL_CANVAS.getBoundingClientRect().left - GL_WIDTH/2;
    var Y = e.clientY - GL_CANVAS.getBoundingClientRect().top - GL_HEIGHT/2;
    cx += (X/GL_WIDTH) * axisLen;
    cy += -(Y/GL_HEIGHT) * axisLen;
    drawWbgl();
    updateGUI()
}

function updateGUI(){
    // because most HTML elements don't have the value property, ts-check throws an error here
    // @ts-ignore
    document.getElementById('centerX').value = cx;
    // @ts-ignore
    document.getElementById('centerY').value = cy;
    // @ts-ignore
    document.getElementById('axisLength').value = axisLen;
}

function updateParameters(){
    // @ts-ignore
    cx = Number(document.getElementById('centerX').value);
    // @ts-ignore
    cy = Number(document.getElementById('centerY').value);
    // @ts-ignore
    axisLen = Number(document.getElementById('axisLength').value);
    drawWbgl();
}

GL_CANVAS.addEventListener("click", updateCenter)