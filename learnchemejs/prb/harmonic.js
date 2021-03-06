/* eslint-disable no-undef */

import {GraphCanvas} from "../src/GraphCanvas.js"
import {hsvToRgb} from '../src/hsvToRgb.js';
import {linspace} from '../src/sky-helpers.js';
import {Modal} from '../src/Modal.js';
import {modalFill} from '../src/modalFill.js';
import {scale} from '../src/scaleApp.js';

class Sim {
    constructor() {
        this.defineGlobals();
        this.insertPageElements();
        this.attachListeners();
        window.setInterval(this.nextFrame.bind(this), 1000 / this.FPS);
        this.init();
    }

    init() {
        this.getCoefficients();
        this.getNs();
        this.getMass();
        this.getKF();
        this.T -= this.TSTEP;
        this.update();
        var modalFiles = [];
        modalFiles.push(modalFill(this.modalDetails,'../html/modalHTML/harmonicDetailsContent.html.txt'));
        modalFiles.push(modalFill(this.modalDirections,'../html/modalHTML/harmonicDirectionsContent.html.txt'));
        modalFiles.push(modalFill(this.modalAbout,'../html/modalHTML/harmonicAboutContent.html.txt'));
        const error1 = this.modalDetails;
        const error2 = this.modalDirections;
        Promise.all(modalFiles).then(function() {
            MathJax.Hub.Configured();
        }).catch(() => {
            console.log("MathJax Not Yet Loaded ...");
            let delay = 1000;
            setTimeout(function jax() {
                try {MathJax.Hub.Configured();}
                catch(error) {console.error(error); if(delay < 10000) {delay*= 1.5; setTimeout(jax, delay);} else {
                    modalFill(error1,'../html/modalHTML/errorText.html.txt');
                    modalFill(error2,'../html/modalHTML/errorText.html.txt');
                }}
            }, delay);
          });
        this.scaleBody(this.SCALE);
    }

    defineGlobals() {
        this.RUNNING = false;
        this.FPS = 60;
        this.T = 0;
        this.TSTEP = 0.1 / this.FPS;

        this.graphWidth = 420;
        this.graphHeight = 280;
        this.rightGraphHeight = this.graphHeight * 2.15;
        this.graphLeft = 30;
        this.graphRight = 25;
        this.graphTop = 10;
        this.graphBottom = 60;
        this.xbounds = [-400, 400];

        this.MAXCOEFFICIENTS = 6;
        this.NS = linspace(0, this.MAXCOEFFICIENTS - 1, this.MAXCOEFFICIENTS, true);
        this.POINTS = 500;

        this.XS = linspace(this.xbounds[0], this.xbounds[1], this.POINTS + 1, true);
        this.Yrange = [0, 10];
        this.HS = [];
        this.KF = 25;
        this.M = 0.01;
        this.PROBS = [];
        this.RES = [];
        this.IMS = [];

        this.scaledParameterToggle = false;
        this.maxY = 1;

        this.SCALE = Math.min(1, window.innerWidth/1000);
        
        this.detailsContent = "";
        this.directionsContent = "";
        this.aboutContent = "";

        this.modalDetails = new Modal({modalid:"modal-details",modalclass:"modal moveUp",headerstyle:"",header:"Details",contentstyle:"",content:this.detailsContent,showing:false});
        this.modalDirections = new Modal({modalid:"modal-directions",modalclass:"modal moveUp",headerstyle:"",header:"Directions",contentstyle:"",content:this.directionsContent,showing:false});
        this.modalAbout = new Modal({modalid:"modal-about",modalclass:"modal moveUp",headerstyle:"",header:"About",contentstyle:"",content:this.aboutContent,showing:false});    

    }

