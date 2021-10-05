//@ts-check
var op = document.getElementById("op");

var audioDevices = [];
/** @type {HTMLCanvasElement}*/
// @ts-ignore
var canvas = document.getElementById("can");
var ct = canvas.getContext("2d");


function Cube(x, y, z, size, color, light,/**@type{Graphics} */ graphics, musicSection = Math.floor(Math.random() * Sound.data.fbc)) {

    var yOffset = 0;
    var ox = 0;//orbit point
    var oy = 0;
    var oz = -650;
    var power = 0;
    var oldPower = 0;
    var dp = 0; //difference in power.
    var tilt = (Math.random() - 0.5) * 60;
    var orbit = Math.random() * 360;
    var tiltOffset = Math.random() * 360 / 180 * Math.PI;//so all the cubes don't make an x
    var maxDistance = 3000;
    var minDistance = 100;
    var orbitDistance = 300;
    this.musicSection = musicSection;
    var scale = 1;//how the model is scaled
    var beatPoints = 0;

    this.bufferLength = 36;
    var rotation = [0, 0, 0];//in degs.
    var modelMat = Graphics.matrix.identity(4);
    var normalMat = Graphics.matrix.identity(3);
    var gl = graphics.getGL();
    var VBO = gl.createBuffer();
    var IBO = gl.createBuffer();

    this.getVBO = function () {
        return VBO;
    }

    this.getIBO = function () {
        return IBO;
    }

    this.getModelMat = function () {
        return modelMat;
    }

    this.getNormalMat = function () {
        return normalMat;
    }

    var lazyArray = [];
    for (var i = 0; i < 6; i++) {
        //because I am too lazy to type a 36 element array
        lazyArray.push(i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 3, i * 4 + 1)
    }

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, IBO);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(lazyArray), gl.STATIC_DRAW);
    //[x, y, z, r, g, b, nx, ny, nz, tx, ty]
    //used to update the VBO on a size or color (not scale) change
    function buildVBO() {
        //half size
        var hs = size / 2;
        var c = color;
        var f = 1;
        if (light > -1) {
            f = -1;
        }
        var anotherArray = [
            -hs, hs, hs, c[0], c[1], c[2], 0, 0, 1 * f, 0, 0,//front
            hs, -hs, hs, c[0], c[1], c[2], 0, 0, 1 * f, 1, 1,
            hs, hs, hs, c[0], c[1], c[2], 0, 0, 1 * f, 1, 0,
            -hs, -hs, hs, c[0], c[1], c[2], 0, 0, 1 * f, 0, 1,

            -hs, hs, -hs, c[0], c[1], c[2], -1 * f, 0, 0, 0, 0,//left
            -hs, -hs, hs, c[0], c[1], c[2], -1 * f, 0, 0, 1, 1,
            -hs, hs, hs, c[0], c[1], c[2], -1 * f, 0, 0, 1, 0,
            -hs, -hs, -hs, c[0], c[1], c[2], -1 * f, 0, 0, 0, 1,

            hs, hs, hs, c[0], c[1], c[2], 1 * f, 0, 0, 0, 0,//right
            hs, -hs, -hs, c[0], c[1], c[2], 1 * f, 0, 0, 1, 1,
            hs, hs, -hs, c[0], c[1], c[2], 1 * f, 0, 0, 1, 0,
            hs, -hs, hs, c[0], c[1], c[2], 1 * f, 0, 0, 0, 1,

            -hs, hs, -hs, c[0], c[1], c[2], 0, 1 * f, 0, 0, 0,//top
            hs, hs, hs, c[0], c[1], c[2], 0, 1 * f, 0, 1, 1,
            hs, hs, -hs, c[0], c[1], c[2], 0, 1 * f, 0, 1, 0,
            -hs, hs, hs, c[0], c[1], c[2], 0, 1 * f, 0, 0, 1,

            -hs, -hs, hs, c[0], c[1], c[2], 0, -1 * f, 0, 0, 0,//bottom
            hs, -hs, -hs, c[0], c[1], c[2], 0, -1 * f, 0, 1, 1,
            hs, -hs, hs, c[0], c[1], c[2], 0, -1 * f, 0, 1, 0,
            -hs, -hs, -hs, c[0], c[1], c[2], 0, -1 * f, 0, 0, 1,

            hs, hs, -hs, c[0], c[1], c[2], 0, 0, -1 * f, 0, 0,//back
            -hs, -hs, -hs, c[0], c[1], c[2], 0, 0, -1 * f, 1, 1,
            -hs, hs, -hs, c[0], c[1], c[2], 0, 0, -1 * f, 1, 0,
            hs, -hs, -hs, c[0], c[1], c[2], 0, 0, -1 * f, 0, 1];

        gl.bindBuffer(gl.ARRAY_BUFFER, VBO);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(anotherArray), gl.STATIC_DRAW);
    }

    this.update = function () {

        if (oldPower != 0) {
            dp = power / oldPower / 1.5;
        }
        if (power < Sound.data.frequency[musicSection] / 255) {
            power = Sound.data.frequency[musicSection] / 255;
        } else {
            if (power > 0)
                power -= 0.1;
            if (power < 0) {
                power = 0;
            }
        }


        beatPoints += dp;
        if (beatPoints < 0) {
            beatPoints = 0;
        }
        if (beatPoints > 5) {
            beatPoints = 0;
            color = Graphics.getNewLightColor();
        }

        scale = power * 5;
        orbit += power * 0.5 * (maxDistance / orbitDistance);
        orbit %= 360;
        yOffset += power / 50;
        orbitDistance += (power * power - 0.25) * 10 * (maxDistance / orbitDistance);
        rotation[0] += power * 2;
        rotation[1] += power * 2 + 0.1;
        if (orbitDistance > maxDistance) {
            orbitDistance = maxDistance;
        } else if (orbitDistance < minDistance) {
            orbitDistance = minDistance;
        }
        var nOrbit = orbit / 180 * Math.PI;
        var nTilt = tilt / 180 * Math.PI;

        oy = Math.sin(yOffset) * 1000 / (orbitDistance / 100);
        // debugger;
        var oldX = 0;
        var oldY = 0;
        var oldZ = 0;
        x = orbitDistance * Math.cos(nOrbit);
        y = 0;
        z = orbitDistance * Math.sin(nOrbit);
        oldX = x;
        oldY = y;
        x = oldX * Math.cos(nTilt) - oldY * Math.sin(nTilt);
        y = oldX * Math.sin(nTilt) + oldY * Math.cos(nTilt) + oy;
        oldX = x;
        oldZ = z;
        x = oldX * Math.cos(tiltOffset) - oldZ * Math.sin(tiltOffset) + ox;
        z = oldX * Math.sin(tiltOffset) + oldZ * Math.cos(tiltOffset) + oz;
        buildModelMat();
        if (light > -1) {
            graphics.lightPos[light * 3] = x;
            graphics.lightPos[light * 3 + 1] = y;
            graphics.lightPos[light * 3 + 2] = z;

            graphics.lightColor[light * 3] = color[0] * power + 0.1;
            graphics.lightColor[light * 3 + 1] = color[1] * power + 0.1;
            graphics.lightColor[light * 3 + 2] = color[2] * power + 0.1;
        }

        oldPower = power;
    }
    function buildModelMat() {
        var xr = rotation[0] * Math.PI / 180;
        var yr = rotation[1] * Math.PI / 180;
        var zr = rotation[2] * Math.PI / 180;
        var xm = [
            1, 0, 0,
            0, Math.cos(xr), -Math.sin(xr),
            0, Math.sin(xr), Math.cos(xr)];
        var ym = [
            Math.cos(yr), 0, Math.sin(yr),
            0, 1, 0,
            -Math.sin(yr), 0, Math.cos(yr)];
        var zm = [
            Math.cos(zr), -Math.sin(zr), 0,
            Math.sin(zr), Math.cos(zr), 0,
            0, 0, 1];
        normalMat = Graphics.matrix.mult3x3([
            scale, 0, 0,
            0, scale, 0,
            0, 0, scale], xm);
        normalMat = Graphics.matrix.mult3x3(normalMat, ym);
        normalMat = Graphics.matrix.mult3x3(normalMat, zm);
        modelMat = Graphics.matrix.mult4x4([
            normalMat[0], normalMat[1], normalMat[2], 0,
            normalMat[3], normalMat[4], normalMat[5], 0,
            normalMat[6], normalMat[7], normalMat[8], 0,
            0, 0, 0, 1],
            [
                1, 0, 0, 0,
                0, 1, 0, 0,
                0, 0, 1, 0,
                x, y, z, 1])

    };
    buildVBO();
    buildModelMat();
}

