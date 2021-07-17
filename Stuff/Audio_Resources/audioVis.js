//@ts-check
/**
     * @type {HTMLSourceElement}
     */
    var audioSrc = document.getElementById("src");
    /**
     * @type {HTMLAudioElement}
     */
    var audioEle = document.getElementById("audio");
    /**
     * @type {HTMLInputElement}
     */
    var fileEle = document.getElementById("files");
    var playlistEle = document.getElementById("playlist");
    var placeHolder = document.createElement("Div");
    var addSongEle = document.getElementById("addSongs");//used as the "last playlist" item to allow drops into the final spot and allow shuffling
    var inputSelectEle = document.getElementById("inputSelect");
    var sidePanelArrow = document.getElementById("sidePanelArrow");
    var op = document.getElementById("op");
    var hasStarted = false;
    var audioDevices = [];
    /**
     * @type {HTMLCanvasElement}
     */
    var canvas = document.getElementById("can");
    var ct = canvas.getContext("2d");
    var movingSongId = -1;
    var ArrowTimer = 3;

    setInterval(
        function () {
            if (ArrowTimer > 0) {
                ArrowTimer--;
                if (ArrowTimer === 0) {
                    sidePanelArrow.style.opacity = "0";
                    sidePanelArrow.style.cursor = "none";
                }
            }
        }, 1000);

    audioEle.addEventListener("error", function (e) {
        console.log("An error was triggered");
        console.log(e);
    });

    audioEle.addEventListener("progress", function (e) {
        Player.songs[Player.songId].hasProgressed = true;
    });

    audioEle.addEventListener("stalled", function (e) {
        console.log("A stalled event was triggered");
        console.log(e);
    });

    audioEle.addEventListener("ended", function (e) {
        Player.nextSong();
    });

    placeHolder.classList.add("playlistItem");
    placeHolder.style.height = "0px";
    placeHolder.id = "placeHolder";

    addSongEle.addEventListener("dragover", function (e) {
        e.preventDefault();
    });

    addSongEle.addEventListener("drop", function (e) {
        e.preventDefault();

        var id = e.dataTransfer.getData("text");
        var movedEle = document.getElementById(id);
        playlistEle.insertBefore(movedEle, this);
        var movedId = parseInt(movedEle.id.substring(5, 10), 10);
        var oldIndex = -1;
        var newIndex = 0;

        if (movingSongId === -1) {
            placeHolder.style.height = "200px";
            playlistEle.insertBefore(placeHolder, movedEle);
            movedEle.style.height = "0px";
            setTimeout(function () {
                Player.songs[movingSongId].playlistItem.removeAttribute("style");
                placeHolder.style.height = "0px";
                movingSongId = -1;
            }, 1)

            movingSongId = movedId;
        }

        Player.songOrder.push(Player.songs[movedId]);
        for (; newIndex < Player.songOrder.length; newIndex++) {
            //insert the song before the one that is reciving the drop
            if (Player.songOrder[newIndex].id == movedId) {
                oldIndex = newIndex;
                break;
            }
        }

        if (oldIndex >= 0) {
            //remove old song if it was found
            Player.songOrder.splice(oldIndex, 1);
        }

        if (Player.songId >= 0) {
            for (var i = 0; i < Player.songOrder.length; i++) {
                //Update the song number as the list changed
                if (Player.songOrder[i].id === Player.songId) {
                    Player.songNumber = i;
                    break;
                }
            }
        }
    });

    function Cube(x, y, z, size, color, light, musicSection = Math.floor(Math.random() * Sound.analyser.frequencyBinCount)) {

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
        var VBO = Graphics.gl.createBuffer();
        var IBO = Graphics.gl.createBuffer();

        this.getVBO = function(){
            return VBO;
        }

        this.getIBO = function(){
            return IBO;
        }

        this.getModelMat = function(){
            return modelMat;
        }

        this.getNormalMat = function(){
            return normalMat;
        }

        var lazyArray = [];
        for (var i = 0; i < 6; i++) {
            //because I am too lazy to type a 36 element array
            lazyArray.push(i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 3, i * 4 + 1)
        }

        Graphics.gl.bindBuffer(Graphics.gl.ELEMENT_ARRAY_BUFFER, IBO);
        Graphics.gl.bufferData(Graphics.gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(lazyArray), Graphics.gl.STATIC_DRAW);
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
                -hs,  hs, hs, c[0], c[1], c[2], 0, 0, 1 * f, 0, 0,//front
                    hs, -hs, hs, c[0], c[1], c[2], 0, 0, 1 * f, 1, 1,
                    hs,  hs, hs, c[0], c[1], c[2], 0, 0, 1 * f, 1, 0,
                -hs, -hs, hs, c[0], c[1], c[2], 0, 0, 1 * f, 0, 1,

                -hs,  hs, -hs, c[0], c[1], c[2], -1 * f, 0, 0, 0, 0,//left
                -hs, -hs,  hs, c[0], c[1], c[2], -1 * f, 0, 0, 1, 1,
                -hs,  hs,  hs, c[0], c[1], c[2], -1 * f, 0, 0, 1, 0,
                -hs, -hs, -hs, c[0], c[1], c[2], -1 * f, 0, 0, 0, 1,

                    hs,  hs,  hs, c[0], c[1], c[2], 1 * f, 0, 0, 0, 0,//right
                    hs, -hs, -hs, c[0], c[1], c[2], 1 * f, 0, 0, 1, 1,
                    hs,  hs, -hs, c[0], c[1], c[2], 1 * f, 0, 0, 1, 0,
                    hs, -hs,  hs, c[0], c[1], c[2], 1 * f, 0, 0, 0, 1,

                -hs,  hs, -hs, c[0], c[1], c[2], 0, 1 * f, 0, 0, 0,//top
                    hs,  hs,  hs, c[0], c[1], c[2], 0, 1 * f, 0, 1, 1,
                    hs,  hs, -hs, c[0], c[1], c[2], 0, 1 * f, 0, 1, 0,
                -hs,  hs,  hs, c[0], c[1], c[2], 0, 1 * f, 0, 0, 1,

                -hs, -hs,  hs, c[0], c[1], c[2], 0, -1 * f, 0, 0, 0,//bottom
                    hs, -hs, -hs, c[0], c[1], c[2], 0, -1 * f, 0, 1, 1,
                    hs, -hs,  hs, c[0], c[1], c[2], 0, -1 * f, 0, 1, 0,
                -hs, -hs, -hs, c[0], c[1], c[2], 0, -1 * f, 0, 0, 1,

                    hs,  hs, -hs, c[0], c[1], c[2], 0, 0, -1 * f, 0, 0,//back
                -hs, -hs, -hs, c[0], c[1], c[2], 0, 0, -1 * f, 1, 1,
                -hs,  hs, -hs, c[0], c[1], c[2], 0, 0, -1 * f, 1, 0,
                    hs, -hs, -hs, c[0], c[1], c[2], 0, 0, -1 * f, 0, 1];

            Graphics.gl.bindBuffer(Graphics.gl.ARRAY_BUFFER, VBO);
            Graphics.gl.bufferData(Graphics.gl.ARRAY_BUFFER, new Float32Array(anotherArray), Graphics.gl.STATIC_DRAW);
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
            if(beatPoints < 0){
                beatPoints = 0;
            }
            if(beatPoints > 5){
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
                Graphics.lightPos[light * 3] = x;
                Graphics.lightPos[light * 3 + 1] = y;
                Graphics.lightPos[light * 3 + 2] = z;

                Graphics.lightColor[light * 3] = color[0] * power + 0.1;
                Graphics.lightColor[light * 3 + 1] = color[1] * power + 0.1;
                Graphics.lightColor[light * 3 + 2] = color[2] * power + 0.1;
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
                0, Math.sin(xr),  Math.cos(xr)];
            var ym = [
                    Math.cos(yr), 0, Math.sin(yr),
                0, 1, 0,
                -Math.sin(yr), 0, Math.cos(yr)];
            var zm = [
                Math.cos(zr), -Math.sin(zr), 0,
                Math.sin(zr),  Math.cos(zr), 0,
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
    var Graphics = {
        canvas: document.createElement("CANVAS"),
        gl: null,
        canvas_settings: {
            width: 0,
            height: 0,
            top: 0,
            left: 0,
            p_width: 0,
            p_height: 0,//previous width/height, lets a function know if the view port needs to be updated
            fullScreen: false,//if true the canvas will attempt to take up the whole screen
            shouldShow: true
        },
        settings: {
            backgroundColorSmoothing: 0.7, // to reduce strobe
            backgroundOpacity: 1.0,
            doBackgroundAnimation: true
        },
        particles: {

        },
        lightPos: [0, 0, 0,  0, 0, 0,  0, 0, 0,  0, 0, 0,  0, 0, 0,  0, 0, 0,  0, 0, 0,  0, 0, 0],
        lightColor: [0.25, 0.25, 0.25,  0.5, 0.0, 0.0,  0.0, 0.5, 0.0,  0.5, 0.5, 0.0,  0.0, 0.0, 0.5,  0.5, 0.0, 0.5,  0.0, 0.5, 0.5,  0.0, 0.0, 0.5],
        backgroundColor: [0, 0, 0],
        lightScore: [0, 0, 0, 0, 0, 0, 0, 0, 0],// to tell when to change light colors
        getNewLightColor: function(){
            var newColor = [Math.random(), Math.random(), Math.random()];
            // Normalize the color and divide it by 2
            var magnitude = Math.sqrt(newColor[0] ** 2 + newColor[1] ** 2 + newColor[2] ** 2) * 2;
            if (magnitude == 0){
                return [0, 0.5, 0];
            }else{
                return [newColor[0] / magnitude, newColor[1] / magnitude, newColor[2] / magnitude];
            }
        },
        backgroundColorGoal: [0, 0, 0],
        cubes: [],
        state: {
            mode: -1,//-2 is fatal error(IE no WebGL or Audioapi),-1 is not running, 0 is frequencyParticles, 1 is cubeField, 2 is cubeWaveForm
            particles: true//wether or not to do particles on modes that don't require it
        },
        camera: {
            height: 0,
            target: {
                x: 0,
                y: 0,
                z: -650
            },
            matrix: null,
            angle: 0,
            direction: 1
        },
        textures: {
            plainWhite: null, // texture 0
            transparentBlack: null, // texture 0
            frequencyData: null // texture 1
        },
        shaderSources: {
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
                }`/*fin = vec4(vec3(1.0,1.0,1.0) - color.rgb , opacity);
                    if (abs(_pos.y) < level){
                        fin = vec4(color.rgb * vec3((level - abs(_pos.y)) * 5.0), opacity);
                    }*/
                    //wave = texture2D(freqData, textPos + vec2(0.0, 0.5)).r;
                    /*
                    if(_pos.x > 0.0 && _pos.y > 0.0){
                        fin = texture2D(freqData, _pos);
                    }*/
        },
        uniforms: {
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
        },
        attributes: {
            main: {
                pos: null,
                color: null,
                tex: null,
                normal: null
            },
            fade: {
                pos: null
            }
        },
        programs: {
            main: null,
            fade: null
        },
        shaders: {
            vertexShaders: {
                main: null,
                fade: null
            },
            fragmentShaders: {
                main: null,
                fade: null
            }
        },
        buffers: {
            fadeCoverPoints: null,
            fadeCoverTriangles: null
        },
        matrix: {
            mult4x4: function (matA, matB) {
                return [
                    matA[ 0] * matB[0] + matA[ 1] * matB[4] + matA[ 2] * matB[8] + matA[ 3] * matB[12], matA[ 0] * matB[1] + matA[ 1] * matB[5] + matA[ 2] * matB[9] + matA[ 3] * matB[13], matA[ 0] * matB[2] + matA[ 1] * matB[6] + matA[ 2] * matB[10] + matA[ 3] * matB[14], matA[ 0] * matB[3] + matA[ 1] * matB[7] + matA[ 2] * matB[11] + matA[ 3] * matB[15],
                    matA[ 4] * matB[0] + matA[ 5] * matB[4] + matA[ 6] * matB[8] + matA[ 7] * matB[12], matA[ 4] * matB[1] + matA[ 5] * matB[5] + matA[ 6] * matB[9] + matA[ 7] * matB[13], matA[ 4] * matB[2] + matA[ 5] * matB[6] + matA[ 6] * matB[10] + matA[ 7] * matB[14], matA[ 4] * matB[3] + matA[ 5] * matB[7] + matA[ 6] * matB[11] + matA[ 7] * matB[15],
                    matA[ 8] * matB[0] + matA[ 9] * matB[4] + matA[10] * matB[8] + matA[11] * matB[12], matA[ 8] * matB[1] + matA[ 9] * matB[5] + matA[10] * matB[9] + matA[11] * matB[13], matA[ 8] * matB[2] + matA[ 9] * matB[6] + matA[10] * matB[10] + matA[11] * matB[14], matA[ 8] * matB[3] + matA[ 9] * matB[7] + matA[10] * matB[11] + matA[11] * matB[15],
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
        },
        buildShader(shaderSource, type) {
            var shader = this.gl.createShader(type);
            this.gl.shaderSource(shader, shaderSource);
            this.gl.compileShader(shader);
            console.log(this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS));
            console.log(this.gl.getShaderInfoLog(shader));
            return shader;
        },
        buildProgram(vertexShader, fragmentShader) {
            var program = this.gl.createProgram();
            this.gl.attachShader(program, vertexShader);
            this.gl.attachShader(program, fragmentShader);
            this.gl.linkProgram(program);
            return program;
        },
        toggleFullScreen(){
            if(Graphics.canvas_settings.fullScreen){
                Graphics.canvas_settings.fullScreen = false;

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
            }else{
                var dEle = document.documentElement;
                Graphics.canvas_settings.fullScreen = true
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
        },
        start() {
            if (this.mode >= 0) {
                return;
            }
            this.gl = this.canvas.getContext("webgl" || "experimental-webgl", { preserveDrawingBuffer: true, alpha: false });
            if (this.gl == undefined || this.gl == null) {
                this.mode = -2;
                console.log("Error: could not obtain WebGL context");
                alert("Faild to start visualizer!\nMake sure your web browser is up to date!")
                return;
            }
            this.canvas.style.zIndex = "-2";
            this.canvas.style.width = "100%";
            this.canvas.style.height = "100%";
            this.canvas.style.top = "0px";
            this.canvas.style.left = "0px";
            this.canvas.style.position = "absolute";
            document.body.appendChild(this.canvas);

            this.shaders.vertexShaders.fade = this.buildShader(this.shaderSources.fadeVertexShader, this.gl.VERTEX_SHADER);
            this.shaders.fragmentShaders.fade = this.buildShader(this.shaderSources.fadeFragmentShader, this.gl.FRAGMENT_SHADER);
            this.programs.fade = this.buildProgram(this.shaders.vertexShaders.fade, this.shaders.fragmentShaders.fade);
            this.gl.useProgram(this.programs.fade);
            this.attributes.fade.pos = this.gl.getAttribLocation(this.programs.fade, "pos");

            this.uniforms.fade.opacity = this.gl.getUniformLocation(this.programs.fade, "opacity");
            this.uniforms.fade.color = this.gl.getUniformLocation(this.programs.fade, "color");
            this.uniforms.fade.freqData = this.gl.getUniformLocation(this.programs.fade, "freqData");
            this.gl.uniform1f(this.uniforms.fade.opacity, 1);
            this.gl.enableVertexAttribArray(this.attributes.fade.pos);

            this.buffers.fadeCoverPoints = this.gl.createBuffer();
            this.buffers.fadeCoverTriangles = this.gl.createBuffer();

            this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.buffers.fadeCoverPoints);
            this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array([-1.0, -1.0, 1.0, -1.0, 1.0, 1.0, -1.0, 1.0]), this.gl.STATIC_DRAW);

            this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, this.buffers.fadeCoverTriangles);
            this.gl.bufferData(this.gl.ELEMENT_ARRAY_BUFFER, new Uint16Array([0, 1, 2, 0, 2, 3]), this.gl.STATIC_DRAW);

            this.shaders.vertexShaders.main = this.buildShader(this.shaderSources.mainVertexShader, this.gl.VERTEX_SHADER);
            this.shaders.fragmentShaders.main = this.buildShader(this.shaderSources.mainFragmentShader, this.gl.FRAGMENT_SHADER);
            this.programs.main = this.buildProgram(this.shaders.vertexShaders.main, this.shaders.fragmentShaders.main);
            this.gl.useProgram(this.programs.main);
            this.attributes.main.pos = this.gl.getAttribLocation(this.programs.main, "pos");
            this.attributes.main.color = this.gl.getAttribLocation(this.programs.main, "color");
            this.attributes.main.normal = this.gl.getAttribLocation(this.programs.main, "normal");
            this.attributes.main.tex = this.gl.getAttribLocation(this.programs.main, "tex");

            this.uniforms.main.world = this.gl.getUniformLocation(this.programs.main, "world");
            this.uniforms.main.perspective = this.gl.getUniformLocation(this.programs.main, "perspective");
            this.uniforms.main.texture = this.gl.getUniformLocation(this.programs.main, "texture");
            this.uniforms.main.ambient_color = this.gl.getUniformLocation(this.programs.main, "ambient_color");
            this.uniforms.main.fog_color = this.gl.getUniformLocation(this.programs.main, "fog_color");
            this.uniforms.main.light_color = this.gl.getUniformLocation(this.programs.main, "light_color");
            this.uniforms.main.light_pos = this.gl.getUniformLocation(this.programs.main, "light_pos");
            this.uniforms.main.normal_matrix = this.gl.getUniformLocation(this.programs.main, "normal_matrix");
            this.uniforms.main.model = this.gl.getUniformLocation(this.programs.main, "model");

            this.gl.enableVertexAttribArray(this.attributes.main.pos);
            this.gl.enableVertexAttribArray(this.attributes.main.color);
            this.gl.enableVertexAttribArray(this.attributes.main.normal);
            this.gl.enableVertexAttribArray(this.attributes.main.tex);



            this.gl.enable(this.gl.BLEND);
            this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA);

            this.gl.activeTexture(this.gl.TEXTURE0);
            this.textures.transparentBlack = this.gl.createTexture();
            this.gl.bindTexture(this.gl.TEXTURE_2D, this.textures.transparentBlack);
            this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, 1, 1, 0, this.gl.RGBA, this.gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 25]));

            this.textures.plainWhite = this.gl.createTexture();
            this.gl.bindTexture(this.gl.TEXTURE_2D, this.textures.plainWhite);

            // Fill the texture with a 1x1 white pixel.
            this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, 1, 1, 0, this.gl.RGBA, this.gl.UNSIGNED_BYTE, new Uint8Array([255, 255, 255, 255]));
            this.gl.uniform1i(this.uniforms.main.texture, 0);

            this.gl.activeTexture(this.gl.TEXTURE1);
            this.textures.frequencyData = this.gl.createTexture();
            this.gl.bindTexture(this.gl.TEXTURE_2D, this.textures.frequencyData);
            var myArray = new Uint8Array(32 * 32);
            for(var i = 0; i < 32 * 32; i++){
                myArray[i] =  i % 255;
            }
            this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.LUMINANCE, 32, 32, 0, this.gl.LUMINANCE, this.gl.UNSIGNED_BYTE, myArray);
            
            this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.NEAREST);
            this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.NEAREST);
            this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
            this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);

            this.gl.useProgram(this.programs.fade);
            this.gl.uniform1i(this.uniforms.fade.freqData, 1);

            this.gl.useProgram(this.programs.main);

            let r = -30 * Math.PI / 180;
            this.gl.bindTexture(this.gl.TEXTURE_2D, this.textures.plainWhite);
            this.gl.uniformMatrix3fv(this.uniforms.main.normal_matrix, false, this.matrix.identity(3));
            this.gl.uniformMatrix4fv(this.uniforms.main.model, false, this.matrix.identity(4));
            this.gl.uniformMatrix4fv(this.uniforms.main.world, false, [
                1, 0, 0, 0,
                0, Math.cos(r), -Math.sin(r), 0,
                0, Math.sin(r),  Math.cos(r), 0,
                0, 0, 0, 1]);
            this.gl.uniformMatrix4fv(this.uniforms.main.perspective, false, this.matrix.identity(4));
            this.gl.uniform3fv(this.uniforms.main.ambient_color, [0.05, 0.05, 0.05]);
            this.gl.uniform3fv(this.uniforms.main.light_color, this.lightColor);
            this.gl.uniform3fv(this.uniforms.main.light_pos, this.lightPos)
            this.resize();
            this.gl.enable(this.gl.DEPTH_TEST);
            this.gl.depthFunc(this.gl.LEQUAL);
            this.gl.clearDepth(1.0);
            this.gl.enable(this.gl.CULL_FACE);
            this.gl.clearColor(0.0, 0.0, 0.0, 1.0);
            this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);

            // Start generating the cubes, TODO mabye seperate this into a different function?
            var chosenLights = [];
            var possibleList = [];
            var numberOfCubes = 300;
            this.cubes = [];
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
                var ms = Math.floor(i / numberOfCubes * Sound.analyser.frequencyBinCount);
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
                this.cubes.push(new Cube(x, y, z, Math.random() * 3 + 3, color, l, ms));

            }

        },
        resize: function () {
            var newWidth = this.canvas.getBoundingClientRect().width;
            var newHeight = this.canvas.getBoundingClientRect().height;
            this.canvas.width = newWidth;
            this.canvas.height = newHeight;
            if (this.gl) {
                this.gl.viewport(0, 0, newWidth, newHeight);
                var f = Math.tan(Math.PI * 0.5 - 0.5 * 90 * Math.PI / 180);
                var rangeInv = 1.0 / (1 - 10000);
                var aspect = newWidth / newHeight;
                perspectiveMatrix = [
                    f / aspect, 0, 0, 0,
                    0, f, 0, 0,
                    0, 0, (1 + 10000) * rangeInv, -1,
                    0, 0, 1 * 10000 * rangeInv * 2, 0
                ]
                this.gl.uniformMatrix4fv(this.uniforms.main.perspective, false, perspectiveMatrix);
            }
        },
        render: function () {

            var totals = [0, 0, 0];
            for (var i = 0; i < this.lightColor.length; i += 3) {
                totals[0] += this.lightColor[i];
                totals[1] += this.lightColor[i + 1];
                totals[2] += this.lightColor[i + 2];
            }
            var spike = 2;
            lAvg = [Math.pow(totals[0] / 2, spike), Math.pow(totals[1] / 2, spike), Math.pow(totals[2] / 2, spike)]
            this.backgroundColorGoal = lAvg;

            for(var i = 0; i < 3; i++){
                var colorDif = this.backgroundColorGoal[i] - this.backgroundColor[i];
                this.backgroundColor[i] += colorDif * (1 - this.settings.backgroundColorSmoothing);
            }

            this.gl.useProgram(this.programs.fade)
            this.gl.uniform3fv(this.uniforms.fade.color, this.backgroundColor);
            

            this.gl.activeTexture(this.gl.TEXTURE1)
            this.gl.bindTexture(this.gl.TEXTURE_2D, this.textures.frequencyData);
            this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.LUMINANCE, 32, 32, 0, this.gl.LUMINANCE, this.gl.UNSIGNED_BYTE, Sound.data.frequenceyAndWaveform);
            //this.gl.uniform1iv(this.uniforms.fade.freq, Sound.data.frequency);

            this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.buffers.fadeCoverPoints);
            this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, this.buffers.fadeCoverTriangles);

            this.gl.vertexAttribPointer(this.attributes.fade.pos, 2, this.gl.FLOAT, false, 4 * (2), 0);

            this.gl.drawElements(this.gl.TRIANGLES, 6, this.gl.UNSIGNED_SHORT, 0);

            this.gl.useProgram(this.programs.main);

            var camera = this.camera;
            camera.angle += camera.direction;
            if (camera.angle > 90) {
                camera.direction = -0.1;
            }
            if (camera.angle < -90) {
                camera.direction = 0.1;
            }
            camera.height = -Math.sin(camera.angle / 180 * Math.PI) * 500;
            var r = Math.asin(camera.height / Math.sqrt(camera.height ** 2 + camera.target.z ** 2));
            var camMatrix = [
                1, 0, 0, 0,
                0, Math.cos(r), -Math.sin(r), 0,
                0, Math.sin(r),  Math.cos(r), 0,
                0, 0, 0, 1];
            camMatrix = this.matrix.mult4x4([
                1, 0, 0, 0,
                0, 1, 0, 0,
                0, 0, 1, 0,
                0, camera.height, 0, 1]
                , camMatrix);
            this.gl.uniformMatrix4fv(this.uniforms.main.world, false, camMatrix);

            this.gl.clearColor(lAvg[0], lAvg[1], lAvg[2], 1.0);
            this.gl.clear(this.gl.DEPTH_BUFFER_BIT);// TODO Make this change based on settings

            this.gl.uniform3fv(this.uniforms.main.light_color, this.lightColor);
            this.gl.uniform3fv(this.uniforms.main.light_pos, this.lightPos)
            this.gl.uniform3fv(this.uniforms.main.ambient_color, [lAvg[0] / 8, lAvg[1] / 8, lAvg[2] / 8]);
            for (var i = 0; i < this.cubes.length; i++) {
                /**
                 * @type {Cube}
                 */
                var cc = this.cubes[i];
                cc.update();
                this.gl.bindBuffer(this.gl.ARRAY_BUFFER, cc.getVBO());
                this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, cc.getIBO());
                //[x, y, z, r, g, b, nx, ny, nz, tx, ty]
                this.gl.uniformMatrix4fv(this.uniforms.main.model, false, cc.getModelMat());
                this.gl.uniformMatrix3fv(this.uniforms.main.normal_matrix, false, cc.getNormalMat());

                this.gl.vertexAttribPointer(this.attributes.main.pos, 3, this.gl.FLOAT, false, 4 * (11), 0);
                this.gl.vertexAttribPointer(this.attributes.main.color, 3, this.gl.FLOAT, false, 4 * (11), 3 * 4);
                this.gl.vertexAttribPointer(this.attributes.main.normal, 3, this.gl.FLOAT, false, 4 * (11), 6 * 4);
                this.gl.vertexAttribPointer(this.attributes.main.tex, 2, this.gl.FLOAT, false, 4 * (11), 9 * 4);

                this.gl.drawElements(this.gl.TRIANGLES, cc.bufferLength, this.gl.UNSIGNED_SHORT, 0);

                //cc.buildModelMat();
            }
        }


    }

    function Song(fileElement, fileNumber, idNumber=Player.songs.length) {
        this.length = 0;
        this.id = idNumber;
        this.title = "Unknown";
        this.fileName = fileElement.files[fileNumber].name;
        this.artist = "Unkown Artist";
        this.album = "Unkown Album";
        this.composer = "";
        this.cover = new Image(100, 100);//cover image file if one exists
        this.songTitleTag = document.createElement("div");
        this.flagged = false;//if true this song has an error that wont allow it to play
        this.format = "";
        this.hasProgressed = false;//helps catch songs that will not load
        this.fileElement = fileElement;//describes which file element holds this song's files
        this.fileNumber = fileNumber;
        this.URL = URL.createObjectURL(fileElement.files[fileNumber]);//used to store the URL created to pass song as a source to the audio player
        this.active = true;//so user can deactivate a song

        this.playlistItem = document.createElement("div");
        this.songTitleTag.innerHTML = this.fileName;

        this.playlistItem.classList.add("playlistItem");
        this.songTitleTag.classList.add("songTitle");
        this.cover.classList.add("songCover");

        this.isDisabled = function () {
            if (!this.active || this.flagged) {
                return true;
            }
            return false;
        }
        this.play = function () {//returns true if successful
            start();//incase the code has not started yet

            if (Sound.mic.playing) {
                Sound.mic.playing = false;
                Sound.mic.source.disconnect(Sound.analyser);
                Sound.state.source = 0;
            }

            if (this.isDisabled()) {
                return false;
            }

            if (Player.songId >= 0) {
                Player.songs[Player.songId].playlistItem.classList.remove("songPlaying");
            }

            Player.songId = this.id;
            Sound.gainNode.gain.setValueAtTime(Player.volume, Sound.ctx.currentTime);
            audioSrc.src = this.URL;
            audioEle.load();
            audioEle.play().then(function () {
                Player.songOrder[Player.songNumber].playlistItem.classList.add("songPlaying");
            }).catch(function (e) {
                console.log(e);
            });
            setTimeout(function () {
                var song = Player.songs[Player.songId];
                if (!song.hasProgressed) {
                    song.flagged = true;
                    song.active = false;
                    song.checkBox.checked = false;
                    song.checkBox.title = "This song failed to load.";
                    song.checkBox.style.cursor = "not-allowed";
                    song.playlistItem.classList.add("songInError");
                    song.cover.src = Player.resources.errorCover.src;
                    Player.nextSong();
                }
            }, 1000)

            for (var i = 0; i < Player.songOrder.length; i++) {//find itself in the songOrder list to get the number so play can coninue from there if shuffeled
                if (Player.songOrder[i] === this) {
                    Player.songNumber = i;
                    break;
                }
            }
            return true;
        }
        //this.playlistItem.style.cursor = "grab";
        this.playlistItem.addEventListener("click", function () {
            var songId = parseInt(this.id.substring(5, 10), 10);
            Player.songs[songId].play();
        });

        this.playlistItem.draggable = true;
        this.playlistItem.addEventListener("dragstart", function (e) {
            e.dataTransfer.setData("text", e.target.id);
        });
        this.playlistItem.addEventListener("dragover", function (e) {
            e.preventDefault();
        });
        this.playlistItem.addEventListener("drop", function (e) {
            e.preventDefault();
            var id = e.dataTransfer.getData("text");
            var movedEle = document.getElementById(id);
            if (movingSongId === -1) {
                placeHolder.style.height = "160px";
                playlistEle.insertBefore(placeHolder, movedEle);
                movedEle.style.height = "0px";
                setTimeout(function () {
                    Player.songs[movingSongId].playlistItem.removeAttribute("style");
                    placeHolder.style.height = "0px";
                    movingSongId = -1;
                }, 1)
            }
            playlistEle.insertBefore(movedEle, this);

            var songId = parseInt(this.id.substring(5, 10), 10);
            var movedId = parseInt(movedEle.id.substring(5, 10), 10);
            if (movingSongId === -1)
                movingSongId = movedId;
            var oldIndex = -1;
            var newIndex = 0;

            for (; newIndex < Player.songOrder.length; newIndex++) {
                if (Player.songOrder[newIndex].id == songId) {
                    Player.songOrder.splice(newIndex, 0, Player.songs[movedId]);//insert the song before the one that is reciving the drop
                    newIndex++;
                }
                if (Player.songOrder[newIndex].id == movedId) {
                    oldIndex = newIndex;
                }
            }
            if (oldIndex >= 0) {
                Player.songOrder.splice(oldIndex, 1);//remove old song if it was found
            }

            if (Player.songId >= 0) {
                for (var i = 0; i < Player.songOrder.length; i++) {//Update the song number as the list changed
                    if (Player.songOrder[i].id === Player.songId) {
                        Player.songNumber = i;
                        break;
                    }
                }
            }
        });

        var idString = (Player.songs.length).toString();

        while (idString.length < 5) {
            idString = "0" + idString;
        }

        this.playlistItem.id = "song" + idString;
        this.checkBox = document.createElement("input");
        this.checkBox.type = "checkbox";
        this.checkBox.style.cursor = "pointer";
        this.checkBox.checked = true;
        this.checkBox.title = "Disable Song";
        this.cover.src = Player.resources.defaultCover.src;
        this.checkBox.addEventListener("click", function (event) {
            var songId = parseInt(this.parentElement.id.substring(5, 10), 10);
            Player.songs[songId].active = this.checked;
            if (this.checked && !Player.songs[songId].isDisabled()) {//checks if the song is Disabled for another reason before activating song.
                Player.songs[songId].playlistItem.classList.remove("songDisabled");
            } else if (this.checked) {//if the last check failed but the check mark was checked, keep the song Disabled as it may be flagged.
                this.checked = false;
                Player.songs[songId].active = false;
                this.style.cursor = "not-allowed";
                this.title = "An error occurred with this song file";
                Player.songs[songId].playlistItem.classList.remove("songDisabled");
                Player.songs[songId].playlistItem.classList.add("songInError");
                Player.songs[songId].cover.src = Player.resources.errorCover.src;
            } else {
                Player.songs[songId].playlistItem.classList.add("songDisabled");
                this.title = "Enable Song";
            }
            event.stopPropagation();
        });

        this.playlistItem.appendChild(this.cover);
        this.playlistItem.appendChild(this.songTitleTag);
        this.playlistItem.appendChild(this.checkBox);
        playlistEle.insertBefore(this.playlistItem, addSongEle);
    }
    var Sound = {
        ctx: null,
        gainNode: null,
        analyser: null,
        state: {
            volume: 0,
            source: -1,//-1 for none, 0 for music, 1 for microphone
        },
        mic: {
            source: null,//the aduio context source
            playing: false//tells if the microphone is active or not
        },
        music: {
            source: null//the html element that will play the music is linked here
            //playing is not needed as this will not be controlled by the Sound object but the player object
        },
        data: {
            frequenceyAndWaveform: new Uint8Array(1),
            frequency: new Uint8Array(1),
            waveform: new Uint8Array(1)
        }

    }

    var Player = {
        songs: [],
        songOrder: [],
        songId: -1,//Identifies the song in the songs list currently playing, this list can only be added to, cannot change order or the ID system breaks down
        songNumber: -1,//Identifies the song in the songOrder list, which is a list of song ID's that correspond to the songs list.
        paused: true,
        playing: false,
        shuffle: false,
        volume: 1,
        repeat: 0,//0 for no repeats, 1 for repeat playlist, 2 for repeat song, 3 for play one song
        showPanel: true,
        controls: {//List of HTML elements for the controls on screen
            controlContainer: null,
            playButton: null,//play and pause
            timeLine: null,
            timeBack: null,//background of the line
            timeDot: null,
            fastforwardButton: null,
            rewindButton: null,
            backButton: null,
            skipButton: null,
            volumeDot: null,
            volumeLine: null,
            volumeBack: null,
            repeatButton: null,
            shuffleButton: null,
            optionButton: null
        },
        resources: {//List of images
            pause: new Image(256, 256),
            play: new Image(256, 256),
            repeatAll: new Image(256, 256),
            repeatOne: new Image(256, 256),
            repeatNone: new Image(256, 256),
            shuffleOn: new Image(256, 256),
            shuffleOff: new Image(256, 256),
            fastforward: new Image(256, 256),
            skip: new Image(256, 256),
            back: new Image(256, 256),
            rewind: new Image(256, 256),
            dot: new Image(256, 256),
            pauseDisabled: new Image(256, 256),
            playDisabled: new Image(256, 256),
            skipDisabled: new Image(256, 256),
            backDisabled: new Image(256, 256),
            rewindDisabled: new Image(256, 256),
            fastforwardDisabled: new Image(256, 256),
            defaultCover: new Image(256, 256),
            errorCover: new Image(256, 256),
            options: new Image(256, 256)

        },
        loadResources: function () {
            this.resources.defaultCover.src = "Audio_Resources/Disc.png";
            this.resources.errorCover.src = "Audio_Resources/DiscBroken.png";
            this.resources.repeatAll.src = "Audio_Resources/RepeatAll.png";
            this.resources.repeatOne.src = "Audio_Resources/RepeatOne.png";
            this.resources.repeatNone.src = "Audio_Resources/RepeatNone.png";
            this.resources.options.src = "Audio_Resources/Options.png";
        },
        loadSongs: function (fileList) {
            var fLength = fileList.length
            for (var sc = 0; sc < fLength; sc++) {
                var newSong = new Song(fileEle, sc);
                Player.songs.push(newSong);
                Player.songOrder.push(Player.songs[Player.songs.length - 1]);//add to the song order
            }
        },
        nextSong: function () {
            switch (Player.repeat) {
                case 0:
                    Player.songNumber++;
                    if (Player.songNumber >= Player.songOrder.length) {//we have reached the end of the playlist
                        Player.songNumber = 0;
                        return;
                    }
                    var suc = Player.songOrder[Player.songNumber].play();
                    if (!suc) {//the play failed
                        Player.nextSong();
                    }

                    break;
                case 1:
                    Player.songNumber++;
                    if (Player.songNumber >= Player.songOrder.length) {
                        Player.songNumber = 0;
                    }
                    var suc = Player.songOrder[Player.songNumber].play();
                    if (!suc) {//the play failed
                        Player.nextSong();
                    }

                    break;
                case 2:
                    if (Player.songOrder[Player.songNumber].isDisabled())
                        return;
                    Player.songOrder[Player.songNumber].play();

                    break;
                case 3:
                    return;
                    break;
                default:
                    return;


            }
        },
        shuffleSongs: function () {
            var remainingSongs = Player.songOrder.slice(0);
            for (var i = 0; remainingSongs.length > 0; i++) {
                var numberOfSongs = remainingSongs.length;
                var songSelected = Math.floor(Math.random() * numberOfSongs);
                Player.songOrder[i] = remainingSongs[songSelected];
                playlistEle.insertBefore(Player.songOrder[i].playlistItem, addSongEle);
                remainingSongs.splice(songSelected, 1);
            }
        }

    }

    var fileElements = [];//a list of file elements that can hold the music files

    function start() {
        if (hasStarted)
            return;
        hasStarted = true;
        Sound.ctx = new (window.AudioContext || window.webkitAudioContext)();
        Sound.music.source = Sound.ctx.createMediaElementSource(audioEle);
        Sound.analyser = Sound.ctx.createAnalyser();
        Sound.gainNode = Sound.ctx.createGain();
        Sound.music.source.connect(Sound.analyser);
        Sound.analyser.connect(Sound.gainNode);
        Sound.gainNode.connect(Sound.ctx.destination);
        //Sound.analyser.smoothingTimeConstant = 0;
        Sound.gainNode.gain.setValueAtTime(0, Sound.ctx.currentTime);//Mute audio so it doesn't create feedback
        Sound.analyser.fftSize = 1024;
        fileEle.addEventListener("change", function () {
            Sound.gainNode.gain.setValueAtTime(1, Sound.ctx.currentTime);
            if (Sound.mic.playing) {
                Sound.mic.source.disconnect(Sound.analyser);
                Sound.mic.playing = false;
            }
            Player.loadSongs(fileEle.files);
        })
        //fEle.addEventListener("change",function(){audioSrc.src=URL.createObjectURL(fEle.files[0]);aEle.load();aEle.play();gainNode.gain.setValueAtTime(1,Sound.ctx.currentTime);if(mSource){mSource.disconnect(analyser)}})
        Sound.data.frequenceyAndWaveform = new Uint8Array(Sound.analyser.frequencyBinCount * 2);
        Sound.data.frequency = new Uint8Array(Sound.data.frequenceyAndWaveform.buffer, 0, Sound.analyser.frequencyBinCount);
        Sound.data.waveform = new Uint8Array(Sound.data.frequenceyAndWaveform.buffer, Sound.analyser.frequencyBinCount, Sound.analyser.frequencyBinCount);
        Player.loadResources();
        Graphics.start();
        update();
    };
    async function requestMic() {
        if (navigator.mediaDevices.getUserMedia) {
            var allDevices = await navigator.mediaDevices.enumerateDevices();
            let length = allDevices.length;
            audioDevices = [];
            while (inputSelectEle.firstChild) {
                inputSelectEle.removeChild(inputSelectEle.firstChild);
            }
            for (let i = 0; i < length; i++) {
                if (allDevices[i].kind == "audioinput") {
                    audioDevices.push(allDevices[i]);
                    var newChild = document.createElement("option");
                    newChild.innerHTML = allDevices[i].label;
                    newChild.value = (audioDevices.length - 1).toString();
                    inputSelectEle.appendChild(newChild);
                }
            }
            if (audioDevices.length > 0) {
                tryMic(0);
            }

        } else {
            alert("***Could not obtain Microphone access***\nClick 'Load a File' to upload an audio file instead")
        }

    }
    function tryMic(index) {
        if (index >= 0 && audioDevices.length) {
            if (Sound.mic.playing) {
                Sound.mic.source.disconnect(Sound.analyser);//disconnect if connected
                Sound.mic.source = null;
                Sound.mic.playing = false;
            }
            navigator.mediaDevices.getUserMedia({ audio: { deviceId: audioDevices[index].deviceId } }).then(function (stream) {
                Sound.mic.source = Sound.ctx.createMediaStreamSource(stream);
                Sound.mic.source.connect(Sound.analyser);
                Sound.mic.playing = true;
                Sound.state.source = 1;
                Sound.gainNode.gain.setValueAtTime(0, Sound.ctx.currentTime);
                audioEle.pause();
                console.log(stream);

            }).catch(errorCallback);
        }
    }
    function update() {
        requestAnimationFrame(update);
        Sound.analyser.getByteFrequencyData(Sound.data.frequency);
        Sound.analyser.getByteTimeDomainData(Sound.data.waveform);

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
        Graphics.render();
    }
    var errorCallback = function (e) {
        alert("***Could not obtain Microphone access***\nClick 'Load a File' to upload an audio file instead\n" + e);
        console.log(e);
    };