    insertPageElements() {
        let html = `<div id="page">`;
        html += `<div class="navbar">`;
        html += `<div class='zoom'><img src='../../media/magPlus.png' width='30' id='zoomIn' class='buttonSmall'></img><img src='../../media/magMinus.png' width='30' id='zoomOut' class='buttonSmall'></img></div>`
        html += `<button id='details' class='buttonMed'>details</button>`;
        html += `<button id='directions' class='buttonMed'>directions</button>`;
        html += `<button id='about' class='buttonMed'>about</button>`;
        html += `</div>`;
        html += `<div class="row">`;
        html += `<div id="left" class="column"></div>`;
        html += `<div id="right" class="column"></div>`;
        html += `</div>`;
        html += `</div>`;
        document.body.insertAdjacentHTML("beforeend", html);

        // Insert coefficient table
        html = `<div id="coefficients">`;
        html += `<table>`;
        html += `<th>n</th><th>C<sub>n</sub></th>`;
        for (let row = 1; row < this.MAXCOEFFICIENTS+1; row++) {
            html += `<tr>`;
            html += `<td class="table dark"><input id="n-${row}" class="tableinput" value="${this.NS[row-1]}" placeholder="${row}"></input></td>`;
            html += `<td class="table light"><input id="cn-${row}" class="tableinput" value="${row == 1 ? 1 : 0}" placeholder="0" tabindex="${row}"></input></td>`;
            html += `</tr>`;
        }
        html += `</table>`;
        html += `</div>`;
        document.getElementById("left").insertAdjacentHTML("beforeend", html);

        // Insert buttons
        html = `<div id="buttons">`;
        html += `<button id='resetc'>reset t = 0</button>`;
        html += `<button id='reset'>reset defaults</button>`;
        html += `<button id='togglec'>start/stop</button>`;
        html += `<br>`;
        html += `<button id='measure' style='width:250px'>collapse wave function (measure E)</button>`;
        html += `<button id='integrate'>integrate</button>`;
        html += `</div>`;
        document.getElementById("left").insertAdjacentHTML("beforeend", html);

        // Insert integral box
        html = `<div id="integral">`;
        html += `<table>`
        html += `<th id="th1">x<sub>1</sub> (pm)</th><th id="th2">x<sub>2</sub> (pm)</th><th>integral</th>`;
        html += `<tr><td><input id="x1" class="tableinput" value="${-50}" placeholder="0"></input></td>`;
        html += `<td><input id="x2" class="tableinput" value="${50}" placeholder="0"></input></td>`;
        html += `<td><input id="int" class="tableinput" placeholder="-" readonly></input></td>`;
        html += `</tr></table>`
        html += `</div>`
        document.getElementById("left").insertAdjacentHTML("beforeend", html);

        // Insert sliders
        html = `<div id="sliders" class="row">`;
        html += `<div class="sliderdiv">`;
        html += `<p id="spanmass" class="sliderp">Mass</p>`;
        html += `<input type="range" min="${1}" max="${100}" value="${34}" class="slider" id="sldmass">`;
        html += `</div>`
        html += `<div class="sliderdiv">`;
        html += `<p id="spankf" class="sliderp">force constant k<sub>f</sub>&nbsp</p>`;
        html += `<input type="range" min="${1}" max="${100}" value="${21}" class="slider" id="sldkf">`;
        html += `</div>`
        html += `</div>`
        document.getElementById("left").insertAdjacentHTML("beforeend", html);

        html = `<button id='changeXaxis' style='align-self: center; transform:translateY(-25%); width:35rem;'>toggle scaled length parameter</button>`;
        document.getElementById("right").insertAdjacentHTML("beforeend", html);

        // Define graph layouts
        this.probgraphinfo = {
            "graphwidth": this.graphWidth,
            "graphheight": this.rightGraphHeight,
            "padding": {
                "left": this.graphLeft + 50,
                "bottom": this.graphBottom,
                "top": this.graphTop,
                "right": this.graphRight
            },
            "graphbackground": "white",
            "axesbackground": "white",
            "x": {
                "label": "x - x<sub>0</sub> (pm)",
                "min": this.xbounds[0],
                "max": this.xbounds[1],
                "majortick": Number((this.xbounds[1] - this.xbounds[0]) / 4).toFixed(2),
                "minortick": Number((this.xbounds[1] - this.xbounds[0]) / 16),
                "gridline": this.xbounds[1],
            },
            "y": {
                "label": "energy (eV)",
                "min": this.Yrange[0],
                "max": this.Yrange[1],
                "majortick": Number((this.Yrange[1] - this.Yrange[0]) / 7).toFixed(0),
                "minortick": Number((this.Yrange[1] - this.Yrange[0]) / 7).toFixed(0) / 4,
                "gridline": this.Yrange[1],
            }
        };

        this.compgraphinfo = {
            "graphwidth": this.graphWidth,
            "graphheight": this.graphHeight,
            "padding": {
                "left": this.graphLeft + 50,
                "bottom": this.graphBottom,
                "top": this.graphTop,
                "right": this.graphRight
            },
            "graphbackground": "white",
            "axesbackground": "white",
            "x": {
                "label": "x - x<sub>0</sub> (pm)",
                "min": this.xbounds[0],
                "max": this.xbounds[1],
                "majortick": Number((this.xbounds[1] - this.xbounds[0]) / 4).toFixed(2),
                "minortick": Number((this.xbounds[1] - this.xbounds[0]) / 16),
                "gridline": this.xbounds[1],
            },
            "y": {
                "label": "ψ (pm <sup>-1/2</sup>)",
                "min": -0.3,
                "max": 0.3,
                "majortick": 0.1,
                "minortick": 0.1,
                "gridline": 0.3,
            }
        };

        // Create graphs
        document.getElementById("right").insertAdjacentHTML("beforeend", `<span class="graphtitle">Energy and Probability Density |ψ|² (=ψ*ψ)</span>`);
        this.densitygc = new GraphCanvas("density-gc", "right", {
            graphinfo: this.probgraphinfo,
        });

        document.getElementById("left").insertAdjacentHTML("beforeend", `<span class="graphtitle">Real & Imaginary Components</span>`);
        this.componentgc = new GraphCanvas("component-gc", "left", {
            graphinfo: this.compgraphinfo,
        });

    }