function Graphics(){
    var canvas = document.createElement("canvas");
    var gl = canvas.getContext("webgl", { preserveDrawingBuffer: true, alpha: false });
    var mySelf = this;

    var lightPos = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    var lightColor = [0.25, 0.25, 0.25, 0.5, 0.0, 0.0, 0.0, 0.5, 0.0, 0.5, 0.5, 0.0, 0.0, 0.0, 0.5, 0.5, 0.0, 0.5, 0.0, 0.5, 0.5, 0.0, 0.0, 0.5];
    
    this.lightPos = lightPos;
    this.lightColor = lightColor;
    var backgroundColor = [0, 0, 0];
    var backgroundColorGoal = [1, 1, 1];
    var lightScore = [0, 0, 0, 0, 0, 0, 0, 0, 0];
    var cubes = [];

    var camera = {
        height: 0,
        target: {
            x: 0,
            y: 0,
            z: -650
        },
        matrix: null,
        angle: 0,
        direction: 1
    };

    var textures = {
        plainWhite: null, // texture 0
        transparentBlack: null, // texture 0
        frequencyData: null // texture 1
    }

    var shaderSources= {
        mainVertexShader: `
                attribute vec3 pos;
                attribute vec3 color;
                attribute vec2 tex;
                attribute vec3 normal;
                varying vec3 f_pos;
                varying vec3 f_color;
                varying vec3 f_normal;
                varying vec2 f_tex;
                uniform mat4 world;
                uniform mat4 model;
                uniform mat4 perspective;
                uniform mat3 normal_matrix;
                void main(void){
                    f_color = color;
                    f_normal = normal_matrix * normal;
                    f_tex = tex;
                    f_pos = (world*model * vec4(pos, 1.0)).xyz;
                    gl_Position=(perspective * world * model * vec4(pos, 1.0));
                }`,
        mainFragmentShader: `
                precision mediump float;
                varying vec3 f_pos;
                varying vec3 f_color;
                varying vec3 f_normal;
                varying vec2 f_tex;
                uniform vec3 light_pos[8];
                uniform vec3 light_color[8];
                uniform sampler2D texture;
                uniform vec3 fog_color;
                uniform vec3 ambient_color;
                void main(void){
                    
                    vec3 normal = normalize(f_normal);
                    vec3 total_light = vec3(0.0, 0.0, 0.0);
                    float light_strength = 0.0;
                    float spec_strength = 0.0;
                    vec3 surface_to_light = vec3(0.0, 0.0, 0.0);
                    vec3 surface_to_camera = normalize(-f_pos);
                    vec3 half_vector = vec3(0.0, 0.0, 0.0);
                    vec3 base = f_color * texture2D(texture, f_tex).rgb;
                    
                    for(int i = 0; i < 8; i++){
                        surface_to_light = normalize(light_pos[i] - f_pos);
                        light_strength = max(dot(normal, surface_to_light), 0.0);
                        half_vector = normalize(surface_to_light + surface_to_camera);
                        spec_strength = pow(max(dot(half_vector, normal), 0.0), 100.0);
                        total_light += base * (light_strength * light_color[i]);
                        total_light += base * (spec_strength * light_color[i]);
                    }

                    total_light += ambient_color * base;
                    float amount = smoothstep(900.0, 1000.0, gl_FragCoord.z);
                    gl_FragColor = vec4(mix(total_light,fog_color,amount),texture2D(texture,f_tex).a);
                }`,
        fadeVertexShader: `
                attribute vec2 pos;
                varying vec2 _pos;
                void main(void){
                    _pos = pos;
                    gl_Position=vec4(pos, 1.0, 1.0);
                }`,
        fadeFragmentShader: `
                precision mediump float;
                uniform sampler2D freqData;
                uniform float opacity;
                uniform vec3 color;
                varying vec2 _pos;
                vec4 fin;
                float index;
                vec2 textPos; 
                float level;
                float wave;
                const float PI = 3.1415926535897932384626433832795;
                void main(void){
                    index = abs(_pos.x) * 512.0;
                    textPos.y = floor(index / 32.0);
                    textPos.x = index - textPos.y * 32.0;
                    textPos.xy /= 32.0;
                    level = texture2D(freqData, textPos).r;
                    
                    wave = texture2D(freqData, textPos + vec2(0.0, 0.5)).r;
                    fin = vec4(color.rgb * vec3(pow(level - abs(_pos.y * _pos.y + (wave * 2.0 - 1.0) * 0.1), 3.0) * 2.0), 0.5);

                    gl_FragColor = fin;
                }`,
            altFadeFragmentShader: `
            precision mediump float;
            uniform sampler2D freqData;
            uniform float opacity;
            uniform vec3 color;
            varying vec2 _pos;
            vec4 fin;
            float index;
            vec2 textPos;
            float level;
            float wave;
            const float PI = 3.1415926535897932384626433832795;
            void main(void){
                index = abs(_pos.x) * 512.0;
                textPos.y = floor(index / 32.0);
                textPos.x = index - textPos.y * 32.0;
                textPos.xy /= 32.0;
                level = texture2D(freqData, textPos).r;
                
                wave = texture2D(freqData, textPos + vec2(0.0, 0.5)).r;
                fin = vec4(color.rgb * vec3(pow(level - abs(_pos.y * _pos.y + (wave * 2.0 - 1.0) * 0.1), 3.0) * 2.0), 0.5);

                index = abs(_pos.y * cos(_pos.x * texture2D(freqData, vec2(0.0,0.0)).r)) * 512.0;
                textPos.y = floor(index / 32.0);
                textPos.x = index - textPos.y * 32.0;
                textPos.xy /= 32.0;
                level = texture2D(freqData, textPos).r;
                
                wave = texture2D(freqData, textPos + vec2(0.0, 0.5)).r;
                fin += vec4(color.rgb * vec3(pow(level - abs(_pos.x * _pos.x + (wave * 2.0 - 1.0) * 0.1), 3.0) * 2.0), 0.5);
                fin.rgb *= 0.5;
                gl_FragColor = fin;
            }`
    }

    var uniforms = {
        main: {
            world: null,
            model: null,
            perspective: null,
            normal_matrix: null,
            light_pos: null,
            light_color: null,
            texture: null,
            fog_color: null,
            ambient_color: null

        },
        fade: {
            opacity: null,
            color: null,
            freqData: null,
            freq: null
        }
    };

    var attributes = {
        main: {
            pos: null,
            color: null,
            tex: null,
            normal: null
        },
        fade: {
            pos: null
        }
    };

    var programs = {
        main: null,
        fade: null
    };

    var shaders = {
        vertexShaders: {
            main: null,
            fade: null
        },
        fragmentShaders: {
            main: null,
            fade: null
        }
    };

    var buffers = {
        fadeCoverPoints: null,
        fadeCoverTriangles: null
    };

    function  buildShader(shaderSource, type) {
        var shader = gl.createShader(type);
        gl.shaderSource(shader, shaderSource);
        gl.compileShader(shader);
        console.log(gl.getShaderParameter(shader, gl.COMPILE_STATUS));
        console.log(gl.getShaderInfoLog(shader));
        return shader;
    }

    function buildProgram(vertexShader, fragmentShader) {
        var program = gl.createProgram();
        gl.attachShader(program, vertexShader);
        gl.attachShader(program, fragmentShader);
        gl.linkProgram(program);
        return program;
    }


    this.settings = {
        canvas_settings:{
            width: 0,
            height: 0,
            top: 0,
            left: 0,
            p_width: 0,
            p_height: 0,//previous width/height, lets a function know if the view port needs to be updated
            fullScreen: false,//if true the canvas will attempt to take up the whole screen
            shouldShow: true
            },
        backgroundColorSmoothing: 0.7, // To reduce strobe
        backgroundOpacity: 1.0,
        doBackgroundAnimation:true
    }

    this.getGL = function(){
        return gl;
    }

    this.toggleFullScreen = function(){
        
        if (mySelf.settings.canvas_settings.fullScreen) {
            mySelf.settings.canvas_settings.fullScreen = false;

            if (document.exitFullscreen) {
                document.exitFullscreen();
                //@ts-ignore
            } else if (document.webkitExitFullscreen) { /* Safari */
                //@ts-ignore
                document.webkitExitFullscreen();
                //@ts-ignore
            } else if (document.msExitFullscreen) { /* IE11 */
                //@ts-ignore
                document.msExitFullscreen();
            }
        } else {
            var dEle = document.documentElement;
            mySelf.settings.canvas_settings.fullScreen = true
            if (dEle.requestFullscreen) {
                dEle.requestFullscreen();
                //@ts-ignore
            } else if (dEle.webkitRequestFullscreen) { /* Safari */
                //@ts-ignore
                dEle.webkitRequestFullscreen();
                //@ts-ignore
            } else if (dEle.msRequestFullscreen) { /* IE11 */
                //@ts-ignore
                dEle.msRequestFullscreen();
            }
        }
    };

    this.resize = function(){
        var newWidth = canvas.getBoundingClientRect().width;
        var newHeight = canvas.getBoundingClientRect().height;
        canvas.width = newWidth;
        canvas.height = newHeight;
        if (gl) {
            gl.viewport(0, 0, newWidth, newHeight);
            var f = Math.tan(Math.PI * 0.5 - 0.5 * 90 * Math.PI / 180);
            var rangeInv = 1.0 / (1 - 10000);
            var aspect = newWidth / newHeight;
            var perspectiveMatrix = [
                f / aspect, 0, 0, 0,
                0, f, 0, 0,
                0, 0, (1 + 10000) * rangeInv, -1,
                0, 0, 1 * 10000 * rangeInv * 2, 0
            ]
            gl.uniformMatrix4fv(uniforms.main.perspective, false, perspectiveMatrix);
        }
    };

    this.render = function(){
        var totals = [0, 0, 0];
        for (var i = 0; i < lightColor.length; i += 3) {
            totals[0] += lightColor[i];
            totals[1] += lightColor[i + 1];
            totals[2] += lightColor[i + 2];
        }
        var spike = 2;
        lAvg = [Math.pow(totals[0] / 2, spike), Math.pow(totals[1] / 2, spike), Math.pow(totals[2] / 2, spike)]
        backgroundColorGoal = lAvg;

        for (var i = 0; i < 3; i++) {
            var colorDif = backgroundColorGoal[i] - backgroundColor[i];
            backgroundColor[i] += colorDif * (1 - mySelf.settings.backgroundColorSmoothing);
        }

        gl.useProgram(programs.fade)
        gl.uniform3fv(uniforms.fade.color, backgroundColor);


        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, textures.frequencyData);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, 32, 32, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, Sound.data.frequenceyAndWaveform);
        //this.gl.uniform1iv(this.uniforms.fade.freq, Sound.data.frequency);

        gl.bindBuffer(gl.ARRAY_BUFFER, buffers.fadeCoverPoints);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffers.fadeCoverTriangles);

        gl.vertexAttribPointer(attributes.fade.pos, 2, gl.FLOAT, false, 4 * (2), 0);

        gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);

        gl.useProgram(programs.main);

        
        camera.angle += camera.direction;
        if (camera.angle > 90) {
            camera.direction = -0.1;
        }
        if (camera.angle < -90) {
            camera.direction = 0.1;
        }
        camera.height = -Math.sin(camera.angle / 180 * Math.PI) * 500;
        var rot = Math.asin(camera.height / Math.sqrt(camera.height ** 2 + camera.target.z ** 2));
        var camMatrix = [
            1, 0, 0, 0,
            0, Math.cos(rot), -Math.sin(rot), 0,
            0, Math.sin(rot), Math.cos(rot), 0,
            0, 0, 0, 1];
        camMatrix = Graphics.matrix.mult4x4([
            1, 0, 0, 0,
            0, 1, 0, 0,
            0, 0, 1, 0,
            0, camera.height, 0, 1]
            , camMatrix);
        gl.uniformMatrix4fv(uniforms.main.world, false, camMatrix);

        gl.clearColor(lAvg[0], lAvg[1], lAvg[2], 1.0);
        gl.clear(gl.DEPTH_BUFFER_BIT);// TODO Make this change based on settings

        gl.uniform3fv(uniforms.main.light_color, lightColor);
        gl.uniform3fv(uniforms.main.light_pos, lightPos)
        gl.uniform3fv(uniforms.main.ambient_color, [lAvg[0] / 8, lAvg[1] / 8, lAvg[2] / 8]);
        for (var i = 0; i < cubes.length; i++) {
            /**
             * @type {Cube}
             */
            var cc = cubes[i];
            cc.update();
            gl.bindBuffer(gl.ARRAY_BUFFER, cc.getVBO());
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, cc.getIBO());
            //[x, y, z, r, g, b, nx, ny, nz, tx, ty]
            gl.uniformMatrix4fv(uniforms.main.model, false, cc.getModelMat());
            gl.uniformMatrix3fv(uniforms.main.normal_matrix, false, cc.getNormalMat());

            gl.vertexAttribPointer(attributes.main.pos, 3, gl.FLOAT, false, 4 * (11), 0);
            gl.vertexAttribPointer(attributes.main.color, 3, gl.FLOAT, false, 4 * (11), 3 * 4);
            gl.vertexAttribPointer(attributes.main.normal, 3, gl.FLOAT, false, 4 * (11), 6 * 4);
            gl.vertexAttribPointer(attributes.main.tex, 2, gl.FLOAT, false, 4 * (11), 9 * 4);

            gl.drawElements(gl.TRIANGLES, cc.bufferLength, gl.UNSIGNED_SHORT, 0);

            //cc.buildModelMat();
        }
    }

    // START
    if (gl == undefined || gl == null) {
        console.log("Error: could not obtain WebGL context");
        alert("Faild to start visualizer!\nMake sure your web browser is up to date!")
        return;
    }
    canvas.style.zIndex = "-2";
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.top = "0px";
    canvas.style.left = "0px";
    canvas.style.position = "absolute";
    document.body.appendChild(canvas);

    shaders.vertexShaders.fade = buildShader(shaderSources.fadeVertexShader, gl.VERTEX_SHADER);
    shaders.fragmentShaders.fade = buildShader(shaderSources.fadeFragmentShader, gl.FRAGMENT_SHADER);
    programs.fade = buildProgram(shaders.vertexShaders.fade, shaders.fragmentShaders.fade);
    gl.useProgram(programs.fade);
    attributes.fade.pos = gl.getAttribLocation(programs.fade, "pos");

    uniforms.fade.opacity = gl.getUniformLocation(programs.fade, "opacity");
    uniforms.fade.color = gl.getUniformLocation(programs.fade, "color");
    uniforms.fade.freqData = gl.getUniformLocation(programs.fade, "freqData");
    gl.uniform1f(uniforms.fade.opacity, 1);
    gl.enableVertexAttribArray(attributes.fade.pos);

    buffers.fadeCoverPoints = gl.createBuffer();
    buffers.fadeCoverTriangles = gl.createBuffer();

    gl.bindBuffer(gl.ARRAY_BUFFER, buffers.fadeCoverPoints);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1.0, -1.0, 1.0, -1.0, 1.0, 1.0, -1.0, 1.0]), gl.STATIC_DRAW);

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffers.fadeCoverTriangles);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array([0, 1, 2, 0, 2, 3]), gl.STATIC_DRAW);

    shaders.vertexShaders.main = buildShader(shaderSources.mainVertexShader, gl.VERTEX_SHADER);
    shaders.fragmentShaders.main = buildShader(shaderSources.mainFragmentShader, gl.FRAGMENT_SHADER);
    programs.main = buildProgram(shaders.vertexShaders.main, shaders.fragmentShaders.main);
    gl.useProgram(programs.main);
    attributes.main.pos = gl.getAttribLocation(programs.main, "pos");
    attributes.main.color = gl.getAttribLocation(programs.main, "color");
    attributes.main.normal = gl.getAttribLocation(programs.main, "normal");
    attributes.main.tex = gl.getAttribLocation(programs.main, "tex");

    uniforms.main.world = gl.getUniformLocation(programs.main, "world");
    uniforms.main.perspective = gl.getUniformLocation(programs.main, "perspective");
    uniforms.main.texture = gl.getUniformLocation(programs.main, "texture");
    uniforms.main.ambient_color = gl.getUniformLocation(programs.main, "ambient_color");
    uniforms.main.fog_color = gl.getUniformLocation(programs.main, "fog_color");
    uniforms.main.light_color = gl.getUniformLocation(programs.main, "light_color");
    uniforms.main.light_pos = gl.getUniformLocation(programs.main, "light_pos");
    uniforms.main.normal_matrix = gl.getUniformLocation(programs.main, "normal_matrix");
    uniforms.main.model = gl.getUniformLocation(programs.main, "model");

    gl.enableVertexAttribArray(attributes.main.pos);
    gl.enableVertexAttribArray(attributes.main.color);
    gl.enableVertexAttribArray(attributes.main.normal);
    gl.enableVertexAttribArray(attributes.main.tex);



    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    gl.activeTexture(gl.TEXTURE0);
    textures.transparentBlack = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, textures.transparentBlack);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 25]));

    textures.plainWhite = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, textures.plainWhite);

    // Fill the texture with a 1x1 white pixel.
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([255, 255, 255, 255]));
    gl.uniform1i(uniforms.main.texture, 0);

    gl.activeTexture(gl.TEXTURE1);
    textures.frequencyData = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, textures.frequencyData);
    var myArray = new Uint8Array(32 * 32);
    for (var i = 0; i < 32 * 32; i++) {
        myArray[i] = i % 255;
    }
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, 32, 32, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, myArray);

    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    gl.useProgram(programs.fade);
    gl.uniform1i(uniforms.fade.freqData, 1);

    gl.useProgram(programs.main);

    let r = -30 * Math.PI / 180;
    gl.bindTexture(gl.TEXTURE_2D, textures.plainWhite);
    gl.uniformMatrix3fv(uniforms.main.normal_matrix, false, Graphics.matrix.identity(3));
    gl.uniformMatrix4fv(uniforms.main.model, false, Graphics.matrix.identity(4));
    gl.uniformMatrix4fv(uniforms.main.world, false, [
        1, 0, 0, 0,
        0, Math.cos(r), -Math.sin(r), 0,
        0, Math.sin(r), Math.cos(r), 0,
        0, 0, 0, 1]);
    gl.uniformMatrix4fv(uniforms.main.perspective, false, Graphics.matrix.identity(4));
    gl.uniform3fv(uniforms.main.ambient_color, [0.05, 0.05, 0.05]);
    gl.uniform3fv(uniforms.main.light_color, lightColor);
    gl.uniform3fv(uniforms.main.light_pos, lightPos)
    mySelf.resize();
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.clearDepth(1.0);
    gl.enable(gl.CULL_FACE);
    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // Start generating the cubes, TODO mabye seperate this into a different function?
    var chosenLights = [];
    var possibleList = [];
    var numberOfCubes = 300;
    cubes = [];
    for (var i = 0; i < numberOfCubes; i++) {
        possibleList.push(i);
    }
    for (var i = 0; i < 8; i++) {
        var random = Math.floor(i / 8 * (numberOfCubes - 1));//Math.floor(Math.random()*possibleList.length);
        chosenLights.push(possibleList[random]);
        possibleList.splice(random, 1);
    }
    for (var i = 0; i < numberOfCubes; i++) {
        //Music slection, selects a value in the frquency array for this cube to read
        var ms = Math.floor(i / numberOfCubes * Sound.data.fbc);
        var x = Math.random() * 150 - 75;
        var y = Math.random() * 150 - 75;
        var z = -Math.random() * 150 - 75;
        var color = [Math.random(), Math.random(), Math.random()];
        var l = -1;
        for (var j = 0; j < 8; j++) {
            if (chosenLights[j] == i) {
                l = j;
                var c = j % 3
                color = [0.0, 0.0, 0.0]
                color[c] = j / 8 * 0.5 + 0.5;

                break;
            }
        }
        cubes.push(new Cube(x, y, z, Math.random() * 3 + 3, color, l, mySelf, ms));

    }




}

