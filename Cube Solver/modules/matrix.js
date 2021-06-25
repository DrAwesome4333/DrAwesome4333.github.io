// @ts-check
/*
Matrix
-----------
Matrix(matrixArray:number[]|number[][], columnMajor?:boolean):Matrix // Creates a new matrix based on the data given
* dot(matA:number[][], matB:number[][], row:int, col:int):number // Calculates the dot product between the row of matA and the column of matB, used in matrix multiplication
multiply(other:Matrix):Matrix // Returns the result of the matrix multiplied by the other matrix.
add(other:Matrix):Matrix // Returns the result of the matrix added with the other matrix.
scale(value:int):Matrix // Returns a new matrix with each of its values scaled by value from the original
determinant():number|null // Calculates and returns the determinant if possible, used by the inverse method
inverse():Matrix|null // Calculates and returns the inverse of the matrix if one exists
minors():Matrix // Calculates and returns the minor values of each location of the matrix
cofactors():Matrix // Calculates and returns the cofactors of each location of the matrix
getMultiArray(columnMajor?:boolean):number[][] // Returns the matrix as a 2D array
getArray(columnMajor?:boolean):number[] // Returns the matrix as an array
getDim():int // Returns the dimension of the matrix (since it is square, only 1 value is needed)
-----------
p matrixArray:number[]|number[][] // The values inside the matrix
p columnMajor?:boolean // If false (default) matrixArray is assumed to be stored as [row][col] or [col * dim + row], if true: [col][row] or [row * dim + col]
* dim:int // The dimension of the array, calculated based on what is given in matrixArray
* mat:number[][] // A 2D array holding the values of our matrix as [row][col]
* multiDim:boolean // Tells if the given array was multidimensional or not
-----------
*/
/**
 * @param {number[]|number[][]} matrixArray 
 * @param {boolean} columnMajor 
 */
