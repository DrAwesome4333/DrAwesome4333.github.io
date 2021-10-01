// @ts-check
import {CUBE_DATA_TYPE, CUBIE_TYPE,CUBIE_STYLE, CUBE_FACE} from "./cubeconsts.js"
import { BinaryData } from "./binarydata.js";
var shouldLogErrors = true;
/*
class CubeData
---------------
- data : BinaryData
- cubeCount : int  does not change after creation
- cubeSize : int   does not change after creation
- storageFormat : CUBE_DATA_TYPE
- errorLog : array[CubeError]

----------------
CubeData(cubeSize:int, cubeCount:int, storageFormat:CUBE_DATA_TYPE, data:BinaryData):CubeData
getCubeCount():int
getCubeSize():int
getCubeData(startCube:int, endCube:int):BinaryData
getStorageFormat():CUBE_DATA_TYPE
convertStorageFormat(toFormat:CUBE_DATA_TYPE):bool
getErrorLog():array[CubeError]
applyAlgorithm(algorithm:Algorithm, cube:int):bool
getCubie(x:int, y:int, z:int):CubieData
setCubie(x:int, y:int, z:int, cubie:CubieData):None
getSticker(side:int, x:int, y:int):int
setSticker(side:int, x:int, y:int, sticker:int):none
-getCubieFromIndex(cubieIndex:int):Cubie
	
*/
function CubeData(cubeSize = 3, cubeCount = 1, storageFormat = CUBE_DATA_TYPE.Surface, data = generateSolvedCubeBinaryData(cubeSize, cubeCount)) {
    // An object that can store one or many cubes of the same dimensions

    this.getCubeCount = function () {
        return cubeCount;
    }

    this.getCubeSize = function () {
        return cubeSize;
    }

    this.getStorageFormat = function () {
        return storageFormat;
    }

    this.getCubeData = function (startCube = 0, endCube = startCube) {
        // Returns the data of the requested cubes
        var dataCountPerCube = data.getElementCount() / cubeCount;
        var startElement = startCube * dataCountPerCube;
        var endElement = (endCube + 1) * dataCountPerCube - 1;
        var dataSize = data.getMaxElementSize();
        var newData = new BinaryData(dataSize, data.getArray(startElement, endElement));
        newData.setDataFlag(storageFormat);
        return newData;
    }

    this.appendCubeData = function (newCubeCount = 1, cubeBinData = generateSolvedCubeBinaryData(cubeSize, newCubeCount)) {
        // Check if the cube being added is of the same format, if not, we need to convert it
        if (cubeBinData.getDataFlag() != storageFormat) {
            var tmpCube = new CubeData(cubeSize, cubeCount, cubeBinData.getDataFlag(), cubeBinData);
            var success = tmpCube.convertStorageFormat(storageFormat);
            if (!success) {
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

    this.setCube = function (cubeBinData = generateSolvedCubeBinaryData(cubeSize, 1), cubeNumber = 0) {
        if (cubeBinData.getDataFlag() != storageFormat) {
            var tmpCube = new CubeData(cubeSize, 1, cubeBinData.getDataFlag(), cubeBinData);

            var success = tmpCube.convertStorageFormat(storageFormat);
            if (!success) {
                console.info("Error setting cube data, could not convert given data.")
                return false;
            }
            cubeBinData = tmpCube.getCubeData();
        }
        var dataCountPerCube = data.getElementCount() / cubeCount;
        var startElement = cubeNumber * dataCountPerCube;
        return data.setArray(startElement, cubeBinData.getArray());
    }

    this.getStickerByIndex = function (index = 0, cubeNumber = 0) {
        switch (storageFormat) {
            case CUBE_DATA_TYPE.Fast:
            // Fall through
            case CUBE_DATA_TYPE.Surface: {
                var dataPerCube = cubeSize ** 2 * 6;
                return data.getData(index + dataPerCube * cubeNumber);
                break;
            }
            case CUBE_DATA_TYPE.Piece: {
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

    this.getSticker = function (face = 0, x = 0, y = 0, cubeNumber = 0) {
        // Check if parameters are in range
        if (face < 0 || face > 5 || x >= cubeSize || y >= cubeSize || x < 0 || y < 0 || cubeNumber < 0 || cubeNumber >= cubeCount) {
            return -1;
        }
        switch (storageFormat) {
            case (CUBE_DATA_TYPE.Fast):
            // fall through
            case (CUBE_DATA_TYPE.Surface): {
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
            case (CUBE_DATA_TYPE.Piece): {
                // We will first convert the face coordinates to 3D coordinates, use that to get the cubie
                // then we will calculate which face of the cubie we need and then return that face's value

                var c = CubeData.get3DCoordinates(face, x, y, cubeSize);
                var myCubie = this.getCubie(c.x, c.y, c.z, cubeNumber);

                var cubieFaceId = CubeData.getTouchingFaces(c.x, c.y, c.z, cubeSize);

                // The cubie's home face is the one we want so we just get it. (this is index 0 in the id array)

                if (cubieFaceId[0] == face) {
                    return myCubie.getFace(0);
                } else if (myCubie.getType() == CUBIE_TYPE.Edge) {
                    // If it was not the home face and we have an edge, then we only have one more option to choose
                    return myCubie.getFace(1);
                } else {
                    // By now we know we have a corner. 
                    // We are going to rearange the faceId list to be clockwise and then find the one that matches the face we are looking for
                    // and then get the data from that cubie

                    // The corners are not clockwise when in the front left, or back right corners (y does not affect this)
                    if ((c.x == 0 && c.z == cubeSize - 1) || (c.x == cubeSize - 1 && c.z == 0)) {
                        cubieFaceId = [cubieFaceId[0], cubieFaceId[2], cubieFaceId[1]];
                    }

                    for (var i = 0; i < 3; i++) {
                        if (face == cubieFaceId[i]) {
                            return myCubie.getFace(i);
                        }
                    }
                }
                break;
            }
            default: {
                return -1;
            }
        }
    }

    this.setStickerByIndex = function (index = 0, value = 0, cubeNumber = 0) {
        switch (storageFormat) {
            case (CUBE_DATA_TYPE.Fast):
            // fall through
            case (CUBE_DATA_TYPE.Surface): {
                // We are going to see which face we are looking at
                // Based on the face, x, and y we can calculate the index of the sticker
                // Sticker faces always start with the left - most, bottom - most, back - most sticker as the starting corner.
                // So on the left side the LDB sticker is on the bottom left when facing you. The 'x+' of a face is now either
                // the x+ in cube space, or in case of equal x in cube space, the z+ direction (towards the front face). The 'y+' of a face is now either
                // the y+ in cube space, or in case of equal y in cube space, the z+ direction
                // We select the face in the data with cubeSize * cubeSize * face and we get the sticker at the given coordinates with 
                // y * cubeSize + x
                if (value >= 6 || value < 0 || Math.floor(value) != value) {
                    if (shouldLogErrors)
                        console.log("Could not set sticker, " + value.toString() + " is not an integer in range (0 - 5)")
                    return false;
                }
                var dataPerCube = cubeSize ** 2 * 6;
                return data.setData(index + dataPerCube * cubeNumber, value);
                break;
            }
            default: {
                if (shouldLogErrors) {
                    console.log("Could not set sticker, you can only set stickers for Surface and Fast type cubes");
                }
                return false;
                break;
            }
        }
    }

    this.setSticker = function (face = 0, x = 0, y = 0, value = 0, cubeNumber = 0) {
        switch (storageFormat) {
            case (CUBE_DATA_TYPE.Fast):
            // fall through
            case (CUBE_DATA_TYPE.Surface): {
                // We are going to see which face we are looking at
                // Based on the face, x, and y we can calculate the index of the sticker
                // Sticker faces always start with the left - most, bottom - most, back - most sticker as the starting corner.
                // So on the left side the LDB sticker is on the bottom left when facing you. The 'x+' of a face is now either
                // the x+ in cube space, or in case of equal x in cube space, the z+ direction (towards the front face). The 'y+' of a face is now either
                // the y+ in cube space, or in case of equal y in cube space, the z+ direction
                // We select the face in the data with cubeSize * cubeSize * face and we get the sticker at the given coordinates with 
                // y * cubeSize + x
                if (value >= 6 || value < 0 || Math.floor(value) != value) {
                    if (shouldLogErrors)
                        console.log("Could not set sticker, " + value.toString() + " is not an integer in range (0 - 5)")
                    return false;
                }
                var index = cubeSize * cubeSize * face + y * cubeSize + x;
                var dataPerCube = cubeSize ** 2 * 6;
                return data.setData(index + dataPerCube * cubeNumber, value);
                break;
            }
            default: {
                if (shouldLogErrors) {
                    console.log("Could not set sticker, you can only set stickers for Surface and Fast type cubes");
                }
                return false;
                break;
            }
        }
    }

    this.setCubie = function (x = 0, y = 0, z = 0, value = new Cubie(), cubeNumber = 0) {
        // This will set a cubie of data, only valid pieces should be used pls
        // Cubies are soreted in LDB order with the 'home' face being the LDB surface of the cubie
        // The index is a bit trickier to get as the cube is 'hollow' so we need to take into consideration the middle layers

        // Verify we have valid coordinates
        if ((!(x == 0 || x == cubeSize - 1) && !(y == 0 || y == cubeSize - 1) && !(z == 0 || z == cubeSize - 1)) || (x < 0 || x >= cubeSize) || (y < 0 || y >= cubeSize) || (z < 0 || z >= cubeSize)) {
            // We are not touching a side of the cube so it is an invalid coordinate
            if (shouldLogErrors) {
                console.log("Could set Cubie, invalid position given");
            }
            return false;
        }

        if (storageFormat == CUBE_DATA_TYPE.Piece) {
            // We are going to first, calculate the index of the cubie's destination, then get the Cubie's code and save it in that index
            // Verify Cubie is valid (required for this format)
            if (!value.isValid()) {
                if (shouldLogErrors) {
                    console.log("Could set Cubie on this cube due to this cube's storage format, invalid cubie given");
                }
                return false;
            }

            // Calculate the index of the Cubie's destination
            var index = CubeData.getCubieIndex(x, y, z, cubeSize);;

            // Save the data and return the true/false of setting the falue
            var dataPerCube = cubeSize ** 3 - (cubeSize - 2) ** 3;
            return data.setData(index + dataPerCube * cubeNumber, value.getCode());

        } else if (storageFormat == CUBE_DATA_TYPE.Surface || storageFormat == CUBE_DATA_TYPE.Fast) {
            // We will calculate the indexes of each face, then set the data from the given Cubie to each face's index
            var type = 0;

            // Find out the type if it is an edge or corner
            if ((x == 0 && y == 0) || (x == 0 && y == cubeSize - 1) || (x == cubeSize - 1 && y == 0) || (x == cubeSize - 1 && y == x)) {
                if (z == 0 || z == cubeSize - 1) {
                    type = CUBIE_TYPE.Corner;
                } else {
                    type = CUBIE_TYPE.Edge;
                }
            }

            // We can't use the cubie's data if it is of a mis-matched type
            if (value.getType() != type) {
                console.log("Could not set cubie, cubie is the wrong type");
                return false;
            }

            const FaceSize = cubeSize ** 2;
            var dataPerCube = FaceSize * 6;
            var touchingFaces = CubeData.getTouchingFaces(x, y, z, cubeSize);

            var indexes = [];
            // Calculate the data index for each face given
            for (var i = 0; i < touchingFaces.length; i++) {
                // Translate the 3d coords into face coords
                var coords = CubeData.getFaceCoordinates(touchingFaces[i], x, y, z);
                // Use this to calculate the data index
                indexes.push(FaceSize * touchingFaces[i] + coords.y * cubeSize + coords.x);
            }

            // Set the face data using the Cubie we generated with the code given (value)
            var faceData = value.getFaces();

            if (indexes.length == 3) {
                // If we have a corner, we need to take into acount rotational direction for CW or CCW
                // They are not clockwise when in the front left, or back right corners (y does not affect this)
                if ((x == 0 && z == cubeSize - 1) || (x == cubeSize - 1 && z == 0)) {
                    faceData = [faceData[0], faceData[2], faceData[1]];
                }
            }

            // Set the data for each index given
            for (var i = 0; i < indexes.length; i++) {
                data.setData(indexes[i] + dataPerCube * cubeNumber, faceData[i]);
            }

            return true;
        } else {
            if (shouldLogErrors) {
                console.log("Error: Unsupported storage format");
            }
            return false;
        }
    }

    this.getCubie = function (x = 0, y = 0, z = 0, cubeNumber = 0) {
        // This will get a cubie of data, will return a Cubie Object
        // Cubies are soreted in LDB order with the 'home' face being the LDB surface of the cubie
        // The index is a bit trickier to get as the cube is 'hollow' so we need to take into consideration the middle layers

        // Verify we have valid coordinates
        if ((!(x == 0 || x == cubeSize - 1) && !(y == 0 || y == cubeSize - 1) && !(z == 0 || z == cubeSize - 1)) || (x < 0 || x >= cubeSize) || (y < 0 || y >= cubeSize) || (z < 0 || z >= cubeSize)) {
            // We are not touching a side of the cube so it is an invalid coordinate
            if (shouldLogErrors) {
                console.log("Could get Cubie, invalid coordinates given");
            }
            return;
        }
        if (storageFormat == CUBE_DATA_TYPE.Piece) {
            var index = CubeData.getCubieIndex(x, y, z, cubeSize);
            var type = 0;

            // Find out the type if it is an edge or corner
            if ((x == 0 && y == 0) || (x == 0 && y == cubeSize - 1) || (x == cubeSize - 1 && y == 0) || (x == cubeSize - 1 && y == x)) {
                if (z == 0 || z == cubeSize - 1) {
                    type = CUBIE_TYPE.Corner;
                } else {
                    type = CUBIE_TYPE.Edge;
                }
            } else if ((x == 0 && z == 0) || (x == 0 && z == cubeSize - 1) || (x == cubeSize - 1 && z == 0) || (x == cubeSize - 1 && z == x) ||
                (z == 0 && y == 0) || (z == 0 && y == cubeSize - 1) || (z == cubeSize - 1 && y == 0) || (z == cubeSize - 1 && y == z)) {
                type = CUBIE_TYPE.Edge;
            }

            var dataPerCube = cubeSize ** 3 - (cubeSize - 2) ** 3;
            return new Cubie(type, [], data.getData(index + cubeNumber * dataPerCube));
        } else if (storageFormat == CUBE_DATA_TYPE.Surface || storageFormat == CUBE_DATA_TYPE.Fast) {
            // We will calculate the indexes of each face, then get the data for each face and then return the cubie
            // Calculate face size, cube data size, and touching faces
            const FaceSize = cubeSize ** 2;
            var dataPerCube = FaceSize * 6;
            var touchingFaces = CubeData.getTouchingFaces(x, y, z, cubeSize);

            var indexes = [];

            // Calculate the data index for each face given
            for (var i = 0; i < touchingFaces.length; i++) {
                // Translate the 3d coords into face coords
                var coords = CubeData.getFaceCoordinates(touchingFaces[i], x, y, z);
                indexes.push(FaceSize * touchingFaces[i] + coords.y * cubeSize + coords.x);
            }

            // Get the data using the indexes to construct the cube;
            var faceData = [];
            indexes.forEach(d => {
                faceData.push(data.getData(d + cubeNumber * dataPerCube));
            });

            if (faceData.length == 3) {
                // If we have a corner, we need to take into acount rotational direction for CW or CCW
                // They are not clockwise when in the front left, or back right corners (y does not affect this)
                if ((x == 0 && z == cubeSize - 1) || (x == cubeSize - 1 && z == 0)) {
                    faceData = [faceData[0], faceData[2], faceData[1]];
                }
            }
            var myCubie = new Cubie(indexes.length - 1, faceData);
            return myCubie;
        } else {
            return;
        }
    }

    this.convertStorageFormat = function (toFormat = CUBE_DATA_TYPE.Surface) {
        // Converts from one storage to another. Returns true upon success

        // Clears the error log
        errorLog = [];

        // Check if we are already in that format
        if (storageFormat === toFormat) {
            return true;
        }


        switch (storageFormat) {
            case (CUBE_DATA_TYPE.Fast):
            // Fall through
            case (CUBE_DATA_TYPE.Surface): {
                switch (toFormat) {
                    case (CUBE_DATA_TYPE.Piece): {
                        // We are going to loop through all cubie indexes, use getCubieFacesFromSurfaceIndex to get the information we need from the data
                        // and create a new data based on the indexes we got
                        var newIndexCount = cubeSize ** 3 - (cubeSize - 2) ** 3;
                        var currentIndexCount = cubeSize ** 2 * 6;
                        var totalCount = newIndexCount * cubeCount;
                        var newData = new BinaryData(23, [], totalCount);
                        for (var i = 0; i < newIndexCount; i++) {
                            var indexes = CubeData.getCubieFaceStickerIndex(i, cubeSize);
                            if (indexes.length > 3) {
                                console.log("Error");
                                return false;
                            }
                            for (var cubeN = 0; cubeN < cubeCount; cubeN++) {
                                var faceData = [];
                                indexes.forEach(d => {
                                    faceData.push(data.getData(d + cubeN * currentIndexCount));
                                });
                                var myCubie = new Cubie(indexes.length - 1, faceData);
                                if (myCubie.isValid()) {
                                    newData.setData(i + cubeN * newIndexCount, myCubie.getCode())
                                } else {
                                    errorLog.push(new CubeError("This Cubie cannot exist", cubeN, i, [true, true, true, true], "FAILED_CONVERSION"));
                                }
                            }
                        }
                        if (errorLog.length == 0) {
                            data = newData;
                            data.setDataFlag(toFormat);
                            storageFormat = toFormat;
                            return true;
                        }
                        break;
                    }
                    default: {
                        errorLog.push(new CubeError("Given storage format is invalid. Format Recieved: " + toFormat, -1, -1, [false, false, false, false], "INVALID_INPUT"));
                        return false;
                        break;
                    }
                }
                break;
            }
            case (CUBE_DATA_TYPE.Piece): {
                switch (toFormat) {
                    case (CUBE_DATA_TYPE.Fast):
                    // Fall through
                    case (CUBE_DATA_TYPE.Surface): {
                        // TODO
                        var newIndexCount = cubeSize ** 2 * 6;
                        var totalCount = newIndexCount * cubeCount;
                        var newData = new BinaryData(5, [], totalCount);

                        for (var i = 0; i < newIndexCount; i++) {
                            var face = Math.floor(i / (cubeSize ** 2));
                            var y = Math.floor((i % (cubeSize ** 2)) / cubeSize);
                            var x = (i % (cubeSize ** 2)) % cubeSize;

                            for (var cubeN = 0; cubeN < cubeCount; cubeN++) {
                                var stickerId = this.getSticker(face, x, y, cubeN);
                                var success = newData.setData(i + cubeN * newIndexCount, stickerId);
                                if (!success) {
                                    console.log(stickerId);
                                    errorLog.push(new CubeError("Error, could not set sticker durring converion", cubeN, -1, [false, false, false, false], "CONVERION_FAILURE"))
                                }
                            }
                        }
                        if (errorLog.length == 0) {
                            data = newData;
                            data.setDataFlag(toFormat);
                            storageFormat = toFormat;
                            return true;
                        }
                        break;
                    }
                    default: {
                        errorLog.push(new CubeError("Given storage format is invalid. Format Recieved: " + toFormat, -1, -1, [false, false, false, false], "INVALID_INPUT"));
                        return false;
                    }
                }
                break;
            }
            default: {
                errorLog.push(new CubeError("Cube has an unsupported storage format. Format: " + storageFormat, -1, -1, [false, false, false, false], "INVALID_DATA"));
                return false;
                break;
            }
        }

    }

    this.getErrorLog = function () {
        return errorLog.slice(0);
    }

    this.getCubeDataAsString = function (cubeNumber = 0) {
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
        var result = "CBDTA:"

        switch (storageFormat) {
            case CUBE_DATA_TYPE.Surface:
                result += "S:";
                break;
            case CUBE_DATA_TYPE.Fast:
                result += "F:";
                break;
            case CUBE_DATA_TYPE.Piece:
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

    if (data.getDataFlag() != storageFormat) {
        // If we recieve an un expected flag on the data, we need to convert it to the correct format;
        // We save the given format, change this cube's format a default one, and convert the cubies.
        var tempFormatSave = storageFormat;

        if (data.getDataFlag() == -1) {
            // If the flag was set to -1, imply it was surface data
            storageFormat = CUBE_DATA_TYPE.Surface;
        } else {
            // Else, use the flag given on the data
            storageFormat = data.getDataFlag();
        }

        this.convertStorageFormat(tempFormatSave);

        // Check if the conversion was unsuccessfull
        if (tempFormatSave != storageFormat) {
            console.info("Cube conversion failed, Data Format Recieved: " + storageFormat + " Target Format: " + tempFormatSave, errorLog)
        }

    }
}

CubeData.getFaceCoordinates = function (faceId = 0, x = 0, y = 0, z = 0) {
    // Turns 3D coordinates to relative face coordinates
    switch (faceId) {
        case (CUBE_FACE.Left):
        //Fall through
        case (CUBE_FACE.Right): {
            return { x: z, y: y };
            break;
        }
        case (CUBE_FACE.Down):
        //Fall through
        case (CUBE_FACE.Up): {
            return { x: x, y: z };
            break;
        }
        default: {
            return { x: x, y: y };
            break;
        }
    }
}

CubeData.getTouchingFaces = function (x = 0, y = 0, z = 0, cubeSize = 3) {
    // returns all touching faces, in LDB order
    var touchingFaces = [];

    if (x == 0) {
        touchingFaces.push(CUBE_FACE.Left);
    }
    if (y == 0) {
        touchingFaces.push(CUBE_FACE.Down);
    }
    if (z == 0) {
        touchingFaces.push(CUBE_FACE.Back);
    }
    if (z == cubeSize - 1) {
        touchingFaces.push(CUBE_FACE.Front);
    }
    if (y == cubeSize - 1) {
        touchingFaces.push(CUBE_FACE.Up);
    }
    if (x == cubeSize - 1) {
        touchingFaces.push(CUBE_FACE.Right);
    }

    return touchingFaces;
}

CubeData.getTouchingFacesClockwise = function (x = 0, y = 0, z = 0, cubeSize = 3) {
    // returns all touching faces, in clockwise order
    var touchingFaces = [];
    var isCW = true;

    if (x == 0) {
        touchingFaces.push(CUBE_FACE.Left);
    }
    if (y == 0) {
        touchingFaces.push(CUBE_FACE.Down);
        if (x == 0 && z == cubeSize - 1) {
            isCW = false;
        }
    }
    if (z == 0) {
        touchingFaces.push(CUBE_FACE.Back);
        if (x == cubeSize - 1) {
            isCW = false;
        }
    }
    if (z == cubeSize - 1) {
        touchingFaces.push(CUBE_FACE.Front);
    }
    if (y == cubeSize - 1) {
        touchingFaces.push(CUBE_FACE.Up);
        if (x == 0 && z == cubeSize - 1) {
            isCW = false;
        }
    }
    if (x == cubeSize - 1) {
        touchingFaces.push(CUBE_FACE.Right);
    }

    if (isCW || touchingFaces.length < 3) {
        return touchingFaces;
    }

    return [touchingFaces[0], touchingFaces[2], touchingFaces[1]];
}

CubeData.getCubieCoordinates = function (cubieIndex = 0, cubeSize = 3) {
    // Calculates the x,y,z coordinates of a cubie with a given index
    const FaceSize = cubeSize * cubeSize;
    const MiddleLayerSize = cubeSize * 2 + (cubeSize - 2) * 2;

    var x, y, z;
    if (cubieIndex < FaceSize) {
        // Left Side
        x = 0;
        y = Math.floor(cubieIndex / cubeSize);
        z = cubieIndex % cubeSize;
    } else if (cubieIndex >= FaceSize + MiddleLayerSize * (cubeSize - 2)) {
        // Right Side
        const Offset = FaceSize + MiddleLayerSize * (cubeSize - 2);
        x = cubeSize - 1;
        y = Math.floor((cubieIndex - Offset) / cubeSize);
        z = (cubieIndex - Offset) % cubeSize;
    } else if ((cubieIndex - FaceSize) % MiddleLayerSize < cubeSize) {
        // We are on the bottom middle layers
        x = Math.floor((cubieIndex - FaceSize) / MiddleLayerSize) + 1;
        y = 0;
        z = (cubieIndex - FaceSize) % MiddleLayerSize;
    } else if ((cubieIndex - FaceSize) % MiddleLayerSize >= MiddleLayerSize - cubeSize) {
        // We are on the top middle layers
        x = Math.floor((cubieIndex - FaceSize) / MiddleLayerSize) + 1;
        y = cubeSize - 1;
        z = (cubieIndex - FaceSize - (cubeSize - 2) * 2 - cubeSize) % MiddleLayerSize;
    } else {
        // We must be in the back or front middle faces
        x = Math.floor((cubieIndex - FaceSize) / MiddleLayerSize) + 1;
        y = Math.floor(((cubieIndex - FaceSize) % MiddleLayerSize - cubeSize) / 2) + 1;
        z = (((cubieIndex - FaceSize) - cubeSize) % 2) * (cubeSize - 1);
    }
    return { x: x, y: y, z: z };
}

CubeData.getCubieIndex = function (x = 0, y = 0, z = 0, cubeSize = 3) {
    // converts 3D cube coordinates to a cubie index
    // Inverse of of getCubieCoordinates
    const FaceSize = cubeSize * cubeSize;
    const MiddleLayerSize = cubeSize * 2 + (cubeSize - 2) * 2;
    if (x == 0) {
        // on left side
        return y * cubeSize + z;
    } else if (x == cubeSize - 1) {
        // on right side
        return FaceSize + MiddleLayerSize * (cubeSize - 2) + y * cubeSize + z;
    } else if (y == 0) {
        // on the bottom side in the middle
        return FaceSize + MiddleLayerSize * (x - 1) + z;
    } else if (y == cubeSize - 1) {
        // on the top side in the middle
        // Cubies on\/left middle cubie layers \/ bottom \/strip     \/cubies bewteen top and bottom
        return FaceSize + MiddleLayerSize * (x - 1) + cubeSize + (cubeSize - 2) * 2 + z;
    } else if (z == 0) {
        // on the back
        return FaceSize + MiddleLayerSize * (x - 1) + cubeSize + (y - 1) * 2;
    } else if (z == cubeSize - 1) {
        // on the front
        return FaceSize + MiddleLayerSize * (x - 1) + cubeSize + (y - 1) * 2 + 1;
    }
    return -1;
}

CubeData.get3DCoordinates = function (faceId = 0, x = 0, y = 0, cubeSize = 3) {
    // Inverse of getFaceCoordinates
    var cx, cy, cz; //  stands for cubie x, cubie y...
    switch (faceId) {
        case (CUBE_FACE.Left): {
            cx = 0;
            cy = y;
            cz = x;
            break;
        }
        case (CUBE_FACE.Down): {
            cx = x;
            cy = 0;
            cz = y;
            break;
        }
        case (CUBE_FACE.Back): {
            cx = x;
            cy = y;
            cz = 0;
            break;
        }
        case (CUBE_FACE.Front): {
            cx = x;
            cy = y;
            cz = cubeSize - 1;
            break;
        }
        case (CUBE_FACE.Up): {
            cx = x;
            cy = cubeSize - 1;
            cz = y;
            break;
        }
        case (CUBE_FACE.Right): {
            cx = cubeSize - 1;
            cy = y;
            cz = x;
            break;
        }
    }
    return { x: cx, y: cy, z: cz };
}

CubeData.getCubieFaceStickerIndex = function (cubieIndex = 0, cubeSize = 3) {
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

    if (touchingFaces.length == 6) {
        // Whole Cube, This should not happen unless we have a 1 by 1 cube, but just in case
        return [0, 1, 2, 3, 4, 5];
    } else if (touchingFaces.length == 1) {
        // Center
        var face1 = CubeData.getFaceCoordinates(touchingFaces[0], x, y, z);
        return [FaceSize * touchingFaces[0] + face1.y * cubeSize + face1.x];
    } else if (touchingFaces.length == 2) {
        // Edge
        var face1 = CubeData.getFaceCoordinates(touchingFaces[0], x, y, z);
        var face2 = CubeData.getFaceCoordinates(touchingFaces[1], x, y, z);
        return [FaceSize * touchingFaces[0] + face1.y * cubeSize + face1.x, FaceSize * touchingFaces[1] + face2.y * cubeSize + face2.x];
    } else if (touchingFaces.length == 3) {
        // Corner
        // isClockwise tells us that if the corner faces are ordered in LDB order, are they clockwise?
        // They are not clock wise when in the front left, or back right corners (y does not affect this)
        var isClockwise = true;
        if ((x == 0 && z == cubeSize - 1) || (x == cubeSize - 1 && z == 0)) {
            isClockwise = false;
        }

        if (isClockwise) {
            var face1 = CubeData.getFaceCoordinates(touchingFaces[0], x, y, z);
            var face2 = CubeData.getFaceCoordinates(touchingFaces[1], x, y, z);
            var face3 = CubeData.getFaceCoordinates(touchingFaces[2], x, y, z);
            return [FaceSize * touchingFaces[0] + face1.y * cubeSize + face1.x, FaceSize * touchingFaces[1] + face2.y * cubeSize + face2.x, FaceSize * touchingFaces[2] + face3.y * cubeSize + face3.x];
        } else {
            var face1 = CubeData.getFaceCoordinates(touchingFaces[0], x, y, z);
            var face2 = CubeData.getFaceCoordinates(touchingFaces[2], x, y, z);
            var face3 = CubeData.getFaceCoordinates(touchingFaces[1], x, y, z);
            return [FaceSize * touchingFaces[0] + face1.y * cubeSize + face1.x, FaceSize * touchingFaces[2] + face2.y * cubeSize + face2.x, FaceSize * touchingFaces[1] + face3.y * cubeSize + face3.x];
        }
    }

    return [];
}

CubeData.parseCubeString = function (value = "") {
    // Decodes a cube from a string, see getCubeDataAsString for format definition
    var parts = value.split(":");

    if (parts.length != 4 || parts[0] != "CBDTA") {
        throw  "Invalid string";
        return null;
    }

    var format = -1;

    switch (parts[1]) {
        case "S":
            format = CUBE_DATA_TYPE.Surface;
            break;
        case "F":
            format = CUBE_DATA_TYPE.Fast;
            break;
        case "P":
            format = CUBE_DATA_TYPE.Piece;
            break;
        default:
            console.info("Invalid format '" + parts[1] + "' for cube");
            return null;
            break;
    }

    var cubeSize = parseInt(parts[2], 16);

    var decodedArray = [];
    for (var i = 0; i < parts[3].length; i++) {
        decodedArray.push(parseInt(parts[3][i], 24));
    }

    // Calculate the data size for a cube as we are not sure which it is
    var tmpCube = new CubeData(cubeSize, 1, format);
    var maxDataSize = tmpCube.getCubeData().getMaxElementSize();

    // Create the binary data for the cube
    var newBinData = new BinaryData(maxDataSize, decodedArray, decodedArray.length, format);

    return new CubeData(cubeSize, 1, format, newBinData);

}

CubeData.getOrbitNumber = function (cubieIndex = 0, cubeSize = 3) {
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

    function getOnionLayer(c = { x: 0, y: 0 }) {
        if (isOdd) {
            return Math.max(Math.abs(c.x - center), Math.abs(c.y - center));
        } else {
            var x = c.x < center ? c.x - center + 1 : c.x - center;
            var y = c.y < center ? c.y - center + 1 : c.y - center;
            return Math.max(Math.abs(x), Math.abs(y));
        }
    }


    function getDistanceFromMidLayer(c = { x: 0, y: 0 }) {
        if (isOdd) {
            return Math.min(Math.abs(c.x - center), Math.abs(c.y - center));
        } else {
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
CubeData.verifyCube = function (cubeData, cubeNumber = 0) {
    // Checks if the cube is a possible configuration of a cube
    // INCOMPLETE
    // For now, it just makes sure there is the correct amount of each piece

    // First convert the given cube to a piece type
    // If the conversion fails, return why
    var cubeSize = cubeData.getCubeSize();
    var testData = new CubeData(cubeSize, 1, CUBE_DATA_TYPE.Piece, cubeData.getCubeData(cubeNumber));
    var testErrorLog = testData.getErrorLog();
    const isOdd = cubeSize % 2 == 1;
    const FaceSize = cubeSize ** 2;

    // If there are errors in the error log, the conversion failed and the log explains why
    if (testErrorLog.length > 0) {
        return { passed: false, errors: testErrorLog };
    }

    /**@param {number}type */
    function getCountOfType(type) {
        if (isTriNum(type)) {
            if (isOdd) {
                if (type == 0) {
                    return 1;
                } else {
                    return 4;
                }
            } else {
                if (type == 0) {
                    return 4;
                } else {
                    return 8;
                }
            }
        } else if (isTriNum(type + 1)) {
            return 4;
        } else {
            return 8;
        }
    }

    /**@param {number}num */
    function isTriNum(num) {
        // We can tell if it is a triangle number
        // By putting it through the inverse function
        // If a whole number comes out, then it is
        // a triangle number, if not then it isn't

        if (num < 0) {
            // Make sure we don't take the sqrt of a negative number
            return false;
        }
        var inv = inverseTriNum(num);
        if (inv % 1 == 0) {
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
    for (var i = 0; i < orbitCount; i++) {
        orbitColorCounter.push([0, 0, 0, 0, 0, 0]);
        orbitExpectedCount.push(getCountOfType(i));
    }

    // Go through each index of the cube and count colors at each location
    // and add these to the orbit color counts.
    // We expect that there should be the expectedCount of each color, else
    // the cube is invalid

    // We will loop through 1 face worth of indecies to count each color
    for (var i = 0; i < cubeSize * cubeSize; i++) {
        var x = i % cubeSize;
        var y = Math.floor(i / cubeSize);
        // In this case we just pretend we are using a cubie from the left side as
        // Those cubies are aranged just as a face is
        var orbitType = CubeData.getOrbitNumber(i, cubeSize);

        // Loop through each side at that location to get the color and add it to the counter
        for (var face = 0; face < 6; face += 1) {
            var sColor = testData.getSticker(face, x, y);
            orbitColorCounter[orbitType][sColor]++;
        }
    }

    // Check for correct counts, if something is not right, start making an error log
    for (var i = 0; i < orbitCount; i++) {
        var expCount = orbitExpectedCount[i];
        var orbitGood = true;
        /**@type {number[]} */
        var errorColors = [];
        for (var color = 0; color < 6; color++) {
            if (orbitColorCounter[i][color] != expCount) {
                orbitGood = false;
                errorColors.push(color);
            }
        }

        if (!orbitGood) {// A mismatch was found, report errors for every cubie in the orbit with the affected colors
            for (var j = 0; j < cubeSize ** 3 - (cubeSize - 2) ** 3; j++) {
                if (CubeData.getOrbitNumber(j, cubeSize) == i) {
                    // Verify the cubie has one of the affected colors and highlight those sides (once supported)
                    var cubieCoords = CubeData.getCubieCoordinates(j, cubeSize);
                    var testCubie = testData.getCubie(cubieCoords.x, cubieCoords.y, cubieCoords.z);
                    for (var k = 0; k < errorColors.length; k++) {
                        if (testCubie.getFaces().includes(errorColors[k])) {
                            testErrorLog.push(new CubeError("This sticker may be incorrect", 0, j, [true, true, true, true], "ORBITCOUNT_FAILURE"));
                            break;
                        }
                    }
                }
            }
        }
    }

    if (testErrorLog.length > 0) {
        return { passed: false, errors: testErrorLog };
    }
    // TODO more verification tests for testing solvibility
    return { passed: true, errors: [] };

}

/*
class Cubie
-----------------
- faces:[int, int, int]
- cubieCode:int
- valid:bool
- type:CUBIE_TYPE
------------------
Cubie(type:CUBIE_TYPE, faces:[int, int, int]):Cubie
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

function Cubie(type=CUBIE_TYPE.Center, faces=[0, 0, 0], cubieCode=255) {

    this.getFace = function (face=0) {
        if (face > type) {
            // 255 is our error value
            return 255;
        }
        return faces[face];
    }

    this.getFaces = function () {
        // return a copy of the array to avoid giving away private variables
        return faces.slice(0);
    }

    this.setFace = function (face=0, value=0) {
        // Verify both the face and value are valid, if they are, set the face to value
        // Returns true if it was successful false otherwise.
        if (face > type || face < 0 || face % 1 != 0) {
            if (shouldLogErrors) {
                console.log("Could not set face on cubie, invalid face")
            }
            return false;
        }

        if (value > 5 || value < 0 || value % 1 != 0) {
            value = 0;
            if (shouldLogErrors) {
                console.log("Could not set face on Cubie, invalid value given")
            }
            return false;
        }

        faces[face] = value;

        validate();
        return true;
    }

    this.setFaces = function (values=[0, 0, 0]) {
        // Verify we have enough values and all faces are within the valid range
        if (values.length < type) {
            if (shouldLogErrors) {
                console.log("Could not set faces on Cubie, not enough vaules given");
            }
            return false;
        }
        for (var i = 0; i <= type; i++) {
            if (values[i] > 5 || faces[i] < 0 || faces[i] % 1 != 0) {
                if (shouldLogErrors) {
                    console.log("Could not set faces on Cubie, invalid vaule(s) given");
                }
                return false;
            }
        }

        // set the values to face
        for (var i = 0; i <= type; i++) {
            faces[i] = values[i];
        }

        validate();
        return true;

    }

    this.isValid = function () {
        return valid;
    }

    this.getCode = function () {
        // Returns the cubieCode which includes the orientation of the piece
        if (!valid) {
            return 255;
        }
        return cubieCode;
    }

    this.setCode = function (code=0) {
        // Decodes the code
        if (code < 24 && code >= 0 && code % 1 === 0) {
            if (type === CUBIE_TYPE.Center) {
                faces = [code % 6];
                code %= 6;
            } else {
                var face1 = Math.floor(code / 4);
                var face2Index = code % 4;
                var possibleFaces = getPossiblePartnerValues(face1);
                var face2 = possibleFaces[face2Index];
                if (type === CUBIE_TYPE.Edge) {
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

    this.getType = function () {
        return type;
    }

    this.getPieceCode = function () {
        // Returns the cubieCode without orientation data
        // We do this by locating the LDB face (when solved) and returning the cubie code from that
        var minFace = 0;

        if (!valid) {
            return 255;
        }

        if (type == CUBIE_TYPE.Center) {
            return cubieCode;
        }

        if (type == CUBIE_TYPE.Edge) {

            var pFaces = [faces[0], faces[1]];
            // p indcates pusdo face, we pass it to get get the code.

            if (faces[0] > faces[1]) {
                pFaces = [faces[1], faces[0]];
            }

            var partnerFaceIndex = -1;
            var possibleFaces = getPossiblePartnerValues(pFaces[0]);
            for (var i = 0; i < possibleFaces.length; i++) {
                if (possibleFaces[i] === pFaces[1]) {
                    partnerFaceIndex = i;
                    break;
                }
            }
            return pFaces[0] * 4 + partnerFaceIndex;
        }

        if (type == CUBIE_TYPE.Corner) {

            var pFaces = faces.slice(0);
            // p indcates pusdo face, we pass it to get get the code.

            if (faces[1] < faces[0] && faces[1] < faces[2]) {
                pFaces = [faces[1], faces[2], faces[0]];
            }

            if (faces[2] < faces[0] && faces[2] < faces[1]) {
                pFaces = [faces[2], faces[0], faces[1]];
            }


            var partnerFaceIndex = -1;
            var possibleFaces = getPossiblePartnerValues(pFaces[0]);
            for (var i = 0; i < possibleFaces.length; i++) {
                if (possibleFaces[i] === pFaces[1]) {
                    partnerFaceIndex = i;
                    break;
                }
            }
            return pFaces[0] * 4 + partnerFaceIndex;
        }
    }

    this.rotate = function (times=1) {
        // Rotates the cubie Clockwise
        if (times < 0) {
            throw "You can only rotate cubies in the positve direction!";
        }
        switch (type) {
            case CUBIE_TYPE.Edge: {
                if (times % 2 == 1)
                    faces = [faces[1], faces[0]];
                validate();
                return true;
            }
            case CUBIE_TYPE.Corner: {
                if (times % 3 == 1) {
                    faces = [faces[2], faces[0], faces[1]];
                } else if (times % 3 == 2) {
                    faces = [faces[1], faces[2], faces[0]];
                }
                validate();
                return true;
            }
            default: {
                // Centers can't really be rotated (yet...)
                return true;
                break;
            }
        }
    };

    function validate() {
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
        if (type == CUBIE_TYPE.Center) {
            // Centers are always valid as long as faces stay with in the needed range
            valid = true;
            cubieCode = faces[0];
        }
        else if (type == CUBIE_TYPE.Edge) {
            // See if the two faces can go together
            var partnerFaceIndex = -1;
            var possibleFaces = getPossiblePartnerValues(faces[0]);
            for (var i = 0; i < possibleFaces.length; i++) {
                if (possibleFaces[i] === faces[1]) {
                    partnerFaceIndex = i;
                    break;
                }
            }

            if (partnerFaceIndex === -1) {
                valid = false;
                cubieCode = 255;
            } else {
                valid = true;
                cubieCode = faces[0] * 4 + partnerFaceIndex;
            }

        }
        else if (type == CUBIE_TYPE.Corner) {
            // See if the first two faces can go together
            var partnerFaceIndex = -1;
            var possibleFaces = getPossiblePartnerValues(faces[0]);
            for (var i = 0; i < possibleFaces.length; i++) {
                if (possibleFaces[i] === faces[1]) {
                    partnerFaceIndex = i;
                    break;
                }
            }

            // Check if the last face is a the expected face, if not, this is not a valid cubie
            if (partnerFaceIndex != -1 && faces[2] === getLastFace(faces[0], faces[1])) {
                valid = true;
                cubieCode = faces[0] * 4 + partnerFaceIndex;
            } else {
                valid = false;
                cubieCode = 255;
            }
        }
    }

    function getPossiblePartnerValues(value=CUBE_FACE.Left) {
        // Returns possible adjacent sides given a face id
        switch (value) {
            case (CUBE_FACE.Right):
            // Fall through
            case (CUBE_FACE.Left): {
                return [CUBE_FACE.Down, CUBE_FACE.Back, CUBE_FACE.Front, CUBE_FACE.Up];
                break;
            }
            case (CUBE_FACE.Up):
            // Fall through
            case (CUBE_FACE.Down): {
                return [CUBE_FACE.Left, CUBE_FACE.Back, CUBE_FACE.Front, CUBE_FACE.Right];
                break;
            }
            case (CUBE_FACE.Front):
            // Fall through
            case (CUBE_FACE.Back): {
                return [CUBE_FACE.Left, CUBE_FACE.Down, CUBE_FACE.Up, CUBE_FACE.Right];
                break;
            }
            default: {
                return [-1, -1, -1, -1];
                break;
            }
        }
    }

    function getLastFace(value1=0, value2=0) {
        // Given two face values, it will give the 3rd face's value for a corner
        // We first create a list of valid combinations of of faces, then we see if value 1 and value 2
        // Match up in any of them and return the 3rd value. Order matters, these arrays "wrap"
        const VALID_COMBOS = [
            [CUBE_FACE.Left, CUBE_FACE.Down, CUBE_FACE.Back],
            [CUBE_FACE.Left, CUBE_FACE.Front, CUBE_FACE.Down],
            [CUBE_FACE.Left, CUBE_FACE.Back, CUBE_FACE.Up],
            [CUBE_FACE.Left, CUBE_FACE.Up, CUBE_FACE.Front],
            [CUBE_FACE.Down, CUBE_FACE.Right, CUBE_FACE.Back],
            [CUBE_FACE.Down, CUBE_FACE.Front, CUBE_FACE.Right],
            [CUBE_FACE.Back, CUBE_FACE.Right, CUBE_FACE.Up],
            [CUBE_FACE.Front, CUBE_FACE.Up, CUBE_FACE.Right]];

        for (var i = 0; i < 8; i++) {
            for (var j = 0; j < 3; j++) {
                if (VALID_COMBOS[i][j] == value1 && VALID_COMBOS[i][(j + 1) % 3] == value2) {
                    return VALID_COMBOS[i][(j + 2) % 3];
                }
            }
        }

        return -1;
    }

    var valid = false;

    // Verify type is with in range, if not, default to 0
    if (type < 0 || type > 2 || type % 1 != 0) {
        type = 0;
    }

    // If we recieved a valid cubieCode, decode it
    if (cubieCode < 24 && cubieCode >= 0 && cubieCode % 1 === 0) {
        this.setCode(cubieCode);
    }

    // Create a copy of the array to avoid accidental changes to it
    if (faces.length > 0) {
        faces = faces.slice(0);
    } else {
        faces = [0];
    }


    // Verify we have enough faces, if not add them
    while (faces.length - 1 < type) {
        faces.push(0);
    }
    // Verify all faces are with in the valid range
    for (var i = 0; i <= type; i++) {
        if (faces[i] > 5 || faces[i] < 0 || faces[i] % 1 != 0) {
            faces[i] = 0;
        }
    }

    validate();

}

/*
        class CubeError
        ---------------
        userReadableError:string
        affectedCube:CubeData
        affectedCubie:int
        affectedFaces:[bool, bool, bool]
        errorType:string
        ----------------
        CubeError(userReadableError:str, affectedCube:CubeData, affectedCubie:int, affectedFaces:[bool, bool, bool, bool], errorType:str):CubeError
        */

function CubeError(userReadableError="", affectedCube=-1, affectedCubie=-1, affectedFaces=[false, false, false, false], errorType="") {
    this.userReadableError = userReadableError;
    this.affectedCube = affectedCube;
    this.affectedCubie = affectedCubie;
    this.affectedFaces = affectedFaces.slice(0);
    this.errorType = errorType;
}

/**@param {number}x */
function triNum(x) {
    // Returns the triangle number of x
    // Used in orbit Identification of a cube
    return 0.5 * (x ** 2) + 0.5 * x;
}

/**@param {number}y */
function inverseTriNum(y) {
    // Returns the positive inverse of a triangle number
    // useful for identifying triangle numbers
    return (-0.5 + Math.sqrt(0.25 - 2 * (-y)));
}


function generateSolvedCubeBinaryData(size=3, count=1) {
    // Generates Solved Binary data for Surface Type cubes. Since the data
    // is flagged as Surface type, if is given to any other format of cube data, it will
    // automatically be converted as the flag will be detected
    var dataArray = [];
    for (var i = 0; i < 6; i++) {
        for (var j = 0; j < size * size; j++) {
            dataArray.push(i);
        }
    }
    var dataCountPerCube = dataArray.length;
    var binData = new BinaryData(5, [], dataCountPerCube * count, CUBE_DATA_TYPE.Surface)
    for (var i = 0; i < count; i++) {

        binData.setArray(dataCountPerCube * i, dataArray);
    }
    return binData;
}
export { CubeData, CubeError, Cubie };