Graphics.getNewLightColor = function(){
    var newColor = [Math.random(), Math.random(), Math.random()];
    // Normalize the color and divide it by 2
    var magnitude = Math.sqrt(newColor[0] ** 2 + newColor[1] ** 2 + newColor[2] ** 2) * 2;
    if (magnitude == 0) {
        return [0, 0.5, 0];
    } else {
        return [newColor[0] / magnitude, newColor[1] / magnitude, newColor[2] / magnitude];
    }
};

Graphics.matrix = {
    mult4x4: function (matA, matB) {
        return [
            matA[0] * matB[0] + matA[1] * matB[4] + matA[2] * matB[8] + matA[3] * matB[12], matA[0] * matB[1] + matA[1] * matB[5] + matA[2] * matB[9] + matA[3] * matB[13], matA[0] * matB[2] + matA[1] * matB[6] + matA[2] * matB[10] + matA[3] * matB[14], matA[0] * matB[3] + matA[1] * matB[7] + matA[2] * matB[11] + matA[3] * matB[15],
            matA[4] * matB[0] + matA[5] * matB[4] + matA[6] * matB[8] + matA[7] * matB[12], matA[4] * matB[1] + matA[5] * matB[5] + matA[6] * matB[9] + matA[7] * matB[13], matA[4] * matB[2] + matA[5] * matB[6] + matA[6] * matB[10] + matA[7] * matB[14], matA[4] * matB[3] + matA[5] * matB[7] + matA[6] * matB[11] + matA[7] * matB[15],
            matA[8] * matB[0] + matA[9] * matB[4] + matA[10] * matB[8] + matA[11] * matB[12], matA[8] * matB[1] + matA[9] * matB[5] + matA[10] * matB[9] + matA[11] * matB[13], matA[8] * matB[2] + matA[9] * matB[6] + matA[10] * matB[10] + matA[11] * matB[14], matA[8] * matB[3] + matA[9] * matB[7] + matA[10] * matB[11] + matA[11] * matB[15],
            matA[12] * matB[0] + matA[13] * matB[4] + matA[14] * matB[8] + matA[15] * matB[12], matA[12] * matB[1] + matA[13] * matB[5] + matA[14] * matB[9] + matA[15] * matB[13], matA[12] * matB[2] + matA[13] * matB[6] + matA[14] * matB[10] + matA[15] * matB[14], matA[12] * matB[3] + matA[13] * matB[7] + matA[14] * matB[11] + matA[15] * matB[15],
        ];
    },
    mult3x3: function (matA, matB) {
        return [
            matA[0] * matB[0] + matA[1] * matB[3] + matA[2] * matB[6], matA[0] * matB[1] + matA[1] * matB[4] + matA[2] * matB[7], matA[0] * matB[2] + matA[1] * matB[5] + matA[2] * matB[8],
            matA[3] * matB[0] + matA[4] * matB[3] + matA[5] * matB[6], matA[3] * matB[1] + matA[4] * matB[4] + matA[5] * matB[7], matA[3] * matB[2] + matA[4] * matB[5] + matA[5] * matB[8],
            matA[6] * matB[0] + matA[7] * matB[3] + matA[8] * matB[6], matA[6] * matB[1] + matA[7] * matB[4] + matA[8] * matB[7], matA[6] * matB[2] + matA[7] * matB[5] + matA[8] * matB[8]
        ];
    },
    identity: function (size) {
        switch (size) {
            case 2:
                return [
                    1, 0,
                    0, 1
                ];
                break;
            case 3:
                return [
                    1, 0, 0,
                    0, 1, 0,
                    0, 0, 1
                ];
                break;
            case 4:
                return [
                    1, 0, 0, 0,
                    0, 1, 0, 0,
                    0, 0, 1, 0,
                    0, 0, 0, 1
                ]
                break;
            default: {
                var returnArray = [];
                for (var i = 0; i < size; i++) {
                    for (var j = 0; j < size; j++) {
                        if (j == i) {
                            returnArray.push(1);
                        } else {
                            returnArray.push(0);
                        }
                    }
                }
                return returnArray;
                break;
            }
        }
    }
};

