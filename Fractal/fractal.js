// @ts-check
var GL_CANVAS = document.createElement("canvas");
var GL = GL_CANVAS.getContext("webgl2");
document.body.append(GL_CANVAS);
GL_CANVAS.width = window.innerHeight;
// - 100 for GUI on bottom
GL_CANVAS.height = window.innerHeight - 100;

GL.clearColor(0.0, 1.0, 0.0, 1.0);
GL.clearDepth(1.0);
GL.disable(GL.CULL_FACE);

var V_ARRAY_BUFFER = GL.createVertexArray();

var GL_WIDTH = GL.drawingBufferWidth;
var GL_HEIGHT = GL.drawingBufferHeight;

var FRACTAL_INFO = {
    'mandelbrot':{
        'name': 'Mandelbrot',
        'setup':`
        _z = _data1;
        _c = _loc;
        `,
        'next':`
        // save old value
        vec2 tmp = _z;
        // calculate new ones
        _z.x = tmp.x * tmp.x - tmp.y * tmp.y;
        _z.y = tmp.y * tmp.x * 2.0;
        _z += _c;
        `,
        'data1':[0,0],
        'data2':[0,0]
    }, 
    'mandelbrot3':{
        'name': 'Mandelbrot 3',
        'setup':`
        _z = _data1;
        _c = _loc;
        `,
        'next':`
        // save old value
        vec2 tmp = _z;
        // calculate new ones
        _z.x = tmp.x * tmp.x * tmp.x - 3.0 * tmp.x * tmp.y * tmp.y;
        _z.y = 3.0 * tmp.x * tmp.x * tmp.y - tmp.y * tmp.y * tmp.y;
        _z += _c;
        `,
        'data1':[0,0],
        'data2':[0,0]
    }, 
    'mandelbrot4':{
        'name': 'Mandelbrot 4',
        'setup':`
        _z = _data1;
        _c = _loc;
        `,
        'next':`
        // save old value
        vec2 tmp = _z;
        // calculate new ones
        _z.x = tmp.x * tmp.x * tmp.x * tmp.x - 6.0 * tmp.x * tmp.x * tmp.y * tmp.y + tmp.y * tmp.y * tmp.y * tmp.y;
        _z.y = 4.0 * tmp.x * tmp.x * tmp.x * tmp.y - 4.0 * tmp.x * tmp.y * tmp.y * tmp.y;
        _z += _c;
        `,
        'data1':[0,0],
        'data2':[0,0]
    },
    'julia':{
        'name': 'Julia',
        'setup':`
        _z = _loc;
        _c = _data1;`,
        'next':`
        // save old value
        vec2 tmp = _z;
        // calculate new ones
        _z.x = tmp.x * tmp.x - tmp.y * tmp.y;
        _z.y = tmp.y * tmp.x * 2.0;
        _z += _c;
        `,
        'data1':[-1.0,0],
        'data2':[0,0]
    },
    'ship':{
        'name': 'Burning Ship',
        'setup':`
        _z = _data1;
        _c = _loc;`,
        'next':`
        // save old value
        vec2 tmp = _z;
        // calculate new ones
        _z.x = tmp.x * tmp.x - tmp.y * tmp.y;
        _z.y = 2.0 * abs(tmp.x * tmp.y);
        _z -= _c;
        `,
        'data1':[0,0],
        'data2':[0,0]
    },
    'juliaShip':{
        'name': 'Burning Julia Ship',
        'setup':`
        _z = _loc;
        _c = _data1;`,
        'next':`
        // save old value
        vec2 tmp = _z;
        // calculate new ones
        _z.x = tmp.x * tmp.x - tmp.y * tmp.y;
        _z.y = 2.0 * abs(tmp.x * tmp.y);
        _z -= _c;
        `,
        'data1':[-0.598, 0.9226],
        'data2':[0,0]
    },
    'phoenix':{
        'name': 'Phoenix',
        'setup':`
        _z = _loc.yx;
        _c = _data1.xy;
        // Use data1 for old z
        _data1 = vec2(0.0,0.0);
        `,
        'next':`
        // save old value
        vec2 tmp = _z;
        // calculate new ones
        _z.x = tmp.x * tmp.x - tmp.y * tmp.y + _data1.x * _data2.x - _data1.y * _data2.y;
        _z.y = 2.0 * tmp.x * tmp.y + _data1.x * _data2.y + _data1.y * _data2.x;
        _z += _c;
        _data1 = tmp;
        `,
        'data1':[0.5667, 0.0],
        'data2':[-0.5,0]
    },
    'ray':{
        'name': 'Ray (AKA failed phoenix)',
        'setup':`
        _z = _data1;
        _c = _loc.yx;
        // Use data1 for old z
        _data1 = vec2(0.0,0.0);
        `,
        'next':`
        // save old value
        vec2 tmp = _z;
        // calculate new ones
        _z.x = tmp.x * tmp.x - tmp.y * tmp.y + _data1.x * _data2.x;
        _z.y = 2.0 * tmp.x * tmp.y + _data1.y * _data2.y;
        _z += _c;
        _data1 = tmp;
        `,
        'data1':[0.5667, 0.0],
        'data2':[-0.5,0]
    }
}

