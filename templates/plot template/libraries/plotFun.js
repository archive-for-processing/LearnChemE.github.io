//javascript main file

//2D Plotting function that spits out an array of numbers from a function
//format: functionToArray("function as string", ["independent variable", start, end, increment])
//example: functionToArray("y + 3", ["y", 1, 5, 2]); returns [[1, 4], [3, 6], [5, 8]]
function functionToArray() {
  let expr, indepVar, outArray, plotRangeMin, plotRangeMax;
  expr = arguments[0];
  indepVar = arguments[1][0];
  plotRangeMin = arguments[1][1];
  plotRangeMax = arguments[1][2];
  outArray = [];

  if (arguments[1].length==4 && isNaN(arguments[1][3]) == false) {plotRangeInc = Number(arguments[1][3])} else {plotRangeInc = Number((arguments[1][2]-arguments[1][1])/100)};

  try { 
    if(arguments.length != 2 ||
      typeof arguments[1] != "object" ||
      arguments[1].length < 3 ||
      arguments[1].length > 4)
      throw "two input arguments: 1.) a single-variate function and 2.) a 3-dimensional array for the independent variable and its respective plot range.";
  }
  catch(err) {
    console.log("function toPlot() requires " + err + " e.g. equationToArray(x + 2x + 6, [x, 0, 100])");
  }

  var i;
  for (i = plotRangeMin; i <= plotRangeMax; i += plotRangeInc) {
    outArray.push([i,
      math.eval(
        expr.replace(new RegExp(indepVar, 'g'), String(i.toPrecision(10)))
        )
      ]);
  }
return outArray;
}

//Auto-plots a pre-defined array. Optional boolean 4th argument] to include smoothing.
//Example: arrayToPlot([[0,1], [1, 0.5], [0.5, 2.3], [2.3, 4.2]], "plotName", true)
function arrayToPlot() {
  let arr, plotID, smoothing;
  let gArray = [];
  arr = arguments[0];
  plotID = arguments[1];
  smoothing = arguments[2];
  var i;

  if (smoothing == true) {
    noFill();
    beginShape();
    for (i=0; i<arr.length; i++) {
      gArray.push(plotID.mainLayer.valueToPlot(arr[i][0], arr[i][1]));
      curveVertex.apply(this, gArray[i]);
    }
    endShape();

  } else {
    for (i=0; i<arr.length; i++) {
      gArray.push(new GPoint(arr[i][0], arr[i][1]));
      plotID.addPoint(gArray[i]);
      if (i>=1) {plotID.drawLine(gArray[i-1], gArray[i]);}
    }
  }
}

//Auto-plots a function (combination of the top two functions). [Optional boolean 4th argument] to include smoothing. Example: plotFunction("s * 6.5", ["s", 1, 100, 1], "plotName", true);
function plotFunction() {
  let expr, indepVar, plotRangeMin, plotRangeMax, plotRangeInc, arr, plotID, smoothing;
  let gArray = [];

  expr = arguments[0];
  indepVar = arguments[1][0];
  plotRangeMin = arguments[1][1];
  plotRangeMax = arguments[1][2];
  plotRangeInc = arguments[1][3];
  plotID = arguments[2];
  smoothing = arguments[3];
  
  arr = functionToArray(expr, [indepVar, plotRangeMin, plotRangeMax, plotRangeInc]);
  var i;

  if (smoothing == true) {
    noFill();
    beginShape();
    for (i=0; i<arr.length; i++) {
      gArray.push(plotID.mainLayer.valueToPlot(arr[i][0], arr[i][1]));
      curveVertex.apply(this, gArray[i]);
    }
    endShape();


  } else {
    for (i=0; i<arr.length; i++) {
      gArray.push(new GPoint(arr[i][0], arr[i][1]));
      plotID.addPoint(gArray[i]);
      if (i>=1) {plotID.drawLine(gArray[i-1], gArray[i]);}
    }
  }
}

function Plot(func, indep, min, max, parentPlot, resolution) {
  if (resolution === undefined) {resolution = (max - min)/200};
  parentPlot.beginDraw();
  parentPlot.drawBackground();
  parentPlot.drawBox();
  plotFunction(func, [indep, min, max, resolution], parentPlot, true);
  parentPlot.drawLimits();
  parentPlot.drawXAxis();
  parentPlot.drawYAxis();
  parentPlot.drawTitle();
  parentPlot.endDraw();
}