function MetaDataRepsonse(trackTitle="", trackCover="", artist=""){
    this.trackTitle = trackTitle;
    this.trackCover = trackCover;// A URI
    this.artist = artist;
}


function TrackMetaDataDecoder(){
    var webWorkersAvail = false;
    /**@type {Worker} */
    var trackMetaWorker;
    /**@type {{resolve:Function, id:Number}[]} */
    var requests = [];

    


    function handleWorkerResponse(e){
        if(typeof e.data == "string"){
            console.log(e.data);
            return;
        }
        var reqId = e.data[0];
        var title = e.data[1];
        var imgSrc = e.data[2];
        var artist = e.data[3];
        requests[reqId].resolve(new MetaDataRepsonse(title, imgSrc, artist));
    }

    if(window.Worker){
        webWorkersAvail = true;
        trackMetaWorker = new Worker("./audioIdWorker.js");
        trackMetaWorker.onmessage = handleWorkerResponse;
    }else{
        console.log("No web worker support");
    }

    /**
     * @param {File} file 
     * @returns {Promise<MetaDataRepsonse>}
     */
    this.requestMetaData = function(file){
        var queData = {
            resolve:null,
            id:requests.length
        }

        requests.push(queData);

        /**
         * @param {ArrayBuffer} dataBuffer 
         */
        function sendToWorker(dataBuffer){
            trackMetaWorker.postMessage([queData.id, dataBuffer], [dataBuffer]);
        }

        function catchError(e){
            queData.resolve(new MetaDataRepsonse("", "", ""));
        }

        function promiseFunction(resolve, reject){
            queData.resolve = resolve;
            if(!webWorkersAvail){
                resolve(new MetaDataRepsonse("", "", ""));
                return;
            }
            file.arrayBuffer().then(sendToWorker).catch(catchError)

        }

        var thePromise = new Promise(promiseFunction);

        return thePromise;
    }
    
}