var fractals = {};
/**
 * Creates a fractal generator within a given WebGL context.
 * @param {WebGL2RenderingContext} gl 
 * @param {string} setupFunc A glsl function run before each pixel calculation for the signature:
 * void setup(inout vec2 _z, inout vec2 _c, in vec2 _loc, inout vec2 _data1, inout vec2 _data2)
 * @param {string} nextFunc A glsl function to advance the fractal formula for the signature:
 * void next(inout vec2 _z, inout vec2 _c)
 */
function FractalGenerator(gl, setupFunc, nextFunc){

    var fragSource = `#version 300 es
    precision highp float;
    
    const float PI = 3.1415926535897932384626433832795;
    const int COLOR_COUNT = 256;
    
    uniform sampler2D color_palette;
    uniform vec2 data1;
    uniform vec2 data2;
    uniform int maxSteps;
    
    in vec2 _pos;
    out vec4 color;
    
    int iteration;
    vec2 z;
    vec2 c;
    vec2 _data1;
    vec2 _data2;
    
    void next(inout vec2 _z, inout vec2 _c){
    ${nextFunc}
    }
    
    void setup(inout vec2 _z, inout vec2 _c, in vec2 _loc, inout vec2 _data1, inout vec2 _data2){
    ${setupFunc}
    }
    
    void main(){
        _data1 = data1;
        _data2 = data2;
        setup(z, c, _pos, _data1, _data2);
    
        iteration = maxSteps;
    
        for(int i = 0; i < maxSteps; i += 1){
            next(z, c);
            if(z.x * z.x + z.y * z.y > 4.0){
                iteration = i;
                break;
            }
        }
        
        color = texture(color_palette, vec2(float(iteration) / float(COLOR_COUNT), 0.0));
    }`

    
    var vertex_source = `#version 300 es
    in vec2 pos;
    in vec2 coords;
    out vec2 _pos;
    void main(){
        gl_Position = vec4(pos.x, pos.y , 0.0, 1.0);
        _pos = coords;
    }`
    var shader = buildProgram(gl, vertex_source, fragSource);
    var vArrayBuffer = gl.createVertexArray();
    gl.bindVertexArray(vArrayBuffer);
    gl.useProgram(shader);
    var posLoc = gl.getAttribLocation(shader, "pos");
    var coordLoc = gl.getAttribLocation(shader, "coords");
    var data1 = gl.getUniformLocation(shader, "data1");
    var data2 = gl.getUniformLocation(shader, "data2");
    var maxSteps = gl.getUniformLocation(shader, "maxSteps");

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

    /**
     * Draws a the fractal with the given parameters
     * @param {Number} axisLength The axis length
     * @param {Number} centerX The center x component
     * @param {Number} centerY The center y component
     * @param {Number[]} d1 Must be a 2 number array, Input for _data1, use varies by setup and next functions defined
     * @param {Number[]} d2 Must be a 2 number array, Input for _data2, use varies by setup and next functions defined
     */
    this.draw = function(axisLength, centerX, centerY, d1=[0,0], d2=[0,0]){
        gl.useProgram(shader);
        gl.bindVertexArray(vArrayBuffer);
        gl.uniform2fv(data1, d1);
        gl.uniform2fv(data2, d2);

        gl.uniform1i(maxSteps, 255);

        var coordArray = new Float32Array(
            [
                -axisLength/2+centerX, axisLength/2+centerY,
                -axisLength/2+centerX, -axisLength/2+centerY,
                axisLength/2+centerX, -axisLength/2+centerY,
                axisLength/2+centerX, axisLength/2+centerY
            ]);
        gl.bindBuffer(gl.ARRAY_BUFFER, COORD_BUFFER);
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, coordArray);
    
        gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT,0);
        gl.bindVertexArray(null);
        gl.flush();
    }
}