    checkAxes() {
        if(this.maxEnergy > this.Yrange[1] || this.maxEnergy < this.Yrange[1] / 4) {
            this.Yrange[1] = Math.ceil(this.maxEnergy * 2);
            let majorTick, minorTick;
            if(this.Yrange[1] >= 7) {
                majorTick = Number((this.Yrange[1] - this.Yrange[0]) / 7).toFixed(0);
                minorTick = majorTick / 4;
            } else {
                majorTick = Math.max(Number((this.Yrange[1] - this.Yrange[0]) / 7).toFixed(1), 0.1);
                minorTick = majorTick / 4;
            }
            this.probgraphinfo.y = {
                "label": "energy (eV)",
                "min": this.Yrange[0],
                "max": this.Yrange[1],
                "majortick": majorTick,
                "minortick": minorTick,
                "gridline": this.Yrange[1],
            };
            this.redrawAxes();
        }
    }

    // to invoke this function, this.probgraphinfo or this.compgraphinfo must be modified first
    redrawAxes() {
        document.getElementById('density-gc').remove();
        document.getElementById('component-gc').remove();

        this.densitygc = new GraphCanvas("density-gc", "right", {
            graphinfo: this.probgraphinfo,
        });

        this.componentgc = new GraphCanvas("component-gc", "left", {
            graphinfo: this.compgraphinfo,
        });
    }

    attachListeners() {
        // Buttons
        document.getElementById('togglec').addEventListener("click", () => this.toggleRunning());
        document.getElementById('resetc').addEventListener("click", () => this.resetTime());
        document.getElementById('reset').addEventListener("click", () => location.reload());
        document.getElementById('measure').addEventListener("click", () => this.measureE());
        document.getElementById('integrate').addEventListener("click", () => this.integrate());
        document.getElementById('changeXaxis').addEventListener("click", () => this.scaledParameter());
        // Input events
        for (let i = 1; i <= this.MAXCOEFFICIENTS; i++) {
            document.getElementById(`n-${i}`).addEventListener("input", () => this.getNs());
            document.getElementById(`cn-${i}`).addEventListener("input", () => this.getCoefficients());
        }
        document.getElementById('sldmass').addEventListener("input", () => this.getMass());
        document.getElementById('sldkf').addEventListener("input", () => this.getKF());
        document.getElementById('details').addEventListener("click", () => this.modalDetails.show());
        document.getElementById('directions').addEventListener("click", () => this.modalDirections.show());
        document.getElementById('about').addEventListener("click", () => this.modalAbout.show());
        document.getElementById('zoomIn').addEventListener("click", () => {this.SCALE *= 1.125; this.scaleBody(this.SCALE);});
        document.getElementById('zoomOut').addEventListener("click", () => {this.SCALE /= 1.125; this.scaleBody(this.SCALE);});
    }