/**
 * @param {HTMLInputElement} fileElement 
 * @param {Number} fileNumber 
 * @param {TrackPlayer} player
 */
function Track(fileElement, fileNumber, player=null) {
    this.length = 0;
    var trackId = Track.allTracks.length;
    var idString = "Track" + trackId;
    Track.allTracks.push(this);
    var trackTitle = "Unknown";
    var fileName = fileElement.files[fileNumber].name;
    var artist = "Unkown Artist";
    var album = "Unkown Album";
    var composer = "";
    var cover = new Image(100, 100);//cover image file if one exists
    var songTitleTag = document.createElement("div");
    var fileURL = URL.createObjectURL(fileElement.files[fileNumber]);//used to store the URL created to pass song as a source to the audio player
    var active = true;//so user can deactivate a song
    var self = this;
    var playlist = player.getPlaylist();
    var audioElement = player.getAudioElement();
    var sourceElement = player.getSourceElement();
    
    var self = this;

    var playlistItem = document.createElement("div");
    songTitleTag.innerHTML = fileName;

    playlistItem.classList.add("playlistItem");
    songTitleTag.classList.add("songTitle");
    cover.classList.add("songCover");

    function isDisabled(){
        return !active;
    }

    this.isDisabled = function () {
       return isDisabled();
    }

    this.disable = function(reason, showBroken=false){
        playlistItem.classList.remove("songInError", "songDisabled", "songPlaying");
        if(showBroken){
            cover.src = _Player.resources.errorCover.src;
            playlistItem.classList.add("songInError");
        }else{
            playlistItem.classList.add("songDisabled");
        }

        checkBox.title = reason;
        active = false;
        checkBox.checked = false;
    }

    this.enable = function(){
        playlistItem.classList.remove("songInError", "songDisabled");
        checkBox.title = "Disable song";
        active = true;
        checkBox.checked = true;
    }

    this.getTrackElement = function(){
        return playlistItem;
    }

    this.play = function () {
        playlist.playTrack(self);
        return;
    }

    this.getAudioURL = function(){
        return fileURL;
    }

    this.getId = function(){
        return trackId;
    }

    playlistItem.addEventListener("click", this.play);

    playlistItem.draggable = true;

    playlistItem.addEventListener("dragstart", function (e) {
        //@ts-ignore
        e.dataTransfer.setData("text", e.target.id);
    });

    playlistItem.addEventListener("dragover", function (e) {
        e.preventDefault();
    });

    playlistItem.addEventListener("drop", function (e) {
        e.preventDefault();
        var movingTrackId = parseInt(e.dataTransfer.getData("text").slice("Track".length), 10);
        var movingTrack = Track.allTracks[movingTrackId];
        var me = Track.allTracks[(parseInt(this.id.slice("Track".length), 10))];
        if(movingTrackId != me.getId())
            playlist.putTrackAfter(me, movingTrack);
        
    }
    );

    playlistItem.id = idString;

    var checkBox = document.createElement("input");
    checkBox.type = "checkbox";
    checkBox.style.cursor = "pointer";
    checkBox.checked = true;
    checkBox.title = "Disable track";

    function handleCheckBox(e){
        if(this.checked){
            self.enable();
        }else{
            self.disable("You turned this track off, click to re-enable");
        }
        e.stopPropagation();
    }
    
    checkBox.onclick = handleCheckBox;
    cover.src = _Player.resources.defaultCover.src;

    playlistItem.appendChild(cover);
    playlistItem.appendChild(songTitleTag);
    playlistItem.appendChild(checkBox);

    // Request meta data
    testDecoder.requestMetaData(fileElement.files[fileNumber]).then((response)=>{
        trackTitle = response.trackTitle;
        artist = response.artist;
        

        if(trackTitle != ""){
            songTitleTag.textContent = trackTitle;
        }

        if(response.trackCover != ""){
            cover.src = response.trackCover;
        }
    }).catch(console.log)
}


/**
 * @type {Track[]}
 */
 Track.allTracks = [];

var Sound = {
    data: {
        frequenceyAndWaveform: new Uint8Array(1),
        frequency: new Uint8Array(1),
        waveform: new Uint8Array(1),
        fft: 1024,
        fbc: 512
    }
}

/**
 * @param {{ [x: string]: {normal:string, hover:string}; }} stateSVGMapping
 */
function DynamicButton(stateSVGMapping){
    this.button = document.createElement("span");
    var svgCollection = {};
    var button = this.button;
    button.style.textAlign = "center";
    button.style.display = "inline-block";
    button.style.height = "100%";
    var self = this;
    
    for(var map in stateSVGMapping){
        var myImg = document.createElement("img");
        var myImg2 = document.createElement("img");
        myImg.src = stateSVGMapping[map].hover;
        myImg2.src = stateSVGMapping[map].normal;
        myImg.style.width = "100%";
        myImg2.style.width = "100%";
        myImg.style.maxHeight = "100%";
        myImg2.style.maxHeight = "100%"
        svgCollection[map] = {
            normal:myImg2,
            hover:myImg
        }
    }

    this.state = "";

    function clearChildren(){
        while (button.firstChild){
            button.removeChild(button.firstChild);
        }
    }

    function hover(){
        if(stateSVGMapping[self.state]){
            clearChildren();
            button.appendChild(svgCollection[self.state].hover);
        }
    }

    function out(){
        if(stateSVGMapping[self.state]){
            clearChildren();
            button.appendChild(svgCollection[self.state].normal);
        }
    }
    button.addEventListener("mouseover", hover);
    button.addEventListener("mouseout", out);
    button.classList.add("DynamicButtonContainer");

    this.setState = function(name=""){
        
        self.state = name;
        if(stateSVGMapping[name]){
            out()
        }
    }

}

/**
 * @param {TrackPlayer} player
 * @param {Playlist} playlist
 */