/**
 * Builds WebGL shader programs
 * @param {WebGLRenderingContext} gl 
 * @param {String} vertexShaderSource Source code for vertext shader
 * @param {String} fragmentShaderSource Source code for fragment shader
 * @returns 
 */
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


GL.activeTexture(GL.TEXTURE0)
var COLOR_PALETTE = GL.createTexture();
GL.bindTexture(GL.TEXTURE_2D, COLOR_PALETTE);


for(var fName in FRACTAL_INFO){
    let fractal = new FractalGenerator(GL, FRACTAL_INFO[fName]['setup'], FRACTAL_INFO[fName]['next']);
    fractals[fName] = fractal;
    var option = document.createElement('option');
    option.value = fName;
    option.innerText = FRACTAL_INFO[fName]['name'];
    document.getElementById('fractal').appendChild(option);
}
var currentFractal = fractals['mandelbrot'];

// Create texture for for gradient using a 2d
var gradCanvas = document.createElement('canvas');
gradCanvas.width = 256;
gradCanvas.height = 1;
var ct = gradCanvas.getContext('2d');
var grad = ct.createLinearGradient(0, 0, 256, 0);
var STOP_COUNT = 22;
grad.addColorStop(0/STOP_COUNT, "#ff0000");
grad.addColorStop(1/STOP_COUNT, "#00ff00");
grad.addColorStop(2/STOP_COUNT, "#0000ff");
grad.addColorStop(3/STOP_COUNT, "#ffff00");
grad.addColorStop(4/STOP_COUNT, "#ff00ff");
grad.addColorStop(5/STOP_COUNT, "#00ffff");
grad.addColorStop(6/STOP_COUNT, "#00ff00");
grad.addColorStop(7/STOP_COUNT, "#0000ff");
grad.addColorStop(8/STOP_COUNT, "#ffff00");
grad.addColorStop(9/STOP_COUNT, "#ff00ff");
grad.addColorStop(10/STOP_COUNT, "#00ffff");
grad.addColorStop(11/STOP_COUNT, "#ff0000");
grad.addColorStop(12/STOP_COUNT, "#00ff00");
grad.addColorStop(13/STOP_COUNT, "#0000ff");
grad.addColorStop(14/STOP_COUNT, "#ffff00");
grad.addColorStop(15/STOP_COUNT, "#ff00ff");
grad.addColorStop(16/STOP_COUNT, "#00ffff");
grad.addColorStop(17/STOP_COUNT, "#00ff00");
grad.addColorStop(18/STOP_COUNT, "#0000ff");
grad.addColorStop(19/STOP_COUNT, "#ffff00");
grad.addColorStop(20/STOP_COUNT, "#ff00ff");
grad.addColorStop(21/STOP_COUNT, "#00ffff");
grad.addColorStop(22/STOP_COUNT, "#000000");
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
    currentFractal = fractals[fractalName];
    dta1 = FRACTAL_INFO[fractalName]['data1'];
    dta2 = FRACTAL_INFO[fractalName]['data2'];
    updateGUI();
}

function drawWbgl(){
    currentFractal.draw(axisLen, cx, cy, dta1, dta2);
    requestAnimationFrame(drawWbgl);
}


var axisLen = 4;
var cx = 0;
var cy = 0;
var dta1 = [0,0];
var dta2 = [0,0];
drawWbgl();

/**
 * @param {WheelEvent} e
 */
function zoom(e){
    e.preventDefault();
    updateParameters();
    axisLen += axisLen * e.deltaY/1000;
    updateGUI();
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
    // @ts-ignore
    document.getElementById('data1R').value = dta1[0];
    // @ts-ignore
    document.getElementById('data1I').value = dta1[1];
    // @ts-ignore
    document.getElementById('data2R').value = dta2[0];
    // @ts-ignore
    document.getElementById('data2I').value = dta2[1];
}

function updateParameters(){
    // @ts-ignore
    cx = Number(document.getElementById('centerX').value);
    // @ts-ignore
    cy = Number(document.getElementById('centerY').value);
    // @ts-ignore
    axisLen = Number(document.getElementById('axisLength').value);
    // @ts-ignore
    dta1 = [Number(document.getElementById('data1R').value), Number(document.getElementById('data1I').value)];
    // @ts-ignore
    dta2 = [Number(document.getElementById('data2R').value), Number(document.getElementById('data2I').value)];
}

GL_CANVAS.addEventListener("click", updateCenter)