function Matrix(matrixArray, columnMajor=false) {
    // Must be a square matrix

    // Check if it is a multi dim array
    var multiDim = (typeof matrixArray[0] == "object");
    var mat = [];// saved in row major
    var dim;

    if (!multiDim) {
        dim = Math.sqrt(matrixArray.length);
        if (dim % 1 != 0) {
            throw "Matrix must be square";
        }

        for (var row = 0; row < dim; row++) {
            mat.push([]);
            for (var col = 0; col < dim; col++) {
                mat[row].push(matrixArray[row * dim + col]);
            }
        }

    } else {
        dim = matrixArray.length;
        //@ts-ignore // It says there's an error since matrixArray[0] can be a number or an array, but .length is not on numbers
        // but we ensure that we don't access .length unless it is an array
        if (dim != matrixArray[0].length) {
            throw "Matrix must be square";
        }
        for (var row = 0; row < dim; row++) {
            mat.push([]);
            for (var col = 0; col < dim; col++) {
                mat[row].push(matrixArray[row][col]);
            }
        }
    }
    // Rearange the matrix if it was given in column major order
    if (columnMajor) {
        // row and column refer to mat's format
        for (var row = 0; row < dim; row++) {
            for (var col = 0; col < dim; col++) {
                if (multiDim) {
                    mat[row][col] = matrixArray[col][row];
                } else {
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
     * @returns {number}
     */
    function dot(matA, matB, row, col) {
        // Calculates the dot product of a row and a col of 2 matricies
        // Used in the multiply function
        var result = 0;
        for (var i = 0; i < dim; i++) {
            result += matA[row][i] * matB[i][col];
        }
        return result;
    }


    /**
     * @param {Matrix} other 
     */
    this.multiply = function (other) {
        if (dim != other.getDim()) {
            throw "Matrix dimensions do not match";
        }

        /**@type {number[][]} */
        var result = [];
        var oMat = other.getMultiArray();
        for (var row = 0; row < dim; row++) {
            result.push([]);
            for (var col = 0; col < dim; col++) {
                result[row].push(dot(mat, oMat, row, col));
            }
        }

        return new Matrix(result);
    }


    this.getDim = function () {
        return dim;
    }

    /**
     * @param {Matrix} other 
     */
    this.add = function (other) {
        var oDim = other.getDim();
        if (dim != oDim) {
            throw "Cannot add matricies of differing dimensions";
        }

        var result = other.getMultiArray();
        for (var row = 0; row < dim; row++) {
            for (var col = 0; col < dim; col++) {
                result[row][col] += mat[row][col];
            }
        }

        return new Matrix(result);
    }

    /**
     * @param {number} value 
     * @returns Matrix
     */
    this.scale = function (value) {
        var result = Matrix.getIdenity(dim).getMultiArray();

        for (var row = 0; row < dim; row++) {
            for (var col = 0; col < dim; col++) {
                result[row][col] = value * mat[row][col];
            }
        }

        return new Matrix(result);
    }


    this.determinant = function () {
        // calculates the determinant
        // We will do this recursively
        if (dim == 2) {
            return mat[0][0] * mat[1][1] - mat[0][1] * mat[1][0];
        }

        if (dim < 2) {
            // Not sure why you need a 1x1 matrix but it is possible
            return 0;
        }

        // we will use the first row as our base
        var result = 0;

        // Build a 2d array that is 1 less than our current width
        var detMatArray = Matrix.getIdenity(dim - 1).getMultiArray();

        for (var col = 0; col < dim; col++) {
            for (var subCol = 0; subCol < dim; subCol++) {
                if (subCol == col) {
                    continue;
                }
                var detArrayCol = subCol < col ? subCol : subCol - 1;
                for (var subRow = 1; subRow < dim; subRow++) {
                    detMatArray[subRow - 1][detArrayCol] = mat[subRow][subCol];
                }
            }
            var detSign = col % 2 == 0 ? 1 : -1;
            result += detSign * mat[0][col] * new Matrix(detMatArray).determinant();

        }

        return result;
    }

    this.inverse = function () {
        var det = this.determinant();
        if (det != 0) {
            return new Matrix(this.cofactors().scale(1 / det).getMultiArray(true));
        } else {
            return null;
        }
    }

    this.minors = function () {
        var result = Matrix.getIdenity(dim).getMultiArray();
        var subMat = Matrix.getIdenity(dim - 1).getMultiArray();
        for (var row = 0; row < dim; row++) {
            for (var col = 0; col < dim; col++) {
                for (var subCol = 0; subCol < dim; subCol++) {
                    if (subCol == col) {
                        continue;
                    }
                    var subMatCol = subCol < col ? subCol : subCol - 1;
                    for (var subRow = 0; subRow < dim; subRow++) {
                        if (subRow == row) {
                            continue;
                        }
                        var subMatRow = subRow < row ? subRow : subRow - 1;
                        subMat[subMatRow][subMatCol] = mat[subRow][subCol];
                    }
                }
                result[row][col] = new Matrix(subMat).determinant();
            }
        }
        return new Matrix(result);
    }

    this.cofactors = function () {
        var result = Matrix.getIdenity(dim).getMultiArray();
        var subMat = Matrix.getIdenity(dim - 1).getMultiArray();
        for (var row = 0; row < dim; row++) {
            for (var col = 0; col < dim; col++) {
                for (var subCol = 0; subCol < dim; subCol++) {
                    if (subCol == col) {
                        continue;
                    }
                    var subMatCol = subCol < col ? subCol : subCol - 1;
                    for (var subRow = 0; subRow < dim; subRow++) {
                        if (subRow == row) {
                            continue;
                        }
                        var subMatRow = subRow < row ? subRow : subRow - 1;
                        subMat[subMatRow][subMatCol] = mat[subRow][subCol];
                    }
                }
                var detSign = (col + row) % 2 == 0 ? 1 : -1;
                result[row][col] = detSign * new Matrix(subMat).determinant();
            }
        }
        return new Matrix(result);
    }

    this.getMultiArray = function (columnMajor=false) {
        var result = [];
        if (columnMajor) {
            // row and column refer to mat's format
            for (var col = 0; col < dim; col++) {
                result.push([]);
                for (var row = 0; row < dim; row++) {
                    result[col].push(mat[row][col]);
                }
            }
        } else {
            // row and column refer to mat's format
            for (var row = 0; row < dim; row++) {
                result.push([]);
                for (var col = 0; col < dim; col++) {
                    result[row].push(mat[row][col]);
                }
            }
        }
        return result;
    }

    this.getArray = function (columnMajor=false) {
        var result = [];
        if (columnMajor) {
            // row and column refer to mat's format
            for (var col = 0; col < dim; col++) {
                for (var row = 0; row < dim; row++) {
                    result.push(mat[row][col]);
                }
            }
        } else {
            // row and column refer to mat's format
            for (var row = 0; row < dim; row++) {
                for (var col = 0; col < dim; col++) {
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
Matrix.getIdenity = function (dim) {
    var result = [];
    for (var row = 0; row < dim; row++) {
        result.push([]);
        for (var col = 0; col < dim; col++) {
            if (col == row) {
                result[row].push(1);
            } else {
                result[row].push(0);
            }
        }
    }
    return new Matrix(result);
}

export {Matrix};