function Controller(player, playlist=null){
    var audioElement = player.getAudioElement();
    var controlContainer = document.createElement("div");
    var buttonContainer = document.createElement("div");
    var playButton = new DynamicButton({
        "play":{
            normal:Controller.resources.play,
            hover:Controller.resources.play_hover
        },
        "play_disabled":{
            normal:Controller.resources.play_disabled,
            hover:Controller.resources.play_disabled
        },
        "pause":{
            normal:Controller.resources.pause,
            hover:Controller.resources.pause_hover
        }
        });
    var timeLine = document.createElement("progress");
    var timeLineBG = null;
    var timeDot = null;
    var ffButton = new DynamicButton({
        "fastforward":{
            normal:Controller.resources.fastforward,
            hover:Controller.resources.fastforward_hover
        },
        "fastforward_disabled":{
            normal:Controller.resources.fastforward_disabled,
            hover:Controller.resources.fastforward_disabled
        }
        });
    var rrButton = new DynamicButton({
        "rewind":{
            normal:Controller.resources.rewind,
            hover:Controller.resources.rewind_hover
        },
        "rewind_disabled":{
            normal:Controller.resources.rewind_disabled,
            hover:Controller.resources.rewind_disabled
        }
        });
    var backTrack = new DynamicButton({
        "back":{
            normal:Controller.resources.back,
            hover:Controller.resources.back_hover
        },
        "back_disabled":{
            normal:Controller.resources.back_disabled,
            hover:Controller.resources.back_disabled
        }
        });
    var skipTrack = new DynamicButton({
        "skip":{
            normal:Controller.resources.skip,
            hover:Controller.resources.skip_hover
        },
        "skip_disabled":{
            normal:Controller.resources.skip_disabled,
            hover:Controller.resources.skip_disabled
        }
        });
    var volDot = null;
    var volLine = null;
    var volBack = null;
    var repeatToggle = new DynamicButton({
        "playList":{
            normal:Controller.resources.repeat_none,
            hover:Controller.resources.repeat_none_hover
        },
        "playTrack":{
            normal:Controller.resources.repeat_one,
            hover:Controller.resources.repeat_one_hover
        },
        "repeatTrack":{
            normal:Controller.resources.repeat_track,
            hover:Controller.resources.repeat_track_hover
        },
        "repeatList":{
            normal:Controller.resources.repeat_list,
            hover:Controller.resources.repeat_list_hover
        }
        });
    var shuffleToggle = new DynamicButton({
        "shuffle":{
            normal:Controller.resources.shuffle,
            hover:Controller.resources.shuffle_hover
        }
        });
    var optionButton = new DynamicButton({
        "option":{
            normal:Controller.resources.option,
            hover:Controller.resources.option_hover
        }
        });
    var hideButton = new DynamicButton({
        "hide":{
            normal:Controller.resources.hide,
            hover:Controller.resources.hide_hover
        }
        });
    var self = this;

    

    controlContainer.classList.add("player")
    controlContainer.appendChild(buttonContainer);
    buttonContainer.style.display = "flex";
    buttonContainer.style.width = "100%";
    buttonContainer.style.height = "70%";
    buttonContainer.style.alignItems = "center";
    buttonContainer.style.justifyContent = "center";
    
    //hideButton.button.style.flexShrink = "2";
    hideButton.setState("hide");

    function hidePlaylist(e){
        e.preventDefault();
        e.stopPropagation();
        var pLCont = player.getPlayerElement();
        pLCont.style.opacity = '0';
        pLCont.style.pointerEvents = 'none';
    }

    hideButton.button.addEventListener("click", hidePlaylist);
    buttonContainer.appendChild(hideButton.button);

    function showPlaylist(e){
        //TODO make this more proper/abstract
        var pLCont = player.getPlayerElement();
        pLCont.style.opacity = '1';
        pLCont.style.pointerEvents = '';
    }
    

    document.body.addEventListener("click", showPlaylist);


    //optionButton.button.style.flexShrink = "2";
    optionButton.setState("option");
    buttonContainer.appendChild(optionButton.button);

    //backTrack.button.style.flexShrink = "1";
    backTrack.setState("back");
    buttonContainer.appendChild(backTrack.button);

    
    //rrButton.button.style.flexShrink = "1";
    rrButton.setState("rewind");
    buttonContainer.appendChild(rrButton.button);

    // playButton.type = "Button";
    // playButton.value = "Play";
    //playButton.button.style.flexShrink = "1";
    playButton.setState("play_disabled");
    
    buttonContainer.appendChild(playButton.button);

    //ffButton.button.style.flexShrink = "1";
    ffButton.setState("fastforward");
    buttonContainer.appendChild(ffButton.button);
    
    //skipTrack.button.style.flexShrink = "1";
    skipTrack.setState("skip");
    buttonContainer.appendChild(skipTrack.button);

    //shuffleToggle.button.style.flexShrink = "2";
    shuffleToggle.setState("shuffle");
    buttonContainer.appendChild(shuffleToggle.button);

    //repeatToggle.button.style.flexShrink = "2";
    repeatToggle.setState("playList");
    buttonContainer.appendChild(repeatToggle.button);

    controlContainer.appendChild(document.createElement("br"));

    controlContainer.appendChild(timeLine);

    this.getControlPanel = function(){
        return controlContainer;
    }

    this.pause = function(){
        // Tell the play Button to show the play button
        playButton.setState("play");
        if(!audioElement.paused){
            audioElement.pause();
        }
    }

    this.play = function(){
        
        // Tell the play Button to show the pause button
        playButton.setState("pause");
        if(audioElement.paused){
            return audioElement.play();
        }else{
            return new Promise(function(resolve,reject){
                resolve();
            });
        }
    }

    this.connectPlaylist = function(/** @type {Playlist} */ newPlaylist){
        playlist = newPlaylist;
        
        skipTrack.button.onclick = () => {playlist.playNextTrack()};
        backTrack.button.onclick = () => {playlist.playNextTrack(true)};
        
        repeatToggle.setState(Playlist.MODE_STATE[playlist.getRepatMode()])
        repeatToggle.button.title = Playlist.MODE_TEXT[playlist.getRepatMode()];
        shuffleToggle.button.onclick = playlist.shuffleTracks;
    }

    function handlePlayButton(){
        if(audioElement.paused){
            self.play();
        }else{
            self.pause();
        }
    }

    playButton.button.onclick = handlePlayButton;

    function fastForward(){
        var playing = !audioElement.paused;
        if(isFinite(audioElement.duration))
        audioElement.currentTime = Math.min(audioElement.currentTime + 5, audioElement.duration);
    }

    function rewind(){
        var playing = !audioElement.paused;
        if(isFinite(audioElement.duration))
        audioElement.currentTime = Math.max(audioElement.currentTime - 5, 0);
    }

    function resumePlayback(){
        audioElement.playbackRate = 1;
    }

    ffButton.button.onmousedown = fastForward;
    ffButton.button.onmouseup = resumePlayback;
    ffButton.button.onmouseleave = resumePlayback;

    rrButton.button.onmousedown = rewind;
    rrButton.button.onmouseup = resumePlayback;
    rrButton.button.onmouseleave = resumePlayback;

    function updateProgress(){
        if(isNaN(audioElement.duration)){
            timeLine.max = 1;
            timeLine.value = 0;
        }else{
            timeLine.max = audioElement.duration;
            timeLine.value = audioElement.currentTime;
        }
    }

    setInterval(updateProgress, 100);

    function switchRepeatMode(){
        var cMode = playlist.getRepatMode();
        cMode ++;
        cMode %= Playlist.MODES.length;
        playlist.setRepeatMode(cMode);
        repeatToggle.setState(Playlist.MODE_STATE[cMode]);
        repeatToggle.button.title = Playlist.MODE_TEXT[cMode];
    }

    repeatToggle.button.title = Playlist.MODE_TEXT[0];
    repeatToggle.button.onclick = switchRepeatMode;


}

Controller.resources = {
    play_hover:"./resources/playHover.svg",
    play:"./resources/play.svg",
    play_disabled:"./resources/playDisabled.svg",
    pause:"./resources/pause.svg",
    pause_hover:"./resources/pauseHover.svg",
    back:"./resources/back.svg",
    back_disabled:"./resources/backDisabled.svg",
    back_hover:"./resources/backHover.svg",
    rewind:"./resources/rr.svg",
    rewind_disabled:"./resources/ffDisabled.svg",
    rewind_hover:"./resources/rrHover.svg",
    fastforward:"./resources/ff.svg",
    fastforward_disabled:"./resources/ffDisabled.svg",
    fastforward_hover:"./resources/ffHover.svg",
    skip:"./resources/skip.svg",
    skip_disabled:"./resources/skipDisabled.svg",
    skip_hover:"./resources/skipHover.svg",
    shuffle:"./resources/shuffle.svg",
    shuffle_disabled:"",
    shuffle_hover:"./resources/shuffleHover.svg",
    repeat_track:"./resources/repeatTrack.svg",
    repeat_track_disabled:"",
    repeat_track_hover:"./resources/repeatTrackHover.svg",
    repeat_list:"./resources/repeatList.svg",
    repeat_list_disabled:"",
    repeat_list_hover:"./resources/repeatListHover.svg",
    repeat_one:"./resources/playTrack.svg",
    repeat_one_disabled:"",
    repeat_one_hover:"./resources/playTrackHover.svg",
    repeat_none:"./resources/playList.svg",
    repeat_none_disabled:"",
    repeat_none_hover:"./resources/playListHover.svg",
    hide:"./resources/hide.svg",
    hide_hover:"./resources/hideHover.svg",
    option:"./resources/option.svg",
    option_hover:"./resources/optionHover.svg"
}

/**@param {Event} ev  */
function prevDef(ev){
    ev.preventDefault();
}

/**
 * @param {TrackPlayer} player 
 * @param {Controller} controller
 * @param {Track[]} tracksIn 
 */