    nextFrame() {
        if (this.RUNNING) this.update();
    }

    update() {
        this.T += this.TSTEP;
        if(this.T >= 2 * Math.PI) {this.T = 0}
        this.calculatePsi();
        this.clearGraphs();
        this.drawGraphs();
    }

    calculatePsi() {
        this.PSI = [];
        this.PROBS = [];
        this.RES = [];
        this.IMS = [];

        // Phase shifts in arbitrary units because propagation is at ridiculously high frequency
        const freqs = this.NS.map(n => (n + 0.5) * math.sqrt(this.KF / this.M));
        const PhaseShifts = freqs.map(freq => math.exp(math.complex(0, - freq * this.T)));
        const lengthUnits = 1e-12; // picometers
        const hb = 1; // h-bar is beyond floating-point precision of javascript, conversion factor was built-in below.
        const scale = 5.08716e-11; // conversion factor to SI
        const alpha = math.pow(hb*hb/(this.M*this.KF), 0.25) * scale; // units of alpha are meters
        const unitsAdjust = this.scaledParameterToggle ? 1 : math.sqrt(lengthUnits);         
        
        let yArr = [];

        if(this.scaledParameterToggle) {
            yArr = this.XS; // y is unitless
        } else {
            yArr = this.XS.map(x => (x / alpha) * lengthUnits); // y is unitless
        }

        const eArr = yArr.map(y => math.exp(-0.5*math.pow(y, 2)));

        for (let i = 0; i < this.coefficients.length; i++) {
            const Nv = this.scaledParameterToggle ? 
            math.divide(1, math.sqrt(math.prod(math.pow(2, this.NS[i]), math.factorial(this.NS[i]), math.sqrt(math.PI))))
            : math.divide(1, math.sqrt(math.prod(alpha, math.pow(2, this.NS[i]), math.factorial(this.NS[i]), math.sqrt(math.PI))));
            
            for (let j = 0; j < this.XS.length; j++) {
                const y = yArr[j];
                const Hv = hermites(this.NS[i], y);
                const e = eArr[j];
                if(i == 0) {
                    // calculates the initial state, pushes to PSI array
                    this.PSI.push(math.prod(this.scaledcoefficients[i], Nv, Hv, e, unitsAdjust));
                    // converts the initial state to a complex value, multiplies by phase shift
                    // units of PSI are pm^-0.5 or unitless, depending on scaled length parameter
                    this.PSI[j] = math.complex(math.prod(this.PSI[j], math.re(PhaseShifts[i])), math.prod(this.PSI[j], math.im(PhaseShifts[i])));
                    // probability is the product of complex and its conjugate (constant added to match graph size)
                    this.PROBS.push(math.re(math.prod(this.PSI[j], math.conj(this.PSI[j]))));      
                    this.RES.push(math.re(this.PSI[j]));
                    this.IMS.push(math.im(this.PSI[j]));
                }
                else {
                    this.PSI[j].re += math.prod(this.scaledcoefficients[i], Nv, Hv, e, math.re(PhaseShifts[i]), unitsAdjust);
                    this.PSI[j].im += math.prod(this.scaledcoefficients[i], Nv, Hv, e, math.im(PhaseShifts[i]), unitsAdjust);
                    this.RES[j] = math.re(this.PSI[j]);
                    this.IMS[j] = math.im(this.PSI[j]);
                    this.PROBS[j] += math.re(math.prod(this.PSI[j], math.conj(this.PSI[j])));
                }
            }
        }

        if(this.T == 0) {
            this.maxY = this.PROBS.reduce(function(a, b) {
                return Math.max(a, b);
            });
        }

        this.ENERGY = 0;
        this.maxEnergy = 0;
        for (let i = 0; i < this.MAXCOEFFICIENTS; i++) {
            const cnvrt = 0.0161538; // conversion factor to electron-volts from (N^0.5 m^-0.5 Da^-0.5)
            const level = (this.NS[i] + 0.5) * math.sqrt(this.KF/this.M) * cnvrt;
            if(level > this.maxEnergy) {this.maxEnergy = level;}
            this.ENERGY += level * this.scaledcoefficients[i];
        }

        this.checkAxes();

        const scaleFactor = (this.probgraphinfo.y.max - this.probgraphinfo.y.min) / this.maxY / 3;

        for (let i = 0; i < this.XS.length; i++) {this.PROBS[i] *= scaleFactor; this.PROBS[i] += this.ENERGY}

        if(this.scaledParameterToggle) {
            this.POTENTIAL = this.XS.map(x => 0.5 * this.KF * math.pow(x * alpha / lengthUnits, 2) * 6.242e-6);
        } else {
            this.POTENTIAL = this.XS.map(x => 0.5 * this.KF * math.pow(x, 2) * 6.242e-6);
        }
    }

