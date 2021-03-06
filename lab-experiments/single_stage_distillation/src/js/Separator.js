class Separator {
  constructor() {
    this.columnVolume = 1; // m^3
    this.nV = 16.1886412292951; // moles of vapor in column
    this.nL = 2003.89883140267; // moles of liquid in column
    this.yA = 0.696613452862335; // mole fraction A in vapor
    this.xA = 0.303386547137665; // mole fraction A in liquid
    this.T = 455.361990495356; // Temperature of column
    this.P = 75000; // Pressure in column (Pa)
    this.level = 17.627608479123547; // Liquid level (%)

    /***** USER SPECIFIED *****/
    this.Tin = 400; // Temperature at inlet
    this.xin = 0.5; // mole fraction at inlet
    this.F = 15; // molar flowrate at inlet (mol/s)
    this.autoTemp = false;
    this.autoLevel = false;
    this.autoPressure = false;
    this.speed = 1; // animation speed
    this.codeString = "0";

    /**** Control Variables *****/
    this.L = 0.66; // Volumetric flowrate of bottoms (L / sec)
    this.Q = 500000; // heat added
    this.lift = 0.5; // lift of valve

    this.PressureController = {
      auto: false,
      bias: this.lift,
      mv: this.lift,
      Kc: 0,
      Tau: 36000,
      stpt: 75000,
      tempmv: this.lift,
      tempTau: 36000,
      tempStpt: 75000,
      tempKc: 0,
      error: 0
    };
  
    this.TemperatureController = {
      auto: false,
      bias: this.Q,
      mv: this.Q,
      Kc: 0,
      Tau: 36000,
      stpt: 500,
      tempmv: this.Q,
      tempTau: 36000,
      tempStpt: 500,
      tempKc: 0,
      error: 0
    };
    
    this.LevelController = {
      auto: false,
      bias: this.L,
      mv: this.L,
      Kc: 0,
      Tau: 36000,
      stpt: 25,
      tempmv: this.L,
      tempTau: 36000,
      tempStpt: 25,
      tempKc: 0,
      error: 0
    };

    /***** Historical Values, 1-D array *****/
    this.Fs = [this.F];
    this.Tins = [this.Tin];
    this.xins = [this.xin];
    this.powers = [this.Q / 1000];
    this.temperatures = [this.T];
    this.levels = [this.level];
    this.flowRatesOut = [this.L];
    this.pressures = [this.P / 1000];
    this.lifts = [this.lift];

    /***** Coordinates for Above Values, 2-column matrix *****/
    this.powerCoords = [[0, 0]];
    this.temperatureCoords = [[0, 0]];
    this.liquidLevelCoords = [[0, 0]];
    this.flowRatesOutCoords = [[0, 0]];
    this.pressureCoords = [[0, 0]];
    this.liftCoords = [[0, 0]];

    this.xAxisLimit = 1000;

  }

  advance() {
    const PC = this.PressureController;
    const TC = this.TemperatureController;
    const LC = this.LevelController;

    this.P = this.pressure();

    if(!PC.auto) { PC.stpt = this.lift }

    [this.lift, PC.error] = this.PI({
      Kc: PC.Kc,
      TauI: PC.Tau,
      Bias: PC.bias,
      ProcessVal: this.P,
      MV: this.lift,
      SetPoint: PC.stpt,
      AccumErr: PC.error,
      Auto: PC.auto
    });
    this.lift = Math.min(1, this.lift);
    PC.mv = Number(Number(this.lift).toFixed(2));

    if(!TC.auto) { TC.stpt = this.Q }

    [this.Q, TC.error] = this.PI({
      Kc: TC.Kc,
      TauI: TC.Tau,
      Bias: TC.bias,
      ProcessVal: this.T,
      MV: this.Q,
      SetPoint: TC.stpt,
      AccumErr: TC.error,
      Auto: TC.auto
    });

    this.Q = Math.min(1e6, this.Q);
    TC.mv = this.Q - this.Q % 100;

    this.level = 100 * this.nL / this.density();

    if(!LC.auto) { LC.stpt = this.L }

    [this.L, LC.error] = this.PI({
      Kc: LC.Kc,
      TauI: LC.Tau,
      Bias: LC.bias,
      ProcessVal: this.level,
      MV: this.L,
      SetPoint: LC.stpt,
      AccumErr: LC.error,
      Auto: LC.auto
    });

    this.L = Math.min(10, this.L);
    LC.mv = Number(Number(this.L).toFixed(2));

    for (let i = 0; i < 4; i++) {
      let dx = this.flash();
      this.nV += 0.25 * dx.dnV;
      this.nL += 0.25 * dx.dnL;
      this.xA += 0.25 * dx.dxA;
      this.yA += 0.25 * dx.dyA;
      this.T += 0.25 * dx.dT;
    }

    this.powers.push(this.Q / 1000);
    this.temperatures.push(this.T);
    this.levels.push(this.level);
    this.flowRatesOut.push(this.L);
    this.pressures.push(this.P / 1000);
    this.lifts.push(this.lift);
    this.Fs.push(this.F);
    this.Tins.push(this.Tin);
    this.xins.push(this.xin);

    if(this.temperatures.length > this.xAxisLimit) { this.powers.shift(); this.temperatures.shift(); }
    if(this.levels.length > this.xAxisLimit) { this.levels.shift(); this.flowRatesOut.shift(); }
    if(this.pressures.length > this.xAxisLimit) { this.pressures.shift(); this.lifts.shift(); }

    this.updateDOM();
  }

  createCoords() {
    // Multfactor is because y-coordinates are drawn according to left axis, not right
    const map = (y1axes, y2axes, value) => {
      const frac = (value - y2axes[0]) / (y2axes[1] - y2axes[0]);
      const mappedValue = frac * (y1axes[1] - y1axes[0]) + y1axes[0];
      return mappedValue;
    };

    const minMax = (array) => {
      let min = array[0];
      let max = array[0];
      for (let i = 0; i < array.length; i++) {
        min = Math.min(array[i], min);
        max = Math.max(array[i], max);
      }
      min *= 0.9;
      max *= 1.1;
      return [min, max];
    }

    const coords = (arrIn, arrOut, y1Axes, y2Axes, useMap) => {
      let arr = [];
      if(useMap) {
        for (let i = 0; i < arrIn.length; i++) {
          arrOut[i] = [-i, map(y1Axes, y2Axes, arrIn[arrIn.length - i - 1])];
        };
      } else {
        for (let i = 0; i < arrIn.length; i++) {
          arrOut[i] = [-i, arrIn[arrIn.length - i - 1]];
        };
      }
    };

    // Update axes limits, then convert the values to coordinates, then update the plotted array

    let powerMinMax = minMax(this.powers);
    powerMinMax[0] -= powerMinMax[0] % 10; // round down to nearest 10
    powerMinMax[1] += (10 - powerMinMax[1] % 10); // round up to nearest 10
    graphics.TPlot.rightLims = powerMinMax;
    coords(this.powers, this.powerCoords, graphics.TPlot.yLims, graphics.TPlot.rightLims, true);
    graphics.TPlot.funcs[1].update(this.powerCoords);

    let flowRateOutMinMax = minMax(this.flowRatesOut);
    flowRateOutMinMax[0] -= flowRateOutMinMax[0] % 0.01;
    flowRateOutMinMax[1] += (0.01 - flowRateOutMinMax[1] % 0.01);
    graphics.LPlot.rightLims = flowRateOutMinMax;
    coords(this.flowRatesOut, this.flowRatesOutCoords, graphics.LPlot.yLims, graphics.LPlot.rightLims, true);
    graphics.LPlot.funcs[1].update(this.flowRatesOutCoords);

    let liftMinMax = minMax(this.lifts);
    liftMinMax[0] -= liftMinMax[0] % 0.01;
    liftMinMax[1] += (0.01 - liftMinMax[1] % 0.01);
    graphics.PPlot.rightLims = liftMinMax;
    coords(this.lifts, this.liftCoords, graphics.PPlot.yLims, graphics.PPlot.rightLims, true);
    graphics.PPlot.funcs[1].update(this.liftCoords);

    let tempMinMax = minMax(this.temperatures);
    tempMinMax[0] -= tempMinMax[0] % 10;
    tempMinMax[1] += (10 - tempMinMax[1] % 10);
    graphics.TPlot.yLims = tempMinMax;
    coords(this.temperatures, this.temperatureCoords, 0, 0, false);
    graphics.TPlot.funcs[0].update(this.temperatureCoords);

    let levelMinMax = minMax(this.levels);
    levelMinMax[0] -= levelMinMax[0] % 1;
    levelMinMax[1] += (1 - levelMinMax[1] % 1);
    graphics.LPlot.yLims = levelMinMax;
    coords(this.levels, this.liquidLevelCoords, 0, 0, false);
    graphics.LPlot.funcs[0].update(this.liquidLevelCoords);

    let pressureMinMax = minMax(this.pressures);
    pressureMinMax[0] -= pressureMinMax[0] % 1;
    pressureMinMax[1] += (1 - pressureMinMax[1] % 1);
    graphics.PPlot.yLims = pressureMinMax;
    coords(this.pressures, this.pressureCoords, 0, 0, false);
    graphics.PPlot.funcs[0].update(this.pressureCoords);

    const secondsPassed = this.pressures.length;
    const resizeArray = [60, 120, 200, 300, 400, 500, 1000];
    let xAxisSize = 60;
    for(let i = 0; i < resizeArray.length - 1; i++) {
      if(secondsPassed > resizeArray[i]) {
        xAxisSize = resizeArray[i + 1]
      }
    }
    const xLims = [-xAxisSize, 0];
    graphics.TPlot.xLims = xLims;
    graphics.PPlot.xLims = xLims;
    graphics.LPlot.xLims = xLims;
  }

  // Density of the liquid in column
  density() {
    const rho1 = 10927; // mol/m^3
    const rho2 = 11560;
    const rhoAvg = this.xA * rho1 + rho2 * (1 - this.xA);
    return rhoAvg;
  }

  flash() {
    const zero = Number.MIN_VALUE;

    this.nV = Math.max(zero, this.nV);
    this.nL = Math.max(zero, this.nL);
    this.yA = Math.min(1, Math.max(zero, this.yA));
    this.xA = Math.min(1, Math.max(zero, this.xA));
    this.T =  Math.max(zero, this.T);
    this.P = this.pressure();

    const D = this.valve(); // distillate flow rate, mol / s
    const B = this.L * this.density() / 1000; // bottoms flow rate, mol / s

    const Cp = 190; // J / mol
    const heatVapA = 43290; // heat of vaporization, J / mol
    const heatVapB = 51000;

    const NA = this.fluxA();
    const NB = this.fluxB();

    let dnV = (NA + NB) - D;
    let dyA = (NA - this.yA * (NA + NB)) / this.nV;
    let dnL = this.F - (NA + NB) - B;
    let dxA = (this.F * (this.xin - this.xA) - NA + this.xA * (NA + NB)) / this.nL;
    let dT = (Cp * this.F * ( this.Tin - this.T ) + this.Q - heatVapA * NA - heatVapB * NB) / ( Cp * (this.nV + this.nL) );

    let d = [];
    // No values can go below 0; xA and yA must be less than 1
    [[this.nV, dnV], [this.nL, dnL], [this.yA, dyA], [this.xA, dxA], [this.T, dT]].forEach((pair, i) => {
      let d0;
      if(pair[0] + pair[1] < zero) {
        d0 = 0;
      } else { d0 = pair[1] }
      if(i == 2 || i == 3) {
        if(pair[0] + pair[1] > 1) {
          d0 = 0;
        } else {
          d0 = pair[1]
        }
      }
      d.push(d0);
    });
    
    return {
      dnV : d[0],
      dnL : d[1],
      dyA : d[2],
      dxA : d[3],
      dT : d[4]
    }
  }

  // Molar flow rate of A from liquid to vapor
  fluxA() {
    const KA = 10; // mol / (sec*m^2)
    const A = 5; // m^2 / m^2
    const NA = this.xA * KA * A * (this.pSatA() * this.xA / this.P - this.yA) * this.nL / this.density();
    return NA;
  }

  // Molar flow rate of B from liquid to vapor
  fluxB() {
    const KB = 6; // mol / (sec*m^2)
    const A = 5; // m^2 / m^2
    const NB = (1 - this.xA) * KB * A * (this.pSatB() * (1 - this.xA) / this.P - (1 - this.yA)) * this.nL / this.density();
    return NB;
  }

  PI(args) {
    const Kc = args.Kc;
    const Ti = args.TauI;
    let mv0 = args.Bias;
    const pv = args.ProcessVal;
    const stpt = args.SetPoint;
    let errs = args.AccumErr;
    const auto = args.Auto;
    let mv = args.MV;
    let dmv = 0;
    const terminal = document.getElementById("code-output");

    const err = stpt - pv;
    errs = errs + err;

    try {
      if(this.codeString === "") {this.codeString = "0"}
      const toEval = `dmv = ${this.codeString}`;
      eval(toEval);
      if(typeof(dmv) !== "number") {
        throw {
          __proto__ : { name : "TypeError" },
          message : `At least one specified variable is not of type "float"`
        }
      }
      mv = mv0 + dmv;
      const output = `Manipulated variable set to<br>&nbsp;&nbsp;&nbsp;&nbsp;mv = bias + ${this.codeString.replace(/\*\*/, "^")}<br>while in "auto" mode.`;
      terminal.innerHTML = output;
    } catch(e) {
      const errorType = e.__proto__.name;
      const error = `${errorType}:<br>${e.message}`;
      terminal.innerHTML = error;
      if(auto) {
        const offButtons = document.getElementsByClassName("btn manual");
        for(let i = 0; i < offButtons.length; i++) {
          const button = offButtons[i];
          button.click();
        };
      }
    }

    if (!auto) {
      mv = stpt;
      errs = 0;
    }

    mv = Math.max(Number.MIN_VALUE, mv);
    return [mv, errs];
  }

  pressure() {
    const R = 8.314;
    const P = this.nV * R * this.T / (this.columnVolume - this.nL / this.density());
    return P;
  }

  pSatA() {
    const A = 4.39031;
    const B = 1254.502;
    const C = -105.246;
    const pSat = 101325 * 10 ** (A - B / (this.T + C));
    return pSat;
  }

  pSatB() {
    const A = 4.34541;
    const B = 1661.858;
    const C = -74.048;
    const pSat = 101325 * 10 ** (A - B / (this.T + C));
    return pSat;
  }

  updateDOM() {
    const TemperatureDisplay = document.getElementById("TemperatureTextWrapper").firstElementChild;
    const PressureDisplay = document.getElementById("PressureTextWrapper").firstElementChild;
    const LevelDisplay = document.getElementById("LevelTextWrapper").firstElementChild;
    const LiftDisplay = document.getElementById("input-lift");
    const BottomsDisplay = document.getElementById("input-flowRateOut");
    const PowerDisplay = document.getElementById("input-power");
    

    const T = Math.round(this.T);
    const P = Number(this.P / 1000).toFixed(1);
    const L = Number(this.level).toPrecision(3);

    const Q = Number(this.Q / 1000).toFixed(1);
    const B = Number(this.L).toPrecision(3);
    const lift = Number(this.lift).toPrecision(3);

    TemperatureDisplay.innerHTML = `${T}&nbsp;K`;
    PressureDisplay.innerHTML = `${P}&nbsp;kPa`;
    LevelDisplay.innerHTML = `${L}&nbsp;%`;

    if(this.TemperatureController.auto) {PowerDisplay.value = `${Q}`}
    if(this.PressureController.auto) {LiftDisplay.value = `${lift}`}
    if(this.LevelController.auto) {BottomsDisplay.value = `${B}`}

    this.adjustLiquidLevel(this.level / 100);
  }

  adjustLiquidLevel(lvl) {
    const actualEmpty = 0.05;
    const actualFull = 0.97;
    const lvlAdj = actualEmpty + (actualFull - actualEmpty) * lvl;
    const ls = document.getElementById("liquidSquiggle");
    const lr = document.getElementById("liquidRect");
    const maxHeight = this.maxLiquidHeight;
    const rectHeightAtLvl = lvlAdj*maxHeight;
    const translateY = maxHeight - rectHeightAtLvl;
    ls.setAttribute("transform", `translate(0, ${translateY})`);
    lr.setAttribute("transform", `translate(0, ${translateY})`);
    lr.setAttribute("height", `${rectHeightAtLvl}`);
  }

  valve() {
    // returns molar flowrate of distillate (mol / s)
    const D = 0.058834841 * this.lift * Math.sqrt(this.pressure() - 10000);
    return D;
  }
}

function separator(speed) {
  return new Separator();
}

module.exports = separator;