function Playlist(player, controller, tracksIn=[]){
    var playingTrackPos = -1;
    var audioElement = player.getAudioElement();
    var fileElement = document.createElement("input");
    var self = this;
    var prog;
    fileElement.type = "file";
    fileElement.accept = "audio/*";
    fileElement.multiple = true;

    function assertProgress (){
        prog = true;
    }

    function assertFailure(){
        if(!prog){
            if (playingTrackPos != -1){
                trackList[playingTrackPos].disable("This track failed to play, click to re-enable", true);
            }
        self.playNextTrack();
        }
    }

    audioElement.addEventListener("progress", assertProgress);

    function loadTracksFromFile(){
        addTracks(fileElement.files);
    }

    fileElement.addEventListener("change", loadTracksFromFile);
    
    var repeat = Playlist.MODE.REPEAT_NONE;

    var trackList = tracksIn.slice(0);
    var PLContainer = document.createElement("div");
    var addSongElement = document.createElement("div");

    PLContainer.classList.add("playlist");

    addSongElement.classList.add("playlistItem");
    addSongElement.classList.add("addSong");
    addSongElement.innerHTML = "<b>&#x2b</b><br>Add songs";

    function clickFileElement() {
        var eve = new MouseEvent('click');
        player.enable();
        fileElement.dispatchEvent(eve);
    }

    addSongElement.addEventListener('click', clickFileElement);

    PLContainer.appendChild(addSongElement);

    function recieveDrop(e){
        e.preventDefault();
        var movingTrackId = parseInt(e.dataTransfer.getData("text").slice("Track".length), 10);
        var movingTrack = Track.allTracks[movingTrackId];
        var lastTrackId = trackList.length - 1;
        var lastTrack;
        if(lastTrackId > -1){
            lastTrack = trackList[lastTrackId];
            if(lastTrack.getId() != movingTrackId)
                self.putTrackAfter(lastTrack, movingTrack);
        }
    }

    addSongElement.addEventListener("dragover", prevDef);
    addSongElement.addEventListener("drop", recieveDrop);

    // This element is used for holding the spot of a song that's moving
    var placeHolderElement = document.createElement("div");
    placeHolderElement.classList.add("playlistItem");
    placeHolderElement.style.height = "0px";


    function shuffleList(inputList){
        function randomInt(start, end){
            // Generates random integer from start to end (exclusive)
            return Math.floor(Math.random() * (end - start) + start);
        }
        // Shuffles a list in place;
        var shuffledSectionEnd = 0;
        var elementCount = inputList.length;
        while(shuffledSectionEnd < elementCount){
            var selectedElement = randomInt(shuffledSectionEnd, elementCount);
            //swap selectedElement and suffledSection end;
            var temp = inputList[shuffledSectionEnd];
            inputList[shuffledSectionEnd] = inputList[selectedElement];
            inputList[selectedElement] = temp;
            shuffledSectionEnd ++;
        }

    }

    function updateE(i){
        trackList[i].getTrackElement().style.top = "0px";
    }

    function updateOrder(){
        // Updates the song list order
        // TODO

        // Get current positions
        var startPos = [];
        for(var i = 0; i < trackList.length; i++){
            startPos.push(trackList[i].getTrackElement().offsetTop);           
        }

        //Update order in DOM

        for(var i = 0; i < trackList.length; i++){        
            PLContainer.insertBefore(trackList[i].getTrackElement(), addSongElement);   
        }

        // calculate offset and animate
        for(var i = 0; i < trackList.length; i++){
            var newPos = trackList[i].getTrackElement().offsetTop;
            trackList[i].getTrackElement().style.top = (startPos[i] - newPos) + "px";
            // This triggers the instant movement of the element back to its original location (calculated above)
            // the timeout then triggers the animation to the new location by removing the offset
            PLContainer.insertBefore(trackList[i].getTrackElement(), trackList[i].getTrackElement());
            setTimeout(updateE, 1, i);
        }


    }

    this.shuffleTracks = function(){
        var cTrack = self.getCurrentTrack();
        shuffleList(trackList);
        if(cTrack != null){
            playingTrackPos = self.getPosOfTrack(cTrack);
        }
        updateOrder();
    }

    this.getNextTrack = function(wrap=false){
        var nextTrack =  playingTrackPos + 1;
        if(nextTrack >= trackList.length){
            if(wrap){
                nextTrack = 0;
            }else{
                return null;
            }
        }

        return trackList[nextTrack];

    }

    this.playNextTrack = function(playPrevTrack=false){
        if(playingTrackPos != -1){
            trackList[playingTrackPos].getTrackElement().classList.remove("songPlaying");
            audioElement.pause();
        }
        switch (repeat){
            case Playlist.MODE.REPEAT_NONE:// Fall through
            case Playlist.MODE.REPEAT_LIST:

                
                if(playPrevTrack){
                    playingTrackPos--;
                }else{
                    playingTrackPos++;
                }

                if(playingTrackPos >= trackList.length || playingTrackPos == -1){
                    if(repeat == Playlist.MODE.REPEAT_NONE){
                        
                        // We have hit the end of the list, so revert the playing
                        // index and return.
                        if(playPrevTrack){
                            playingTrackPos++;
                        }else{
                            playingTrackPos--;
                        }
                        return;
                    }else{
                        // go back to the begining
                        if(playPrevTrack){
                            playingTrackPos = trackList.length - 1;
                        }else{
                            playingTrackPos = 0;
                        }
                    }
                }
                if(trackList[playingTrackPos].isDisabled()){
                    // If the track is disabled, stop trying to play it and move on
                    setTimeout(self.playNextTrack, 250);
                    return;
                }else{
                    trackList[playingTrackPos].play()
                }
                break;
            case Playlist.MODE.REPEAT_TRACK:
                 if(trackList[playingTrackPos].isDisabled()){
                     // If the track is disabled, stop trying to play it :)
                     return;
                 }
                 trackList[playingTrackPos].play();

            default:
                return;
                 

        }
    }

    this.getCurrentTrack = function(){
        if(playingTrackPos == -1 || playingTrackPos >= trackList.length){
            return null;
        }
        return trackList[playingTrackPos];
    }

    this.getPosOfTrack = function(/** @type {Track} */ track){
        for(var i = 0; i < trackList.length; i ++){
            if(trackList[i] == track){
                return i;
            }
        }
        return -1;
    }

    this.getPlayingTrackPos = function(){
        return playingTrackPos;
    }

    /** @param {number} newId*/ 
    this.setPlayingTrackPos = function(newId){
        // Check if value is valid
        if(newId % 1 != 0 || newId < -1 || newId >= trackList.length){
            return false;
        }
        playingTrackPos = newId;
    }

    this.playTrack = function(/** @type {number | Track} */ newTrack){
        var oldId = playingTrackPos;
        
        /** @type {Track} */
        var track = null;
        if(typeof(newTrack) == "number"){
            if(newTrack % 1 != 0 || newTrack < -1 || newTrack >= trackList.length){
                return false;
            }
            playingTrackPos = newTrack;
            track = trackList[newTrack];

        }else{
            var newId = self.getPosOfTrack(newTrack);
            if(newId != -1){
                playingTrackPos = newId;
                track = newTrack;
            }else{
                return false;
            }
        }

        

        if(track.isDisabled())
            return false;
        
        if(oldId != -1)
            trackList[oldId].getTrackElement().classList.remove("songPlaying");

        if(!player.enabled()){
            player.enable();
        }

        audioElement.src = track.getAudioURL();
        audioElement.load();
        controller.play().then(() => track.getTrackElement().classList.add("songPlaying")).catch(assertFailure);
        prog = false;
        //prog = setTimeout(assertFailure, 10 * 1000);// Wait 10 seconds to see if audio has started
    }

    /**@param {number} id */
    this.getTrack = function(id){
        if(id % 1 != 0 || id < 0 || id >= trackList.length){
            return null;
        }
        
        return trackList[id];
    }

    this.getCurrentTrack = function(){
        if(playingTrackPos != -1){
            return trackList[playingTrackPos];
        }
    }

    this.getTrackCount = function(){
        return trackList.length;
    }

    function addTracks(fileList){
        var fileCount = fileList.length;
        for(var fileNum = 0; fileNum < fileCount; fileNum ++){
            var newTrack = new Track(fileElement, fileNum, player);
            trackList.push(newTrack);
            PLContainer.insertBefore(newTrack.getTrackElement(), addSongElement);
        }
    }

    this.addTracks = function(fileList){
        addTracks(fileList);
    }

    this.getPlaylistElement = function(){
        return PLContainer;
    }

    this.setRepeatMode = function(/** @type {number} */ mode){
        if(Playlist.MODES.includes(mode)){
            repeat = mode;
        }
    }

    this.getRepatMode = function(){
        return repeat;
    }

    this.putTrackAfter = function(/** @type {Track} */ trackInList, /** @type {Track} */ movingTrack, before=false){
        var tilLoc = self.getPosOfTrack(trackInList);
        var mtLoc = self.getPosOfTrack(movingTrack);
        if(tilLoc == -1 || mtLoc == -1 || tilLoc == mtLoc){
            // Tracks are not in same list or are the same track
            console.log("Error inserting track, reason(s):");
            if(tilLoc == -1)
                console.log("Could not find the trackInList's position in playlist");
            if(mtLoc == -1)
                console.log("Could not find the movingTrack's position in playlist, it may be in a different list");
            if(tilLoc == mtLoc)
                console.log("Both trackInList and movingTrack are the same");
            
            return;
        }

        trackList.splice(mtLoc, 1);
        if(tilLoc > mtLoc){
            tilLoc --;
        }
       
        if(before){
            // if this is true, we will actually insert the track before the current one
            trackList.splice(tilLoc, 0, movingTrack);
        }else{
            // We want the track to go after the given element, so we add one
            trackList.splice(tilLoc + 1, 0, movingTrack);
        }
        updateOrder();

    }


}