    clearGraphs() {
        this.densitygc.clear();
        this.componentgc.clear();
    }

    drawGraphs() {

        for (let i = 0; i < this.MAXCOEFFICIENTS; i++) {
            const cnvrt = 0.0161538; // conversion factor to electron-volts from (N^0.5 m^-0.5 Da^-0.5)
            const level = (this.NS[i] + 0.5) * math.sqrt(this.KF/this.M) * cnvrt;
            this.densitygc.drawLine(this.xbounds, [level,level], hsvToRgb(0,0,0), 1, [5, 4]);
            this.densitygc.drawText(`n = ${this.NS[i]}`, this.xbounds[1] - 50 * (this.xbounds[1] - this.xbounds[0]) / this.POINTS, level + 10 * (this.Yrange[1] - this.Yrange[0]) / this.rightGraphHeight, {'color':'black', 'fontsize':'14'});
        }
        
        this.densitygc.drawLine(this.XS.slice(0, 49), this.POTENTIAL.slice(0, 49), hsvToRgb(240,100,100), 1, [2, 2]);
        this.densitygc.drawLine(this.XS.slice(53, this.XS.length), this.POTENTIAL.slice(53, this.POTENTIAL.length), hsvToRgb(240,100,100), 1, [2, 2]);
        this.densitygc.drawLine(this.XS, this.PROBS, hsvToRgb(0,0,0), 3);

        this.densitygc.drawLine([this.xbounds[0], 0.52*this.xbounds[1]], [this.ENERGY, this.ENERGY], hsvToRgb(0,100,100), 3);
        this.densitygc.drawLine([this.xbounds[1]*0.63, this.xbounds[1]], [this.ENERGY, this.ENERGY], hsvToRgb(0,100,100), 3);
        this.densitygc.drawLine([this.xbounds[1]*0.52, this.xbounds[1]*0.63], [this.ENERGY, this.ENERGY], hsvToRgb(0,0,100), 3);

        this.densitygc.drawText(`E`, this.xbounds[1]*0.55, this.ENERGY + 0.03, {'color':'red', 'fontsize':'14', 'fontstyle':'bold italic'});
        this.densitygc.drawText(`U(x)`, this.xbounds[0] + 42 * (this.xbounds[1] - this.xbounds[0]) / this.POINTS, this.POTENTIAL[50], {'color':'blue', 'fontsize':'14', 'fontstyle':'bold'});

        this.componentgc.drawText('Re', 0.3, 2.6, {'color':'blue'});
        this.componentgc.drawText('Im', 0.3, 2.1, {'color':'red'});
        this.componentgc.drawLine([0.38, 0.43], [2.6, 2.6], hsvToRgb(220,100,100), 2);
        this.componentgc.drawLine([0.38, 0.43], [2.1, 2.1], hsvToRgb(0,100,100), 2);
        this.componentgc.drawLine(this.XS, this.RES, hsvToRgb(220,100,100), 3);
        this.componentgc.drawLine(this.XS, this.IMS, hsvToRgb(0,100,100), 3);
    }

