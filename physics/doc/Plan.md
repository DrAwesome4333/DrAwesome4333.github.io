Physics Engine breakdown:

    Rendering:
        Use 2D HTML 5 canvas for rendering polygons of any color, y axis will be flipped to maintain right handed ness.

    Math Module:
        Create a modlue to handle points, lines and polygons
        Point:
            defined by an x and y coordinate
        Vector:
            defined by an x and y component, magnitude and unit vector are readable parts of this object
        Line: 
            Defined by 2 points or by a point and a vector

        Polygon: 
            Defined by 3 or more points in CCW order

    Detecting Collisions between polygons:
        Step 1:✅
            Check if the polygons max and min coordinates overlap
        Step 2:✅
            Check for intersecting lines between the 2 shapes, determine location of intersections.
        Step 3:〰
            React (for testing, this will be a color change)