Playlist.MODE = {
    REPEAT_NONE : 0,
    REPEAT_LIST : 1,
    REPEAT_TRACK: 2,
    REPEAT_STOP: 3 // For just playing one song
}

Playlist.MODES = [Playlist.MODE.REPEAT_NONE, Playlist.MODE.REPEAT_LIST, Playlist.MODE.REPEAT_TRACK, Playlist.MODE.REPEAT_STOP];

Playlist.MODE_TEXT = [
    "Play List",
    "Repeat List",
    "Repeat Track",
    "Just One Track"
];

Playlist.MODE_STATE = [
    "playList",
    "repeatList",
    "repeatTrack",
    "playTrack"
];


function TrackPlayer() {

    this.getAudioElement = function(){
        return audioElement;
    }

    this.getSourceElement = function(){
        return sourceElement;
    }

    this.getPlayerElement = function(){
        return playerContainer;
    }

    function startContext(){
        // @ts-ignore
        // It doesn't like the webkit prefix :/
        
        var context= new (window.AudioContext || window.webkitAudioContext)();
        if(context != null){
            if(gainNode != null){
                throw "Cannot add a new context to player!"
            }
            audioCtx = context;
            analyser = audioCtx.createAnalyser();
            analyser.fftSize = Sound.data.fft;
            gainNode = audioCtx.createGain();
            // Set the volume
            gainNode.gain.setValueAtTime(volume, audioCtx.currentTime);

            mediaSource = audioCtx.createMediaElementSource(audioElement);
            mediaSource.connect(analyser);
            analyser.connect(gainNode);
            if(enabled)
                gainNode.connect(audioCtx.destination);
        }
    }

    this.getOutputNode = function(){
        return gainNode;
    }
    
    this.getAnalyser = function(){
        return analyser;
    }

    this.setVolume = function(/** @type {number} */ value){
        if(Number.isFinite(value) && value >= 0 && value <= 1){
            if(gainNode != null){
                gainNode.gain.setValueAtTime(value, audioCtx.currentTime);
            }
            volume = value;
        }
    }

    this.getVolume = function(){
        return volume;
    }

    this.disable = function(){
        if(enabled){
            if(gainNode != null){
                gainNode.disconnect(audioCtx.destination);
            }
        }
        // TODO disable the interface
        enabled = false;
    }

    this.enable = function(){
        if(!enabled){
            if(gainNode == null){
                startContext();
            }
            gainNode.connect(audioCtx.destination);
        }
        enabled = true;
    }

    this.enabled = function(){
        return enabled;
    }

    this.getPlaylist = function(){
        return playlist;
    }

    this.hasContext = function(){
        return gainNode != null;
    }

   

    var prog;

    var enabled = false;
    var volume = 1;
    var audioElement = document.createElement("audio");
    var sourceElement = document.createElement("source");
    var mediaSource = null;
    sourceElement.type = "audio/mp3";
    audioElement.addEventListener("error", (e) => {console.log("An Error occured\n", e)});
    audioElement.addEventListener("ended", () => {playlist.playNextTrack()});
    var controller = new Controller(this);
    var playlist = new Playlist(this, controller);
    
    controller.connectPlaylist(playlist);
    
    
    /** @type {AudioContext}*/
    var audioCtx = null;

    /** @type {AnalyserNode} */
    var analyser = null;
    
    /** @type {GainNode} */
    var gainNode = null;

    // Build the HTML player
    var playerContainer = document.createElement("div");
    playerContainer.classList.add("playerContainer");
    playerContainer.appendChild(controller.getControlPanel());
    playerContainer.appendChild(playlist.getPlaylistElement());
    playerContainer.appendChild(audioElement);
}


var _Player = {
    resources: {
        defaultCover: new Image(256, 256),
        errorCover: new Image(256, 256)

    },
    loadResources: function () {
        this.resources.defaultCover.src = "resources/Disc.png";
        this.resources.errorCover.src = "resources/DiscBroken.png";
    }

}

var testPlayer = new TrackPlayer();
var testDecoder = new TrackMetaDataDecoder();
var graphicPlayer = null;


function main(){
    _Player.loadResources();
    document.body.appendChild(testPlayer.getPlayerElement());
    Sound.data.frequenceyAndWaveform = new Uint8Array(Sound.data.fbc * 2);
    Sound.data.frequency = new Uint8Array(Sound.data.frequenceyAndWaveform.buffer, 0, Sound.data.fbc);
    Sound.data.waveform = new Uint8Array(Sound.data.frequenceyAndWaveform.buffer, Sound.data.fbc, Sound.data.fbc);
    graphicPlayer = new Graphics();
    update();
}

async function requestMic() {
    // if (navigator.mediaDevices.getUserMedia) {
    //     var allDevices = await navigator.mediaDevices.enumerateDevices();
    //     let length = allDevices.length;
    //     audioDevices = [];
    //     while (inputSelectEle.firstChild) {
    //         inputSelectEle.removeChild(inputSelectEle.firstChild);
    //     }
    //     for (let i = 0; i < length; i++) {
    //         if (allDevices[i].kind == "audioinput") {
    //             audioDevices.push(allDevices[i]);
    //             var newChild = document.createElement("option");
    //             newChild.innerHTML = allDevices[i].label;
    //             newChild.value = (audioDevices.length - 1).toString();
    //             inputSelectEle.appendChild(newChild);
    //         }
    //     }
    //     if (audioDevices.length > 0) {
    //         tryMic(0);
    //     }

    // } else {
    //     alert("***Could not obtain Microphone access***\nClick 'Load a File' to upload an audio file instead")
    // }

}

function tryMic(index) {
    // if (index >= 0 && audioDevices.length) {
    //     if (Sound.mic.playing) {
    //         Sound.mic.source.disconnect(Sound.analyser);//disconnect if connected
    //         Sound.mic.source = null;
    //         Sound.mic.playing = false;
    //     }
    //     navigator.mediaDevices.getUserMedia({ audio: { deviceId: audioDevices[index].deviceId } }).then(function (stream) {
    //         Sound.mic.source = Sound.ctx.createMediaStreamSource(stream);
    //         Sound.mic.source.connect(Sound.analyser);
    //         Sound.mic.playing = true;
    //         Sound.state.source = 1;
    //         Sound.gainNode.gain.setValueAtTime(0, Sound.ctx.currentTime);
    //         audioEle.pause();
    //         console.log(stream);

    //     }).catch(errorCallback);
    // }
    // TODO, rewrite function
}

function update() {
    requestAnimationFrame(update);
    var analyser = testPlayer.getAnalyser();
    if(analyser != null){
        analyser.getByteFrequencyData(Sound.data.frequency);
        analyser.getByteTimeDomainData(Sound.data.waveform);
    }

    var width = window.innerWidth;
    var height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;
    ct.clearRect(0, 0, width, height);
    ct.strokeStyle = "White";
    ct.fillStyle = "rgba(0, 255, 0, 0.5)";
    ct.beginPath();
    ct.moveTo(0, -Sound.data.frequency[0] + (height / 2));
    for (var i = 1; i < Sound.data.frequency.length; i++) {
        ct.lineTo(width / Sound.data.frequency.length * i, -(Sound.data.frequency[i] / 255 * height) + height);
    }
    ct.lineTo(width, height);
    ct.lineTo(0, height);
    //ct.fill();
    //ct.stroke();

    ct.beginPath();
    ct.moveTo(0, -Sound.data.waveform[0] + height / 2);
    for (var i = 1; i < Sound.data.waveform.length; i++) {
        ct.lineTo(width / Sound.data.waveform.length * i, -(Sound.data.waveform[i] / 255 * height) + height);
    }
    ct.lineTo(width, height);
    ct.lineTo(0, height);
    ct.strokeStyle = "rgba(255, 255, 0, 0.5)";

    //ct.stroke();
    graphicPlayer.render();
}

var lAvg;
var errorCallback = function (e) {
    alert("***Could not obtain Microphone access***\nClick 'Load a File' to upload an audio file instead\n" + e);
    console.log(e);
};