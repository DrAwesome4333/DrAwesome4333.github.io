// @ts-check
/*
		* Plan for redoing stuff:
		* ✔ Turn CubeData into a class 
		* ✔ Create a BinaryData class to handle compressed arrays, in a way that can be used in a cleaner way 
		* ✔ Create a Algorithm class to create a consitent way to interact with algorithms
		* ✔ Create a Cube class (we kind of already have it)
		* ✔ Create a CubieData class for piece data
		* Re - Design the Cubie class to have methods only it uses with it.
		* ✔ Create a Model class so models can be independent of the Render Object
		* Re work tasks that may take a while to web workers and promises
		* Clean up the code a ton
		* Create a start webGl function that will only do the things required to start webGl and can be recalled in case of context loss
		*/

		/**@type {WebGLRenderingContext} */
		var gl = null;//A global refrence to Renderer.gl so that I don't have to keep typing Renderer.gl or this.gl, just gl.			
		const PR = Math.PI / 180;//(Pi ratio, use this to convert degrees to Radians)

		const CubieType = {
			Center: 0,
			Edge: 1,
			Corner: 2
		};

		const CubieStyle = {
			Plain: 0,
			Fast: 1
		};

		const CubeDataType = {
			Surface: 0,
			Piece: 1,
			Compact: 2,
			Fast: 3
		};

		const CubeFace = {
			Left: 0,
			Down: 1,
			Back: 2,
			Front: 3,
			Up: 4,
			Right: 5
		}

		
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


		function generateSolvedCubeBinaryData(size=3, count=1) {
			// Generates Solved Binary data for Surface Type cubes. Since the data
			// is flagged as Surface type, if is given to any other format of cube data, it will
			// automatically be converted as the flag will be detected
			var dataArray = [];
            for(var i = 0; i < 6; i++){
                for(var j = 0; j < size * size; j++){
                    dataArray.push(i);
                }
            }
			var dataCountPerCube = dataArray.length;
			var binData = new BinaryData(5, [], dataCountPerCube * count, CubeDataType.Surface)
			for(var i = 0; i < count; i++){

				binData.setArray(dataCountPerCube * i, dataArray);
			}
            return binData;
		}

		/*
		class BinaryData
		---------------------
		- dataArray:Uint8Array
		- elementBitLength:int
		- elementCount:int
        - dataFlag:int          // not utilized by the object but useful for tagging data types
		----------------------
		BinaryData(maxElementSize:int, data:array, elementCount:int):BinaryData
		getData(element:int):int
		setData(element:int, info:int):bool
		getMaxElementSize():int
		getArray(startElement:int, endElement:int):array[int]
		setArray(startElement:int, data:array[int]:bool
		getBitLength():int
		getElementCount():int
        getDataFlag():int
        setDataFlag(flag:int):bool
		
		*/

		function BinaryData(maxElementSize=1, data=[0], elementCount=1, dataFlag=-1){
			// Returns an obect used for storing binary data
			// This only can store unsigned integers inside.

			this.setData = function(elementIndex=0, info=0){
				// Sets an element in the array, returns true for success, false for failure

				// Check if info is in an invalid range
				if(info > maxElementSize || info % 1 != 0 || typeof (info) != "number"){
					throw "Error: Could not set binary data, info too large or invalid. Data recived: " + info;
				}

				// Check if elementIndex is in range
				if(elementIndex >= elementCount){
					throw "Error: Could not set binary data, Element index out of range or invalid. Data recived: " + info;
				}

				// Loop through all the bits in the info array set the coresponding bit in the data array
				for(var i = 0; i < elementBitLength; i++){
					var byte = Math.floor((elementIndex * elementBitLength + i) / 8);
					var bit = (elementIndex * elementBitLength + i) % 8;
					var relativeByte = byte % MAX_BYTES_PER_ARRAY;
					var dataArray = dataArrays[Math.floor(byte / MAX_BYTES_PER_ARRAY)];
					dataArray[relativeByte] = changeBit(dataArray[relativeByte], bit, getBit(info, i));
				}
				return true;
			}

			this.getData = function(elementIndex=0){
				if(elementIndex >= elementCount || elementIndex < 0){
					throw "Error, cannot access elements outside of array. Expected Range: 0 - " + (elementCount - 1) + " Value requested: " + elementCount;
				}
				var result = 0;
				for(var i = elementBitLength - 1; i >= 0; i--){
					var byte = Math.floor((elementIndex * elementBitLength + i) / 8);
					var bit = (elementIndex * elementBitLength + i) % 8;
					var relativeByte = byte % MAX_BYTES_PER_ARRAY;
					var dataArray = dataArrays[Math.floor(byte / MAX_BYTES_PER_ARRAY)];
					result = result << 1;
					result += getBit(dataArray[relativeByte], bit);
				}
				return result;
			}

			this.getMaxElementSize = function(){
				return maxElementSize;
			}

			this.getBitLength = function(){
				return elementBitLength;
			}

			this.getElementCount = function(){
				return elementCount;
			}

			this.getArray = function(startElementIndex=0, endElementIndex=elementCount - 1){
				// Gets a list of items out of the data, can be reversed
				// Defaults to whole array
				var result = [];
				// Check if we are in bounds of the array
				if (startElementIndex < 0 || endElementIndex < 0 || startElementIndex >= elementCount || endElementIndex >= elementCount){
					throw "Error, cannot access elements outside of array Expected Range: 0 - " + (elementCount - 1) + " Values requested: " + startElementIndex + " - " + endElementIndex;
				}
				// Check if it is reversed
				if (endElementIndex < startElementIndex){
					for(var i = endElementIndex; i <= startElementIndex; i++){
						result.push(this.getData(i));
					}
				}else{
					for(var i = startElementIndex; i <= endElementIndex; i++){
						result.push(this.getData(i));
					}
				}

				return result;
				
			}

			this.setArray = function(startElementIndex=0, info=[0]){
				//Sets an array of data starting with startElement
				if (startElementIndex < 0 || startElementIndex + info.length > elementCount){
					throw "Error, cannot set elements outside of array Expected Range: 0 - " + (elementCount - 1) + " Values sent: " + startElementIndex + " - " + (startElementIndex + info.length);
				}
				var passed = true;
				for(var i = 0; i < info.length; i++){
					passed = this.setData(startElementIndex + i, info[i]);
					if (!passed){
						break;
					}
				}
				return passed;

			}

			function getBit(value=0, bit=0){
				// Gets a binary bit out of a number
				// We right shift value by bit places to get the bit we want in the first bit location, then we AND by 1 to leave only the first bit
				return value >>> bit & 1;
			}

			function changeBit(value=0, bit=0, set=0){
				// changes a bit in value to either set (1) or reset(0) and returns it
				// Check if no change is needed, in this case return the orignal value
				if(set === getBit(value, bit))
					return value;
				// else toggle the bit
				// We do this by getting 1, left shifting it bit times and then XOR ing it with value
				return value ^ (1 << bit);
			}

            this.getDataFlag = function(){
                return dataFlag;
            }

            this.setDataFlag = function(flag=-1){
                dataFlag = flag;
                return true;
            }

			this.getBinaryData = function(){
				// Returns the binary data stored within the function
				// Use for debugging purposes
				return dataArrays.slice(0);
			}

			// Calculate the minimum bit length to store a number of maxElementSize
			var elementBitLength = 1;
			var valueOfPOT = 2;
			/**@type {Uint8Array[]} */
			var dataArrays = [];
			const MAX_BYTES_PER_ARRAY = 1024;
			while(valueOfPOT < maxElementSize){
				elementBitLength ++;
				valueOfPOT *= 2;
			}

			// Calculate the actual maxElement size based on the bit length we calculated recieved
			maxElementSize = valueOfPOT - 1;

			// Verify the number of elements given in elementCount is enough to hold the data, if not, take up more more data
			if(data.length > elementCount){
				elementCount = data.length;
			}

			// Calculate the number of bytes needed to store the number of elements given
			var byteCount = Math.ceil(elementBitLength * elementCount / 8);

			// If the byteCount came out to be 1 (due to empty array and elementCount being set to 0), set it to 1
			if (byteCount == 0){
				byteCount = 1;
			}

			// create our data array based on the byte count calcualated
			for(var i = 0; i < byteCount; i += MAX_BYTES_PER_ARRAY){
				// Create an array of arrays to keep the data, that way it does not have to be one continous block.
				dataArrays.push(new Uint8Array(Math.min(MAX_BYTES_PER_ARRAY, byteCount - i)))
			}
			//dataArray = new Uint8Array(byteCount);
			
			// fill the array with data
			for(var i = 0; i < data.length; i++){
				this.setData(i, data[i]);
			}

			

		}
		
		/*
		class Cubie
		-----------------
		- faces:[int, int, int]
		- cubieCode:int
		- valid:bool
		- type:CubieType
		------------------
		Cubie(type:CubieType, faces:[int, int, int]):Cubie
		getFace(face:int):int
		getFaces():[int]
		setFace(face:int, value:int):bool
		setFaces(values:[int]):bool
		getCode():int
		setCode(code:int):bool
		getPieceCode():int 
		isValid():bool
		- validate():None
		getType():int
		*/
		
		function Cubie(type=CubieType.Center, faces=[0,0,0], cubieCode=255){

			this.getFace = function(face=0){
				if (face > type){
					// 255 is our error value
					return 255;
				}
				return faces[face];
			}

			this.getFaces = function(){
				// return a copy of the array to avoid giving away private variables
				return faces.slice(0);
			}

			this.setFace = function(face=0, value=0){
				// Verify both the face and value are valid, if they are, set the face to value
				// Returns true if it was successful false otherwise.
				if(face > type || face < 0 || face % 1 != 0){
					if(shouldLogErrors){
						console.log("Could not set face on cubie, invalid face")
					}
					return false;
				}

				if(value > 5 || value < 0 || value % 1 != 0){
					value = 0;
					if(shouldLogErrors){
						console.log("Could not set face on Cubie, invalid value given")
					}
					return false;
				}

				faces[face] = value;

				validate();
				return true;
			}

			this.setFaces = function(values=[0,0,0]){
				// Verify we have enough values and all faces are within the valid range
				if(values.length < type){
					if(shouldLogErrors){
						console.log("Could not set faces on Cubie, not enough vaules given");
					}
					return false;
				}
				for(var i = 0; i <= type; i++){
					if(values[i] > 5 || faces[i] < 0 || faces[i] % 1 != 0){
						if(shouldLogErrors){
							console.log("Could not set faces on Cubie, invalid vaule(s) given");
						}
						return false;
					}
				}

				// set the values to face
				for(var i = 0; i <= type; i++){
					faces[i] = values[i];
				}
				
				validate();
				return true;

			}

			this.isValid = function(){
				return valid;
			}

			this.getCode = function(){
				// Returns the cubieCode which includes the orientation of the piece
				if(!valid){
					return 255;
				}
				return cubieCode;
			}

			this.setCode = function(code=0){
				// Decodes the code
				if(code < 24 && code >= 0 && code % 1 === 0){
					if(type === CubieType.Center){
						faces = [code % 6];
						code %= 6;
					}else{
						var face1 = Math.floor(code / 4);
						var face2Index = code % 4;
						var possibleFaces = getPossiblePartnerValues(face1);
						var face2 = possibleFaces[face2Index];
						if(type === CubieType.Edge){
							faces = [face1, face2];
						} else {
							var face3 = getLastFace(face1, face2);
							faces = [face1, face2, face3];
						}
						
					}
				}
				// Validate will set cubieCode to code if everything came out alright
				validate();
					return (code == cubieCode);
				
			}

			this.getType = function(){
				return type;
			}

			this.getPieceCode = function(){
				// Returns the cubieCode without orientation data
				// We do this by locating the LDB face (when solved) and returning the cubie code from that
				var minFace = 0;

				if(!valid){
					return 255;
				}

				if(type == CubieType.Center){
					return cubieCode;
				}

				if(type == CubieType.Edge){

					var pFaces = [faces[0], faces [1]];
					// p indcates pusdo face, we pass it to get get the code.

					if(faces[0] > faces [1]){
						pFaces = [faces[1], faces [0]];
					}

					var partnerFaceIndex = -1;
					var possibleFaces = getPossiblePartnerValues(pFaces[0]);
					for(var i = 0; i < possibleFaces.length; i++){
						if(possibleFaces[i] === pFaces[1]){
							partnerFaceIndex = i;
							break;
						}
					}
					return pFaces[0] * 4 + partnerFaceIndex;
				}

				if(type == CubieType.Corner){

					var pFaces = faces.slice(0);
					// p indcates pusdo face, we pass it to get get the code.

					if(faces[1] < faces[0] && faces[1] < faces[2]){
						pFaces = [faces[1], faces[2], faces[0]];
					}

					if(faces[2] < faces[0] && faces[2] < faces[1]){
						pFaces = [faces[2], faces[0], faces[1]];
					}


					var partnerFaceIndex = -1;
					var possibleFaces = getPossiblePartnerValues(pFaces[0]);
					for(var i = 0; i < possibleFaces.length; i++){
						if(possibleFaces[i] === pFaces[1]){
							partnerFaceIndex = i;
							break;
						}
					}
					return pFaces[0] * 4 + partnerFaceIndex;
				}
			}

            this.rotate = function(times=1){
                // Rotates the cubie Clockwise
                if (times < 0){
                    console.log("Please only rotate in the positve direction");
                    return false;
                }
                switch(type){
                    case CubieType.Edge:{
                        if(times % 2 == 1)
                            faces = [faces[1], faces[0]];
                        validate();
                        return true;
                    }
                    case CubieType.Corner:{
                        if(times % 3 == 1){
                            faces = [faces[2], faces[0], faces[1]];
                        }else if(times % 3 == 2){
                            faces = [faces[1], faces[2], faces[0]];
                        }
                        validate();
                        return true;
                    }
                    default:{
                        return true;
                        break;
                    }
                }
            };

			function validate(){
				// Checks if the cubie is a valid piece of the cube and sets the Cubie Code
				// Called when ever there is a change in some of the data on the Cubie
				// About CubieCodes:
				// For centers, this is just their face code
				// For edges, this is the 'home' (LBD) face * 4 + a value from 0 to 3 representing possible other faces from other sides
				// once you have the home face, there are only 4 other valid face codes for the other face to be as you can't have 2 sides of
				// an edge be the same face code and you can't have an edge with the face code from the oposite side. Faces will follow LDB order
				// For corners, this is the 'home' (LBD) face * 4 + a value from 0 to 3 reperesenting possible other face codes for the next
				// Clockwise adjecent face to the home. The third face can only have 1 valid possiblity after we know those 2 values
				// Note if we add a rotation to the center, we get 24 possible values for all types of pieces. (Currently filtered out for now)
				if(type == CubieType.Center){
					// Centers are always valid as long as faces stay with in the needed range
					valid = true;
					cubieCode = faces[0];
				}
				else if(type == CubieType.Edge){
					// See if the two faces can go together
					var partnerFaceIndex = -1;
					var possibleFaces = getPossiblePartnerValues(faces[0]);
					for(var i = 0; i < possibleFaces.length; i++){
						if(possibleFaces[i] === faces[1]){
							partnerFaceIndex = i;
							break;
						}
					}

					if(partnerFaceIndex === -1){
						valid = false;
						cubieCode = 255;
					}else{
						valid = true;
						cubieCode = faces[0] * 4 + partnerFaceIndex;
					}
						
				}
				else if(type == CubieType.Corner){
					// See if the first two faces can go together
					var partnerFaceIndex = -1;
					var possibleFaces = getPossiblePartnerValues(faces[0]);
					for(var i = 0; i < possibleFaces.length; i++){
						if(possibleFaces[i] === faces[1]){
							partnerFaceIndex = i;
							break;
						}
					}

					// Check if the last face is a the expected face, if not, this is not a valid cubie
					if(partnerFaceIndex != -1 && faces[2] === getLastFace(faces[0], faces[1])){
						valid = true;
						cubieCode = faces[0] * 4 + partnerFaceIndex;
					}else{
						valid = false;
						cubieCode = 255;
					}
				}
			}
			
			function getPossiblePartnerValues(value=0){
				// Returns possible adjacent sides given a face id
				switch(value){
					case(CubeFace.Right):
					// Fall through
					case(CubeFace.Left):{
						return [CubeFace.Down, CubeFace.Back, CubeFace.Front, CubeFace.Up];
						break;
					}
					case(CubeFace.Up):
					// Fall through
					case(CubeFace.Down):{
						return [CubeFace.Left, CubeFace.Back, CubeFace.Front, CubeFace.Right];
						break;
					}
					case(CubeFace.Front):
					// Fall through
					case(CubeFace.Back):{
						return [CubeFace.Left, CubeFace.Down, CubeFace.Up, CubeFace.Right];
						break;
					}
					default:{
						return [-1, -1, -1, -1];
						break;
					}
				}
			}

			function getLastFace(value1=0, value2=0){
				// Given two face values, it will give the 3rd face's value for a corner
				// We first create a list of valid combinations of of faces, then we see if value 1 and value 2
				// Match up in any of them and return the 3rd value. Order matters, these arrays "wrap"
				const VALID_COMBOS = [
					[CubeFace.Left, CubeFace.Down, CubeFace.Back],
					[CubeFace.Left, CubeFace.Front, CubeFace.Down],
					[CubeFace.Left, CubeFace.Back, CubeFace.Up],
					[CubeFace.Left, CubeFace.Up, CubeFace.Front],
					[CubeFace.Down, CubeFace.Right, CubeFace.Back],
					[CubeFace.Down, CubeFace.Front, CubeFace.Right],
					[CubeFace.Back, CubeFace.Right, CubeFace.Up],
					[CubeFace.Front, CubeFace.Up, CubeFace.Right]];
				
				for(var i = 0; i < 8; i++){
					for(var j = 0; j < 3; j++){
						if(VALID_COMBOS[i][j] == value1 && VALID_COMBOS[i][(j + 1) % 3] == value2){
							return VALID_COMBOS[i][(j + 2) % 3];
						}
					}
				}

				return -1;
			}

			var valid = false;
			
			// Verify type is with in range, if not, default to 0
			if (type < 0 || type > 2 || type % 1 != 0){
				type = 0;
			}

			// If we recieved a valid cubieCode, decode it
			if(cubieCode < 24 && cubieCode >= 0 && cubieCode % 1 === 0){
				this.setCode(cubieCode);
			}

			// Create a copy of the array to avoid accidental changes to it
			if(faces.length > 0){
				faces = faces.slice(0);
			} else {
				faces = [0];
			}
			

			// Verify we have enough faces, if not add them
			while(faces.length - 1 < type){
				faces.push(0);
			}
			// Verify all faces are with in the valid range
			for(var i = 0; i <= type; i++){
				if(faces[i] > 5 || faces[i] < 0 || faces[i] % 1 != 0){
					faces[i] = 0;
				}
			}
			
			validate();

		}

		/*
		class AlgorithmStorage  This class will store several Algorithms of the same size and length in a compact format
		------------------
		- data:BinaryData
		- algLength:int
		- algCount:int
		- cubeSize:int
		- maxAlgs:int
		------------------
		AlgorithmStorage(cubeSize:int, algLength:int, maxAlgs:int):AlgorithmStorage
		getMoves(algId:int):array			This will return the moves as [direction * layerCount + layer,   ]
		getMovesInPairs(algId:int):array[int]    This will return the moves as [layer, direction, layer, direction]
		getAlgCount():int
		getFilter(algId:int, cubeStorageFormat:int):Filter
		selfIndex():Promise
		addAlgorithm(alg:[int]):bool
		*/

		/**
		 * @param {number} cubeSize
		 */

		function AlgorithmStorage(cubeSize, algLength=1, maxAlgs=1000000){

			this.getMoves = function(algId=0){
				// returns moves for a certain alg in number format
				var alg = [];
				if(usesAlgSaver){
					if(algId >= algCount * 3 || algId < 0){
						throw "Invalid algorithm requested"
					}
					var indexInData = algId % algCount;
					var direction = Math.floor(algId / algCount);
					alg = data.getArray(indexInData * algLength, (indexInData + 1) * algLength - 1);
					alg[algLength - 1] += direction * layerCount;
				}else{
					if(algId >= algCount || algId < 0){
						throw "Invalid algorithm requested"
					}
					alg = data.getArray(algId * algLength, (algId + 1) * algLength - 1);
				}

				return alg;
			}

            this.getMovesInPairs = function(algId=0){
				// retunrs moves for a certain alg in pair format
				var alg = this.getMoves(algId);
				var result = [];
				const len = alg.length;
				for(var i = 0; i < len; i++){
					result.push(alg[i] % layerCount, Math.floor(alg[i] / layerCount))
				}

				return result;
			}

			this.getMovesAsText = function(algId=0){
				var moves = this.getMoves(algId);
				var key = [];
				var base = ['L', 'R', 'D', 'U', 'B', 'F', '', "'", '2', ", "];
				var result = "";
				var layerCount = AlgorithmStorage.getLayerCount(cubeSize);
				var isEven = (cubeSize % 2 == 0);
				var layersPerFace = layerCount / 6;

				// First we will create a map with the text for each move:

				for (var i = 0; i < layerCount * 3; i++) {
					
					var face = Math.floor(i % layerCount / layersPerFace);

					var number = i % layerCount % layersPerFace + 1;

					var direction = Math.floor(i / layerCount);
					// Since in HTM it is clock wise from the point of view of the face
					// and in our terms it is from the LDB side, we need to 
					// view a side as in reverse at times
					var shouldReverse = false;

					if (face == CubeFace.Down || face == CubeFace.Front || face == CubeFace.Right)
						shouldReverse = true;

					if (shouldReverse)
						number = layersPerFace - i % layerCount % layersPerFace;

					var total = "";

					// In cases where we have more than one layer on each side
					if (number > 1) {
						total += number;
					}

					total += base[face];

					if ((shouldReverse && direction == 0) || (!shouldReverse && direction == 2)) {
						// Add the inverse character
						total += base[7];
					} else if (direction == 1) {
						// add the 180 character (in this case a 2)
						total += base[8];

					} else {
						// Add the clockwise character, in this case nothing
						total += base[6];
					}

					key.push(total);


				}

				for (var i = 0; i < algLength; i++) {
					// Use the map key created to build the move text.
					var move = 0;
					move = moves[i];
					result += key[move];

					if (!(i + 1 >= algLength)) {
						// Add the separator, in this case ", "
						result += base[9]
					}

				}
				return result;
			}

			this.getAlgCount = function(){
				if(usesAlgSaver)
					return algCount * 3;
				return algCount;
			}

			this.getAlgLength = function(){
				return algLength;
			}

			this.getFilter = function(algId=0, cubeStorageFormat=CubeDataType.Surface){
				if((algId > algCount * 3 && usesAlgSaver) || (algId > algCount && !usesAlgSaver)){
					if(shouldLogErrors){
							console.info("Could not get correct filter, invalid algId");
					}
					return new Filter(cubeSize, cubeStorageFormat);
				}
				return new Filter(cubeSize, cubeStorageFormat, this, algId);
			}

			this.addAlgorithm = function(alg=[0]){
				// Adds an algorithm to the set

				// Check if we still accept new algs
				if(!acceptsNewAlgs){
					console.info("This storage no longer accepts algorithms because it was indexed");
					return false;
				}
				// Check if we recieved moves in single or pair form
				if(alg.length == algLength * 2){
					// we recieved it in pair form so convert it to singular
					var newAlg = [];
					for(var i = 0; i < algLength; i++){
						newAlg.push(alg[i * 2] + (alg[i * 2 + 1] * layerCount));
					}

					alg = newAlg;

				}else if(alg.length != algLength){
					// If the alg given is not either double the alg length or the alg length, then it is an invalid value
					console.info("Invalid algorithm given");
					return false;
				}

				// If we are over the max, we need to create a new data storage
				if(algCount < maxAlgs){
					algCount++;
					return data.setArray(algLength * (algCount - 1), alg);
				}else{
					// Increase maxAlgs by 10%
					var newData = new BinaryData(maxAcceptedValue, data.getArray(), Math.ceil(maxAlgs * 1.1));
					data = newData;
					maxAlgs = Math.ceil(maxAlgs * 1.1);
					algCount++;
					return data.setArray(algLength * (algCount - 1), alg);
				}

			}

			this.asyncSelfIndex = async function(){
				// Exactly the same as Self index, except this will take advantage of a web worker
				// TODO make this async (⓿_⓿)
				// Verify we can still index on this storage, only new empty storages are accepted
				if(algCount != 0){
					console.info("You cannot index on pre filed algorithm storage");
					return false;
				}
				// We can use the algSaver now
				usesAlgSaver = true;

				if(true){
					var moves = [0];
					var startingAlgorithm = [];
					
					function isSame(a=[], b=[]){
						// sees if two algorithms are the same
						if (a.length == b.length){
							const len = a.length;
							for(var i=0; i < len; i++){
								if(a[i] != b[i]){
									return false;
								}
							}
							return true;
						}
					}

					function findNextSequence(){
						// Finds the next valid sequence returns true if we found the next one, false if there are no more
						var backIndex = 0;
						// Get the previous moves - the one we are on
						var previousMoves = moves.slice(0, moves.length - 1);
						// Get the current end move value, and increment it by 1
						var proposedMove = moves[moves.length - 1] + 1;


						function goBack(){
							backIndex ++;
							// Have we reached the max we can go back? if so return false
							if(backIndex > moves.length - 1){
								backIndex--;
								return false;
							}
							var previousMoves = moves.slice(0, moves.length - (1 + backIndex));
							var proposedMove = moves[moves.length - (1 + backIndex)] + 1;

							while(true){
								// Did we over flow our with our move, if so , set our current move to 0,
								// and go back
								// Note that previous moves do incorporate direction into the algorithm
								if(proposedMove >= layerCount * 3){
									proposedMove = 0;
									moves[moves.length - (1 + backIndex)] = 0;
									// Go back if we can, if we cannot, then we are done
									var canGoOn = goBack();
	
									if(!canGoOn){
										return false;
									}else{
										// update previous moves now.
										previousMoves = moves.slice(0, moves.length - 1);
									}
								}
								// Do we have a valid move?
								if(AlgorithmStorage.checkNextMove(cubeSize, previousMoves, proposedMove)){
									moves[moves.length - (1 + backIndex)] = proposedMove;
									backIndex--;
									return true;
									break;
								}else{
									// Keep on looking
									proposedMove ++;
								}
							}
						}

						while(true){
							// Did we over flow our with our move, if so , set our current move to 0,
							// and go back
							if(proposedMove >= layerCount){
								proposedMove = 0;
								moves[moves.length - 1] = 0;
								// Go back if we can, if we cannot, then we are done
								var canGoOn = goBack();

								if(!canGoOn){
									return false;
									break;
								}else{
									previousMoves = moves.slice(0, moves.length - 1);
									// update previous moves now
								}
							}
							// Do we have a valid move?
							if(AlgorithmStorage.checkNextMove(cubeSize, previousMoves, proposedMove)){
								moves[moves.length - 1] = proposedMove;
								return true;
								break;
							}else{
								// Increment the move
								proposedMove++;
							}
						}
					}
					// Generate the first valid sequence of moves
					while(moves.length < algLength){
						// find the first valid move
						for(var i = 0; i < layerCount; i++){
							if(AlgorithmStorage.checkNextMove(cubeSize, moves, i)){
								moves.push(i);
								break;
							}

						}
					}

					startingAlgorithm = moves.slice(0); // Save this for comparing later

					while (true){
						// Save Current Sequence
						this.addAlgorithm(moves);

						var isThereNextSequence = findNextSequence();
						if(!isThereNextSequence){
							// we are done
							return true;
							break;
						}

					}
					

				}

			}

			this.selfIndex = function(){
				// This will fill the Storage with algorithms that "try" to avoid repeating resulting cubes, there are no repeating cubes with in 3 moves cube.
				// Verify we can still index on this storage, only new empty storages are accepted
				if(algCount != 0){
					console.info("You cannot index on pre filed algorithm storage");
					return false;
				}
				// We can use the algSaver now
				usesAlgSaver = true;

				var moves = [0];

				function findNextSequence(){
					// Finds the next valid sequence returns true if we found the next one, false if there are no more
					var backIndex = 0;
					// Get the previous moves - the one we are on
					var previousMoves = moves.slice(0, moves.length - 1);
					// Get the current end move value, and increment it by 1
					var proposedMove = moves[moves.length - 1] + 1;


					function goBack(){
						backIndex ++;
						// Have we reached the max we can go back? if so return false
						if(backIndex > moves.length - 1){
							backIndex--;
							return false;
						}
						var previousMoves = moves.slice(0, moves.length - (1 + backIndex));
						var proposedMove = moves[moves.length - (1 + backIndex)] + 1;

						while(true){
							// Did we overflow our with our move, if so , set our current move to 0,
							// and go back
							// Note that previous moves do incorporate direction into the algorithm
							if(proposedMove >= layerCount * 3){
								proposedMove = 0;
								moves[moves.length - (1 + backIndex)] = 0;
								// Go back if we can, if we cannot, then we are done
								var canGoOn = goBack();

								if(!canGoOn){
									return false;
								}else{
									// update previous moves now.
									previousMoves = moves.slice(0, moves.length - (1 + backIndex));
								}
							}
							// Do we have a valid move?
							if(AlgorithmStorage.checkNextMove(cubeSize, previousMoves, proposedMove)){
								moves[moves.length - (1 + backIndex)] = proposedMove;
								backIndex--;
								return true;
								break;
							}else{
								// Keep on looking
								proposedMove ++;
							}
						}
					}

					while(true){
						// Did we over flow our with our move, if so , set our current move to 0,
						// and go back
						if(proposedMove >= layerCount){
							proposedMove = 0;
							moves[moves.length - 1] = 0;
							// Go back if we can, if we cannot, then we are done
							var canGoOn = goBack();

							if(!canGoOn){
								return false;
								break;
							}else{
								previousMoves = moves.slice(0, moves.length - 1);
								// update previous moves now
							}
						}
						// Do we have a valid move?
						if(AlgorithmStorage.checkNextMove(cubeSize, previousMoves, proposedMove)){
							moves[moves.length - 1] = proposedMove;
							return true;
							break;
						}else{
							// Increment the move
							proposedMove++;
						}
					}
				}
				// Generate the first valid sequence of moves
				while(moves.length < algLength){
					// find the first valid move
					// at this level we ignore the final move's direction as all would be valid
					for(var i = 0; i < layerCount; i++){
						if(AlgorithmStorage.checkNextMove(cubeSize, moves, i)){
							moves.push(i);
							break;
						}

					}
				}

				while (true){
					// Save Current Sequence
					this.addAlgorithm(moves);
					

					var isThereNextSequence = findNextSequence();
					if(!isThereNextSequence){
						// we are done
						acceptsNewAlgs = false;
						return true;
						break;
					}

				}

			}

			var algCount = 0;
			const layerCount = AlgorithmStorage.getLayerCount(cubeSize);
			var maxAcceptedValue = layerCount * 3;
			var data = new BinaryData(maxAcceptedValue, [], maxAlgs * algLength);
			// Alg saver saves memory with selfIndexed storage by removing the final move's direction, reducing the the total memory
			// consumption to 1/3 of if we saved all the algs. The final move's direction is then retrieved by looking at the algId
			// the alg can be accessed by first getting the 'base' (the alg - the final move direction) with algId % compressedAlgCount
			// and the final direction can be accessed direction = Math.floor(algId / compressedAlgCount)
			// This does not apply algorithms added one by one as, this just does not work as nicely
			var usesAlgSaver = false;
			var acceptsNewAlgs = true;
		}

		/**
		 * @param {number} cubeSize 
		 */
		AlgorithmStorage.getLayerCount = function(cubeSize){
			// Returns the number of MOVEABLE layers on the cube. For odd numbered cubes, this means
			// You can only turn the size - 1 layers as you can't turn the middle layer in this format
			return cubeSize % 2 == 0 ? cubeSize * 3 : (cubeSize - 1) * 3;
		}

		/**
		 * @param {number} cubeSize
		 * @param {number[]} previousMoves
		 * @param {number} proposedNextMove
		 */
		AlgorithmStorage.checkNextMove = function(cubeSize, previousMoves, proposedNextMove){
			// Checks the move sequence to see if the proposed next move does not violoate any rules.
			// Previous moves is saved as [moveId, moveId, movdId] not as [layer, direction, layer, direction]
			const layerCount = AlgorithmStorage.getLayerCount(cubeSize);
			// We do not care about move directions here, just the layer
			const proposedMoveLayer = proposedNextMove % layerCount;
			// Calculate the Plane the move operates on should result in 0(z, y), 1(x, z), or 2(x, y)
			const plane = Math.floor(proposedMoveLayer / (layerCount / 3));

			const moveLength = previousMoves.length;

			var isValid = true;

			// Check if the proposedMove is in a valid range
			if(proposedMoveLayer < 0){
				return false;
			}

			for(var i = moveLength - 1; i >= 0; i++){
				var pMoveLayer = previousMoves[i] % layerCount;
				var pMovePlane = Math.floor(pMoveLayer / (layerCount / 3));
				// Rule 1, the move cannot be done on the same layer as the previous one (EX, you cant do R2 just to do R' next, that cube will exist in a different branch)
				if(pMoveLayer == proposedMoveLayer){
					isValid = false;
					break;
				}else if(pMovePlane === plane){
					// If layers are parallel, we need to do more checking, if not, the move is valid
					// Rule 2, if two moves are parallel, we cannot go from high to low layer moves, only low to high
					// so if this move is less than the last parallel move, then we can stop it right here
					// EX: RL is the same as LR so we only keep 1 of the 2
					if(proposedMoveLayer < pMoveLayer){
						isValid = false;
						break;
					}
					// If both of these tests passed, we continue on to the next previous move to see if this move is valid with that
					// as we need to find the first no parallel move that the move intersects to consider it unique
					continue;
				}else{
					break;
				}
			}

			return isValid;
		}

		if(webWorkersAvailable){
			AlgorithmStorage.hardWorker = new Worker("cubeSolverV3.2Worker.js");
			AlgorithmStorage.hardWorker.postMessage("test");
			AlgorithmStorage.hardWorker.onmessage = function(e){
				console.log("Main: " + e.data)
			}
		}

		/*
		class Filter
		---------------
		- filterData:[int]
		- storageFormat:int
		- cubeSize:int
		- algId:int
		- algStorage: AlgorithmStorage
		* filterCahce:[[Filter]] Filters of the same cube size and storage format are grouped together. All are depth 1 (single moves) to construct other Filters
		----------------
		Filter(cubeSize:int, storageFormat:int, algStorage:AlgorithmStorage, algId:int):Filter
		getFilterData():[int]
		getCubeSize():int
		getMoves():[int]
		getAlgId():int
		getStorageFormat():int
		applyFilter(cubeData:CubeData, startCube:int, endCube:int):bool
		*/

		/**
		 * @param {number} cubeSize 
		 */
		function Filter(cubeSize, storageFormat=CubeDataType.Surface, algStorage=new AlgorithmStorage(cubeSize, 1, 1), algId=0, fromScratch=false){

			var filterData = Filter.createNewFilterData(cubeSize, storageFormat);

			this.getFilterData = function(){
				return filterData.slice(0);
			};

			this.getCubeSize = function(){
				return cubeSize;
			};

			this.getMoves = function(){
				return algStorage.getMoves(algId);
			};

			this.getMovesInPairs = function(){
				return algStorage.getMovesInPairs(algId);
			};

			this.getAlgId = function(){
				return algId;
			};

			this.getStorageFormat = function(){
				return storageFormat;
			};

			this.applyFilter = function(cubeData=new CubeData(), startCube=0, endCube=startCube){
				// Applies a filter to the specified cube data
				// Check for mis matched formating, if so, create a new filter object with the appropirate
				// type and print a warning to the console.
				if(cubeData.getStorageFormat() != storageFormat){
					if(shouldLogErrors){
						console.info("Warning: Mismatched cube data format and filter format, created a new filter with the correct format.\n\
						Please revise the code to avoid this slowdown. Cube format: " + cubeData.getStorageFormat() + " Filter format: " + storageFormat)
					}
					
					var newFilter = new Filter(cubeSize, cubeData.getStorageFormat(), algStorage, algId);
					return newFilter.applyFilter(cubeData, startCube, endCube);
				}

				switch(storageFormat){
					case CubeDataType.Surface:{
                        // This format is strait forward, use the index in filterData[i] to set the destination sticker[i] with the originalData[filterData[i]]
						var originalData = cubeData.getCubeData(startCube, endCube);
                        const FaceSize = (cubeSize ** 2)
                        var dataCount = FaceSize * 6;
                       
                        for(var i = 0; i < dataCount;i++){
                            var face = Math.floor(i / FaceSize);
                            var y =  Math.floor((i % FaceSize) / cubeSize);
                            var x = (i % FaceSize) % cubeSize;
                            for(var cCube = startCube; cCube <= endCube; cCube++){
                                cubeData.setSticker(face, x, y, originalData.getData((cCube - startCube) * dataCount + filterData[i]), cCube);
                            }
                        }
						return true;
						break;
					}
                    case CubeDataType.Piece:{
                        // This format takes a bit more thinking but works out in the end.
                        // Similar to the last format, we will go though each index, but we will also check for cubie rotations
                        // when needed. Cubie rotations are coded into the filter by adding rotations * cubieCount + sourceIndex
                        const CubieCount = (cubeSize ** 3) - (cubeSize - 2) ** 3;
                        var originalData = cubeData.getCubeData(startCube, endCube);
						originalData.setDataFlag(storageFormat);
                        var originalCubeData = new CubeData(cubeSize, (startCube - endCube) + 1, storageFormat, originalData)
						//console.log(this.getMoves(), filterData);
                        for(var i = 0; i < CubieCount;i++){
                            var sourceIndex = filterData[i] % CubieCount;
                            var rotation = Math.floor(filterData[i] / CubieCount);
                            var sourcePos = CubeData.getCubieCoordinates(sourceIndex, cubeSize);
                            var destinationPos = CubeData.getCubieCoordinates(i, cubeSize);
                            for(var cCube = startCube; cCube <= endCube; cCube++){
                                var sourceCubie = originalCubeData.getCubie(sourcePos.x, sourcePos.y, sourcePos.z, cCube - startCube);
								//console.log("Destination: ", destinationPos, "Source: ", sourcePos, "Rotation: ", rotation)
                                sourceCubie.rotate(rotation);
                                cubeData.setCubie(destinationPos.x, destinationPos.y, destinationPos.z, sourceCubie, cCube);
								
                            }
                        }
                        return true;
                        break;
                    }
					default:{
						if(shouldLogErrors){
							console.info("Invalid filter type, no changes were made.");
						}
						return false;
						break;
					}
				}
			};

			// Build the filter from other filters, if from scratch is true, then we must build our own filters
			// The fromScratch is used by the buildBaseFilters function as we do not have any filters to build from
			// so we must build from scratch.
			if(fromScratch){
				var layerCount = AlgorithmStorage.getLayerCount(cubeSize);
				const isOdd = cubeSize % 2 === 1;
				var sourceData = Filter.createNewFilterData(cubeSize, storageFormat);
				var destinationData = Filter.createNewFilterData(cubeSize, storageFormat);

				function copyDestinationToSource(){
					sourceData = destinationData.slice(0);
				}
				
				switch(storageFormat){
					case(CubeDataType.Surface):{
						const FaceSize = cubeSize ** 2;
						const Layer = algId % layerCount;
						const Direction = Math.floor(algId / layerCount);
						const Plane = isOdd ? Math.floor(Layer / (cubeSize - 1)) :  Math.floor(Layer / cubeSize);
						var slice = isOdd ? Layer % (cubeSize - 1) : Layer % cubeSize;

						if(isOdd && slice + 1 > cubeSize / 2){
							slice += 1;
						}
						
						for(var l = 0; l <= Direction; l++){
							switch(Plane){
								case 0:{
									// z, y plane
									for(var i = 0; i < cubeSize; i++){
										// Increment in the y+ in face space for each face, Up and Back need to be reversed to corespond to the correct sticker on the other faces
										// Up to Front
										destinationData[CubeFace.Front * FaceSize + i * cubeSize + slice] = sourceData[CubeFace.Up * FaceSize + (cubeSize - 1 - i) * cubeSize + slice];
										// Front to Down
										destinationData[CubeFace.Down * FaceSize + i * cubeSize + slice] = sourceData[CubeFace.Front * FaceSize + i * cubeSize + slice];
										// Down to Back
										destinationData[CubeFace.Back * FaceSize + (cubeSize - 1 - i) * cubeSize + slice] = sourceData[CubeFace.Down * FaceSize + i * cubeSize + slice];
										// Back to Up
										destinationData[CubeFace.Up * FaceSize + (cubeSize - 1 - i) * cubeSize + slice] = sourceData[CubeFace.Back * FaceSize + (cubeSize - 1 - i) * cubeSize + slice];
										
										if(slice == 0){
											// We also need to rotate the Left side
											for(var j = 0; j < cubeSize; j++){
												// ith column to cubeSize - 1 - ith row
												destinationData[CubeFace.Left * FaceSize + (cubeSize - 1 - i) * cubeSize + j] = sourceData[CubeFace.Left * FaceSize + j * cubeSize + i];
											}
										}

										if(slice == cubeSize - 1){
											// We also need to rotate the Right side
											for(var j = 0; j < cubeSize; j++){
												// ith column to cubeSize - 1 - ith row
												destinationData[CubeFace.Right * FaceSize + (cubeSize - 1 - i) * cubeSize + j] = sourceData[CubeFace.Right * FaceSize + j * cubeSize + i];
											}
										}
									}

									break;
								}

								case 1:{
									// x, z plane
									for(var i = 0; i < cubeSize; i++){
										// Increment in the x+ in face space for each face, Back and Right need to be reversed to corespond to the correct sticker on the other faces
										// Left to Front
										destinationData[CubeFace.Front * FaceSize + slice * cubeSize + i] = sourceData[CubeFace.Left * FaceSize + slice * cubeSize + i];
										// Front to Right
										destinationData[CubeFace.Right * FaceSize + slice * cubeSize + (cubeSize - 1 - i)] = sourceData[CubeFace.Front * FaceSize + slice * cubeSize + i];
										// Right to Back
										destinationData[CubeFace.Back * FaceSize + slice * cubeSize + (cubeSize - 1 - i)] = sourceData[CubeFace.Right * FaceSize + slice * cubeSize + (cubeSize - 1 - i)];
										// Back to Left
										destinationData[CubeFace.Left * FaceSize + slice * cubeSize + i] = sourceData[CubeFace.Back * FaceSize + slice * cubeSize + (cubeSize - 1 - i)];
										
										if(slice == 0){
											// We also need to rotate the Down side
											for(var j = 0; j < cubeSize; j++){
												// ith column to cubeSize - 1 - ith row
												destinationData[CubeFace.Down * FaceSize + (cubeSize - 1 - i) * cubeSize + j] = sourceData[CubeFace.Down * FaceSize + j * cubeSize + i];
											}
										}

										if(slice == cubeSize - 1){
											// We also need to rotate the Up side
											for(var j = 0; j < cubeSize; j++){
												// ith column to cubeSize - 1 - ith row
												destinationData[CubeFace.Up * FaceSize + (cubeSize - 1 - i) * cubeSize + j] = sourceData[CubeFace.Up * FaceSize + j * cubeSize + i];
											}
										}
									}
									
									break;
								}

								case 2:{
									// x, y plane
									for(var i = 0; i < cubeSize; i++){
										// Increment in y- for Left, x- for Up, y+ for Right, x+ for Down
										// Up to Left
										destinationData[CubeFace.Left * FaceSize + (cubeSize - 1 - i) * cubeSize + slice] = sourceData[CubeFace.Up * FaceSize + slice * cubeSize + (cubeSize - 1 -i)];
										// Left to Down
										destinationData[CubeFace.Down * FaceSize + slice * cubeSize + i] = sourceData[CubeFace.Left * FaceSize + (cubeSize - 1 - i) * cubeSize + slice];
										// Down to Right
										destinationData[CubeFace.Right * FaceSize + i * cubeSize + slice] = sourceData[CubeFace.Down * FaceSize + slice * cubeSize + i];
										// Right to Up
										destinationData[CubeFace.Up * FaceSize + slice * cubeSize + (cubeSize - 1 -i)] = sourceData[CubeFace.Right * FaceSize + i * cubeSize + slice];
										
										if(slice == 0){
											// We also need to rotate the Back side
											for(var j = 0; j < cubeSize; j++){
												
												destinationData[CubeFace.Back * FaceSize + j * cubeSize + i] = sourceData[CubeFace.Back * FaceSize + (cubeSize - 1 - i) * cubeSize + j];
											}
										}

										if(slice == cubeSize - 1){
											// We also need to rotate the Front side
											for(var j = 0; j < cubeSize; j++){
												// cubeSize - 1 - ith column to ith row
												destinationData[CubeFace.Front * FaceSize + j * cubeSize + i] = sourceData[CubeFace.Front * FaceSize + (cubeSize - 1 - i) * cubeSize + j];
											}
										}
									}
									
									break;
								}
							}
							copyDestinationToSource();
						}

						
						break;
					}
					case(CubeDataType.Piece):{
						const totalCubieCount = cubeSize ** 3 - (cubeSize - 2) ** 3;
						const Layer = algId % layerCount;
						const Direction = Math.floor(algId / layerCount);
						const Plane = isOdd ? Math.floor(Layer / (cubeSize - 1)) :  Math.floor(Layer / cubeSize);
						var slice = isOdd ? Layer % (cubeSize - 1) : Layer % cubeSize;

						if(isOdd && slice >= (cubeSize - 1) / 2){
							slice += 1;
						}
						//console.log(Plane, slice)
						// For this mode we are going to go through each index, find out it's x, y, z Coordinate using the CubeData methods
						// See if it is affected by the move, and calculate to which index it should go.
						function sameCoords(a, b){
							return (a.x == b.x && a.y == b.y && a.z == b.z);
						}

						function findDestinationIndex(a){
							for(var i = 0; i < totalCubieCount; i++){
								if(sameCoords(a, indexTo3d[i])){
									return i;
								}
							}
							return -1;
						}

						// Calculate the 3D position of each Cubie Index
						var indexTo3d = [];
						for(var i = 0; i < totalCubieCount; i++){
							indexTo3d.push(CubeData.getCubieCoordinates(i, cubeSize));
						}
						for(var l = 0; l <= Direction; l++){
							switch(Plane){
								case(0):{
									// z, y Plane
									// We will loop through each index to find ones with an X Coordinate that matches slice
									// we will then caculate their destination Coordinates, find the destination index
									// then determine if the transfer has a change in home value. 
									for(var i = 0; i < totalCubieCount; i++){
										if(indexTo3d[i].x != slice){
											continue;
										}
										var destinationCoords = {x:slice, y:(cubeSize - 1 - indexTo3d[i].z), z:indexTo3d[i].y};
										var destinationIndex = findDestinationIndex(destinationCoords);
										var homeRotation = 0;

										// Calculate home face rotation 0: none, 1 Clockwise, 2 Counterclock wise;
										// There is no home rotation when slice = 0 as it is the LDB face, always
										
										var sourceFaces = CubeData.getTouchingFaces(indexTo3d[i].x, indexTo3d[i].y, indexTo3d[i].z, cubeSize);
										var destinationFaces = CubeData.getTouchingFaces(destinationCoords.x, destinationCoords.y, destinationCoords.z, cubeSize);

										if(slice > 0 && slice < cubeSize - 1 && destinationFaces.length > 1){
											// We are on one of the middle layers
											// If the new LDB face is facing down, or to the front, the Home value has changed
											if ((destinationFaces[0] == CubeFace.Down && sourceFaces[0] == CubeFace.Down) || destinationFaces[0] == CubeFace.Front){
												homeRotation = 1;
											}
										}else if(slice == cubeSize - 1 && destinationFaces.length > 2){
											// Only Corners are affected here on the right layer by home changes
											// If the new LDB face is facing down, or to the front, the Home value has changed
											if (destinationFaces[0] == CubeFace.Down && sourceFaces[0] == CubeFace.Down){
												homeRotation = 2;
											}else if(destinationFaces[0] == CubeFace.Front){
												homeRotation = 1;
											}
										}
										// from previous rotations
										var previousRotation = Math.floor(sourceData[i] / totalCubieCount);
										var totalRotaion = (previousRotation + homeRotation);
										if (destinationFaces.length == 2){
											totalRotaion %= 2;
										}else if (destinationFaces.length == 3){
											totalRotaion %= 3;
										}
										
										destinationData[destinationIndex] = (sourceData[i] % totalCubieCount) + totalRotaion * totalCubieCount;

									}
									break;
								}

								case(1):{
									// x, z Plane
									// We will loop through each index to find ones with a Y Coordinate that matches slice
									// we will then caculate their destination Coordinates, find the destination index
									// then determine if the transfer has a change in home value. 
									for(var i = 0; i < totalCubieCount; i++){
										if(indexTo3d[i].y != slice){
											continue;
										}
										var destinationCoords = {x:indexTo3d[i].z, y:slice, z:(cubeSize - 1 - indexTo3d[i].x)};
										var destinationIndex = findDestinationIndex(destinationCoords);
										var homeRotation = 0;

										// Calculate home face rotation 0: none, 1 Clockwise, 2 Counterclock wise;
										var sourceFaces = CubeData.getTouchingFaces(indexTo3d[i].x, indexTo3d[i].y, indexTo3d[i].z, cubeSize);
										var destinationFaces = CubeData.getTouchingFaces(destinationCoords.x, destinationCoords.y, destinationCoords.z, cubeSize);
										if(slice == 0 && destinationFaces.length > 1){
											if(sourceFaces[0] == CubeFace.Left || destinationFaces[0] == CubeFace.Left){
												// Same conditions apply for both corners and edges here
												homeRotation = 1;
											}
										}else if(slice > 0 && slice < cubeSize - 1 && destinationFaces.length > 1){
											// We are on one of the middle layers
											// If the new LDB face is facing left, or to the Back, the Home value has changed
											if ((destinationFaces[0] == CubeFace.Left && sourceFaces[0] == CubeFace.Left) || destinationFaces[0] == CubeFace.Back){
												homeRotation = 1;
											}
										}else if(slice == cubeSize - 1 && destinationFaces.length > 1){
											// If the new LDB face is facing up, or to the back, the Home value has changed for edges
											if(destinationFaces.length == 2 && (destinationFaces[0] == CubeFace.Up || destinationFaces[0] == CubeFace.Back)){
												homeRotation = 1;
											} else if(destinationFaces.length == 3 && (destinationFaces[0] == CubeFace.Back)){
												// If the new LDB face is facing the Back, the Home value has changed by 1
												homeRotation = 1;
											}else if(destinationFaces.length == 3 && (destinationFaces[0] == CubeFace.Left && sourceFaces[0] == CubeFace.Left)){
												// If the new LDB face is facing the Front with a source from the left, the Home value has changed by 2
												homeRotation = 2;
											}
										}
										// from previous rotations
										var previousRotation = Math.floor(sourceData[i] / totalCubieCount);
										var totalRotaion = (previousRotation + homeRotation) % 3;

										destinationData[destinationIndex] = (sourceData[i] % totalCubieCount) + totalRotaion * totalCubieCount;

									}
									break;
								}

								case(2):{
									// x, y Plane
									// We will loop through each index to find ones with a Z Coordinate that matches slice
									// we will then caculate their destination Coordinates, find the destination index
									// then determine if the transfer has a change in home value. 
									for(var i = 0; i < totalCubieCount; i++){
										if(indexTo3d[i].z != slice){
											continue;
										}
										var destinationCoords = {x:(cubeSize - 1 - indexTo3d[i].y), y:indexTo3d[i].x, z:slice};
										var destinationIndex = findDestinationIndex(destinationCoords);
										var homeRotation = 0;

										// Calculate home face rotation 0: none, 1 Clockwise, 2 Counterclock wise;
										var sourceFaces = CubeData.getTouchingFaces(indexTo3d[i].x, indexTo3d[i].y, indexTo3d[i].z, cubeSize);
										var destinationFaces = CubeData.getTouchingFaces(destinationCoords.x, destinationCoords.y, destinationCoords.z, cubeSize);

										if(slice == 0 && destinationFaces.length > 1){
											if(destinationFaces.length == 2 && (sourceFaces[0] == CubeFace.Down || destinationFaces[0] == CubeFace.Left)){
												// If the edge ends up with source LDB on bottom or Destination on Left, it changes
												homeRotation = 1;
											}else if(destinationFaces.length == 3 && !(destinationFaces[0] == CubeFace.Down)){
												// All corners except for the down to right piece, have this rotation
												homeRotation = 1;
											}
										}else if(slice > 0 && slice < cubeSize - 1 && destinationFaces.length > 1){
											// We are on one of the middle layers
											// If the new LDB face is facing left with a source from left, or if the destination is up, we have a homeChange
											if ((destinationFaces[0] == CubeFace.Left && sourceFaces[0] == CubeFace.Left) || destinationFaces[0] == CubeFace.Up ){
												homeRotation = 1;
											}
										}else if(slice == cubeSize - 1 && destinationFaces.length > 1){
											// If we have source down, or destination left, we have a home change in an edge
											if(destinationFaces.length == 2 && (destinationFaces[0] == CubeFace.Left || sourceFaces[0] == CubeFace.Down)){
												homeRotation = 1;
											} else if(destinationFaces.length == 3 && !(destinationFaces[0] == CubeFace.Down)){
												// If the new LDB face is facing Down, there is no change, else we have a CCW change
												homeRotation = 2;
											}
										}
										// from previous rotations
										var previousRotation = Math.floor(sourceData[i] / totalCubieCount);
										var totalRotaion = (previousRotation + homeRotation) % 3;

										destinationData[destinationIndex] = (sourceData[i] % totalCubieCount) + totalRotaion * totalCubieCount;

									}
									break;
								}
							}
							copyDestinationToSource();
						}
						break;
					}
				}
				filterData = sourceData.slice(0);
			}else{

				var filterBase = Filter.buildBaseFilters(cubeSize, storageFormat);
				var moveSequence = this.getMoves();
				var sourceData =  Filter.createNewFilterData(cubeSize, storageFormat);
				var destinationData =  Filter.createNewFilterData(cubeSize, storageFormat);
				const len = moveSequence.length;
				const TotalCubieCount = cubeSize ** 3 - (cubeSize - 2) ** 3;
				function copyDestinationToSource(){
					sourceData = destinationData.slice(0);
				}
				for(var i = 0; i < len; i++){
					var moveId = moveSequence[i];
					var currentFilter = Filter.filterCache[filterBase][moveId].getFilterData();
					const FLen = currentFilter.length;
					for(var j = 0; j < FLen; j++){
						switch(storageFormat){
							case CubeDataType.Fast:
								// Fall thorugh
							case CubeDataType.Surface:{
								destinationData[j] = sourceData[currentFilter[j]];
								break;
							}
							case CubeDataType.Piece:{
								var rotation = Math.floor(currentFilter[j] / TotalCubieCount);
								var sourceIndex = currentFilter[j] % TotalCubieCount;
								var currentRotation = Math.floor(sourceData[sourceIndex] / TotalCubieCount);
								var totalRotaion = rotation + currentRotation;
								var cubeCoords = CubeData.getCubieCoordinates(j, cubeSize);
								var faceCount = CubeData.getTouchingFaces(cubeCoords.x, cubeCoords.y, cubeCoords.z, cubeSize).length;
								totalRotaion %= faceCount;
								destinationData[j] = (sourceData[sourceIndex] % TotalCubieCount) + totalRotaion * TotalCubieCount;
								break;
							}
						}
					}
					copyDestinationToSource();
				}
				
				filterData = sourceData.slice(0);
			}
			
		}

		/**
		 * @param {number} cubeSize 
		 */
		Filter.createNewFilterData = function(cubeSize, storageFormat=CubeDataType.Surface){
			// Returns an array that a filter can use to apply rotations or moves to cubes
			// Filters use the array to tell what index to pull from the starting cube to fill in the current index or
			// more simply, cubeArray[i] = cubeArray[filterArray[i]]. Variations on this are used for the different storage formats
			var result = [];
			switch(storageFormat){
				case CubeDataType.Surface:{
					// All the indecies in these format literaly are just in order, so return an array with all
					// the indexes in order
					var totalCount = (cubeSize ** 2) * 6;
					for(var i = 0; i < totalCount; i++){
						result.push(i);
					}
					break;
				}
				case CubeDataType.Piece:{
					// All the indecies in these format literaly are just in order, so return an array with all
					// the indexes in order
					var totalCount = (cubeSize ** 3) - ((cubeSize - 2) ** 3);
					for(var i = 0; i < totalCount; i++){
						result.push(i);
					}
					break;
				}
				default:{
					if(shouldLogErrors){
						console.info("Error: Could not create filter data, unknown storage format!");
					}
				}
			}
			return result;
		}

		/**
		 * @param {number} cubeSize 
		 */
		Filter.buildBaseFilters = function(cubeSize, storageFormat=CubeDataType.Surface){
			// Builds the basic filters that are used to create larger ones. This will build all the single move filters and save them in the cache
			// Retuns the index of the filter
			//	Check if filters for this size are already made
			var foundMatchingFilter = false;
			var cacheLength = Filter.filterCache.length;
			for(var i = 0; i < cacheLength; i++){
				var cFilter = Filter.filterCache[i][0]
				if(cFilter.getCubeSize() === cubeSize && cFilter.getStorageFormat() === storageFormat){
					foundMatchingFilter = true;
					break;
				}
			}

			if(foundMatchingFilter){
				// If we found a filter set that already has our data we don't need to make a new one
				return i;
			}

			// To accomplish our goal we will perform all depth one moves and create filters for them.
			var layerCount = AlgorithmStorage.getLayerCount(cubeSize);
			var isOdd = cubeSize % 2 === 1;
			var algStorage = new AlgorithmStorage(cubeSize, 1, layerCount * 3);
			var success = algStorage.selfIndex();
			if(!success){
				console.info("Error creating base filters, algorithm storage failed to self index.");
				return -1;
			}
			var filterList = [];
			for(var i = 0; i < layerCount * 3; i++){
				filterList.push(new Filter(cubeSize, storageFormat, algStorage, i, true));
			}
			Filter.filterCache.push(filterList);
			return Filter.filterCache.length - 1;

		}

		/**
		 * @type {Filter[][]} 
		 */
		Filter.filterCache = [];

		/*
		class CubeError
		---------------
		userReadableError:string
		affectedCube:CubeData
		affectedCubie:int
		affectedFaces:[bool, bool, bool]
		errorType:string
		----------------
		CubeError(userReadableError:str, affectedCube:CubeData, affectedCubie:int, affectedFaces:[bool, bool, bool], errorType:str):CubeError
		*/

		function CubeError(userReadableError="", affectedCube=-1, affectedCubie=-1, affectedFaces=[false,false,false,false], errorType=""){
			this.userReadableError = userReadableError;
			this.affectedCube = affectedCube;
			this.affectedCubie = affectedCubie;
			this.affectedFaces = affectedFaces.slice(0);
			this.errorType = errorType;
		}

		/*
		class CubeData
		---------------
		- data : BinaryData
		- cubeCount : int  does not change after creation
		- cubeSize : int   does not change after creation
		- storageFormat : CubeDataType
		- errorLog : array[CubeError]

		----------------
		CubeData(cubeSize:int, cubeCount:int, storageFormat:CubeDataType, data:BinaryData):CubeData
		getCubeCount():int
		getCubeSize():int
		getCubeData(startCube:int, endCube:int):BinaryData
		getStorageFormat():CubeDataType
		convertStorageFormat(toFormat:CubeDataType):bool
		getErrorLog():array[CubeError]
		applyAlgorithm(algorithm:Algorithm, cube:int):bool
		getCubie(x:int, y:int, z:int):CubieData
		setCubie(x:int, y:int, z:int, cubie:CubieData):None
		getSticker(side:int, x:int, y:int):int
		setSticker(side:int, x:int, y:int, sticker:int):none
		-getCubieFromIndex(cubieIndex:int):Cubie
		
		*/
		function CubeData(cubeSize=3, cubeCount=1, storageFormat=CubeDataType.Surface, data=generateSolvedCubeBinaryData(cubeSize, cubeCount)){
			// An object that can store one or many cubes of the same dimensions
		
			this.getCubeCount = function(){
				return cubeCount;
			}

			this.getCubeSize = function(){
				return cubeSize;
			}

			this.getStorageFormat = function(){
				return storageFormat;
			}

			this.getCubeData = function(startCube=0, endCube=startCube){
				// Returns the data of the requested cubes
				var dataCountPerCube = data.getElementCount() / cubeCount;
				var startElement = startCube * dataCountPerCube;
				var endElement = (endCube + 1) * dataCountPerCube - 1;
				var dataSize = data.getMaxElementSize();
				var newData = new BinaryData(dataSize, data.getArray(startElement, endElement));
				newData.setDataFlag(storageFormat);
				return newData;
			}

			this.appendCubeData = function(newCubeCount=1, cubeBinData=generateSolvedCubeBinaryData(cubeSize, newCubeCount)){
				// Check if the cube being added is of the same format, if not, we need to convert it
				if(cubeBinData.getDataFlag() != storageFormat){
					var tmpCube = new CubeData(cubeSize, cubeCount, cubeBinData.getDataFlag(), cubeBinData);
					var success = tmpCube.convertStorageFormat(storageFormat);
					if (!success){
						console.info("Error appending cube data, could not convert given data.")
						return false;
					}
					cubeBinData = tmpCube.getCubeData();
				}

				var dataSize = data.getMaxElementSize();
				var newData = new BinaryData(dataSize, data.getArray().concat(cubeBinData.getArray()));
				data = newData;
				cubeCount += newCubeCount;
				return true;
			}

			this.setCube = function(cubeBinData=generateSolvedCubeBinaryData(cubeSize, 1), cubeNumber=0){
				if(cubeBinData.getDataFlag() != storageFormat){
					var tmpCube = new CubeData(cubeSize, 1, cubeBinData.getDataFlag(), cubeBinData);

					var success = tmpCube.convertStorageFormat(storageFormat);
					if (!success){
						console.info("Error setting cube data, could not convert given data.")
						return false;
					}
					cubeBinData = tmpCube.getCubeData();
				}
				var dataCountPerCube = data.getElementCount() / cubeCount;
				var startElement = cubeNumber * dataCountPerCube;
				return data.setArray(startElement, cubeBinData.getArray());			
			}

			this.getStickerByIndex = function(index=0, cubeNumber=0){
				switch(storageFormat){
					case CubeDataType.Fast:
						// Fall through
					case CubeDataType.Surface:{
						var dataPerCube = cubeSize ** 2 * 6;
						return data.getData(index + dataPerCube * cubeNumber);
						break;
					}
					case CubeDataType.Piece:{
						// I feel this is for the best as we already have to translate the
						// cubie to 3d coordinates just to get the right one, so we will just pass it on
						var face = Math.floor(index / (cubeSize ** 2));
						var x = index % (cubeSize ** 2) % cubeSize;
						var y = Math.floor(index % (cubeSize ** 2) / cubeSize);
						return this.getSticker(face, x, y, cubeNumber);
						break;
					}

				}
			}

			this.getSticker = function(face=0, x=0, y=0, cubeNumber=0){
				// Check if parameters are in range
				if(face < 0 || face > 5 || x >= cubeSize || y >= cubeSize || x < 0 || y < 0 || cubeNumber < 0 || cubeNumber >= cubeCount){
					return -1;
				}
				switch(storageFormat){
					case(CubeDataType.Fast):
						// fall through
					case(CubeDataType.Surface):{
						// We are going to see which face we are looking at
						// Based on the face, x, and y we can calculate the index of the sticker
						// Sticker faces always start with the left - most, bottom - most, back - most sticker as the starting corner.
						// So on the left side the LDB sticker is on the bottom left when facing you. The 'x+' of a face is now either
						// the x+ in cube space, or in case of equal x in cube space, the z+ direction (towards the front face). The 'y+' of a face is now either
						// the y+ in cube space, or in case of equal y in cube space, the z+ direction
						// We select the face in the data with cubeSize * cubeSize * face and we get the sticker at the given coordinates with 
						// y * cubeSize + x
						var index = cubeSize * cubeSize * face + y * cubeSize + x;
						var dataPerCube = cubeSize ** 2 * 6;
						return data.getData(index + dataPerCube * cubeNumber);
						break;
					}
					case(CubeDataType.Piece):{
						// We will first convert the face coordinates to 3D coordinates, use that to get the cubie
						// then we will calculate which face of the cubie we need and then return that face's value

						var c = CubeData.get3DCoordinates(face, x, y, cubeSize);
						var myCubie = this.getCubie(c.x, c.y, c.z, cubeNumber);

						var cubieFaceId = CubeData.getTouchingFaces(c.x, c.y, c.z, cubeSize);

						// The cubie's home face is the one we want so we just get it. (this is index 0 in the id array)
						
						if(cubieFaceId[0] == face){
							return myCubie.getFace(0);
						} else if(myCubie.getType() == CubieType.Edge){
							// If it was not the home face and we have an edge, then we only have one more option to choose
							return myCubie.getFace(1);
						} else {
							// By now we know we have a corner. 
							// We are going to rearange the faceId list to be clockwise and then find the one that matches the face we are looking for
							// and then get the data from that cubie

							// The corners are not clockwise when in the front left, or back right corners (y does not affect this)
							if((c.x == 0 && c.z == cubeSize - 1) || (c.x == cubeSize - 1 && c.z == 0)){
								cubieFaceId = [cubieFaceId[0], cubieFaceId[2], cubieFaceId[1]];
							}

							for(var i = 0; i < 3 ;i++){
								if(face == cubieFaceId[i]){
									return myCubie.getFace(i);
								}
							}
						}
						break;
					}
					default:{
						return -1;
					}
				}
			}

			this.setStickerByIndex = function(index=0, value=0, cubeNumber=0){
				switch(storageFormat){
					case(CubeDataType.Fast):
						// fall through
					case(CubeDataType.Surface):{
						// We are going to see which face we are looking at
						// Based on the face, x, and y we can calculate the index of the sticker
						// Sticker faces always start with the left - most, bottom - most, back - most sticker as the starting corner.
						// So on the left side the LDB sticker is on the bottom left when facing you. The 'x+' of a face is now either
						// the x+ in cube space, or in case of equal x in cube space, the z+ direction (towards the front face). The 'y+' of a face is now either
						// the y+ in cube space, or in case of equal y in cube space, the z+ direction
						// We select the face in the data with cubeSize * cubeSize * face and we get the sticker at the given coordinates with 
						// y * cubeSize + x
						if (value >= 6 || value < 0 || Math.floor(value) != value){
							if(shouldLogErrors)
								console.log("Could not set sticker, " + value.toString() + " is not an integer in range (0 - 5)")
							return false;
						}
						var dataPerCube = cubeSize ** 2 * 6;
						return data.setData(index + dataPerCube * cubeNumber, value);
						break;
					}
					default:{
						if(shouldLogErrors){
							console.log("Could not set sticker, you can only set stickers for Surface and Fast type cubes");
						}
						return false;
						break;
					}
				}
			}

			this.setSticker = function(face=0, x=0, y=0, value=0, cubeNumber=0){
				switch(storageFormat){
					case(CubeDataType.Fast):
						// fall through
					case(CubeDataType.Surface):{
						// We are going to see which face we are looking at
						// Based on the face, x, and y we can calculate the index of the sticker
						// Sticker faces always start with the left - most, bottom - most, back - most sticker as the starting corner.
						// So on the left side the LDB sticker is on the bottom left when facing you. The 'x+' of a face is now either
						// the x+ in cube space, or in case of equal x in cube space, the z+ direction (towards the front face). The 'y+' of a face is now either
						// the y+ in cube space, or in case of equal y in cube space, the z+ direction
						// We select the face in the data with cubeSize * cubeSize * face and we get the sticker at the given coordinates with 
						// y * cubeSize + x
						if (value >= 6 || value < 0 || Math.floor(value) != value){
							if(shouldLogErrors)
								console.log("Could not set sticker, " + value.toString() + " is not an integer in range (0 - 5)")
							return false;
						}
						var index = cubeSize * cubeSize * face + y * cubeSize + x;
						var dataPerCube = cubeSize ** 2 * 6;
						return data.setData(index + dataPerCube * cubeNumber, value);
						break;
					}
					default:{
						if(shouldLogErrors){
							console.log("Could not set sticker, you can only set stickers for Surface and Fast type cubes");
						}
						return false;
						break;
					}
				}
			}

			this.setCubie = function(x=0, y=0, z=0, value=new Cubie(), cubeNumber=0){
				// This will set a cubie of data, only valid pieces should be used pls
				// Cubies are soreted in LDB order with the 'home' face being the LDB surface of the cubie
				// The index is a bit trickier to get as the cube is 'hollow' so we need to take into consideration the middle layers
				
				// Verify we have valid coordinates
				if((!(x == 0 || x == cubeSize - 1) && !(y == 0 || y == cubeSize - 1) && !(z == 0 || z == cubeSize - 1)) || (x < 0 || x >= cubeSize) || (y < 0 || y >= cubeSize) || (z < 0 || z >= cubeSize)){
					// We are not touching a side of the cube so it is an invalid coordinate
					if(shouldLogErrors){
						console.log("Could set Cubie, invalid position given");
					}
					return false;
				}

				if(storageFormat == CubeDataType.Piece){
					// We are going to first, calculate the index of the cubie's destination, then get the Cubie's code and save it in that index
					// Verify Cubie is valid (required for this format)
					if(!value.isValid()){
						if(shouldLogErrors){
							console.log("Could set Cubie on this cube due to this cube's storage format, invalid cubie given");
						}
						return false;
					}

					// Calculate the index of the Cubie's destination
					var index = CubeData.getCubieIndex(x, y, z, cubeSize);;			

					// Save the data and return the true/false of setting the falue
					var dataPerCube = cubeSize ** 3 - (cubeSize - 2) ** 3;
					return data.setData(index + dataPerCube * cubeNumber, value.getCode());

				} else if (storageFormat == CubeDataType.Surface || storageFormat == CubeDataType.Fast){
					// We will calculate the indexes of each face, then set the data from the given Cubie to each face's index
					var type = 0;
					
					// Find out the type if it is an edge or corner
					if((x == 0 && y == 0) || (x == 0 && y == cubeSize - 1) || (x == cubeSize - 1 && y == 0) || (x == cubeSize - 1 && y == x)){
						if(z == 0 || z == cubeSize - 1){
							type = CubieType.Corner;
						}else{
							type = CubieType.Edge;
						}
					}

					// We can't use the cubie's data if it is of a mis-matched type
					if(value.getType() != type){
						console.log("Could not set cubie, cubie is the wrong type");
						return false;
					}

					const FaceSize = cubeSize ** 2;
					var dataPerCube = FaceSize * 6;
					var touchingFaces = CubeData.getTouchingFaces(x, y, z, cubeSize);

					var indexes = [];
					// Calculate the data index for each face given
					for(var i = 0; i < touchingFaces.length; i++){
						// Translate the 3d coords into face coords
						var coords = CubeData.getFaceCoordinates(touchingFaces[i], x, y, z);
						// Use this to calculate the data index
						indexes.push(FaceSize * touchingFaces[i] + coords.y * cubeSize + coords.x);
					}

					// Set the face data using the Cubie we generated with the code given (value)
					var faceData = value.getFaces();

					if (indexes.length == 3){
						// If we have a corner, we need to take into acount rotational direction for CW or CCW
						// They are not clockwise when in the front left, or back right corners (y does not affect this)
						if((x == 0 && z == cubeSize - 1) || (x == cubeSize - 1 && z == 0)){
							faceData = [faceData[0], faceData[2], faceData[1]];
						}
					}

					// Set the data for each index given
					for(var i = 0; i < indexes.length; i++) {
						data.setData(indexes[i] + dataPerCube * cubeNumber, faceData[i]);
					}

					return true;
				}else{
					if(shouldLogErrors){
						console.log("Error: Unsupported storage format");
					}
					return false;
				}
			}

			this.getCubie = function(x=0, y=0, z=0, cubeNumber=0){
				// This will get a cubie of data, will return a Cubie Object
				// Cubies are soreted in LDB order with the 'home' face being the LDB surface of the cubie
				// The index is a bit trickier to get as the cube is 'hollow' so we need to take into consideration the middle layers

				// Verify we have valid coordinates
				if((!(x == 0 || x == cubeSize - 1) && !(y == 0 || y == cubeSize - 1) && !(z == 0 || z == cubeSize - 1)) || (x < 0 || x >= cubeSize) || (y < 0 || y >= cubeSize) || (z < 0 || z >= cubeSize)){
					// We are not touching a side of the cube so it is an invalid coordinate
					if(shouldLogErrors){
						console.log("Could get Cubie, invalid coordinates given");
					}
					return;
				}
				if(storageFormat == CubeDataType.Piece){
					var index = CubeData.getCubieIndex(x, y, z, cubeSize);
					var type = 0;
					
					// Find out the type if it is an edge or corner
					if((x == 0 && y == 0) || (x == 0 && y == cubeSize - 1) || (x == cubeSize - 1 && y == 0) || (x == cubeSize - 1 && y == x)){
						if(z == 0 || z == cubeSize - 1){
							type = CubieType.Corner;
						}else{
							type = CubieType.Edge;
						}
					}else if((x == 0 && z == 0) || (x == 0 && z == cubeSize - 1) || (x == cubeSize - 1 && z == 0) || (x == cubeSize - 1 && z == x) || 
							 (z == 0 && y == 0) || (z == 0 && y == cubeSize - 1) || (z == cubeSize - 1 && y == 0) || (z == cubeSize - 1 && y == z)){
							type = CubieType.Edge;
					}

					var dataPerCube = cubeSize ** 3 - (cubeSize - 2) ** 3;
					return new Cubie(type, [], data.getData(index + cubeNumber * dataPerCube));
				}else if (storageFormat == CubeDataType.Surface || storageFormat == CubeDataType.Fast){
					// We will calculate the indexes of each face, then get the data for each face and then return the cubie
					// Calculate face size, cube data size, and touching faces
					const FaceSize = cubeSize ** 2;
					var dataPerCube = FaceSize * 6;
					var touchingFaces = CubeData.getTouchingFaces(x, y, z, cubeSize);

					var indexes = [];

					// Calculate the data index for each face given
					for(var i = 0; i < touchingFaces.length; i++){
						// Translate the 3d coords into face coords
						var coords = CubeData.getFaceCoordinates(touchingFaces[i], x, y, z);
						indexes.push(FaceSize * touchingFaces[i] + coords.y * cubeSize + coords.x);
					}

					// Get the data using the indexes to construct the cube;
					var faceData = [];
					indexes.forEach(d => {
						faceData.push(data.getData(d + cubeNumber * dataPerCube));
					});

					if (faceData.length == 3){
						// If we have a corner, we need to take into acount rotational direction for CW or CCW
						// They are not clockwise when in the front left, or back right corners (y does not affect this)
						if((x == 0 && z == cubeSize - 1) || (x == cubeSize - 1 && z == 0)){
							faceData = [faceData[0], faceData[2], faceData[1]];
						}
					}
					var myCubie = new Cubie(indexes.length - 1, faceData);
					return myCubie;
				}else{
					return;
				}
			}

			this.convertStorageFormat = function(toFormat=CubeDataType.Surface){
				// Converts from one storage to another. Returns true upon success

				// Clears the error log
				errorLog = [];

				// Check if we are already in that format
				if(storageFormat === toFormat){
					return true;
				}

					
				switch(storageFormat){
					case(CubeDataType.Fast):
					// Fall through
					case(CubeDataType.Surface):{
						switch(toFormat){
							case(CubeDataType.Piece):{
								// We are going to loop through all cubie indexes, use getCubieFacesFromSurfaceIndex to get the information we need from the data
								// and create a new data based on the indexes we got
								var newIndexCount = cubeSize ** 3 - (cubeSize - 2) ** 3;
								var currentIndexCount = cubeSize ** 2 * 6;
								var totalCount = newIndexCount * cubeCount;
								var newData = new BinaryData(23, [], totalCount);
								for(var i = 0; i < newIndexCount; i++){
									var indexes = CubeData.getCubieFaceStickerIndex(i, cubeSize);
									if(indexes.length > 3){
										console.log("Error");
										return false;
									}
									for(var cubeN = 0; cubeN < cubeCount; cubeN++){
										var faceData = [];
										indexes.forEach(d => {
											faceData.push(data.getData(d + cubeN * currentIndexCount));
										});
										var myCubie = new Cubie(indexes.length - 1, faceData);
										if(myCubie.isValid()){
											newData.setData(i + cubeN * newIndexCount, myCubie.getCode())
										}else{
											errorLog.push(new CubeError("This Cubie cannot exist", cubeN, i, [true, true, true, true], "FAILED_CONVERSION"));
										}
									}
								}
								if (errorLog.length == 0){
									data = newData;
                                    data.setDataFlag(toFormat);
									storageFormat = toFormat;
									return true;
								}
								break;
							}
							default:{
								errorLog.push(new CubeError("Given storage format is invalid. Format Recieved: " + toFormat, -1, -1, [false,false,false,false], "INVALID_INPUT"));
								return false;
								break;
							}
						}
						break;
					}
					case(CubeDataType.Piece):{
						switch(toFormat){
							case(CubeDataType.Fast):
							// Fall through
							case(CubeDataType.Surface):{
								// TODO
								var newIndexCount = cubeSize ** 2 * 6;
								var totalCount = newIndexCount * cubeCount;
								var newData = new BinaryData(5, [], totalCount);

								for(var i = 0; i < newIndexCount; i++){
									var face = Math.floor(i / (cubeSize ** 2));
									var y = Math.floor((i % (cubeSize ** 2)) / cubeSize);
									var x = (i % (cubeSize ** 2)) % cubeSize;
									
									for(var cubeN = 0; cubeN < cubeCount; cubeN++){
										var stickerId = this.getSticker(face, x, y, cubeN);
										var success = newData.setData(i + cubeN * newIndexCount, stickerId);
										if(!success){
											console.log(stickerId);
											errorLog.push(new CubeError("Error, could not set sticker durring converion", cubeN, -1, [false,false,false,false], "CONVERION_FAILURE"))
										}
									}
								}
								if (errorLog.length == 0){
									data = newData;
                                    data.setDataFlag(toFormat);
									storageFormat = toFormat;
									return true;
								}
								break;
							}
							default:{
								errorLog.push(new CubeError("Given storage format is invalid. Format Recieved: " + toFormat, -1, -1, [false,false,false,false], "INVALID_INPUT"));
								return false;
							}
						}
						break;
					}
					default:{
						errorLog.push(new CubeError("Cube has an unsupported storage format. Format: " + storageFormat, -1, -1, [false,false,false,false], "INVALID_DATA"));
						return false;
						break;
					}
				}

			}

			this.getErrorLog = function(){
				return errorLog.slice(0);
			}

			this.getCubeDataAsString = function(cubeNumber=0){
				// Returns the cube data in a copiable string that can be used for saving and sending cubes
				/*
					Format is as follows:
						Each section will be separated by a :
						data will start with "CBDTA" (stands for Cube Data)
						then it will give the format code, valid codes are : "S" for surface, "P" for piece, "F" for fast
							"E" is for error/invalid cube
						Then we get the dimension in base 16 of the cube, why base 16, because base 16 is cool
						Then we get the element data stream in base 24 for each element of the cube (base 24 is chosen because there are
							24 possibilites for each piece)
				*/
				var result  = "CBDTA:"

				switch(storageFormat){
					case CubeDataType.Surface:
						result += "S:";
						break;
					case CubeDataType.Fast:
						result += "F:";
						break;
					case CubeDataType.Piece:
						result += "P:";
						break;
					default:
						result += "E:";
						break;
				}

				result += cubeSize.toString(16) + ":"
				
				var dataToEncode = this.getCubeData(cubeNumber).getArray();

				dataToEncode.forEach(element => {
					result += element.toString(24);
				});

				return result;
			}


			/**@type {CubeError[]} */
			var errorLog = [];

            if(data.getDataFlag() != storageFormat){
                // If we recieve an un expected flag on the data, we need to convert it to the correct format;
                // We save the given format, change this cube's format a default one, and convert the cubies.
                var tempFormatSave = storageFormat;

				if (data.getDataFlag() == -1){
					// If the flag was set to -1, imply it was surface data
                	storageFormat = CubeDataType.Surface;
				}else{
					// Else, use the flag given on the data
					storageFormat = data.getDataFlag();
				}

                this.convertStorageFormat(tempFormatSave);

				// Check if the conversion was unsuccessfull
				if(tempFormatSave != storageFormat){
					console.info("Cube conversion failed, Data Format Recieved: " + storageFormat + " Target Format: " + tempFormatSave , errorLog)
				}
               
            }
		}

		CubeData.getFaceCoordinates = function(faceId=0, x=0, y=0, z=0){
			// Turns 3D coordinates to relative face coordinates
			switch(faceId){
				case(CubeFace.Left):
				//Fall through
				case(CubeFace.Right):{
					return {x:z, y:y};
					break;
				}
				case(CubeFace.Down):
				//Fall through
				case(CubeFace.Up):{
					return {x:x, y:z};
					break;
				}
				default:{
					return {x:x, y:y};
					break;
				}
			}
		}

		CubeData.getTouchingFaces = function(x=0, y=0, z=0, cubeSize=3){
			// returns all touching faces, in LDB order
			var touchingFaces = [];
				
			if(x == 0){
				touchingFaces.push(CubeFace.Left);
			}
			if(y == 0){
				touchingFaces.push(CubeFace.Down);
			}
			if(z == 0){
				touchingFaces.push(CubeFace.Back);
			}
			if(z == cubeSize - 1){
				touchingFaces.push(CubeFace.Front);
			}
			if(y == cubeSize - 1){
				touchingFaces.push(CubeFace.Up);
			}
			if(x == cubeSize - 1){
				touchingFaces.push(CubeFace.Right);
			}

			return touchingFaces;
		}

		CubeData.getTouchingFacesClockwise = function(x=0, y=0, z=0, cubeSize=3){
			// returns all touching faces, in clockwise order
			var touchingFaces = [];
			var isCW = true;
				
			if(x == 0){
				touchingFaces.push(CubeFace.Left);
			}
			if(y == 0){
				touchingFaces.push(CubeFace.Down);
				if(x == 0 && z == cubeSize - 1){
					isCW = false;
				}
			}
			if(z == 0){
				touchingFaces.push(CubeFace.Back);
				if(x == cubeSize - 1){
					isCW = false;
				}
			}
			if(z == cubeSize - 1){
				touchingFaces.push(CubeFace.Front);
			}
			if(y == cubeSize - 1){
				touchingFaces.push(CubeFace.Up);
				if(x == 0 && z == cubeSize - 1){
					isCW = false;
				}
			}
			if(x == cubeSize - 1){
				touchingFaces.push(CubeFace.Right);
			}

			if(isCW || touchingFaces.length < 3){
				return touchingFaces;
			}
			
			return [touchingFaces[0], touchingFaces[2], touchingFaces[1]];
		}

		CubeData.getCubieCoordinates = function (cubieIndex=0, cubeSize=3){
			// Calculates the x,y,z coordinates of a cubie with a given index
			const FaceSize = cubeSize * cubeSize;
			const MiddleLayerSize = cubeSize * 2 + (cubeSize - 2) * 2;

			var x, y, z;
			if(cubieIndex < FaceSize){
				// Left Side
				x = 0;
				y = Math.floor(cubieIndex / cubeSize);
				z = cubieIndex % cubeSize;
			}else if (cubieIndex >= FaceSize + MiddleLayerSize * (cubeSize - 2)){
				// Right Side
				const Offset = FaceSize + MiddleLayerSize * (cubeSize - 2);
				x = cubeSize -1;
				y = Math.floor((cubieIndex - Offset) / cubeSize);
				z = (cubieIndex - Offset) % cubeSize;
			}else if((cubieIndex - FaceSize) % MiddleLayerSize < cubeSize){
				// We are on the bottom middle layers
				x = Math.floor((cubieIndex - FaceSize) / MiddleLayerSize) + 1;
				y = 0;
				z = (cubieIndex - FaceSize) % MiddleLayerSize;
			}else if((cubieIndex - FaceSize) % MiddleLayerSize >= MiddleLayerSize - cubeSize){
				// We are on the top middle layers
				x = Math.floor((cubieIndex - FaceSize) / MiddleLayerSize) + 1;
				y = cubeSize - 1;
				z = (cubieIndex - FaceSize - (cubeSize - 2) * 2 - cubeSize) % MiddleLayerSize;
			}else{
				// We must be in the back or front middle faces
				x = Math.floor((cubieIndex - FaceSize) / MiddleLayerSize) + 1;
				y = Math.floor(((cubieIndex - FaceSize) % MiddleLayerSize - cubeSize) / 2) + 1;
				z = (((cubieIndex - FaceSize) - cubeSize) % 2) * (cubeSize - 1);
			}
			return {x:x, y:y, z:z};
		}

		CubeData.getCubieIndex = function(x=0, y=0, z=0, cubeSize=3){
			// converts 3D cube coordinates to a cubie index
			// Inverse of of getCubieCoordinates
			const FaceSize = cubeSize * cubeSize;
			const MiddleLayerSize = cubeSize * 2 + (cubeSize - 2) * 2;
			if(x == 0){
				// on left side
				return y * cubeSize + z;
			}else if(x == cubeSize - 1){
				// on right side
				return FaceSize + MiddleLayerSize * (cubeSize - 2) + y * cubeSize + z;
			}else if (y == 0){
				// on the bottom side in the middle
				return FaceSize + MiddleLayerSize * (x - 1) + z;
			}else if (y == cubeSize - 1){
				// on the top side in the middle
				// Cubies on\/left middle cubie layers \/ bottom \/strip     \/cubies bewteen top and bottom
				return FaceSize + MiddleLayerSize * (x - 1) + cubeSize + (cubeSize - 2) * 2 + z;
			}else if(z == 0){
				// on the back
				return FaceSize + MiddleLayerSize * (x - 1) + cubeSize + (y - 1) * 2;
			}else if(z == cubeSize - 1){
				// on the front
				return FaceSize + MiddleLayerSize * (x - 1) + cubeSize + (y - 1) * 2 + 1;
			}
			return -1;
		}

		CubeData.get3DCoordinates = function(faceId=0, x=0, y=0, cubeSize=3){
			// Inverse of getFaceCoordinates
			var cx, cy, cz; //  stands for cubie x, cubie y...
			switch(faceId){
				case(CubeFace.Left):{
					cx = 0;
					cy = y;
					cz = x;
					break;
				}
				case(CubeFace.Down):{
					cx = x;
					cy = 0;
					cz = y;
					break;
				}
				case(CubeFace.Back):{
					cx = x;
					cy = y;
					cz = 0;
					break;
				}
				case(CubeFace.Front):{
					cx = x;
					cy = y;
					cz = cubeSize - 1;
					break;
				}
				case(CubeFace.Up):{
					cx = x;
					cy = cubeSize - 1;
					cz = y;
					break;
				}
				case(CubeFace.Right):{
					cx = cubeSize - 1;
					cy = y;
					cz = x;
					break;
				}
			}
			return {x:cx, y:cy, z:cz};
		}

		CubeData.getCubieFaceStickerIndex = function(cubieIndex=0, cubeSize=3){
			// Given the cubie Index, we find out which stickers it would have from the surface storage fromat
			// To get to the base corner of any face, we will use this constant * 
			const FaceSize = cubeSize * cubeSize;
			const MiddleLayerSize = cubeSize * 2 + (cubeSize - 2) * 2;
			

			// to acomplish our goal we are first going to calculate the x, y, and z coordinates of the Cubie
			// then see which sides we are touching, then from that information combined with the coordinates
			// we can calculate the index of each face a cubie is touching, returned in a clockwise order.
			var cubieCoords = CubeData.getCubieCoordinates(cubieIndex, cubeSize);
			var x = cubieCoords.x, y = cubieCoords.y, z = cubieCoords.z;

			var touchingFaces = CubeData.getTouchingFaces(x, y, z, cubeSize);
			
			if(touchingFaces.length == 6){
				// Whole Cube, This should not happen unless we have a 1 by 1 cube, but just in case
				return [0, 1, 2, 3, 4, 5];
			}else if(touchingFaces.length == 1){
				// Center
				var face1 = CubeData.getFaceCoordinates(touchingFaces[0], x, y, z);
				return [FaceSize * touchingFaces[0] + face1.y * cubeSize + face1.x];
			}else if(touchingFaces.length == 2){
				// Edge
				var face1 = CubeData.getFaceCoordinates(touchingFaces[0], x, y, z);
				var face2 = CubeData.getFaceCoordinates(touchingFaces[1], x, y, z);
				return [FaceSize * touchingFaces[0] + face1.y * cubeSize + face1.x, FaceSize * touchingFaces[1] + face2.y * cubeSize + face2.x];
			}else if(touchingFaces.length == 3){
				// Corner
				// isClockwise tells us that if the corner faces are ordered in LDB order, are they clockwise?
				// They are not clock wise when in the front left, or back right corners (y does not affect this)
				var isClockwise = true;
				if((x == 0 && z == cubeSize - 1) || (x == cubeSize - 1 && z == 0)){
					isClockwise = false;
				}

				if(isClockwise){
					var face1 = CubeData.getFaceCoordinates(touchingFaces[0], x, y, z);
					var face2 = CubeData.getFaceCoordinates(touchingFaces[1], x, y, z);
					var face3 = CubeData.getFaceCoordinates(touchingFaces[2], x, y, z);
					return [FaceSize * touchingFaces[0] + face1.y * cubeSize + face1.x, FaceSize * touchingFaces[1] + face2.y * cubeSize + face2.x, FaceSize * touchingFaces[2] + face3.y * cubeSize + face3.x];
				}else{
					var face1 = CubeData.getFaceCoordinates(touchingFaces[0], x, y, z);
					var face2 = CubeData.getFaceCoordinates(touchingFaces[2], x, y, z);
					var face3 = CubeData.getFaceCoordinates(touchingFaces[1], x, y, z);
					return [FaceSize * touchingFaces[0] + face1.y * cubeSize + face1.x, FaceSize * touchingFaces[2] + face2.y * cubeSize + face2.x, FaceSize * touchingFaces[1] + face3.y * cubeSize + face3.x];
				}
			}

			return [];
		}

		CubeData.parseCubeString = function(value=""){
			// Decodes a cube from a string, see getCubeDataAsString for format definition
			var parts = value.split(":");

			if(parts.length != 4 || parts[0] != "CBDTA"){
				console.info("Invalid string");
				return null;
			}

			var format = -1;

			switch(parts[1]){
				case "S":
					format = CubeDataType.Surface;
					break;
				case "F":
					format = CubeDataType.Fast;
					break;
				case "P":
					format = CubeDataType.Piece;
					break;
				default:
					console.info("Invalid format '" + parts[1] + "' for cube");
					return null;
					break;
			}

			var cubeSize = parseInt(parts[2], 16);

			var decodedArray = [];
			for(var i = 0; i < parts[3].length; i++){
				decodedArray.push(parseInt(parts[3][i], 24));
			}

			// Calculate the data size for a cube as we are not sure which it is
			var tmpCube = new CubeData(cubeSize, 1, format);
			var maxDataSize = tmpCube.getCubeData().getMaxElementSize();

			// Create the binary data for the cube
			var newBinData = new BinaryData(maxDataSize, decodedArray, decodedArray.length, format);

			return new CubeData(cubeSize, 1, format, newBinData);
			
		}

		CubeData.getOrbitNumber = function(cubieIndex=0, cubeSize=3){
			/*
			Now you may be thinking right about now, what in the world
			is an orbit number?

			An orbit number is:
				a piece with an orbit number can only ever be swapped with
				pieces of the same orbit number, it is calculated by doing
				the following, first, calculate the distance from the center
				of a row or column, next add its onion layer's (see below)
				triangle number.

			for a visual example we are going to use a 6 by 6 and 7 by 7 cube face:

			Here is I mean by onion layer:

				   6 by 6       7 by 7

				2 2 2 2 2 2    3 3 3 3 3 3 3
				2 1 1 1 1 2    3 2 2 2 2 2 3
				2 1 0 0 1 2    3 2 1 1 1 2 3
				2 1 0 0 1 2    3 2 1 0 1 2 3
				2 1 1 1 1 2    3 2 1 1 1 2 3
				2 2 2 2 2 2    3 2 2 2 2 2 3
							   3 3 3 3 3 3 3 
				
				by picturing each successive square as a layer of an onion, we can
				start getting some usefull information to calculate the orbit number
				
				The maximum onion layer number is the floor of the cube size divided
				by 2

			Here is what I mean from distance from the middle of the row or column:

				2 1 0 0 1 2     3 2 1 0 1 2 3
				1 1 0 0 1 1     2 2 1 0 1 2 2
				0 0 0 0 0 0     1 1 1 0 1 1 1
				0 0 0 0 0 0     0 0 0 0 0 0 0
				1 1 0 0 1 1     1 1 1 0 1 1 1
				2 1 0 0 1 2     2 2 1 0 1 2 2
			                    3 2 1 0 1 2 3

				If you consider the piece inline with the center as the "middle"
				section of the layer, you count how far away its distance is
				from that piece. It may make more sense if you focus on the lower
				triangles only of each cube:

				0          	0
				0 1			0 1
				0 1 2		0 1 2
							0 1 2 3

			now you may see what we are about do do next. If we take the triangle number
			of the layer and add it to our distance from midle value we get the following:



				5 4 3 3 4 5		9 8 7 6 7 8 9
				4 2 1 1 2 4		8 5 4 3 4 5 8
				3 1 0 0 1 3		7 4 2 1 2 4 7
				3 1 0 0 1 3		6 3 1 0 1 3 6
				4 2 1 1 2 4		7 4 2 1 2 4 7
				5 4 3 3 4 5		8 5 4 3 4 5 8
								9 8 7 6 7 8 9

			and if we look at a triangle portion of the cube face:

				0			0
				1 2			1 2
				3 4 5		3 4 5
							6 7 8 9
			
			we find that each number is unique! No matter what we do (unless we rip our cube 
				apart), we can never get a 2 to swap with a 4 and every 5 can only 7 can only
				swap with other 7's. This pattern is extendible and will always work!
				This is useful for being able to count the correct number of each type

			To calculate how many of each number there are we will do the following:
				1st check if the number is a triangle number
					If it is:
						If the cube is odd:
							if the number is 0 there is only 1
							else there are 4
						Else:
							If the number is 0, there are 4
							Else: there are 8

				If it is not a triangle number, is 1 + it a triangle number:
					If so: this is a corner there are 4 of them
				Else:
					Ther are 8 of them				
			*/			

			function getOnionLayer(c={x:0,y:0}){
				if(isOdd){
					return Math.max(Math.abs(c.x - center), Math.abs(c.y - center));
				}else{
					var x = c.x < center ? c.x - center + 1 : c.x - center;
					var y = c.y < center ? c.y - center + 1 : c.y - center;
					return Math.max(Math.abs(x), Math.abs(y));
				}
			}


			function getDistanceFromMidLayer(c={x:0,y:0}){
				if(isOdd){
					return Math.min(Math.abs(c.x - center), Math.abs(c.y - center));
				}else{
					var x = c.x < center ? c.x - center + 1 : c.x - center;
					var y = c.y < center ? c.y - center + 1 : c.y - center;
					return Math.min(Math.abs(x), Math.abs(y));
				}
			}


			const isOdd = cubeSize % 2 == 1;
			var coords = CubeData.getCubieCoordinates(cubieIndex, cubeSize);
			var face = CubeData.getTouchingFaces(coords.x, coords.y, coords.z, cubeSize)[0];
			var fCoord = CubeData.getFaceCoordinates(face, coords.x, coords.y, coords.z);
			var center = Math.floor(cubeSize / 2);

			return triNum(getOnionLayer(fCoord)) + getDistanceFromMidLayer(fCoord);

		}

		/**@param {CubeData}cubeData */
		CubeData.verifyCube = function(cubeData, cubeNumber=0){
			// Checks if the cube is a possible configuration of a cube
			// INCOMPLETE
			// For now, it just makes sure there is the correct amount of each piece

			// First convert the given cube to a piece type
			// If the conversion fails, return why
			var cubeSize = cubeData.getCubeSize();
			var testData = new CubeData(cubeSize, 1, CubeDataType.Piece, cubeData.getCubeData(cubeNumber));
			var testErrorLog = testData.getErrorLog();
			const isOdd = cubeSize % 2 == 1;
			const FaceSize = cubeSize ** 2;
			
			// If there are errors in the error log, the conversion failed and the log explains why
			if(testErrorLog.length > 0){
				return {passed:false, errors:testErrorLog};
			}

			/**@param {number}type */
			function getCountOfType(type){
				if(isTriNum(type)){
					if(isOdd){
						if(type == 0){
							return 1;
						}else{
							return 4;
						}
					}else{
						if(type == 0){
							return 4;
						}else{
							return 8;
						}
					}
				}else if (isTriNum(type + 1)){
					return 4;
				}else{
					return 8;
				}
			}

			/**@param {number}num */
			function isTriNum(num){
				// We can tell if it is a triangle number
				// By putting it through the inverse function
				// If a whole number comes out, then it is
				// a triangle number, if not then it isn't

				if (num < 0){
					// Make sure we don't take the sqrt of a negative number
					return false;
				}
				var inv = inverseTriNum(num);
				if (inv % 1 == 0){
					return true;
				}
				return false;
			}
			// We are going to start counting the number of pieces of each orbit type.
			// the highest orbit number we can get is the triangle number of the ceiling of
			// the size / 2   - 1
			
			// Make a list that can hold all of our obits and their counts
			// Orbit Counter format [orbitList, orbitList, orbitList..]
			// OrbitList:[color0, color1, color2...]
			// OrbitExpectedCount [expected count of each color for orbit0, orbit1, orbit2...]
			// If there is a missmatch between the counter and the expected count, there is an error

			/**@type {number[][]} */
			var orbitColorCounter = [];
			/**@type {number[]} */
			var orbitExpectedCount = [];
			var orbitCount = triNum(Math.ceil(cubeSize / 2));

			// Popluate the lists with the start data
			// and expected counts
			for(var i = 0; i < orbitCount; i++){
				orbitColorCounter.push([0, 0, 0, 0, 0, 0]);
				orbitExpectedCount.push(getCountOfType(i));
			}

			// Go through each index of the cube and count colors at each location
			// and add these to the orbit color counts.
			// We expect that there should be the expectedCount of each color, else
			// the cube is invalid

			// We will loop through 1 face worth of indecies to count each color
			for(var i = 0; i < cubeSize * cubeSize; i++){
				var x = i % cubeSize;
				var y = Math.floor(i / cubeSize);
				// In this case we just pretend we are using a cubie from the left side as
				// Those cubies are aranged just as a face is
				var orbitType = CubeData.getOrbitNumber(i, cubeSize);
				
				// Loop through each side at that location to get the color and add it to the counter
				for(var face = 0; face < 6; face += 1){
					var sColor = testData.getSticker(face, x, y);
					orbitColorCounter[orbitType][sColor]++;
				}
			}

			// Check for correct counts, if something is not right, start making an error log
			for(var i = 0; i < orbitCount; i ++){
				var expCount = orbitExpectedCount[i];
				var orbitGood = true;
				/**@type {number[]} */
				var errorColors = [];
				for(var color = 0; color < 6; color ++){
					if(orbitColorCounter[i][color] != expCount){
						orbitGood = false;
						errorColors.push(color);
					}
				}

				if(!orbitGood){// A mismatch was found, report errors for every cubie in the orbit with the affected colors
					for(var j = 0; j < cubeSize ** 3 - (cubeSize - 2) ** 3; j ++){
						if(CubeData.getOrbitNumber(j, cubeSize) == i){
							// Verify the cubie has one of the affected colors and highlight those sides (once supported)
							var cubieCoords = CubeData.getCubieCoordinates(j, cubeSize);
							var testCubie = testData.getCubie(cubieCoords.x, cubieCoords.y, cubieCoords.z);
							for(var k = 0; k < errorColors.length; k ++){
								if(testCubie.getFaces().includes(errorColors[k])){
									testErrorLog.push(new CubeError("This sticker may be incorrect", 0, j, [true, true, true, true], "ORBITCOUNT_FAILURE"));
									break;
								}
							}
						}
					}
				}
			}
            
			if(testErrorLog.length > 0){
				return {passed:false, errors:testErrorLog};
			}
			// TODO more verification tests for testing solvibility
			return {passed:true, errors:[]};

		}

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
			 * 
			 * @param {string} attrib 
			 * @returns {number}
			 */
			this.getAttribute = function(attrib){
				return attributes[attrib];
			}

			/**
			 * 
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

		/**
		 * @param {number[]|number[][]} matrixArray 
		 * @param {boolean} columnMajor 
		 */
		function Matrix(matrixArray, columnMajor=false){
			// Must be a square matrix
			
			// Check if it is a multi dim array
			var multiDim = (typeof matrixArray[0] == "object");
			var mat = [];// saved in row major
			var dim;

			if(!multiDim){
				dim = Math.sqrt(matrixArray.length);
				if(dim % 1 != 0){
					throw "Matrix must be square";
				}
				for(var row = 0; row < dim; row ++){
					mat.push([]);
					for(var col = 0; col < dim; col ++){
						mat[row].push(matrixArray[row * dim + col]);
					}
				}
			}else{
				dim = matrixArray.length;
				//@ts-ignore // It says there's an error since matrixArray[0] can be a number or an array, but .length is not on numbers
							// but we ensure that we don't access .length unless it is an object
				if(dim != matrixArray[0].length){
					throw "Matrix must be square";
				}
				for(var row = 0; row < dim; row ++){
					mat.push([]);
					for(var col = 0; col < dim; col ++){
						mat[row].push(matrixArray[row][col]);
					}
				}
			}
			// Rearange the matrix if it was given in column major order
			if(columnMajor){
				// row and column refer to mat's format
				for(var row = 0; row < dim; row ++){
					for(var col = 0; col < dim; col ++){
						if(multiDim){
							mat[row][col] = matrixArray[col][row];
						}else{
							mat[row][col] = matrixArray[col * dim + row];
						}
					}
				}
			}

			/**
			 * @param {number[][]} matA 
			 * @param {number[][]} matB 
			 * @param {number} row 
			 * @param {number} col 
			 * @returns number
			 */
			function dot(matA, matB, row, col){
				// Calculates the dot product of a row and a col of 2 matricies
				// Used in the multiply function
				var result = 0;
				for(var i = 0; i < dim; i++){
					result += matA[row][i] * matB[i][col];
				}
				return result;
			}


			/**
			 * @param {Matrix} other 
			 */
			this.multiply = function(other){
				if(dim != other.getDim()){
					throw "Matrix dimensions do not match";
				}

				/**@type {number[][]} */
				var result = [];
				var oMat = other.getMultiArray();
				for(var row = 0; row < dim; row ++){
					result.push([]);
					for(var col = 0; col < dim; col ++){
						result[row].push(dot(mat, oMat, row, col));
					}
				}

				return new Matrix(result);
			}
			

			this.getDim = function(){
				return dim;
			}

			/**
			 * @param {Matrix} other 
			 */
			this.add = function(other){
				var oDim = other.getDim();
				if(dim != oDim){
					throw "Cannot add matricies of differing dimensions";
				}

				var result = other.getMultiArray();
				for(var row = 0; row < dim; row++){
					for(var col = 0; col < dim; col++){
						result[row][col] += mat[row][col];
					}
				}

				return new Matrix(result);
			}

			/**
			 * @param {number} value 
			 * @returns Matrix
			 */
			this.scale = function(value){
				var result = Matrix.getIdenity(dim).getMultiArray();

				for(var row = 0; row < dim; row ++){
					for(var col = 0; col < dim; col ++){
						result[row][col] = value * mat[row][col];
					}
				}

				return new Matrix(result);
			}


			this.determinant = function(){
				// calculates the determinant
				// We will do this recursively
				if(dim == 2){
					return mat[0][0] * mat[1][1] - mat[0][1] * mat[1][0];
				}

				if(dim < 2){
					// Not sure why you need a 1x1 matrix but it is possible
					return 0;
				}

				// we will use the first row as our base
				var result = 0;

				// Build a 2d array that is 1 less than our current width
				var detMatArray = Matrix.getIdenity(dim - 1).getMultiArray(); 

				for(var col = 0; col < dim; col++){
					for(var subCol = 0; subCol < dim; subCol++){
						if(subCol == col){
							continue;
						}
						var detArrayCol = subCol < col ? subCol : subCol - 1;
						for(var subRow = 1; subRow < dim; subRow++){
							detMatArray[subRow - 1][detArrayCol] = mat[subRow][subCol];
						}  
					}
					var detSign = col % 2 == 0 ? 1 : -1;
					result += detSign * mat[0][col] * new Matrix(detMatArray).determinant();

				}

				return result;
			}

			this.inverse = function(){
				var det = this.determinant();
				if(det != 0){
					return new Matrix(this.cofactors().scale(1 / det).getMultiArray(true));
				}else{
					return null;
				}
			}

			this.minors = function(){
				var result = Matrix.getIdenity(dim).getMultiArray();
				var subMat = Matrix.getIdenity(dim - 1).getMultiArray();
				for(var row = 0; row < dim; row++){
					for(var col = 0; col < dim; col++){
						for(var subCol = 0; subCol < dim; subCol++){
							if(subCol == col){
								continue;
							}
							var subMatCol = subCol < col ? subCol : subCol - 1;
							for(var subRow = 0; subRow < dim; subRow++){
								if(subRow == row){
									continue;
								}
								var subMatRow = subRow < row ? subRow : subRow - 1;
								subMat[subMatRow][subMatCol] = mat[subRow][subCol];
							}  
						}
						//var detSign = col % 2 == 0 ? 1 : -1;
						result[row][col] = new Matrix(subMat).determinant();
					}
				}
				return new Matrix(result);
			}

			this.cofactors= function(){
				var result = Matrix.getIdenity(dim).getMultiArray();
				var subMat = Matrix.getIdenity(dim - 1).getMultiArray();
				for(var row = 0; row < dim; row++){
					for(var col = 0; col < dim; col++){
						for(var subCol = 0; subCol < dim; subCol++){
							if(subCol == col){
								continue;
							}
							var subMatCol = subCol < col ? subCol : subCol - 1;
							for(var subRow = 0; subRow < dim; subRow++){
								if(subRow == row){
									continue;
								}
								var subMatRow = subRow < row ? subRow : subRow - 1;
								subMat[subMatRow][subMatCol] = mat[subRow][subCol];
							}  
						}
						var detSign = (col  + row) % 2 == 0 ? 1 : -1;
						result[row][col] = detSign * new Matrix(subMat).determinant();
					}
				}
				return new Matrix(result);
			}

			this.getMultiArray = function(columnMajor=false){
				var result = [];
				if(columnMajor){
					// row and column refer to mat's format
					for(var col = 0; col < dim; col ++){
						result.push([]);
						for(var row = 0; row < dim; row ++){
								result[col].push(mat[row][col]);
						}
					}
				}else{
					// row and column refer to mat's format
					for(var row = 0; row < dim; row ++){
						result.push([]);
						for(var col = 0; col < dim; col ++){
								result[row].push(mat[row][col]);
						}
					}
				}
				return result;
			}

			this.getArray = function(columnMajor=false){
				var result = [];
				if(columnMajor){
					// row and column refer to mat's format
					for(var col = 0; col < dim; col ++){
						for(var row = 0; row < dim; row ++){
								result.push(mat[row][col]);
						}
					}
				}else{
					// row and column refer to mat's format
					for(var row = 0; row < dim; row ++){
						for(var col = 0; col < dim; col ++){
								result.push(mat[row][col]);
						}
					}
				}
				return result;
			}
		}

		/**
		 * @param {number} dim 
		 * @returns {Matrix}
		 */
		Matrix.getIdenity = function(dim){
			var result = [];
			for(var row = 0; row < dim; row++){
				result.push([]);
				for(var col = 0; col < dim; col++){
					if(col == row){
						result[row].push(1);
					}else{
						result[row].push(0);
					}
				}
			}
			return new Matrix(result);
		}

		const MAP_SIZE = 1024;

		function Renderer(){
			var canvas = document.createElement("canvas");
			document.getElementById("canvas").appendChild(canvas);/*The div element with the id 
				'canvas' is the holder that holds the canvas allowing
				it to fit into the page like formating style with ease.*/
				
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
				op.innerHTML="Cube Number: " + info[0] + ", Sticker Number: " + (info[1] * 256 + info[2]) + ", Mouse Location: " + X + " , " + Y;
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

		function CubeNode(data=new CubeData(), cubeId=-1, algorithmStorage=data==null?null:new AlgorithmStorage(data.getCubeSize(), 0), algIds=[-1], cubeScore=-1, totalPoints=Infinity){
			this.data = data;
			this.cubeId = cubeId;
			this.algorithmStorage = algorithmStorage;
			this.algIds = algIds;// This stores the id's of the algorithms applied to the cube in order
			this.cubeScore = cubeScore;
			this.totalPoints = totalPoints;
			this.active = true;
			/** @type {CubeNode} **/
			this.next = null;
			/** @type {CubeNode} **/
			this.last = null;
		}

		/**
		 * @param {CubeNode}nodeInList 
		 * @param {CubeNode}newNode
		 * */
		CubeNode.insertAfter = function(nodeInList, newNode){
			// Inserts a node after a specified node. 
			// Returns true if it was successful or
			// returns false if either the node in the list or the node 
			// we are inserting after it are null
			if(nodeInList == null || newNode == null){
				// There was nothing to insert or there was nothing to insert into
				return false;
			}
			var tmpSave = nodeInList.next;
			nodeInList.next = newNode;
			newNode.last = nodeInList;
			newNode.next = tmpSave;

			if(tmpSave != null){
				tmpSave.last = newNode;
			}
			return true;
		}

		/**
		 * @param {CubeNode}nodeInList 
		 * @param {CubeNode}newNode
		 * */
		CubeNode.insertBefore = function(nodeInList, newNode){
			// Inserts a node before a specified node. 
			// Returns true if it was successful or
			// returns false if either the node in the list or the node 
			// we are inserting before it are null
			if(nodeInList == null || newNode == null){
				// There was nothing to insert or there was nothing to insert into
				return false;
			}
			var tmpSave = nodeInList.last;
			nodeInList.last = newNode;
			newNode.next = nodeInList;
			newNode.last = tmpSave;

			if(tmpSave != null){
				tmpSave.next = newNode;
			}
			return true;
		}

		/**
		 * @param {CubeNode}node
		 * */
		CubeNode.removeNode = function(node){
			// removes the node from the list
			// and updates the previous and next
			// node's accordinglly
			if(node == null){
				return;
			}

			var before = node.last;
			var after = node.next;

			node.next = null;
			node.last = null;

			if(before != null){
				before.next = after;
			}
			if(after != null){
				after.last = before;
			}
		}

		/**
		 * @param {AlgorithmStorage} algorithm 
		 */
		function basicSuccesCallBack(algorithm, algId=0, time=0, cycles=0){
			console.log(`Cube was solved in ${Math.round(time)} seconds and ${cycles} cycles. The algorithm is ${algorithm.getMoves(algId)}`);
		
		}

		function basicFailureCallBack(errors=[new CubeError()]){
			displayErrorsOnCube(errors);
			//console.log("Failed to solve cube for the follwing reasons: ", errors)
		}

		function basicStartCallBack(cancelCallBack=function(){}){
			console.log("Verification passed, begining to solve...");
			clearCubeErrors(testCube);
			document.getElementById("cancel_button").addEventListener("click", cancelCallBack);

		}

		function displayErrorsOnCube(errors=[new CubeError()]){
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

		function clearCubeErrors(vcube=new VCube()){
			var cubies = vcube.getCubies();
			cubies.forEach(cubie => {
				cubie.inError = [false, false, false, false];
				cubie.errorMessage = "";
			});
		}


		async function solveCube(cubeData=new CubeData(), cubeNumber=0, startCallBack=basicStartCallBack, successCallBack=basicSuccesCallBack, failureCallBack=basicFailureCallBack){
			// Functions we are going to use:
			/** @returns {CubeNode} **/
			function getNewNode(canRetireLastNode=false){
				// Returns a cube node to use if possible
				if(inactiveNode == null){
					// Check if there are no inactive nodes to try to create a new one
					if(totalCubeCount < MAX_CUBE_COUNT){
						// Make sure we are not going over our limit on cubes
						// If so, create a new node
						totalCubeCount ++;
						activeCubeCount ++;
						return new CubeNode(cubeStorage, totalCubeCount - 1);			
						
					}else{
						// If we have reached our limit on cubes and there are no inactive nodes
						// we need to retire the last node and use it
						if(canRetireLastNode){
							retireLastNode();
							return getNewNode();
						}
						// If retiring is not allowed, we have nothing to return.
						return null;
					}	
				}else{
					// Reuse a used node since there is an inacitve one available
					// Yay recycling!
					var theNode = inactiveNode;
					inactiveNode = theNode.next;
					activeCubeCount ++;
					CubeNode.removeNode(theNode);
					return theNode;
				}
			}

			function removeNode(node=new CubeNode()){
				// Removes a node from the active list and
				// moves it to the inactive list
				if(node == firstNode){
					// If this is the first node we are removing, we need to
					// reassign wich node is the first node
					firstNode = node.next;
				}

				CubeNode.removeNode(node);
				var isFirstInactiveNode = !CubeNode.insertAfter(inactiveNode, node);

				if(isFirstInactiveNode){
					// If this is the first inactive node, we need to 
					// assign it as the first inactive node.
					inactiveNode = node;
				}
				activeCubeCount --;
			}

			function retireLastNode(){
				removeNode(endNode.last);
			}

			/** @param {CubeNode}cubeNode */
			function insertCubeNodeInOrder(cubeNode=null){
				// Cubes will be (for now) sorted by their totalPoints, points are bad, we want cubes with fewer points
				if(cubeNode == null){
					return false;
				}

				var currentNode = endNode.last;
				// This is out of the loop as it is a special
				// case where we need to update firstNode's reference
				if(cubeNode.totalPoints <= firstNode.totalPoints){
					CubeNode.insertBefore(firstNode, cubeNode);
					firstNode = cubeNode;
					return true;
				}

				// check if we are at the end of the list already
				// as if we are, then no need to look through the rest of the list
				if(cubeNode.totalPoints > endNode.last.totalPoints){
					CubeNode.insertAfter(endNode.last, cubeNode);
					return true;
				}

				// Skip to the half node to save on loop iterations
				if (halfNode != null && halfNode.next != null && cubeNode.totalPoints < halfNode.totalPoints){
					currentNode = halfNode;
				}

				// Find the first node were whe have a lower or equal points than it and insert
				// this node before it.
				// Also make sure we don't go past the end node.
				var i = activeCubeCount;
				while(currentNode != null && cubeNode.totalPoints < currentNode.totalPoints){
					if(i == Math.floor(activeCubeCount * 0.5)){
						halfNode = currentNode;
					}
					i--;
					currentNode = currentNode.last;
				}
				if(currentNode == firstNode){
					firstNode = cubeNode;
				}
				CubeNode.insertBefore(currentNode, cubeNode);
				return true;

			}

			/** @param {CubeNode}cubeNode */
			function scoreCube(cubeNode){
				if(cubeNode == null || cubeNode.data == null){
					cubeNode.cubeScore = -1;
					return -1;
				}

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
						var stickerColor = cubeNode.data.getSticker(side, x, y, cubeNode.cubeId);
						
						if(stickerColor == cubeNode.data.getSticker(side, x + 1, y, cubeNode.cubeId)){
							cubeScore ++;
						}

						if(stickerColor == cubeNode.data.getSticker(side, x - 1, y, cubeNode.cubeId)){
							cubeScore ++;
						}

						if(stickerColor == cubeNode.data.getSticker(side, x, y + 1, cubeNode.cubeId)){
							cubeScore ++;
						}

						if(stickerColor == cubeNode.data.getSticker(side, x, y - 1, cubeNode.cubeId)){
							cubeScore ++;
						}

					}

				}
				cubeNode.cubeScore = cubeScore;
				cubeNode.totalPoints = (solvedCubeScore - cubeScore) + MOVE_WEIGHT * (cubeNode.algIds.length * cubeNode.algorithmStorage.getAlgLength());
				return cubeScore;

			}

			/** @param {CubeNode[]}cubeNodes **/
			function scoreCubes(cubeNodes){
				var results = [];
				var cubeCount = cubeNodes.length;
				for(var i = 0; i < cubeCount; i ++){
					results.push(scoreCube(cubeNodes[i]));
				}
				return results;
			}

			/** 
			 * @param {CubeNode}cubeNode 
			 * @return {number[]}
			 * **/
			function getAlgorithmFromNode(cubeNode){
				if(cubeNode == null || cubeNode.algorithmStorage == null || cubeNode.algIds.includes(-1)){
					return [];
				}
				var alg = [];
				var algCount = cubeNode.algIds.length;
				for(var i = 0; i < algCount; i++){
					alg = alg.concat(cubeNode.algorithmStorage.getMoves(cubeNode.algIds[i]));
				}
				return alg;
			}

			/** 
			 * @param {CubeNode}cubeNode 
			 * **/
			function getAlgorithmFromNodeAsText(cubeNode){
				if(cubeNode == null || cubeNode.algorithmStorage == null || cubeNode.algIds.includes(-1)){
					return "No algorithm";
				}
				var alg = "";
				var algCount = cubeNode.algIds.length;
				for(var i = 0; i < algCount; i++){
					alg += (i==0 ? "": ", ") + cubeNode.algorithmStorage.getMovesAsText(cubeNode.algIds[i]);
				}
				return alg;
			}
			
			/**
			 * @param {number[]}list
			 * @param {number[]}indexList
			 */
			function sortList(list, indexList=[]){
				// the list is sorted in place, the return value is a map to return the list to the original order
				if(indexList.length != list.length){
					indexList = [];
					for(var i = 0; i < list.length; i++){
						indexList.push(i);
					}
				}

				// bubble sort the list
				var hasSwapped = true;
				var sortedPortion = list.length - 1;

				while(hasSwapped){
					hasSwapped = false;
					
					for(var i = 0; i < sortedPortion; i ++){
						if(list[i] < list[i + 1]){
							hasSwapped = true;
							var tmp = list[i];
							list[i] = list[i + 1];
							list[i + 1] = tmp;

							tmp = indexList[i];
							indexList[i] = indexList[i + 1];
							indexList[i + 1] = tmp;

						}
					}
					sortedPortion --;
				}

				return indexList;
			}
			
			// Verification:
			var verificationResults = CubeData.verifyCube(cubeData, cubeNumber);

			if(!verificationResults.passed){// The cube failed the test
				failureCallBack(verificationResults.errors);
				return;
			}

			var cancel = false;

			function cancelSolve(){
				cancel = true;
			}

			startCallBack(cancelSolve);

			// This is where if we had a web worker, we would send work over there it over there
			
			console.log(cubeData.getCubeData(0).getArray())
			// fun statistics we are going to watch
			var startTime = performance.now();
			var cycles = 0;
			var frameCycles = 0;
			var cubesChecked = 0;
			const CYCLES_PER_FRAME = 100;

			// We will start by setting up the data structures we are going to need
			var cubeSize = cubeData.getCubeSize();
			var all3MoveAlgs = new AlgorithmStorage(cubeSize, 3);
			var all1MoveAlgs = new AlgorithmStorage(cubeSize, 1);
			var all3MoveFilters = [];
			var all1MoveFilters = [];
			all3MoveAlgs.selfIndex();
			all1MoveAlgs.selfIndex();

			var agCount = all3MoveAlgs.getAlgCount();
			for(var i = 0; i < agCount; i ++){
				all3MoveFilters.push(all3MoveAlgs.getFilter(i, CubeDataType.Surface));
			}

			agCount = all1MoveAlgs.getAlgCount();
			for(var i = 0; i < agCount; i ++){
				all1MoveFilters.push(all1MoveAlgs.getFilter(i, CubeDataType.Surface));
			}

			// Set up our mass storage object
			const MAX_CUBE_COUNT = 50000;
			const MOVE_WEIGHT = 1;
			var totalCubeCount = 1;
			var activeCubeCount = 1;
			var tmpCube = new CubeData(cubeSize, 1, CubeDataType.Surface);
			all1MoveFilters[0].applyFilter(tmpCube);
			var maximumUnsolvedScore = scoreCube(new CubeNode(tmpCube, 0, all1MoveAlgs, [0]));
			// d is for data, c is four count
			// We will use multiple storages to keep our data 
			// as one big one, is kind of not nice to the browser
			var cubeStorage = new CubeData(cubeSize, MAX_CUBE_COUNT, CubeDataType.Surface);
			
			cubeStorage.setCube(cubeData.getCubeData(cubeNumber), 0);
			/** @type {CubeNode} **/
			var inactiveNode = null;
			var firstNode = new CubeNode(cubeStorage, 0);
			var halfNode = null;
			scoreCube(firstNode);
			// This is a dummy node, it is there to keep track of where the last node is
			var endNode = new CubeNode(null);
			// Link the two nodes together
			CubeNode.insertBefore(endNode, firstNode);

			var solvedCubeScore = scoreCube(new CubeNode(new CubeData(cubeSize, 1), 0));
			console.log("Solved Cube Score:", solvedCubeScore);
			console.log("Starting score:", firstNode.cubeScore);


			function solveCycle(){
				// We did something wrong
				if(firstNode == null || firstNode == endNode){
					op.innerHTML = "An error occured";
					console.log("An error occured, no more nodes to run");
					return true;
				}


			

				// Now lets get to solving:

				frameCycles ++;
				cycles ++;

				// Step one, see if we are solved
				var currentScore = firstNode.cubeScore;
				if(currentScore == solvedCubeScore){
					// We have solved the cube
					return true;
				}

				// If we made it here, we are not solved.
				// Save the current firstNode as it may change as we insert new nodes
				var cNode = firstNode;
				var currentAlg = getAlgorithmFromNode(cNode);
				var prospectiveNodes = [];
				// We are going to loop through possible next algorithms, validate them
				// Then create new nodes with them
				var layerCount = AlgorithmStorage.getLayerCount(cubeSize);
				for(var i = 0; i < layerCount; i ++){
					var isValid = AlgorithmStorage.checkNextMove(cubeSize, currentAlg, i);
					if(isValid){
						var newNodes = [getNewNode(true), getNewNode(true), getNewNode(true)];
						var newAlgs = [currentAlg.concat([i]), currentAlg.concat([i + layerCount]), currentAlg.concat([i + layerCount * 2])];
						
						// Update each of the nodes with their new cube data
						for(var j = 0; j < 3; j++){
							newNodes[j].data.setCube(cNode.data.getCubeData(cNode.cubeId), newNodes[j].cubeId);
							all1MoveFilters[i + layerCount * j].applyFilter(newNodes[j].data, newNodes[j].cubeId);
							newNodes[j].algorithmStorage = all1MoveAlgs;
							newNodes[j].algIds = newAlgs[j];
							prospectiveNodes.push(newNodes[j]);
						}
					}
				}

				// Score all these nodes and save them
				// TODO we will do something with the scores in the future
				// @ts-ignore
				var nodeScores = scoreCubes(prospectiveNodes);
				var nCount = prospectiveNodes.length;

				var sortedScoreIndexes = sortList(nodeScores);

				for(var i = 0; i < nCount; i ++){
					if(nodeScores[i] <= maximumUnsolvedScore && i < 12){
						insertCubeNodeInOrder(prospectiveNodes[sortedScoreIndexes[i]]);
					}else{
						removeNode(prospectiveNodes[sortedScoreIndexes[i]]); 
					}
				}

				// Remove our used node
				removeNode(cNode);
				// Start next cycle;
				return false;
			}

			function runSolveCycles(){
				
				if(cancel){
					op.innerHTML = "The solve was canceled by user";
					return;
				}

				var isComplete = false;

				for(var i = 0; i < CYCLES_PER_FRAME; i ++){

					if(solveCycle()){
						isComplete = true;
						break;
					}
				}

				if(!isComplete){
					// We are not done yet, so come back in a moment
					frameCycles = 0;
					setTimeout(runSolveCycles, 100/6);
					var algStr = firstNode.cubeScore + "<br>" + firstNode.totalPoints + "<br>Top Alg: " + getAlgorithmFromNodeAsText(firstNode);
					/**@type {CubeData} */
					var td = testCube.getCubeData();
					td.setCube(cubeStorage.getCubeData(firstNode.cubeId), 0);
					testCube.updateColors();
					op.innerHTML = algStr;

				}else{
					// We have solved the Cube or encountered an error
					if(firstNode == null){
						// It was an error so don't do anything
					}else{
						var totalTime = performance.now() - startTime;
						var alg = getAlgorithmFromNode(firstNode);
						var algSt = new AlgorithmStorage(cubeSize, alg.length, 1);
						algSt.addAlgorithm(alg);
						successCallBack(algSt, 0, totalTime / 1000 , cycles);
						op.innerHTML = getAlgorithmFromNodeAsText(firstNode);
					}
				}
			}

			runSolveCycles();
			
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
		function VCube(size=3, dataStorageFormat=0, cubeData=new CubeData(size, 1, dataStorageFormat), cubeNumber=0, selectable=true, scale=1, pos={x:0,y:0,z:-2*scale}, style=CubieStyle.Plain) {
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
				if (dataStorageFormat == CubeDataType.Surface && !recording && edit) {
					
					cubeData.setStickerByIndex(stickerIndex, stickerValue, cubeNumber);

					updateColors();
					return true;
				} else if (dataStorageFormat == CubeDataType.Piece && override && !recording && edit) {
					
					cubeData.convertStorageFormat(CubeDataType.Surface);
					dataStorageFormat = CubeDataType.Surface;
					changeSticker(stickerIndex, stickerValue);
					return true;
				} else {
					if (dataStorageFormat == CubeDataType.Piece && !override) {
						throw "Cannot change data type of cube without override enabled!";
					} else if (dataStorageFormat == CubeDataType.Compact) {
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
						case CubeFace.Left:{
							switch(secondaryFace){
								case CubeFace.Back:{
									modMat = modMat.multiply(rxm3);
									break;
								}
								case CubeFace.Up:{
									modMat = modMat.multiply(rxm2);
									break;
								}
								case CubeFace.Front:{
									modMat = modMat.multiply(rxm);
									break;
								}
								case CubeFace.Down:
									// Fall through
								default:{
									// Nothing is Needed
									break;
								}
							}
							break;
						}
						case CubeFace.Down:{
							switch(secondaryFace){
								
								case CubeFace.Front:{
									modMat = modMat.multiply(rzm);
									modMat = modMat.multiply(rxm);
									break;
								}
								case CubeFace.Back:{
									modMat = modMat.multiply(rzm);
									modMat = modMat.multiply(rxm3);
									break;
								}
								case CubeFace.Right:
									// Fall through;
								default:{
									modMat = modMat.multiply(rzm);
									break;
								}
							}
							break;
						}
						case CubeFace.Back:{
							switch(secondaryFace){
								case CubeFace.Up:{
									modMat = modMat.multiply(rym);
									modMat = modMat.multiply(rxm2);
									break;
								}
								case CubeFace.Right:{
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
						
						case CubeFace.Front:{
							switch(secondaryFace){
								case CubeFace.Up:{
									modMat = modMat.multiply(rym3);
									modMat = modMat.multiply(rxm2);
									break;
								}
								case CubeFace.Right:{
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

						case CubeFace.Up:{
							switch(secondaryFace){
								case CubeFace.Right:{
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
				var filter = algStorage.getFilter(0, CubeDataType.Piece);
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
			testCube = new VCube(3, CubeDataType.Piece);
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
				filters.push(all3MoveAlgs.getFilter(i, CubeDataType.Surface))
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
