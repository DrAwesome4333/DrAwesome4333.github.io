// @ts-check

/**
 * @param {number} x 
 * @param {number} y 
 */
class Point {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.type = "Point";
    }
}

/**
 * @param {number} x 
 * @param {number} y 
 */
class Vector {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.type = "Vector";
    }

    get mag(){
        return Math.sqrt((this.x ** 2 + this.y ** 2));
    }

    set mag(val){
        var vec = this.direction;
        this.x = vec.x * val;
        this.y = vec.y * val;
    }

    get direction(){
        var mag = this.mag;
        if (mag == 0)
            return new Vector(0, 0);
        return new Vector(this.x / mag, this.y / mag);
    }

    set direction(val){
        var mag = this.mag;
        var vec = val.direction;
        this.x = vec.x * mag;
        this.y = vec.y * mag;
    }

    /**
     * @param {Vector} v1
     * @param {Vector} v2
     */
    static dot(v1, v2) {
        return v1.x * v2.x + v1.y * v2.y;
    }
}



/**
 * @param {Point} p1 
 * @param {Point | Vector} p2 
 */
class Line {
    constructor(p1, p2) {
        this.p1 = p1;
        if (p2.type == "Vector") {
            this.p2 = new Point(p1.x + p2.x, p1.y + p2.y);
        } else {
            this.p2 = p2;
        }

        //this.v = new Vector(this.p2.x - this.p1.x, this.p2.y - this.p1.y);
    }

    /**
     * @param {Vector} val
     */
    set v(val){
        this.p2.x = this.p1.x + val.x;
        this.p2.y = this.p1.y + val.y;
    }

    get v(){
        return new Vector(this.p2.x - this.p1.x, this.p2.y - this.p1.y);
    }

    valueAt = function (/** @type {number} */ t) {
        if (isFinite(t)) {
            var x = this.v.x * t + this.p1.x;
            var y = this.v.y * t + this.p1.y;
            return new Point(x, y);
        }

        return new Point(NaN, NaN);

    }

    /**
     * @param {Line} l1
     * @param {Line} l2
     * @return {{point:Point, t:number}}
     */
    static getIntersect(l1, l2) {
        //Returns the point of intersection as well as
        // the parametric t of one line where the intersection occurs
        /*
            The math here cheats a bit by
            thinking of l2 as a 2d plane where the z
            component of the normal is 0 and then uses
            the cross product to calculate a normal perpendicular
            to this fake plane. So pv = vector (l2.v.y, -l2.v.x)
            We then use
            some algebra to break the equation down to
            the point of intersection being
            t = -dot(pv, vector(l1.p - l2.p)) / dot(l1.v, pv)
            if 0 <= t <= 1 then the line segments intersect
        */
        const dot = Vector.dot;
        var pv = new Vector(l2.v.y, -l2.v.x); //plane vector
        var v3 = new Vector(l1.p1.x - l2.p1.x, l1.p1.y - l2.p1.y);
        var dotl1pv = dot(l1.v, pv);
        if (dotl1pv == 0) { // The lines are parallel and do not have an intersection
            return { point: new Point(NaN, NaN), t: NaN };
        }
        var t = -dot(pv, v3) / dotl1pv;
        var intersectionPt = l1.valueAt(t);
        return {
            point: intersectionPt,
            t: t
        };


    }
}



class Polygon {
    /**
     * @param  {...Point} points 
     */
    constructor(...points) {
        this.points = points;
    }

    get center(){
        var x = 0;
        var y = 0;
        this.points.forEach(
            (p) => {
                x += p.x;
                y += p.y;
            }
        )

        x /= this.points.length;
        y /= this.points.length;
        return new Point(x, y);
    }

    set center(val){
        var oCenter = this.center;
        var offSetVec = new Vector(val.x - oCenter.x, val.y - oCenter.y);
        this.points.forEach((p) => {
            p.x += offSetVec.x;
            p.y += offSetVec.y;
        })
    }

    get diagonal(){
        var minX = Infinity;
        var maxX = -Infinity;
        var minY = Infinity;
        var maxY = -Infinity;
        this.points.forEach(
            (p) => {
                minX = Math.min(minX, p.x);
                minY = Math.min(minY, p.y);
                maxX = Math.max(maxX, p.x);
                maxY = Math.max(maxY, p.y);
                
            }
        )

        return new Line(new Point(minX, minY), new Point(maxX, maxY));
    }

    /**
     * @param {Polygon} poly1 
     * @param {Polygon} poly2 
     */
    static checkCollision(poly1, poly2){
        var p1d = poly1.diagonal;
        var p2d = poly2.diagonal;
        var result = 0;

        

        var intersections = [];
        // Check if max/min boxes overlap
        if(p1d.p1.x < p2d.p2.x && p1d.p2.x > p2d.p1.x && p1d.p1.y < p2d.p2.y && p1d.p2.y > p2d.p1.y){
            result = 1;
            for(var p1i = 0; p1i < poly1.points.length; p1i ++){
                // Loop through each line of poly1 and see if it intersects with any lines on poly2
                var nextPoint = (p1i + 1) % poly1.points.length;
                var line1 = new Line(poly1.points[p1i], poly1.points[nextPoint]);

                for(var p2i = 0; p2i < poly2.points.length; p2i ++){
                    var nextPoint2 = (p2i + 1) % poly2.points.length;
                    var line2 = new Line(poly2.points[p2i], poly2.points[nextPoint2]);
                    var colRes = Line.getIntersect(line1, line2);

                    if(isFinite(colRes.t) && 0 <= colRes.t && colRes.t <= 1){
                        // We have to 2 this twice to make sure the intersection the lines
                        // is actually on both segments instead of just on line1's segment
                        var colRes2 = Line.getIntersect(line2, line1);
                        if(0 <= colRes2.t && colRes2.t <= 1){
                            intersections.push(colRes.point);
                        }
                    }
                }
            }
            
        }

        return intersections;
    }
}

export{Point, Line, Vector, Polygon};