    toggleRunning() {
        if(this.RUNNING) {
            this.RUNNING = false
        } else {
            this.getCoefficients();
            this.getNs();
            this.getMass();
            this.getKF();
            this.RUNNING = true
        }
    }

    resetTime() {
        this.RUNNING = false;
        this.T = 0;
        this.getCoefficients();
        this.T -= this.TSTEP;
        this.update();
    }

    scaledParameter() {
        if(this.scaledParameterToggle) {
            // in real-space
            this.xbounds = [-400, 400];
            this.probgraphinfo.x = {
                "label": "x - x<sub>0</sub> (pm)",
                "min": this.xbounds[0],
                "max": this.xbounds[1],
                "majortick": Number((this.xbounds[1] - this.xbounds[0]) / 4).toFixed(2),
                "minortick": Number((this.xbounds[1] - this.xbounds[0]) / 16),
                "gridline": this.xbounds[1],
            };
            this.compgraphinfo.x = this.probgraphinfo.x;
            this.compgraphinfo.y = {
                "label": "ψ (pm <sup>-1/2</sup>)",
                "min": -0.3,
                "max": 0.3,
                "majortick": 0.1,
                "minortick": 0.1,
                "gridline": 0.3,
            };
            this.XS = linspace(this.xbounds[0], this.xbounds[1], this.POINTS + 1, true);
            const th1 = document.getElementById("th1");
            const th2 = document.getElementById("th2");
            const x1 = document.getElementById("x1");
            const x2 = document.getElementById("x2");
            th1.innerHTML = "x<sub>1</sub> (pm)";
            th2.innerHTML = "x<sub>2</sub> (pm)";
            x1.value = `${this.probgraphinfo.x.min}`;
            x2.value = `${this.probgraphinfo.x.max}`;

            this.scaledParameterToggle = false;
            this.redrawAxes();
            if(this.RUNNING) {this.toggleRunning();}
            this.T = -this.TSTEP;
            this.update();
        } else {
            // in y-space
            this.xbounds = [-4, 4];
            this.probgraphinfo.x = {
                "label": "y - y<sub>0</sub>",
                "min": this.xbounds[0],
                "max": this.xbounds[1],
                "majortick": Number((this.xbounds[1] - this.xbounds[0]) / 4).toFixed(2),
                "minortick": Number((this.xbounds[1] - this.xbounds[0]) / 16),
                "gridline": this.xbounds[1],
            };
            this.compgraphinfo.x = this.probgraphinfo.x;
            this.compgraphinfo.y = {
                "label": "ψ",
                "min": -1.5,
                "max": 1.5,
                "majortick": 0.5,
                "minortick": 0.125,
                "gridline": 1.5,
            };
            this.XS = linspace(this.xbounds[0], this.xbounds[1], this.POINTS + 1, true);
            const th1 = document.getElementById("th1");
            const th2 = document.getElementById("th2");
            const x1 = document.getElementById("x1");
            const x2 = document.getElementById("x2");
            th1.innerHTML = "y<sub>1</sub>";
            th2.innerHTML = "y<sub>2</sub>";
            x1.value = `${this.probgraphinfo.x.min}`;
            x2.value = `${this.probgraphinfo.x.max}`;
            this.scaledParameterToggle = true;
            this.redrawAxes();
            if(this.RUNNING) {this.toggleRunning();}
            this.T = -this.TSTEP;
            this.update();
        }
    }

    measureE() {
        this.getCoefficients();
        let cumsum = [];
        let levels = [];
        for (let i = 0; i < this.MAXCOEFFICIENTS; i++) {
            levels.push(0);
            const last = i > 0 ? cumsum[i - 1] : 0;
            cumsum.push(last + this.scaledcoefficients[i])
        }
        const probe = Math.random();
        for (let i = 0; i < this.MAXCOEFFICIENTS; i++) {
            if (probe < cumsum[i]) {
                levels[i] = 1;
                break;
            }
        }
        this.scaledcoefficients = levels;
        if(this.RUNNING) this.toggleRunning();
        this.T = 0 - this.TSTEP;
        this.update();
    }

