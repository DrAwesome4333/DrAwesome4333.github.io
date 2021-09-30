// @ts-check
//import('./cubeSolverV3.2.js').then(m => module = m)
import {BinaryData} from "./modules/binarydata.js"
import {AlgorithmStorage, Filter} from "./modules/algorithmstorage.js"
import {CUBE_DATA_TYPE, CUBIE_TYPE,CUBIE_STYLE, CUBE_FACE} from "./modules/cubeconsts.js"
import {CubeData, CubeError, Cubie} from "./modules/cubedata.js"
import {Matrix} from "./modules/matrix.js"
import {solveCube, CubeNode} from "./modules/solver.js"

		const PR = Math.PI / 180;//(Pi ratio, use this to convert degrees to Radians)

		const  VBO_FORMAT="vx,vy,vz,tu,tv,nx,ny,nz";

		var shouldLogErrors = true;

		var webWorkersAvailable = false;

		if(window.Worker){
			webWorkersAvailable = true;
			console.log("Web worker support!");
		}else{
			console.info("No worker support");
		}

		
		/*
		Cube data always starts with the left most information, then bottom most, and then back most. (smaller to biggest) (with the excpetion of model files)
		There are a few formats a Cube can be save in:
		Surface: an array filled with the information about each sticker of the cube, each sticker takes up 3 bits. Used for the editable cubes, 
		Piece: an array filled with the information about each location and the piece that fills it, each location takes up 5 bits. Used for solving and animating cubes
		Compact: An array filled with information about each corner location, no orientation or other pieces are saved, this loses a lot of information. Used for quick testing and creating,
		 should only be used when speed and memory are required and actual cube information is not, helps lower the number of cubes needed to actualy test a solve on.
		Fast: An array were each item in the array contains a sticker simmilar to Surface type but not compressed, it does not need to deal with bits to work so it does not need a lot of
			Utility functions, Cubes can take up a lot of space.
		All cubes are stored with a Uint8 Array for memory reasons. Several cubes can be saved in one, must be cubes of the same size and format for best results.
		*/

		/*
		Format information
		Surface: Bits per Cube: 18 * size^2;
		Piece: Bits per Cube: 5 * (size^3 - (size-2)^3);
		Compact: Bits per Cube: 24 Bytes: 3
		
		*/



		// if(webWorkersAvailable){
		// 	AlgorithmStorage.hardWorker = new Worker("cubeSolverV3.2Worker.js");
		// 	AlgorithmStorage.hardWorker.postMessage("test");
		// 	AlgorithmStorage.hardWorker.onmessage = function(e){
		// 		console.log("Main: " + e.data)
		// 	}
		// }

	




		/**@param {number}x */
		function triNum(x){
			// Returns the triangle number of x
			// Used in orbit Identification of a cube
			return 0.5 * (x ** 2) + 0.5 * x;
		}

		/**@param {number}y */
		function inverseTriNum(y){
			// Returns the positive inverse of a triangle number
			// useful for identifying triangle numbers
			return (-0.5 + Math.sqrt(0.25 - 2 * (-y)));
		}

		var mainVertexSource = `
		    uniform mat4 model_matrix;
		    uniform mat4 perspective_matrix;
		    attribute vec3 point;
		    attribute vec2 main_uv;
			attribute vec3 normal;
		    varying vec2 _main_uv;
			varying vec3 _fragment_position;
			varying vec3 _normal;
		    void main(void){
		        _main_uv = main_uv;
		        _normal = mat3(model_matrix) * normal;
				_fragment_position = (model_matrix * vec4(point,1.0)).xyz;
		        gl_Position = perspective_matrix * model_matrix * vec4(point, 1.0);
		    }
		    `;

		var mainAttributes = ["point", "main_uv", "normal"];
		var mainUniforms = [
			{
				name:"model_matrix",
				type:"matrix4fv"
			},{
				name:"perspective_matrix",
				type:"matrix4fv"
			},{
				name:"main_texture",
				type:"1i"
			},{
				name:"colors",
				type:"3fv"
			},{
				name:"overlay_color",
				type:"3fv"
			},{
				name:"back_light",
				type:"1iv"
			},{
				name:"overlay",
				type:"1iv"
			},{
				name:"light_direction",
				type:"3fv"
			}
		];

		var mainFragmentSource = `
		    precision highp float;
		    uniform sampler2D main_texture;
			uniform vec3 colors[4];
		    uniform vec3 overlay_color;
			uniform bool back_light[4];
			uniform bool overlay[3];
			uniform vec3 light_direction;
			vec3 surface_to_Eye;
			vec3 halfV;
			vec4 data;
			vec3 out_color;
			vec3 _light_direction;// Because we can't normalize a uniform
		    varying vec2 _main_uv;
			varying vec3 _fragment_position;
			varying vec3 _normal;
		    void main(void){
				// Calculate specular light levels
				surface_to_Eye = normalize(-_fragment_position);
				halfV = normalize(normalize(-light_direction) + surface_to_Eye);
				float spec = max(pow(dot(normalize(_normal), halfV), 1000.0), 0.0);

				// Calculate regular light level
				_light_direction = -normalize(light_direction);
				float light_level = max(dot(_light_direction, normalize(_normal)), 0.2);

				if(light_level <= 0.0){
					// Don't do specular light if there is no light
					spec = 0.0;
				}

		        data = texture2D(main_texture, _main_uv);
				// Red and green identify the side 0, 0 being no side
				if(data.r == 0.0 && data.g == 0.0){
					if(back_light[3]){
						out_color = colors[3];
					}else{
						out_color = colors[3] * light_level + vec3(spec);
					}

				} else if(data.r > 0.0 && data.g == 0.0){

					if(back_light[0]){
						out_color = colors[0];
					}else{
						out_color = colors[0] * light_level + vec3(spec);

						if(overlay[0]){
							out_color *= overlay_color;
						}
					}

				} else if(data.r == 0.0 && data.g > 0.0){

					if(back_light[1]){
						out_color = colors[1];
					}else{
						out_color = colors[1] * light_level + vec3(spec);

						if(overlay[1]){
							out_color *= overlay_color;
						}
					}

				} else {

					if(back_light[2]){
						out_color = colors[2];
					}else{
						out_color = colors[2] * light_level + vec3(spec);

						if(overlay[2]){
							out_color *= overlay_color;
						}
					}

				}

		        gl_FragColor = vec4(out_color , 1.0);  
		    }
		     `;

		
		var debugFragmentSource = `
		    precision highp float;
		    uniform sampler2D main_texture;
		    varying vec2 _uv;
		    void main(void){
		      gl_FragColor = texture2D(main_texture, _uv);
		    }
		     `;

		var debugAttributes = ["point","uv"];
		var debugUniforms = [{name:"main_texture",type:"1i"}]

		var debugVertexSource = `
		    attribute vec2 point;
			attribute vec2 uv;
		    varying vec2 _uv;
		    void main(void){
				_uv = uv;
		        gl_Position = vec4(point,-1.0,1.0);
		    }
		    `;

		
		var mapVertexSource = `
		    uniform mat4 model_matrix;
		    uniform mat4 perspective_matrix;
		    attribute vec3 point;
			attribute vec2 uv;
		    varying vec2 _uv;
		    void main(void){
				_uv = uv;
		        gl_Position = perspective_matrix * model_matrix * vec4(point, 1.0);
		    }
		    `;
		var mapAttributes = ["point", "uv"];
		var mapUniforms = [
			{
				name:"model_matrix",
				type:"matrix4fv"
			},{
				name:"perspective_matrix",
				type:"matrix4fv"
			},{
				name:"main_texture",
				type:"1i"
			},{
				name:"id_colors",
				type:"3fv"
			}];

		var mapFragmentSource =`
		    precision highp float;
		    uniform vec3 id_colors[4];
		    uniform sampler2D main_texture;
		    varying vec2 _uv;
			vec4 data;
			vec3 out_color;
			void main(void){
		        data = texture2D(main_texture, _uv);
				// Red and green identify the side 0, 0 being no side
				if(data.r == 0.0 && data.g == 0.0){
						out_color = id_colors[3];

				} else if(data.r > 0.0 && data.g == 0.0){
						out_color = id_colors[0];

				} else if(data.r == 0.0 && data.g > 0.0){
						out_color = id_colors[1];
				} else {
						out_color = id_colors[2];
				}
		        gl_FragColor = vec4(out_color, 1.0);  
		    }
		     `;
			 
		

		/**
		 * @param {WebGLRenderingContext} gl 
		 * @param {string} vertexShaderSource 
		 * @param {string} fragmentShaderSource
		 * @param {{name:string,type:string}[]} uniformNames
		 * @param {string[]} attribNames
		 */
		function WGLProgram(gl, vertexShaderSource, fragmentShaderSource, uniformNames, attribNames){
			
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

			/**
			 * @type {{}}
			 */
			var attributes = {};

			for(var attrib in attribNames){
				attributes[attribNames[attrib]] = gl.getAttribLocation(program, attribNames[attrib]);
			}

			/**
			 * @type {{}}
			 */
			var uniforms = {};

			for(var uniform = 0; uniform < uniformNames.length; uniform++){
				uniforms[uniformNames[uniform].name] = {u:gl.getUniformLocation(program, uniformNames[uniform].name), type:uniformNames[uniform].type.toLocaleLowerCase().trim()};
			}

			this.enableVertexArrays = function(){
				gl.useProgram(program);

				for(var attrib in attributes){
					gl.enableVertexAttribArray(attributes[attrib]);
				}
			}

			/**
			 * 
			 * @param {string} uniform 
			 * @param {*} newValue 
			 * @param {boolean} matTranspose 
			 */
			this.setUniform = function(uniform, newValue, matTranspose=false){
				if(typeof uniforms[uniform] == "undefined"){
					throw "Unknown uniform";
				}
				var uType = uniforms[uniform].type;
				var uni = uniforms[uniform].u;

				switch(uType){
					case '1f':{
						gl.uniform1f(uni, newValue);
						break;
					}

					case '1fv':{
						gl.uniform1fv(uni, newValue);
						break;
					}

					case '2f':{
						gl.uniform2f(uni, newValue[0], newValue[1]);
						break;
					}

					case '2fv':{
						gl.uniform2fv(uni, newValue);
						break;
					}

					case '3f':{
						gl.uniform3f(uni, newValue[0], newValue[1], newValue[2]);
						break;
					}

					case '3fv':{
						gl.uniform3fv(uni, newValue);
						break;
					}

					case '4f':{
						gl.uniform4f(uni, newValue[0], newValue[1], newValue[2], newValue[3]);
						break;
					}

					case '4fv':{
						gl.uniform4fv(uni, newValue);
						break;
					}

					case '1i':{
						gl.uniform1i(uni, newValue);
						break;
					}

					case '1iv':{
						gl.uniform1iv(uni, newValue);
						break;
					}

					case '2i':{
						gl.uniform2i(uni, newValue[0], newValue[1]);
						break;
					}

					case '2fi':{
						gl.uniform2iv(uni, newValue);
						break;
					}

					case '3i':{
						gl.uniform3i(uni, newValue[0], newValue[1], newValue[2]);
						break;
					}

					case '3iv':{
						gl.uniform3iv(uni, newValue);
						break;
					}

					case '4i':{
						gl.uniform4i(uni, newValue[0], newValue[1], newValue[2], newValue[3]);
						break;
					}

					case '4iv':{
						gl.uniform4iv(uni, newValue);
						break;
					}

					case 'matrix2fv':{
						gl.uniformMatrix2fv(uni, matTranspose, newValue);
						break;
					}
					
					case 'matrix3fv':{
						gl.uniformMatrix3fv(uni, matTranspose, newValue);
						break;
					}

					case 'matrix4fv':{
						gl.uniformMatrix4fv(uni, matTranspose, newValue);
						break;
					}

					default: {
						if(typeof newValue == "object"){
							// Is this an array of say, samplers? use the v for vector
							gl.uniform1iv(uni, newValue);
						}else{
							// If not, just use the value as an integer
							gl.uniform1i(uni, newValue);
						}
						break;
					}
				}
			}

			this.getProgram = function(){
				return program;
			}

			this.use = function(){
				gl.useProgram(program);
			}

			/**
			 * @param {string} attrib 
			 * @returns {number}
			 */
			this.getAttribute = function(attrib){
				return attributes[attrib];
			}

			/** 
			 * @param {string} uniform 
			 * @returns {WebGLUniformLocation}
			 */
			this.getUniform = function(uniform){
				return uniforms[uniform].u;
			}

		}


		/**
		 * @param {{x:number,y:number,z:number}[]} vertexPositions 
		 * @param {{u:number,v:number}[]} textureCoords 
		 * @param {{x:number,y:number,z:number}[]} normalVectors 
		 * @param {{vertex:number,texture:number,normal:number}[]} points
		 * @param {number[]} faces 
		 */
		function Model(vertexPositions, textureCoords, normalVectors, points, faces, format=VBO_FORMAT){
			// This will store a model and will be able to generage webGL buffers for us!
			// It will save buffers for each webgl context should the need arise to have multiple
			/**
			 * @type {{gl:WebGLRenderingContext, arrayBuffer:WebGLBuffer, faceBuffer:WebGLBuffer}[]}
			 */
			var buffers = [];
			var elementCount = faces.length;

			/**
			 * @param {WebGLRenderingContext} gl
			 */
			function createBuffers(gl){
				// First search to see if the buffer is already defined for us
				// format specififes how to build the arrays.
				// v stands for the vector
				// t for texture
				// n for normal
				// _ for put a 0 here for now
				var isBuilt = false;

				for(var i = 0; i < buffers.length; i++){
					if(buffers[i].gl == gl){
						var isBuilt = true;
						break;
					}
				}

				if(isBuilt){
					// If so, return the index of the filter
					return i;
				}

				// Now we need to build the filters
				var vCodes = format.split(",");
				
				// Now to build the the vertex array buffer
				var vertexArray = [];
				for(var i = 0; i < points.length; i++){
					// Loops through each vertex/point
					for(var j = 0; j < vCodes.length; j++){
						// Loops through each data in the code
						switch(vCodes[j].trim().toLocaleLowerCase()){

							case "vx":
								vertexArray.push(vertexPositions[points[i].vertex].x);
								break;

							case "vy":
								vertexArray.push(vertexPositions[points[i].vertex].y);
								break;

							case "vz":
								vertexArray.push(vertexPositions[points[i].vertex].z);
								break;

							case "tu":
								vertexArray.push(textureCoords[points[i].texture].u);
								break;

							case "tv":
								vertexArray.push(textureCoords[points[i].texture].v);
								break;

							case "nx":
								vertexArray.push(normalVectors[points[i].normal].x);
								break;

							case "ny":
								vertexArray.push(normalVectors[points[i].normal].y);
								break;

							case "nz":
								vertexArray.push(normalVectors[points[i].normal].z);
								break;

							default:
								vertexArray.push(0);
								break;
						}
					}

				}

				// buffer the data
				var typedVertexArray = new Float32Array(vertexArray);
				var vertexObjectBuffer = gl.createBuffer();
				gl.bindBuffer(gl.ARRAY_BUFFER, vertexObjectBuffer);
				gl.bufferData(gl.ARRAY_BUFFER, typedVertexArray, gl.STATIC_DRAW);


				// Now build the element array buffer (which should be quite easy TBH)
				var typedElementArray = new Uint16Array(faces);
				var elementBuffer = gl.createBuffer();
				gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, elementBuffer);
				gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, typedElementArray, gl.STATIC_DRAW);

				buffers.push({gl:gl, arrayBuffer:vertexObjectBuffer, faceBuffer:elementBuffer});

				return buffers.length - 1;

			}

			this.getVBO = function (gl){
				var bufferIndex = createBuffers(gl);
				return buffers[bufferIndex].arrayBuffer;
			}

			this.getEBO = function(gl){
				var bufferIndex = createBuffers(gl);
				return buffers[bufferIndex].faceBuffer;
			}

			this.getElementCount = function(){
				return elementCount;
			}

		}

		// this is a simple model to create a sqaure on the screen that displays
		// the given texture;
		var debugModel = new Model(
		[
			{x:0, y:0, z:-1},
			{x:1, y:0, z:-1},
			{x:1, y:1, z:-1},
			{x:0, y:1, z:-1}
		],[
			{u:0, v:0},
			{u:1, v:0},
			{u:1, v:1},
			{u:0, v:1}
		],[
			{x:0,y:0,z:0}
		],[
			{vertex:0, texture:0, normal:0},
			{vertex:1, texture:1, normal:0},
			{vertex:2, texture:2, normal:0},
			{vertex:3, texture:3, normal:0}
		],[0, 1, 2, 0, 2, 3],
		"vx,vy,tu,tv");

		
		/**
		 * @param {number} r 
		 * @param {number} g 
		 * @param {number} b 
		 * @param {string} name
		 */

		function Color(r, g, b, name=""){

			var colorString = ""; // A hex version of the string

			this.getColor = function(){
				return colorString;
			}

			this.getRGB = function (){
				return {r:r, g:g, b:b};
			}

			this.getRGBDecimal = function(){
				return {r:r / 255, g:g / 255, b:b / 255};
			}

			this.getRGBDecimalArray = function(){
				return [r / 255, g / 255, b / 255];
			}

			this.getName = function(){
				return name;
			}

			/**
			 * @param {string} newName 
			 */
			this.setName = function(newName){
				name = newName;
			}

			/**
			 * @param {number}nr
			 * @param {number}ng
			 * @param {number}nb
			*/

			this.setColor = function(nr, ng, nb){
				// Clamps the numbers between 0 and 255
				r = Math.max(0, Math.min(Math.floor(nr), 255));
				g = Math.max(0, Math.min(Math.floor(ng), 255));
				b = Math.max(0, Math.min(Math.floor(nb), 255));
				// Convert to hexidecimal
				var rs = r.toString(16);
				var gs = g.toString(16);
				var bs = b.toString(16);

				if(rs.length == 1){
					rs = "0" + rs;
				}
				if(gs.length == 1){
					gs = "0" + gs;
				}
				if(bs.length == 1){
					bs = "0" + bs;
				}

				colorString = "#" + rs + gs + bs;
			}
			
			this.setColor(r, g, b);
		}

		const MAP_SIZE = 1024;

		function Renderer(){
			/*The div element with the id 
				'canvas' is the holder that holds the canvas allowing
				it to fit into the page like formating style with ease.*/
			var canvas = document.createElement("canvas");
			document.getElementById("canvas").appendChild(canvas);
				
			/**@type {WebGLRenderingContext} */
			// @ts-ignore // it has a problem with this statement as getContext() can return a 2d context
			var gl = canvas.getContext("webgl", {
				alpha: false, antialias: true
			}) || canvas.getContext("experimental-webgl", {
				alpha: false, antialias: true
			});//gotta support that IE

			if(gl == undefined || gl == null){
				throw "Failed to start webGL";
			}

			var mainProgram = new WGLProgram(gl, mainVertexSource, mainFragmentSource, mainUniforms, mainAttributes);
			var mapProgram = new WGLProgram(gl, mapVertexSource, mapFragmentSource, mapUniforms, mapAttributes);
			var debugProgram = new WGLProgram(gl, debugVertexSource, debugFragmentSource, debugUniforms, debugAttributes);
			mainProgram.enableVertexArrays();
			mapProgram.enableVertexArrays();
			debugProgram.enableVertexArrays();
			gl.clearColor(0.0, 1.0, 0.0, 1.0);
			gl.enable(gl.DEPTH_TEST);
			gl.depthFunc(gl.LEQUAL);
			gl.clearDepth(1.0);
			gl.enable(gl.CULL_FACE);
			gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

			var lightDirection = [-0.5, -0.5, -2];
			var highLightColor = new Color(128, 128, 128, "Grey");
			var bgColor = new Color(10, 10, 10, "Black");
			var errorAnimationColor = new Color(10, 10, 10); // used for the red flashing
			var errorColor = new Color(255, 0, 0, "Red");
			var errorTimer = 0;
			var errorAnimationSpeed = 50;
			var backFlashing = false;
			const MAP_SIZE = 1024;

			// Set up the textures, starting with the map
			gl.activeTexture(gl.TEXTURE0);
			
			var mapTexture = gl.createTexture();
			gl.bindTexture(gl.TEXTURE_2D, mapTexture);
			gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, MAP_SIZE, MAP_SIZE, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
			
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

			var mapFrameBuffer = gl.createFramebuffer();
			gl.bindFramebuffer(gl.FRAMEBUFFER, mapFrameBuffer);
			gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, mapTexture, 0);
			var mapDepthBuffer = gl.createRenderbuffer();
			gl.bindRenderbuffer(gl.RENDERBUFFER, mapDepthBuffer);

			gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, MAP_SIZE, MAP_SIZE);
			gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, mapDepthBuffer);
			
			// Set up the main texture
			var mainTexture = gl.createTexture();
			/**
			 * @param {HTMLCanvasElement} source 
			 * @param {boolean} isPOT 
			 */
			this.updateMainTexture = function(source, isPOT){
				gl.useProgram(mainProgram.getProgram());
				gl.activeTexture(gl.TEXTURE1);

				gl.bindTexture(gl.TEXTURE_2D, mainTexture);
				gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
				gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
				gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
				if (isPOT) {
					gl.generateMipmap(gl.TEXTURE_2D);
				}
				mainProgram.setUniform("main_texture", 1);
				gl.useProgram(mapProgram.getProgram());
				mapProgram.setUniform("main_texture", 1);
			}

			// Draw a base texture to have for rendering cubies
			var textureCanvas = document.createElement("canvas");
			var ctx = textureCanvas.getContext("2d");
			textureCanvas.width  = 1024;
			textureCanvas.height = 1024;
			var faceSize = 512 - 20;
				// fill in the background with black
			ctx.fillStyle = "#000";
			ctx.fillRect(0, 0, 1024, 1024);
				// fill in the top left (bottom left for WebGL) with red for color 1
			ctx.fillStyle = "#F00";
			ctx.fillRect(10, 10, faceSize, faceSize);
				// top right
			ctx.fillStyle = "#0F0";
			ctx.fillRect(512 + 10, 10, faceSize, faceSize);
				// bottom left
			ctx.fillStyle = "#FF0";
			ctx.fillRect(10, 512 + 10, faceSize, faceSize);

			// Now save it to our texture
			this.updateMainTexture(textureCanvas, true);

			// Camera Varibles
			var feildOfView = 90;// In degrees
			var camNear = 1;
			var camFar = 1000;
			
			function prepareCamera(){
				// Should only need to be called upon screen resize
				// Update the canvas's internal height and width
				// to match that of the screen
				canvas.width = canvas.clientWidth;
				canvas.height = canvas.clientHeight;
				
				var viewWidth = gl.drawingBufferWidth;
				var viewHeight = gl.drawingBufferHeight;

				// Calculate the slope of the view fulstrum
				var factor = Math.tan(Math.PI * 0.5 - 0.5 * feildOfView * PR);
				var rangeInv = 1 / (camNear - camFar);
				// Use the above values to compute a perspective matrix
				// Note we do not need to use the Matrix class to create this as
				// no operations will be done in javascript to this matrix
				var psm = [
					factor / (viewWidth / viewHeight), 0, 0, 0,
					0, factor, 0, 0,
					0, 0, (camNear + camFar) * rangeInv, -1,
					0, 0, camNear * camFar * rangeInv * 2, 0
				];
				
				// Update the uniforms to this matrix in the map and main programs
				mapProgram.use();
				mapProgram.setUniform("perspective_matrix", psm);

				mainProgram.use(); 
				mainProgram.setUniform("perspective_matrix", psm);
				// Update other uniforms as well
				mainProgram.setUniform("light_direction", lightDirection);
				mainProgram.setUniform("overlay_color", highLightColor.getRGBDecimalArray());
				// All other uniforms will be set by the cubie rendering them
				
			}
			
			prepareCamera();

			function clear(){
				gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
				gl.flush();
			}

			this.clearAll = function(){
				//Clears both the main screen and the map render buffer
				prepMapRender();
				clear();
				prepMainRender();
				clear();
			}

			function prepMapRender(shouldClear=false){
				// Set up rendering to the map buffer
				gl.bindFramebuffer(gl.FRAMEBUFFER, mapFrameBuffer);
				// The background of the map is white
				gl.clearColor(1, 1, 1, 1);
				if (shouldClear){
					clear();
				}
				// Set the view port to the size of the render buffer;
				gl.viewport(0, 0, MAP_SIZE, MAP_SIZE);
			}


			function prepMainRender(shouldClear=false){
				// Unbind any bound framebuffer
				gl.bindFramebuffer(gl.FRAMEBUFFER, null);
				if(backFlashing){
					// If we are animating the back color, load that color as the clear color
					var c = errorAnimationColor.getRGBDecimal();
					gl.clearColor(c.r, c.g, c.b, 1);
				}else{
					var c = bgColor.getRGBDecimal();
					gl.clearColor(c.r, c.g, c.b, 1);
				}

				if (shouldClear){
					clear();
				}
				// Set the view port to the size of the drawing buffer
				gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
			}

			/**
			 * 
			 * @param {WGLProgram} program 
			 */
			function setAtts(program){
				if(program == mainProgram){
					gl.vertexAttribPointer(mainProgram.getAttribute("point"), 3, gl.FLOAT, false, 4 * 8, 0);
					gl.vertexAttribPointer(mainProgram.getAttribute("main_uv"), 2, gl.FLOAT, false, 4 * 8, 4 * 3);
					gl.vertexAttribPointer(mainProgram.getAttribute("normal"), 3, gl.FLOAT, false, 4 * 8, 4 * 5);
				}else if(program == mapProgram){
					gl.vertexAttribPointer(mapProgram.getAttribute("point"), 3, gl.FLOAT, false, 4 * 8, 0);
					gl.vertexAttribPointer(mapProgram.getAttribute("uv"), 2, gl.FLOAT, false, 4 * 8, 4 * 3);
				}else if(program == debugProgram){
					gl.vertexAttribPointer(debugProgram.getAttribute("point"), 2, gl.FLOAT, false, 4 * 4, 0);
					gl.vertexAttribPointer(debugProgram.getAttribute("uv"), 2, gl.FLOAT, false, 4 * 4, 4 * 2);
				}
			}


			/**
			 * 
			 * @param {VCube} cube
			 * @param {boolean} doMapRender 
			 */
			this.renderCube = function(cube, doMapRender=false){
				prepareCamera();
				/**@type {VCubie[]} */
				var cubies = cube.getCubies();
				mainProgram.use();
				prepMainRender();
				var cubieCount = cubies.length;
				var cubeModelMat = cube.getPosMatrix();
				var cubeRotMat = cube.getRotMatrix();
				var cubeScaleMat = cube.getScaleMatrix();
				var sideRotMat = cube.getRotatingSideMat();
				var rotatingCubies = cube.getRotatingCubies();
				var mainCubeModelMat = cubeModelMat.multiply(cubeScaleMat).multiply(cubeRotMat);
				var sideCubeModelMat = cubeModelMat.multiply(cubeScaleMat).multiply(cubeRotMat).multiply(sideRotMat);
				var cubeIdColor = cube.getIdCode();
				
				var bg = cube.baseColor.getRGBDecimal();
				var cubeColors = cube.colorPallet;

				for(var c = 0; c < cubieCount; c++){
					var cubie = cubies[c];
					var modelMat;
					if(rotatingCubies.includes(c)){
						modelMat = sideCubeModelMat.multiply(cubie.modelMat).getArray(true);
					}else{
						modelMat = mainCubeModelMat.multiply(cubie.modelMat).getArray(true);
					}
					
					gl.bindBuffer(gl.ARRAY_BUFFER, cubie.model.getVBO(gl));
					gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, cubie.model.getEBO(gl));

					setAtts(mainProgram);
					mainProgram.setUniform("model_matrix", modelMat);
					var colorsToLoad = [0, 0, 0, 0, 0, 0, 0, 0, 0, bg.r, bg.g, bg.b];
					if(cubie.inError.includes(true)){
						var nclr = errorAnimationColor.getRGBDecimal();
						colorsToLoad = [0, 0, 0, 0, 0, 0, 0, 0, 0, nclr.r, nclr.g, nclr.b];
					}
					for (var i = 0; i < cubie.type + 1; i ++){
						// TODO replace with color given by cube
						var clr = cubeColors[cubie.cubie.getFace(i)].getRGBDecimal();
						colorsToLoad[i * 3] = clr.r;
						colorsToLoad[i * 3 + 1] = clr.g;
						colorsToLoad[i * 3 + 2] = clr.b;
					}

					mainProgram.setUniform("colors", colorsToLoad);
					mainProgram.setUniform("back_light", cubie.inError);
					
					mainProgram.setUniform("overlay", cubie.highlightedSides);

					gl.drawElements(gl.TRIANGLES, cubie.model.getElementCount(), gl.UNSIGNED_SHORT, 0);
				}

				

				if(!doMapRender){
					return;
				}

				mapProgram.use();
				prepMapRender();
				//gl.bindFramebuffer(gl.FRAMEBUFFER, null);
				//clear();


				for(var c = 0; c < cubieCount; c++){
					var cubie = cubies[c];
					var modelMat;
					if(rotatingCubies.includes(c)){
						modelMat = sideCubeModelMat.multiply(cubie.modelMat).getArray(true);
					}else{
						modelMat = mainCubeModelMat.multiply(cubie.modelMat).getArray(true);
					}
					
					gl.bindBuffer(gl.ARRAY_BUFFER, cubie.model.getVBO(gl));
					gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, cubie.model.getEBO(gl));

					setAtts(mapProgram);
					mapProgram.setUniform("model_matrix", modelMat);
					var bg = bgColor.getRGBDecimal();
					// TODO replace these colors with id colors
					var colorsToLoad = [cubeIdColor / 255, 0, 0, cubeIdColor / 255, 0, 0, cubeIdColor / 255, 0, 0, cubeIdColor / 255, 1, 1];
					for (var i = 0; i < cubie.type + 1; i ++){
						colorsToLoad[i * 3 + 1] = Math.floor(cubie.dataLink[i] / 256) / 255;
						colorsToLoad[i * 3 + 2] = cubie.dataLink[i] % 256 / 255;
					}

					mapProgram.setUniform("id_colors", colorsToLoad);

					gl.drawElements(gl.TRIANGLES, cubie.model.getElementCount(), gl.UNSIGNED_SHORT, 0);	
				}

				// prepMainRender();

				// debugProgram.use();
				// gl.bindBuffer(gl.ARRAY_BUFFER, debugModel.getVBO(gl));
				// gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, debugModel.getEBO(gl));
				// setAtts(debugProgram);
				// gl.drawElements(gl.TRIANGLES, debugModel.getElementCount(), gl.UNSIGNED_SHORT, 0)

			}

			/**
			 * @param {number} x 
			 * @param {number} y 
			 */
			this.getMapPixel = function(x, y){
				gl.bindFramebuffer(gl.FRAMEBUFFER, mapFrameBuffer)
				var info = new Uint8Array(4);
				gl.readPixels(x, y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, info);
				return info;
			}

			this.update = function(){
				// Runs background animations
				var goalC = errorColor.getRGB();
				var origC = bgColor.getRGB();
				errorAnimationColor.setColor(origC.r + errorTimer / 1000 * (goalC.r - origC.r), origC.g + errorTimer / 1000 * (goalC.g - origC.g), origC.b + errorTimer / 1000 * (goalC.b - origC.b));
				errorTimer += errorAnimationSpeed;
				if (errorTimer >= 1000) {
					errorAnimationSpeed = -Math.abs(errorAnimationSpeed);
				}
				if (errorTimer <= 0) {
					errorAnimationSpeed = Math.abs(errorAnimationSpeed);
					backFlashing = false;
				}

			}

			this.beginFlash = function(){
				backFlashing = true;
				errorAnimationSpeed = 50;
				errorTimer = 0;
			}
			

		}


		var Controls = {
			GetMouseSelection: function () {//returns info about what the mouse is over in webgl
				var xRatio = MAP_SIZE / window.innerWidth;
				var yRatio = MAP_SIZE / window.innerHeight;
				var X = Math.floor(Controls.MouseX * xRatio);
				var Y = Math.floor((window.innerHeight - Controls.MouseY) * yRatio);
				var hasMessage = false;
				var info = tstRender.getMapPixel(X, Y);
				//op.innerHTML="Cube Number: " + info[0] + ", Sticker Number: " + (info[1] * 256 + info[2]) + ", Mouse Location: " + X + " , " + Y;
				if (info[0] != 255) {
					if (!Controls.MouseIsDown) {
						document.getElementById("cube_edit").style.cursor = "pointer";
					} else {
						document.getElementById("cube_edit").style.cursor = "move";
					}
					if (this.MouseClicked && !(info[1] == 255 && info[2] == 255)) {
						VCubeList[info[0]].changeSticker((info[1] * 256 + info[2]), selColor, true);
					}
					//highlight sides
					var cubies = VCubeList[info[0]].getCubies();
					for (var i = 0; i < cubies.length; i++) {
						var disCubie = false;
						for (var j = 0; j < cubies[i].dataLink.length; j++) {

							if (cubies[i].dataLink[j] === (info[1] * 256 + info[2])) {
								cubies[i].highlightedSides[j] = true;
								if (cubies[i].inError.includes(true)) {
									hasMessage = true;
									document.getElementById("cube_edit").title = cubies[i].errorMessage;
								}
								disCubie = true;
							} else {
								cubies[i].highlightedSides[j] = false;
							}
						}
					}
				} else {
					if (!Controls.MouseIsDown) {
						document.getElementById("cube_edit").style.cursor = "auto";
					}

				}
				if (!hasMessage)
					document.getElementById("cube_edit").title = "";
				return { Cube: info[0], Side: (info[1] * 256 + info[2]) };
			},
			MouseX: 0,
			MouseY: 0,
			OldMouseX: 0,
			OldMouseY: 0,
			MouseIsDown: false,
			MouseJustWentDown: false,
			MouseClicked: false,
			ClickTime: 200,//how long a the mouse must be down for it to no longer be a click
			ClickTimer: null,
			SelectedCube: 0,
			SetUp: function () {
				document.getElementById("cube_edit").addEventListener("mousemove", Controls.MouseMove);
				document.getElementById("cube_edit").addEventListener("mouseout", Controls.MouseUp);
				document.getElementById("cube_edit").addEventListener("mouseup", Controls.MouseUp);
				document.getElementById("cube_edit").addEventListener("mousedown", Controls.MouseDown);
				document.getElementById("cube_edit").addEventListener("touchmove", Controls.TouchMove);
				document.getElementById("cube_edit").addEventListener("touchcancel", Controls.TouchEnd);
				document.getElementById("cube_edit").addEventListener("touchend", Controls.TouchEnd);
				document.getElementById("cube_edit").addEventListener("touchstart", Controls.TouchStart);
				var colorsws = document.getElementsByClassName("swatch");
				colorsws[0].addEventListener("click", function(e){selColor = 0;e.stopPropagation()});
				colorsws[1].addEventListener("click", function(e){selColor = 1;e.stopPropagation()});
				colorsws[2].addEventListener("click", function(e){selColor = 2;e.stopPropagation()});
				colorsws[3].addEventListener("click", function(e){selColor = 3;e.stopPropagation()});
				colorsws[4].addEventListener("click", function(e){selColor = 4;e.stopPropagation()});
				colorsws[5].addEventListener("click", function(e){selColor = 5;e.stopPropagation()});
				

			},
			MouseMove: function (e) {
				Controls.OldMouseX = Controls.MouseX;
				Controls.OldMouseY = Controls.MouseY;
				Controls.MouseX = e.clientX;
				Controls.MouseY = e.clientY;

			},
			MouseDown: function (e) {
				Controls.MouseIsDown = true;
				Controls.MouseJustWentDown = true;
				if (Controls.ClickTimer) {
					clearTimeout(Controls.ClickTimer);
				}
				Controls.ClickTimer = setTimeout(function () { Controls.MouseJustWentDown = false; Controls.ClickTimer = null; }, Controls.ClickTime);

			},
			MouseUp: function (e) {
				Controls.MouseIsDown = false;
				Controls.MouseJustWentDown = false;
				if (Controls.ClickTimer) {
					Controls.MouseClicked = true;
					requestAnimationFrame(function () {
						Controls.MouseClicked = false;
					});//make sure this is cleared on the next frame
					clearTimeout(Controls.ClickTimer);
					Controls.ClickTimer = null;
				}

				document.getElementById("cube_edit").style.cursor = "auto";

			},
			TouchMove: function (e) {
				e.preventDefault();
				Controls.OldMouseX = Controls.MouseX;
				Controls.OldMouseY = Controls.MouseY;
				Controls.MouseX = e.touches[0].clientX;
				Controls.MouseY = e.touches[0].clientY;

			},
			TouchStart: function (e) {

				e.preventDefault();
				Controls.MouseIsDown = true;
				Controls.MouseJustWentDown = true;
				if (Controls.ClickTimer) {
					clearTimeout(Controls.ClickTimer);
				}
				Controls.ClickTimer = setTimeout(function () { Controls.MouseJustWentDown = false; Controls.ClickTimer = null; }, Controls.ClickTime);

			},
			TouchEnd: function (e) {

				e.preventDefault();
				Controls.MouseIsDown = false;
				Controls.MouseJustWentDown = false;
				if (Controls.ClickTimer) {
					Controls.MouseClicked = true;
					requestAnimationFrame(function () {
						Controls.MouseClicked = false;
					});//make sure this is cleared on the next frame
					clearTimeout(Controls.ClickTimer);
					Controls.ClickTimer = null;
				}

				document.getElementById("cube_edit").style.cursor = "auto";

			},
			MoveCube: function () {
				if (Controls.SelectedCube != -1) {
					var dx = Controls.OldMouseX - Controls.MouseX;
					var dy = Controls.OldMouseY - Controls.MouseY;

					Controls.OldMouseX = Controls.MouseX;
					Controls.OldMouseY = Controls.MouseY;

					var rym = new Matrix([Math.cos(dx * PR), 0, -Math.sin(dx * PR), 0,
						0, 1, 0, 0,
					Math.sin(dx * PR), 0, Math.cos(dx * PR), 0,
						0, 0, 0, 1]);
					var rxm = new Matrix([1, 0, 0, 0,
						0, Math.cos(dy * PR), Math.sin(dy * PR), 0,
						0, -Math.sin(dy * PR), Math.cos(dy * PR), 0,
						0, 0, 0, 1]);
					var tMat = rym.multiply(rxm);
					VCubeList[Controls.SelectedCube].addRotMat(tMat);
					document.getElementById("cube_edit").style.cursor = "move";
				}
			}

		};


		/**
		 * @param {AlgorithmStorage} algorithm 
		 */
		function basicSuccessCallBack(algorithm, algId=0, time=0, cycles=0){
			console.log(`Cube was solved in ${Math.round(time)} seconds and ${cycles} cycles. The algorithm is ${algorithm.getMovesAsText(algId)}`);
			var resAlg = algorithm.getMovesInPairs(algId);
			for (var i = 0; i < resAlg.length; i += 2) {
				testCube.addRotation(resAlg[i], resAlg[i + 1]);
			}
		
		}

		/**
		 * @param {CubeError[]} errors 
		 */
		function basicFailureCallBack(errors=[]){
			displayErrorsOnCube(errors);
			//console.log("Failed to solve cube for the follwing reasons: ", errors)
		}

		function basicStartCallBack(cancelCallBack){
			console.log("Verification passed, begining to solve...");
			clearCubeErrors(testCube);
			document.getElementById("cancel_button").addEventListener("click", cancelCallBack);

		}

		function basicUpdateCallBack(text) {
			op.innerHTML = text;
		}

		/**
		 * @param {CubeError[]} errors 
		 */
		function displayErrorsOnCube(errors=[]){
			// Clear previous errors if there were any

			clearCubeErrors(testCube);

			for(var i = 0; i < errors.length; i ++){
				if(errors[i].affectedCubie != -1){
					var cubies = testCube.getCubies();
					cubies[errors[i].affectedCubie].inError = errors[i].affectedFaces;
					cubies[errors[i].affectedCubie].errorMessage = errors[i].userReadableError;
				}
			}
			tstRender.beginFlash();

		}

		/**
		 * @param {VCube} vcube 
		 */
		function clearCubeErrors(vcube){
			var cubies = vcube.getCubies();
			cubies.forEach(cubie => {
				cubie.inError = [false, false, false, false];
				cubie.errorMessage = "";
			});
		}
		
		/**
		 * @param {0|1|2} type 
		 * @param {number} style 
		 * @param {number[]} data 
		 */

		 function VCubie(type, style, data) {
			this.type = type;// 0 1 or 2 for center, edge or corner
			this.style = style;// selects a model type to get
			this.home = 0;// lets the code know which surface is defined as the "home" surface, to make coloring easier.
			this.dataLink = [0, 0, 0];//a list of numbers stored in the cubie by the cube so it can recognize what data this cubie is linked to.
			this.idColors = [[0, 0, 0],[0, 0, 0],[0, 0, 0]];// REMOVE, it is unused
			this.highlightedSides = [false, false, false, false];//used for hovering and error highlights
			this.inError = [false, false, false, false];
			this.errorMessage = "";
			this.cubie = new Cubie(type);
			this.modelMat = Matrix.getIdenity(4);
			this.model = VCubie.models[style][type];
		}

		VCubie.models = [{
			0:new Model(
				[
					{x:-0.5, y:-0.5, z:-0.5},
					{x:-0.5, y:-0.5, z: 0.5},
					{x:-0.5, y: 0.5, z: 0.5},
					{x:-0.5, y: 0.5, z:-0.5},

					{x: 0.5, y:-0.5, z:-0.5},
					{x: 0.5, y:-0.5, z: 0.5},
					{x: 0.5, y: 0.5, z: 0.5},
					{x: 0.5, y: 0.5, z:-0.5}
				],[
					{u:0.0, v:0.0},
					{u:0.5, v:0.0},
					{u:0.5, v:0.5},
					{u:0.0, v:0.5},

					{u:1, v:1}

				],[
					{x:-1, y:0, z:0},
					{x:0, y:-1, z:0},
					{x:0, y:0, z:-1},
					{x:0, y:0, z:1},
					{x:0, y:1, z:0},
					{x:1, y:0, z:0},
				],[
					{vertex:0, texture:0, normal:0},
					{vertex:1, texture:1, normal:0},
					{vertex:2, texture:2, normal:0},
					{vertex:3, texture:3, normal:0},

					{vertex:4, texture:4, normal:1},
					{vertex:5, texture:4, normal:1},
					{vertex:1, texture:4, normal:1},
					{vertex:0, texture:4, normal:1},

					{vertex:4, texture:4, normal:2},
					{vertex:0, texture:4, normal:2},
					{vertex:3, texture:4, normal:2},
					{vertex:7, texture:4, normal:2},

					{vertex:1, texture:4, normal:3},
					{vertex:5, texture:4, normal:3},
					{vertex:6, texture:4, normal:3},
					{vertex:2, texture:4, normal:3},

					{vertex:3, texture:4, normal:4},
					{vertex:2, texture:4, normal:4},
					{vertex:6, texture:4, normal:4},
					{vertex:7, texture:4, normal:4},

					{vertex:5, texture:4, normal:5},
					{vertex:4, texture:4, normal:5},
					{vertex:7, texture:4, normal:5},
					{vertex:6, texture:4, normal:5},
				], [0, 1, 2, 0, 2, 3,
					4, 5, 6, 4, 6, 7,
					8, 9,10, 8,10,11,
					12,13,14,12,14,15,
					16,17,18,16,18,19,
					20,21,22,20,22,23]),

				1:new Model(
					[
						{x:-0.5, y:-0.5, z:-0.5},
						{x:-0.5, y:-0.5, z: 0.5},
						{x:-0.5, y: 0.5, z: 0.5},
						{x:-0.5, y: 0.5, z:-0.5},

						{x: 0.5, y:-0.5, z:-0.5},
						{x: 0.5, y:-0.5, z: 0.5},
						{x: 0.5, y: 0.5, z: 0.5},
						{x: 0.5, y: 0.5, z:-0.5}
					],[
						{u:0.0, v:0.0},
						{u:0.5, v:0.0},
						{u:0.5, v:0.5},
						{u:0.0, v:0.5},
	
						{u:0.5, v:0.0},
						{u:1.0, v:0.0},
						{u:1.0, v:0.5},
						{u:0.5, v:0.5},
	
						{u:1, v:1}
	
					],[
						{x:-1, y:0, z:0},
						{x:0, y:-1, z:0},
						{x:0, y:0, z:-1},
						{x:0, y:0, z:1},
						{x:0, y:1, z:0},
						{x:1, y:0, z:0},
					],[
						{vertex:0, texture:0, normal:0},
						{vertex:1, texture:1, normal:0},
						{vertex:2, texture:2, normal:0},
						{vertex:3, texture:3, normal:0},
	
						{vertex:4, texture:4, normal:1},
						{vertex:5, texture:5, normal:1},
						{vertex:1, texture:6, normal:1},
						{vertex:0, texture:7, normal:1},
	
						{vertex:4, texture:8, normal:2},
						{vertex:0, texture:8, normal:2},
						{vertex:3, texture:8, normal:2},
						{vertex:7, texture:8, normal:2},
	
						{vertex:1, texture:8, normal:3},
						{vertex:5, texture:8, normal:3},
						{vertex:6, texture:8, normal:3},
						{vertex:2, texture:8, normal:3},
	
						{vertex:3, texture:8, normal:4},
						{vertex:2, texture:8, normal:4},
						{vertex:6, texture:8, normal:4},
						{vertex:7, texture:8, normal:4},
	
						{vertex:5, texture:8, normal:5},
						{vertex:4, texture:8, normal:5},
						{vertex:7, texture:8, normal:5},
						{vertex:6, texture:8, normal:5},
					], [0, 1, 2, 0, 2, 3,
						4, 5, 6, 4, 6, 7,
						8, 9,10, 8,10,11,
						12,13,14,12,14,15,
						16,17,18,16,18,19,
						20,21,22,20,22,23]),
					2:new Model(
						[
							{x:-0.5, y:-0.5, z:-0.5},
							{x:-0.5, y:-0.5, z: 0.5},
							{x:-0.5, y: 0.5, z: 0.5},
							{x:-0.5, y: 0.5, z:-0.5},

							{x: 0.5, y:-0.5, z:-0.5},
							{x: 0.5, y:-0.5, z: 0.5},
							{x: 0.5, y: 0.5, z: 0.5},
							{x: 0.5, y: 0.5, z:-0.5}
						],[
							{u:0.0, v:0.0},
							{u:0.5, v:0.0},
							{u:0.5, v:0.5},
							{u:0.0, v:0.5},
		
							{u:0.5, v:0.0},
							{u:1.0, v:0.0},
							{u:1.0, v:0.5},
							{u:0.5, v:0.5},
		
							{u:0.0, v:0.5},
							{u:0.5, v:0.5},
							{u:0.5, v:1.0},
							{u:0.0, v:1.0},
		
							{u:1, v:1}
		
						],[
							{x:-1, y:0, z:0},
							{x:0, y:-1, z:0},
							{x:0, y:0, z:-1},
							{x:0, y:0, z:1},
							{x:0, y:1, z:0},
							{x:1, y:0, z:0},
						],[
							{vertex:0, texture:0, normal:0},
							{vertex:1, texture:1, normal:0},
							{vertex:2, texture:2, normal:0},
							{vertex:3, texture:3, normal:0},
		
							{vertex:4, texture:4, normal:1},
							{vertex:5, texture:5, normal:1},
							{vertex:1, texture:6, normal:1},
							{vertex:0, texture:7, normal:1},
		
							{vertex:4, texture:8, normal:2},
							{vertex:0, texture:9, normal:2},
							{vertex:3, texture:10, normal:2},
							{vertex:7, texture:11, normal:2},
		
							{vertex:1, texture:12, normal:3},
							{vertex:5, texture:12, normal:3},
							{vertex:6, texture:12, normal:3},
							{vertex:2, texture:12, normal:3},
		
							{vertex:3, texture:12, normal:4},
							{vertex:2, texture:12, normal:4},
							{vertex:6, texture:12, normal:4},
							{vertex:7, texture:12, normal:4},
		
							{vertex:5, texture:12, normal:5},
							{vertex:4, texture:12, normal:5},
							{vertex:7, texture:12, normal:5},
							{vertex:6, texture:12, normal:5},
						], [0, 1, 2, 0, 2, 3,
							4, 5, 6, 4, 6, 7,
							8, 9,10, 8,10,11,
							12,13,14,12,14,15,
							16,17,18,16,18,19,
							20,21,22,20,22,23])
				
				}];


				// size, dataStorageFormat, cubeData, cubeNumber, selectable, scale, pos, style 
		function VCube(size=3, dataStorageFormat=0, cubeData=new CubeData(size, 1, dataStorageFormat), cubeNumber=0, selectable=true, scale=1, pos={x:0,y:0,z:-2*scale}, style=CUBIE_STYLE.Plain) {
			this.size = size;//the number of cubies on the cube
			this.format = dataStorageFormat;
			this.style = style;
			this.selectable = selectable;//determines if this should render on color map for cube edits
			this.colorPallet = [new Color(0, 0, 255, "Blue"), new Color(250, 128, 0, "Orange"), new Color(255, 255, 0, "Yellow"), new Color(255, 255, 255, "White"), new Color(255, 0, 0, "Red"), new Color(0, 255, 0, "Green")];
			this.baseColor = new Color(200, 200, 200);
			var scale_matrix = new Matrix([scale / size, 0, 0, 0,
				0, scale / size, 0, 0,
				0, 0, scale / size, 0,
				0, 0, 0, 1]);
			var rotMatrix = Matrix.getIdenity(4);
			/**@type {VCubie[]} */
			var cubies = [];
			var retainStartData = false;//tells if the data it has should be updated or not when rotating or if it is just visual
			var recording = false;//decides weither or not the rotation que should be emptied after each move.
			var edit = true;

			var timeControl = false;//tells wether or not the cube's animation is time controlled by something else such as a slider
			var animationTime = 0;
			var animationStart = 0;
			var rotating = false;
			var animationDuration = 100;
			var currentDegrees = 0;
			var targetDegrees = 0;

			var rotationLocations = [0, 0, 0, 0];//cos -sin sin cos
			var rotationMatrix = Matrix.getIdenity(4).getArray();
			var rotatingCubies = [];
			var rotationQue = [];//saves the planned moves and previous moves if recording is set to true
			var quePosition = 0;//used when recording as the que is not emptied then.
			var idColor = VCubeList.length;//for identifying its self when clicked on for rotations and changes
			//Id color informatiton for cubies R: cube in VCubelist, G * 255 + B = sticker on cube.

			VCubeList.push(this);

			this.getCubeData = function(){
				return cubeData;
			}


			this.getIdCode = function(){
				return idColor;
			}

			this.changeScale = function (newScale) {
				scale = newScale;
				scale_matrix = new Matrix([scale / this.size, 0, 0, 0,
					0, scale / this.size, 0, 0,
					0, 0, scale / this.size, 0,
					0, 0, 0, 1]);
			};

			this.getScaleMatrix = function(){
				return scale_matrix;
			};

			/**
			 * @param {number} x 
			 * @param {number} y 
			 * @param {number} z 
			 */
			this.setPos = function(x, y, z){
				pos = {x:x, y:y, z:z};
			}

			this.getPosMatrix = function(){
				return new Matrix([1, 0, 0, pos.x,
								   0, 1, 0, pos.y,
								   0, 0, 1, pos.z,
								   0, 0, 0, 1]);
			};

			this.getRotMatrix = function(){
				return rotMatrix;
			}

			/**
			 * 
			 * @param {Matrix} mat 
			 */
			this.addRotMat = function(mat){
				rotMatrix = mat.multiply(rotMatrix);
			}

			this.getRotatingSideMat = function(){
				return new Matrix(rotationMatrix);
			};

			this.getCubies = function(){
				return cubies;
			};

			this.getRotatingCubies = function(){
				return rotatingCubies;
			}



			function changeSticker (stickerIndex=0, stickerValue=0, override=false) {
				//sticker is a number that identifies which sticker is being changed
				//id is what color to change the sticker to
				//override allows the function to automatically change the format of the cube to surface type if possible to change a single sticker
				//returns true or false to tell if it was a success or not
				if (dataStorageFormat == CUBE_DATA_TYPE.Surface && !recording && edit) {
					
					cubeData.setStickerByIndex(stickerIndex, stickerValue, cubeNumber);

					updateColors();
					return true;
				} else if (dataStorageFormat == CUBE_DATA_TYPE.Piece && override && !recording && edit) {
					
					cubeData.convertStorageFormat(CUBE_DATA_TYPE.Surface);
					dataStorageFormat = CUBE_DATA_TYPE.Surface;
					changeSticker(stickerIndex, stickerValue);
					return true;
				} else {
					if (dataStorageFormat == CUBE_DATA_TYPE.Piece && !override) {
						throw "Cannot change data type of cube without override enabled!";
					} else if (dataStorageFormat == CUBE_DATA_TYPE.Compact) {
						throw "Cannot change data type of cube from compact data!";
					} else if (!(!recording && edit)) {
						throw "Cannot edit data, cube does not have editing enabled!";
					}
					else {
						throw "An error occured!";
					}
				}
			};

			this.changeSticker = function(stickerIndex=0, stickerValue=0, override=false){
				changeSticker(stickerIndex, stickerValue, override);
			}


			function updateColors() {//updates the colors on cubies to match that of the data, resets the cubies position as a result, should only be used on edit cubes or cubes that update the data as they go along.
				for (var i = 0; i < cubies.length; i++) {
					var c = cubies[i];
					var newColors = [0, 0, 0];
					for (var j = 0; j < c.type + 1; j++) {
				
						newColors[j] = cubeData.getStickerByIndex(c.dataLink[j], cubeNumber);
					}
					c.home = 0;
					c.cubie.setFaces(newColors);
				}
			};

			this.updateColors = function () {
				updateColors();
			};


			function resetCubies() {
				// TODO Redo graphics
				//resets the cubies back to their original positions, good for redoing stuff I guess
				if (!recording && !retainStartData) {
					updateColors();
				} else {
					quePosition = 0;
				}
				var baseMatrix = new Matrix([
					1, 0, 0, -size / 2 + 0.5,
					0, 1, 0, -size / 2 + 0.5,
					0, 0, 1, -size / 2 + 0.5,
					0, 0, 0, 1
				]);
				//cube space (until it is scaled based on the scale) is represented as a size by size by size area with 0,0,0 in the middle, pieces will start in their LDB location and then rotated to the correct location
				//depending on how their home is set up, a different  rotation may be used.
				//values can be pre computed
				var rym = new Matrix([
					0, 0, -1, 0,
					0, 1, 0, 0,
					1, 0, 0, 0,
					0, 0, 0, 1]);//rotation to back
				var rym3 = new Matrix([
					0, 0, 1, 0,
					0, 1, 0, 0,
					-1, 0, 0, 0,
					0, 0, 0, 1]);//rotation to front
				var rym2 = new Matrix([
					-1, 0, 0, 0,
					0, 1, 0, 0,
					0, 0, -1, 0,
					0, 0, 0, 1]);//rotation to right

				var rzm = new Matrix([
					0, -1, 0, 0,
					1, 0, 0, 0,
					0, 0, 1, 0,
					0, 0, 0, 1]);//rotation to bottom
				var rzm3 = new Matrix([
					0, 1, 0, 0,
					-1, 0, 0, 0,
					0, 0, 1, 0,
					0, 0, 0, 1]);//rotation to top
				var rxm = new Matrix(
				   [1, 0, 0, 0,
					0, 0, 1, 0,
					0, -1, 0, 0,
					0, 0, 0, 1]);// backwards 90deg;
				var rxm2 = new Matrix(
				   [1, 0, 0, 0,
					0, -1, 0, 0,
					0, 0, -1, 0,
					0, 0, 0, 1]); // 180;
				var rxm3 = new Matrix(
				   [1, 0, 0, 0,
					0, 0, -1, 0,
					0, 1, 0, 0,
					0, 0, 0, 1]); // forwards 90deg;

				for (var i = 0; i < cubies.length; i++) {
					var actualCoords = CubeData.getCubieCoordinates(i, size);
					var stickerIndexs = CubeData.getCubieFaceStickerIndex(i, size);
					var contactFaces = CubeData.getTouchingFacesClockwise(actualCoords.x, actualCoords.y, actualCoords.z, size);
					
					var homeFace = contactFaces[0];
					var secondaryFace = -1;// Default
					if(contactFaces.length > 1){
						secondaryFace = contactFaces[1];
					}
					var modMat = new Matrix([
						1, 0, 0, 0,
						0, 1, 0, 0,
						0, 0, 1, 0,
						0, 0, 0, 1]);
					
					var translation = new Matrix([
						1, 0, 0, actualCoords.x,
						0, 1, 0, actualCoords.y,
						0, 0, 1, actualCoords.z,
						0, 0, 0, 1]);
					
					modMat = modMat.multiply(translation);
					modMat = modMat.multiply(baseMatrix);
					switch(homeFace){
						case CUBE_FACE.Left:{
							switch(secondaryFace){
								case CUBE_FACE.Back:{
									modMat = modMat.multiply(rxm3);
									break;
								}
								case CUBE_FACE.Up:{
									modMat = modMat.multiply(rxm2);
									break;
								}
								case CUBE_FACE.Front:{
									modMat = modMat.multiply(rxm);
									break;
								}
								case CUBE_FACE.Down:
									// Fall through
								default:{
									// Nothing is Needed
									break;
								}
							}
							break;
						}
						case CUBE_FACE.Down:{
							switch(secondaryFace){
								
								case CUBE_FACE.Front:{
									modMat = modMat.multiply(rzm);
									modMat = modMat.multiply(rxm);
									break;
								}
								case CUBE_FACE.Back:{
									modMat = modMat.multiply(rzm);
									modMat = modMat.multiply(rxm3);
									break;
								}
								case CUBE_FACE.Right:
									// Fall through;
								default:{
									modMat = modMat.multiply(rzm);
									break;
								}
							}
							break;
						}
						case CUBE_FACE.Back:{
							switch(secondaryFace){
								case CUBE_FACE.Up:{
									modMat = modMat.multiply(rym);
									modMat = modMat.multiply(rxm2);
									break;
								}
								case CUBE_FACE.Right:{
									modMat = modMat.multiply(rym);
									modMat = modMat.multiply(rxm3);
									break;
								}
								default:{
									modMat = modMat.multiply(rym);
									break;
								}
							}
							break;
						}
						
						case CUBE_FACE.Front:{
							switch(secondaryFace){
								case CUBE_FACE.Up:{
									modMat = modMat.multiply(rym3);
									modMat = modMat.multiply(rxm2);
									break;
								}
								case CUBE_FACE.Right:{
									modMat = modMat.multiply(rym3);
									modMat = modMat.multiply(rxm);
									break;
								}
								default:{
									modMat = modMat.multiply(rym3);
									break;
								}
							}
							break;
						}

						case CUBE_FACE.Up:{
							switch(secondaryFace){
								case CUBE_FACE.Right:{
									modMat = modMat.multiply(rym2);
									modMat = modMat.multiply(rzm3);
									break;
								}
								default:{
									modMat = modMat.multiply(rzm3);
									break;
								}
							}
							break;
						}
						
						default:{
							// AKA the right
							modMat = modMat.multiply(rym2);
						}
					}


					cubies[i].modelMat = modMat;

				}


			};

			this.resetCubies = function () {
				resetCubies();
			}


			this.addRotation = function (layer, direction) {//adds a rotation to the que

				var layerCount = AlgorithmStorage.getLayerCount(size);
				rotationQue.push(layer + direction * layerCount);
			};


			function rotate(move) {//only used to actualy rotate the data by the vCube itself, not meant to be accessed else where.
				// TODO, update this to accept an algorithm or filter
				var algStorage = new AlgorithmStorage(size, 1, 1);
				algStorage.addAlgorithm([move]);
				var filter = algStorage.getFilter(0, dataStorageFormat);
				filter.applyFilter(cubeData, cubeNumber);

			};

			function rotateCubies(move) {//updates the cubies position in the cubie list for proper coordinate selecting for animations and cube editing

				//turns can be simplified into pieces that are swapped and transformed, using a lot of the cubeData utilities made previously, this should not be a hard task.
				// TODO, allow this to accept an algorthm and an id
				var algStorage = new AlgorithmStorage(size, 1, 1);
				algStorage.addAlgorithm([move]);
				var filter = algStorage.getFilter(0, CUBE_DATA_TYPE.Piece);
				var filterData = filter.getFilterData();
				var destinationList;


				destinationList = cubies.slice(0);
				var filterLength = filterData.length;
				
				const LocationCount = size ** 3 - (size - 2) ** 3;

				for (var j = 0; j < filterLength; j++) {
					var originLocation = filterData[j];
					originLocation %= LocationCount;
					destinationList[j] = cubies[originLocation];

					var dl = CubeData.getCubieFaceStickerIndex(j, size);
					var cubieIdData = [[idColor / 255, 0, 0], [idColor / 255, 0, 0], [idColor / 255, 0, 0]];
					for (var i = 0; i < dl.length; i++) {
						cubieIdData[i][1] = Math.floor(dl[i] / 256) / 255;
						cubieIdData[i][2] = (dl[i] % 256) / 255;
					}
					destinationList[j].dataLink = dl;
					destinationList[j].idColors = cubieIdData;
				}
				cubies = destinationList.slice(0);


			}


			this.update = function (shouldAnimate=true) {
				//shouldAnimate decides if the cube should progress its animation or not.


				if (!timeControl && shouldAnimate) {//Is the cube just being moved but not controlled by an external source?
					if (rotating) {
						animationTime++;
						if (animationTime >= animationDuration) {//Is the animation done?
							animationTime = 0;

							/*
							var rym=[Math.cos(degy*pr),0,-Math.sin(degy*pr),0,
									 0,1,0,0,
									 Math.sin(degy*pr),0,Math.cos(degy*pr),0,
									 0,0,0,1];
							var rxm=[1,0,0,0,
									 0,Math.cos(degx*pr),Math.sin(degx*pr),0,
									 0,-Math.sin(degx*pr),Math.cos(degx*pr),0,
									 0,0,0,1];
							var rzm=[Math.cos(degz*pr),-Math.sin(degz*pr),0,0,
									 Math.sin(degz*pr),Math.cos(degz*pr),0,0,
									 0,0,1,0,
									 0,0,0,1];
							*/
							rotationMatrix[rotationLocations[0]] = Math.round(Math.cos(PR * targetDegrees));//update the rotation matrix to reflect the goal position
							rotationMatrix[rotationLocations[1]] = Math.round(-Math.sin(PR * targetDegrees));
							rotationMatrix[rotationLocations[2]] = Math.round(Math.sin(PR * targetDegrees));
							rotationMatrix[rotationLocations[3]] = Math.round(Math.cos(PR * targetDegrees));
							for (var i = 0; i < rotatingCubies.length; i++) {
								//Add the rotation matrix applied through the temp matrix on the cubies to the cubies own model matrix and reset the temp matrix
								cubies[rotatingCubies[i]].modelMat = new Matrix(rotationMatrix).multiply(cubies[rotatingCubies[i]].modelMat);

							}

							rotatingCubies = [];
							rotateCubies(rotationQue[0]);
							rotate(rotationQue[0]);
							if (!recording) {
								rotationQue.splice(0, 1);
							}
							if (recording || retainStartData && rotationQue.length > quePosition + 1) {
								//Are we recording and is there more information in the que? if so don't damage the start data but start animating the next rotation
								quePosition++;

								var layer;
								var direction;
								var isOdd = (size % 2 == 1);
								var plane = 0;//0 is along z value, 1 is y, 2 is x
								var planeLocation = 0;//tells which slice of cube you are on.
								layer = rotationQue[quePosition];
								direction = Math.floor(layer / AlgorithmStorage.getLayerCount(size));//add one to this to see how many times a rotation should be done
								layer %= AlgorithmStorage.getLayerCount(size);

								if (isOdd) {
									plane = Math.floor(layer / (size - 1));
									planeLocation = layer % (size - 1);
									if (planeLocation + 1 > size / 2) {
										planeLocation++;
									}
								}
								else {
									plane = Math.floor(layer / size);
									planeLocation = layer % size;
								}
								var cl = cubies.length;
								for (var i = 0; i < cl; i++) {
									switch(plane){
										case 0:{
											if (CubeData.getCubieCoordinates(i, size).x == planeLocation) {
												rotatingCubies.push(i);
											}
											break;
										}
										case 1:{
											if (CubeData.getCubieCoordinates(i, size).y == planeLocation) {
												rotatingCubies.push(i);
											}
											break;
										}
										case 2:{
											if (CubeData.getCubieCoordinates(i, size).z == planeLocation) {
												rotatingCubies.push(i);
											}
											break;
										}
									}
								}
								rotationMatrix = Matrix.getIdenity(4).getArray();
								switch (direction) {
									case 0: targetDegrees = 90;
										break;
									case 1: targetDegrees = 180;
										break;
									case 2: targetDegrees = -90;
										break;

								}
								switch (plane) {
									case 0: rotationLocations = [5, 6, 9, 10];
										break;
									case 1: rotationLocations = [0, 2, 8, 10];
										targetDegrees *= -1;
										break;
									case 2: rotationLocations = [0, 1, 4, 5];
										break;

								}
							} else if (rotationQue.length > 0) {
								//if we are not recoriding but still have some info in the que, animate and update the data as well for the next rotaion in que.
								var layer;
								var direction;
								var isOdd = (size % 2 == 1);
								var plane = 0;//0 is along z value, 1 is y, 2 is x
								var planeLocation = 0;//tells which slice of cube you are on.
								layer = rotationQue[0];
								//this.rotate(layer);
								direction = Math.floor(layer / AlgorithmStorage.getLayerCount(size));//add one to this to see how many times a rotation should be done
								layer %= AlgorithmStorage.getLayerCount(size);

								if (isOdd) {
									plane = Math.floor(layer / (size - 1));
									planeLocation = layer % (size - 1);
									if (planeLocation + 1 > size / 2) {
										planeLocation++;
									}
								}
								else {
									plane = Math.floor(layer / size);
									planeLocation = layer % size;
								}
								var cl = cubies.length;
								for (var i = 0; i < cl; i++) {
									switch(plane){
										case 0:{
											if (CubeData.getCubieCoordinates(i, size).x == planeLocation) {
												rotatingCubies.push(i);
											}
											break;
										}
										case 1:{
											if (CubeData.getCubieCoordinates(i, size).y == planeLocation) {
												rotatingCubies.push(i);
											}
											break;
										}
										case 2:{
											if (CubeData.getCubieCoordinates(i, size).z == planeLocation) {
												rotatingCubies.push(i);
											}
											break;
										}
									}
								}
								rotationMatrix = Matrix.getIdenity(4).getArray();
								switch (direction) {
									case 0: targetDegrees = 90;
										break;
									case 1: targetDegrees = 180;
										break;
									case 2: targetDegrees = -90;
										break;

								}
								switch (plane) {
									case 0: rotationLocations = [5, 6, 9, 10];
										break;
									case 1: rotationLocations = [0, 2, 8, 10];
										targetDegrees *= -1;//for some reason this plane rotates differently causing a desync between visual and internal data
										break;
									case 2: rotationLocations = [0, 1, 4, 5];
										break;

								}
							} else {
								rotating = false;
							}
							resetCubies();
						} else {//if the animation is on going, update the rotation matrix for all the cubies that are affected
							var per = animationTime / animationDuration;
							currentDegrees = per * per * targetDegrees;
							rotationMatrix[rotationLocations[0]] = Math.cos(PR * currentDegrees);
							rotationMatrix[rotationLocations[1]] = -Math.sin(PR * currentDegrees);
							rotationMatrix[rotationLocations[2]] = Math.sin(PR * currentDegrees);
							rotationMatrix[rotationLocations[3]] = Math.cos(PR * currentDegrees);
							// for (var i = 0; i < rotatingCubies.length; i++) {
							// 	// REMOVE, rotation will be applied at render time
							// 	// cubies[rotatingCubies[i]].model[6] = rotationMatrix;
							// }
						}

					} else if (rotationQue.length > 0) {//if we are not rotating right now, should we be?
						rotating = true;
						var layer;
						var direction;
						var isOdd = (size % 2 == 1);
						var plane = 0;//0 is along z value, 1 is y, 2 is x
						var planeLocation = 0;//tells which slice of cube you are on.
						if (recording || retainStartData) {
							layer = rotationQue[quePosition];
						} else {
							layer = rotationQue[0];
							//this.rotate(layer);
						}
						direction = Math.floor(layer / AlgorithmStorage.getLayerCount(size));//add one to this to see how many times a rotation should be done
						layer %= AlgorithmStorage.getLayerCount(size);

						if (isOdd) {
							plane = Math.floor(layer / (size - 1));
							planeLocation = layer % (size - 1);
							if (planeLocation + 1 > size / 2) {
								planeLocation++;
							}
						} else {
							plane = Math.floor(layer / size);
							planeLocation = layer % size;
						}
						var cl = cubies.length;
						rotatingCubies = [];
						for (var i = 0; i < cl; i++) {
							switch(plane){
								case 0:{
									if (CubeData.getCubieCoordinates(i, size).x == planeLocation) {
										rotatingCubies.push(i);
									}
									break;
								}
								case 1:{
									if (CubeData.getCubieCoordinates(i, size).y == planeLocation) {
										rotatingCubies.push(i);
									}
									break;
								}
								case 2:{
									if (CubeData.getCubieCoordinates(i, size).z == planeLocation) {
										rotatingCubies.push(i);
									}
									break;
								}
							}
						}

						rotationMatrix = Matrix.getIdenity(4).getArray();
						switch (direction) {
							case 0: targetDegrees = 90;
								break;
							case 1: targetDegrees = 180;
								break;
							case 2: targetDegrees = -90;
								break;

						}
						switch (plane) {
							case 0: rotationLocations = [5, 6, 9, 10];
								break;
							case 1: rotationLocations = [0, 2, 8, 10];
								targetDegrees *= -1;
								break;
							case 2: rotationLocations = [0, 1, 4, 5];
								break;

						}
					}
				}
			};
			//add cubies and load colors from the data.
			for (var x = 0; x < size; x++) {
				for (var y = 0; y < size; y++) {
					for (var z = 0; z < size; z++) {
						var count = CubeData.getTouchingFaces(x , y, z, size).length;
						if (count > 0) {
							var cubieIndex = CubeData.getCubieIndex(x, y, z, size);
							var sides = CubeData.getCubieFaceStickerIndex(cubieIndex, size);
							
							var cubieData = [0, 0, 0];
							var cubieIdData = [[idColor / 255, 0, 0], [idColor / 255, 0, 0], [idColor / 255, 0, 0]];
							var cubieDataLink = sides.slice(0);
							
							for (var i = 0; i < sides.length; i++) {
								cubieData[i] = cubeData.getStickerByIndex(sides[i], cubeNumber);
								cubieIdData[i][1] = Math.floor(sides[i] / 255) / 255;
								cubieIdData[i][2] = (sides[i] % 256) / 255;
							}
							//@ts-ignore
							cubies.push(new VCubie(count - 1, style, cubieData));
							cubies[cubies.length - 1].dataLink = cubieDataLink;
						}
					}
				}
			}
			resetCubies();
		}

		var op = document.getElementById("debugOP");
		var selColor = 0;

		var VCubeList = [];

		var testCube;

		var tstRender = new Renderer();

		function start() {
			Controls.SetUp();
			testCube = new VCube(3, CUBE_DATA_TYPE.Piece);
			document.getElementById("solve_cube").addEventListener("click", function(){SolveWithWorker(testCube.getCubeData(), 0, basicStartCallBack, basicSuccessCallBack, basicFailureCallBack, basicUpdateCallBack);});
			draw();
		}

		function draw() {
			
			testCube.update();
			tstRender.clearAll();
			tstRender.update();
			tstRender.renderCube(testCube, true);

			var info = Controls.GetMouseSelection();
			if (Controls.MouseJustWentDown && info.Cube != 255) {
			 	Controls.SelectedCube = info.Cube;
			 }
			 if (Controls.MouseIsDown && !Controls.MouseJustWentDown && Controls.selectedCube != -1) {
				Controls.MoveCube();
			} else if (!Controls.MouseIsDown) {
			 	Controls.SelectedCube = -1;
			 }

			requestAnimationFrame(draw);
		}


		function SolveWithWorker(cubeData, cubeNumber=0, startCallBack=basicStartCallBack, successCallBack=basicSuccessCallBack, failureCallBack=basicFailureCallBack, updateCallBack=basicUpdateCallBack){
			if(!webWorkersAvailable){
				solveCube(cubeData, cubeNumber, startCallBack, successCallBack, failureCallBack, updateCallBack);
			}else{
				if(SolveWithWorker.worker == null){
					SolveWithWorker.worker = new Worker("cubeSolverV3.2Worker.js", { type: "module" });
					SolveWithWorker.worker.onmessage = handleWorkerResponse;
				}
				var worker =  SolveWithWorker.worker;
				

				function cancelWorker(){
					worker.postMessage({type:"cancel",data:queItem.data});
					
				}

				var queItem = {
					data: cubeData.getCubeDataAsString(cubeNumber),
					startCallBack: startCallBack,
					successCallBack: successCallBack,
					failureCallBack: failureCallBack,
					updateCallBack: updateCallBack,
					cancelCallBack: cancelWorker
				}

				SolveWithWorker.que.push(queItem);

				if(SolveWithWorker.que.length == 1){
					handleNextQueItem();
				}
				
			}

			function handleNextQueItem(){
				if(SolveWithWorker.que.length > 0){
					
					SolveWithWorker.worker.postMessage(SolveWithWorker.que[0].data);
				}
			}

			function advanceQue(){
				SolveWithWorker.que.splice(0,1);
				handleNextQueItem();
			}

			function handleWorkerResponse(event){
				//Response should be structured like so:
				//{type:String (can be strt, sucs, fail, upda each corresponding to the above callbacks), args in string form)}
				var resp = event.data;
				var queItem = SolveWithWorker.que[0];
				switch (resp.type){
					
					case "strt":{
						queItem.startCallBack(queItem.cancelCallBack)
						break;
					}
					case "sucs":{
						var algStorage = new AlgorithmStorage(resp.cubeSize, resp.algLength, 1);
						
						algStorage.addAlgorithm(resp.alg);
						queItem.successCallBack(algStorage, 0, resp.time, resp.cycles);
						advanceQue();
						break;
					}
					case "fail":{
						queItem.failureCallBack(resp.errors);
						advanceQue();
						break;
						
					}
					case "upda":{
						queItem.updateCallBack(resp.text);
						if(resp.text == "The solve was canceled by user"){
							advanceQue();
						}
						break;
					}
					default:{
						console.log(resp);
					}
				}
			}
		}

		SolveWithWorker.que = [];
		
		/**
		 * @type {Worker}
		 */
		SolveWithWorker.worker = null;


		/*
		Notes and TO DO
		Allow vCubes to have a time seeker/be controlled by a slider
		Create Settings object - object that handels all settings and setting operations (such as visual, language, and various other items)
		Work on mobile function
		Optimize algorithm code
		Run tests
		*/
		//apply super flip to 3by3
		/*nray = [3,2,
		1,1,
		5,2,
		4,0,
		1,2,
		4,1,
		1,2,
		3,1,
		0,0,
		4,1,
		1,2,
		3,0,
		2,2,
		1,1,
		5,2,
		1,0,
		0,0,
		4,1,
		3,1,
		5,1];
		for(var i = 0;i<nray.length;i+=2){testCube.addRotation(nray[i],nray[i+1]);}
		
		
		*/

		function applySuperFilp(cube){
			var cubeSize = cube.size;
			var layerCount = AlgorithmStorage.getLayerCount(cubeSize) / 3;
			const isOdd = cube % 2 == 1;
			var nray = 
				[3,2,
				1,1,
				5,2,
				4,0,
				1,2,
				4,1,
				1,2,
				3,1,
				0,0,
				4,1,
				1,2,
				3,0,
				2,2,
				1,1,
				5,2,
				1,0,
				0,0,
				4,1,
				3,1,
				5,1]
			for(var i = 0; i < layerCount / 2; i++){
				for(var j = 0; j < nray.length; j+=2){
					// convert the layer to the cube size
					var layer = nray[j];
					const Plane = Math.floor(layer / 2);
					var slice = layer % 2

					for(var k = 0; k < layerCount / 2 - i; k++){
						var newSlice = layerCount / 2 - 1 - (i + k);
						if(slice >= 1){
							newSlice = layerCount - (layerCount / 2 - (i + k));
						}
						var newLayer = Plane * layerCount + newSlice;
						console.log(nray[j], newLayer, slice, newSlice)
						cube.addRotation(newLayer, nray[j + 1])
					}
				}
			}
		}

		// function testAlgorithmIndex(){
		// 	// This was created to test and make sure the index algorithm does
		// 	// Not lose any cubes.
		// 	// To do this we removed the move validation checks on a test function to let
		// 	// All possible combinations of moves be valid. we will see how many unique cubes there are
		// 	// In each storage. This is going to take a while, so take a seat!


		// 	// Results: We were in fact losing about 150 cubes due to incorrectly copying the previous moves array in the goBack function in selfIndex()
		// 	function SNode(id){
		// 		this.id = id;
		// 		this.next = null;
		// 		this.duplicates = null;
		// 		this.duplicateCount = 0;
		// 	}
			
		// 	var startNodeA = null;
		// 	var startNodeB = null;
			
		// 	var algStorageA = new AlgorithmStorage(3, 3);
		// 	var algStorageB = new AlgorithmStorage(3, 3);
		// 	algStorageA.selfIndex();
		// 	//algStorageB.testSelfIndex();

		// 	var totalCubeCount = algStorageA.getAlgCount() + algStorageB.getAlgCount();
		// 	var cubeStorage = new CubeData(3, totalCubeCount, CubeDataType.Surface);

		// 	// Start generating our nodes for each cube;
		// 	var algCountA = algStorageA.getAlgCount();
		// 	var previousNode = null;
			
		// 	for(var i = 0; i < algCountA; i ++){
		// 		var filter = algStorageA.getFilter(i, CubeDataType.Surface);
		// 		filter.applyFilter(cubeStorage, i);
		// 		if(i == 0){
		// 			startNodeA = new SNode(i);
		// 			previousNode = startNodeA;
		// 		}else{
		// 			previousNode.next = new SNode(i);
		// 			previousNode = previousNode.next;
		// 		}
		// 	}

		// 	var algCountB = algStorageB.getAlgCount();
		// 	var previousNode = null;
		// 	for(var i = 0; i < algCountB; i ++){
		// 		var filter = algStorageB.getFilter(i, CubeDataType.Surface);
		// 		filter.applyFilter(cubeStorage, i + algCountA);
		// 		if(i == 0){
		// 			startNodeB = new SNode(i + algCountA);
		// 			previousNode = startNodeB;
		// 		}else{
		// 			previousNode.next = new SNode(i + algCountA);
		// 			previousNode = previousNode.next;
		// 		}
		// 	}

		// 	// Now compare the cubes against each other in each list;
		// 	var uniqueACubes = 0;
		// 	var uniqueBCubes = 0;
		// 	var cubesInBNotInA = null;

		// 	var cNode = startNodeA;
		// 	while(cNode != null){

		// 		if(cNode.duplicates == null){
		// 			uniqueACubes ++;
		// 			/** @type {SNode} */
		// 			var tNode = cNode.next;
		// 			// go through all future cubes in the list to see how many this duplicates
		// 			while(tNode != null){
		// 				if(tNode.duplicates == null){
		// 					var cData = cubeStorage.getCubeDataAsString(cNode.id);
		// 					var tData = cubeStorage.getCubeDataAsString(tNode.id);

		// 					if(cData == tData){
		// 						tNode.duplicates = cNode;
		// 						cNode.duplicateCount ++;
		// 					}
		// 				}
		// 				tNode = tNode.next;
		// 			}

		// 		}
		// 		cNode = cNode.next;
		// 	}


		// 	var cNode = startNodeB;
		// 	while(cNode != null){
		// 		if(cNode.duplicates == null){
		// 			uniqueBCubes ++;
		// 			/** @type {SNode} */
		// 			var tNode = cNode.next;
		// 			// go through all future cubes in the list to see how many this duplicates
		// 			while(tNode != null){
		// 				if(tNode.duplicates == null){
		// 					var cData = cubeStorage.getCubeDataAsString(cNode.id);
		// 					var tData = cubeStorage.getCubeDataAsString(tNode.id);

		// 					if(cData == tData){
		// 						tNode.duplicates = cNode;
		// 						cNode.duplicateCount ++;
		// 					}
		// 				}
						
		// 				tNode = tNode.next;
		// 			}

		// 			tNode = startNodeA;
		// 			// go through all future cubes in the other list, see which ones don't have a friend
		// 			while(tNode != null){
		// 				if(tNode.duplicates == null){
		// 					var cData = cubeStorage.getCubeDataAsString(cNode.id);
		// 					var tData = cubeStorage.getCubeDataAsString(tNode.id);

		// 					if(cData == tData){
		// 						break;
		// 					}
		// 				}
						
		// 				tNode = tNode.next;
		// 			}

		// 			if(tNode == null){
		// 				console.log("Cube with no friend in other array. Alg: ", algStorageB.getMovesAsText(cNode.id - algCountA));
		// 			}
		// 		}
		// 		cNode = cNode.next;
		// 	}



		// 	console.log("Unique cubes in A: " + uniqueACubes);
		// 	console.log("Unique cubes in B: " + uniqueBCubes);
		// 	console.log("Duplicate cubes in A: " + (algCountA - uniqueACubes));
		// 	console.log("Duplicate cubes in B: " + (algCountB - uniqueBCubes));


		// }

		var AllxMoveAlgs = [];
		var XmoveScores = [];//{CubeSize:0,AlgLength:0,Scores:[[0,0],[1,100]]}

		function ScoreAllXMoveCubes(cubeSize = 3, xNumber = 3) {
			//Search to see if the _Algorithm was cached yet, if not request to start the run for it.

			function scoreCube(cubeData){

				var cubeScore = 0;
				const FaceSize = cubeSize ** 2;
				// To score the cubes, we are going to count the 
				// Number of sqaures that are touching of the same color 
				// (2 squares touching results in 2 points in this case)
				// TODO improve this metric later
				for(var i = 0; i < FaceSize; i ++){
					var x = i % cubeSize;
					var y = Math.floor(i / cubeSize);

					// Go through each sticker on each side and see how many colors of its own it touches
					// Note that if x or y is out of range, getSticker will return -1
					//debugger;

					for(var side = 0; side < 6; side++){
						var stickerColor = cubeData.getSticker(side, x, y);
						
						if(stickerColor == cubeData.getSticker(side, x + 1, y)){
							cubeScore ++;
						}

						if(stickerColor == cubeData.getSticker(side, x - 1, y)){
							cubeScore ++;
						}

						if(stickerColor == cubeData.getSticker(side, x, y + 1)){
							cubeScore ++;
						}

						if(stickerColor == cubeData.getSticker(side, x, y - 1)){
							cubeScore ++;
						}

					}

				}
				
				return cubeScore;

			}

			var scores = [];
			var all3MoveAlgs = new AlgorithmStorage(cubeSize, xNumber);
			all3MoveAlgs.selfIndex();

			AllxMoveAlgs = [];
			var numberOfAlgs = all3MoveAlgs.getAlgCount();
			var filters = []

			for(var i = 0; i < numberOfAlgs; i++){
				filters.push(all3MoveAlgs.getFilter(i, CUBE_DATA_TYPE.Surface))
			}

			var scoreFound = false;

			for (var i = 0; i < numberOfAlgs; i++) {
				var myCube = new CubeData(cubeSize, 1);
				filters[i].applyFilter(myCube);
				var aScore = scoreCube(myCube);
				scoreFound = false;

				for (var j = 0; j < scores.length; j++) {
					if (scores[j][0] == aScore) {
						scores[j][1]++;
						scoreFound = true;
					}
				}
				if (!scoreFound) {
					scores.push([aScore, 1])
				}
			}
			XmoveScores.push({ "CubeSize": cubeSize, "AlgLength": xNumber, "Scores": scores })
		}

		start();