    riemanntrapezoid(x, y, x1, x2, draw=false) {
        let int = 0;
        for (let i = 0; i < x.length; i+=1) {
            if (x[i] >= x1 && x[i+1] <= x2) {
                int += (y[i] + y[i+1] - 2 * this.ENERGY) / 2 * (x[i+1] - x[i]);
                if (draw) this.densitygc.fillLine([x[i], x[i], x[i+1], x[i+1]], [this.ENERGY, y[i], y[i+1], this.ENERGY], hsvToRgb(0,100,100));
            }
        }
        return int;
    }

    integrate() {
        this.RUNNING = false;
        this.clearGraphs();
        const x1 = Number(document.getElementById('x1').value);
        const x2 = Number(document.getElementById('x2').value);
        const fullint = this.riemanntrapezoid(this.XS, this.PROBS, this.xbounds[0], this.xbounds[1], false);
        const int = this.riemanntrapezoid(this.XS, this.PROBS, x1, x2, true) / fullint;
        this.drawGraphs();
        const digits = 4;
        document.getElementById('int').value = Math.round(int * (10 ** digits), digits) / (10 ** digits);
    }

    getCoefficients() {
        this.coefficients = [];
        this.scaledcoefficients = [];
        let sum = 0;
        for (let i = 1; i <= this.MAXCOEFFICIENTS; i++) {
            const val = parseFloat(document.getElementById(`cn-${i}`).value);
            this.coefficients.push(val);
            this.scaledcoefficients.push(val);
            sum += val;
        }
        this.scaledcoefficients.forEach((value, index, array) => array[index] /= sum);
        this.T -= this.TSTEP;
        this.update();
    }

    getNs() {
        this.NS = [];
        for (let i = 1; i <= this.MAXCOEFFICIENTS; i++) {
            let val = parseFloat(document.getElementById(`n-${i}`).value);
            if(val > 20) {val = 20; document.getElementById(`n-${i}`).value = 20}
            this.NS.push(val);
        }
        this.T -= this.TSTEP;
        this.update();
    }

    getMass() {
        const value = Number(math.pow(10, -3 + 3 * (document.getElementById("sldmass").value - 1) / 99)).toFixed(5); // varies between 10^-3 and 10^0, logarithmically
        document.getElementById("spanmass").innerHTML = `mass: ${Number(value).toFixed(3)} Da`;
        this.M = value;
        this.T -= this.TSTEP;
        this.update();
    }

    getKF() {
        const value = Math.trunc(math.pow(10, 1 + 2 * (document.getElementById("sldkf").value - 1) / 99)); // varies between 10^1 and 10^3, logarithmically
        document.getElementById("spankf").innerHTML = `force constant k<sub>f</sub>&nbsp: ${value} N/m`;
        this.KF = value;
        this.T -= this.TSTEP;
        this.update();
    }

    scaleBody() {scale(this.SCALE);}
}

function hermites(n, xx) {
    let eqns = {
    "0": `${1}`,
    "1": `${2*xx}`,
    "2": `${-2 + 4*Math.pow(xx, 2) }`,
    "3": `${-12*xx + 8*Math.pow(xx, 3) }`,
    "4": `${12 - 48*Math.pow(xx, 2) + 16*Math.pow(xx, 4) }`,
    "5": `${120*xx - 160*Math.pow(xx, 3) + 32*Math.pow(xx, 5) }`,
    "6": `${-120 + 720*Math.pow(xx, 2) - 480*Math.pow(xx, 4) + 64*Math.pow(xx, 6) }`,
    "7": `${-1680*xx + 3360*Math.pow(xx, 3) - 1344*Math.pow(xx, 5) + 128*Math.pow(xx, 7) }`,
    "8": `${1680 - 13440*Math.pow(xx, 2) + 13440*Math.pow(xx, 4) - 3584*Math.pow(xx, 6) + 256*Math.pow(xx, 8) }`,
    "9": `${30240*xx - 80640*Math.pow(xx, 3) + 48384*Math.pow(xx, 5) - 9216*Math.pow(xx, 7) + 512*Math.pow(xx, 9) }`,
    "10": `${-30240 + 302400*Math.pow(xx, 2) - 403200*Math.pow(xx, 4) + 161280*Math.pow(xx, 6) - 23040*Math.pow(xx, 8) + 1024*Math.pow(xx, 10) }`,
    "11": `${-665280*xx + 2217600*Math.pow(xx, 3) - 1774080*Math.pow(xx, 5) + 506880*Math.pow(xx, 7) - 56320*Math.pow(xx, 9) + 2048*Math.pow(xx, 11) }`,
    "12": `${665280 - 7983360*Math.pow(xx, 2) + 13305600*Math.pow(xx, 4) - 7096320*Math.pow(xx, 6) + 1520640*Math.pow(xx, 8) - 135168*Math.pow(xx, 10) + 4096*Math.pow(xx, 12) }`,
    "13": `${17297280*xx - 69189120*Math.pow(xx, 3) + 69189120*Math.pow(xx, 5) - 26357760*Math.pow(xx, 7) + 4392960*Math.pow(xx, 9) - 319488*Math.pow(xx, 11) + 8192*Math.pow(xx, 13) }`,
    "14": `${-17297280 + 242161920*Math.pow(xx, 2) - 484323840*Math.pow(xx, 4) + 322882560*Math.pow(xx, 6) - 92252160*Math.pow(xx, 8) + 12300288*Math.pow(xx, 10) - 745472*Math.pow(xx, 12) + 16384*Math.pow(xx, 14) }`,
    "15": `${-518918400*xx + 2421619200*Math.pow(xx, 3) - 2905943040*Math.pow(xx, 5) + 1383782400*Math.pow(xx, 7) - 307507200*Math.pow(xx, 9) + 33546240*Math.pow(xx, 11) - 1720320*Math.pow(xx, 13) + 32768*Math.pow(xx, 15) }`,
    "16": `${518918400 - 8302694400*Math.pow(xx, 2) + 19372953600*Math.pow(xx, 4) - 15498362880*Math.pow(xx, 6) + 5535129600*Math.pow(xx, 8) - 984023040*Math.pow(xx, 10) + 89456640*Math.pow(xx, 12) - 3932160*Math.pow(xx, 14) + 65536*Math.pow(xx, 16) }`,
    "17": `${17643225600*xx - 94097203200*Math.pow(xx, 3) + 131736084480*Math.pow(xx, 5) - 75277762560*Math.pow(xx, 7) + 20910489600*Math.pow(xx, 9) - 3041525760*Math.pow(xx, 11) + 233963520*Math.pow(xx, 13) - 8912896*Math.pow(xx, 15) + 131072*Math.pow(xx, 17) }`,
    "18": `${-17643225600 + 317578060800*Math.pow(xx, 2) - 846874828800*Math.pow(xx, 4) + 790416506880*Math.pow(xx, 6) - 338749931520*Math.pow(xx, 8) + 75277762560*Math.pow(xx, 10) - 9124577280*Math.pow(xx, 12) + 601620480*Math.pow(xx, 14) - 20054016*Math.pow(xx, 16) + 262144*Math.pow(xx, 18) }`,
    "19": `${-670442572800*xx + 4022655436800*Math.pow(xx, 3) - 6436248698880*Math.pow(xx, 5) + 4290832465920*Math.pow(xx, 7) - 1430277488640*Math.pow(xx, 9) + 260050452480*Math.pow(xx, 11) - 26671841280*Math.pow(xx, 13) + 1524105216*Math.pow(xx, 15) - 44826624*Math.pow(xx, 17) + 524288*Math.pow(xx, 19) }`,
    "20": `${670442572800 - 13408851456000*Math.pow(xx, 2) + 40226554368000*Math.pow(xx, 4) - 42908324659200*Math.pow(xx, 6) + 21454162329600*Math.pow(xx, 8) - 5721109954560*Math.pow(xx, 10) + 866834841600*Math.pow(xx, 12) - 76205260800*Math.pow(xx, 14) + 3810263040*Math.pow(xx, 16) - 99614720*Math.pow(xx, 18) + 1048576*Math.pow(xx, 20) }`
    };
    return eqns[n];
}

window['Simulation'] = new Sim();