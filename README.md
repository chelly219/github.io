
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Interval Calculator</title>
  <script src="https://cdn.jsdelivr.net/npm/jstat@latest/dist/jstat.min.js"></script>
  <script src="https://cdn.plot.ly/plotly-2.27.0.min.js"></script>
  <style>
    body {
      font-family: Arial, sans-serif;
      padding: 20px;
      max-width: 800px;
      margin: auto;
    }
    textarea, input {
      width: 100%;
      margin-bottom: 10px;
    }
    button {
      padding: 10px;
      background-color: #4CAF50;
      color: white;
      border: none;
      cursor: pointer;
      margin-top: 10px;
    }
    #result {
      margin-top: 20px;
      font-size: 1.1em;
    }
  </style>
</head>
<body>
  <h2>CKD's<br> 3SD / Prediction / Tolerance / Confidence <br> Interval Calculator</h2>

  <!-- Test method name 입력창 -->
  <label><strong>Test Method Name</strong><small> (optional):</small><input type="text" id="methodName" placeholder="e.g. SE-HPLC"/></label>

  <!-- Reference Results 입력창 -->
  <label><strong>Reference Results</strong> <small>(used for interval calculations)</small>:</label>
  <textarea id="data" rows="5" placeholder="Enter numbers separated by comma, newline, or tab (Excel column copy)"></textarea>
  
  <!-- Test Results 입력창 -->
  <label><strong>Test Results</strong>  <small>(displayed as red dots only)</small>:</label>
  <textarea id="testData" rows="3" placeholder="Optional: Enter test values to visualize as red dots (not used in calculations)"></textarea>

  
  <label>Confidence Level (%): <input type="number" id="confidence" value="95"></label>
  <label>Tolerance Coverage (%): <input type="number" id="tolerance" value="99"></label>
  <button onclick="calculate()">Calculate Intervals</button>
  <div id="result"></div>
  <div id="plot"></div>

  <script>
    const kTable = {
      95: {
        99: {
          2: 30.577, 3: 9.925, 5: 5.740, 10: 4.048, 20: 3.272, 30: 3.013, 50: 2.792, 100: 2.579
        },
        95: {
          2: 12.706, 3: 4.303, 5: 2.776, 10: 2.228, 20: 2.086, 30: 2.042, 50: 2.009, 100: 1.984
        }
      },
      99: {
        99: {
          2: 63.657, 3: 15.697, 5: 7.173, 10: 4.587, 20: 3.670, 30: 3.426, 50: 3.221, 100: 3.055
        },
        95: {
          2: 31.598, 3: 9.925, 5: 4.032, 10: 2.764, 20: 2.528, 30: 2.457, 50: 2.403, 100: 2.364
        }
      }
    };

 
    function interpolateMeekerK(n) {
      const keys = Object.keys(meekerKFactors).map(Number).sort((a, b) => a - b);
    
      if (n <= keys[0]) return meekerKFactors[keys[0]];
      if (n >= keys[keys.length - 1]) return meekerKFactors[keys[keys.length - 1]];
    
      for (let i = 0; i < keys.length - 1; i++) {
        const n1 = keys[i];
        const n2 = keys[i + 1];
        if (n >= n1 && n <= n2) {
          const k1 = meekerKFactors[n1];
          const k2 = meekerKFactors[n2];
          const k = k1 + (k2 - k1) * (n - n1) / (n2 - n1);
          return k;
        }
      }
    }


    function findBoundingKeys(keys, value) {
      keys = keys.map(Number).sort((a, b) => a - b);
      let lower = keys[0], upper = keys[keys.length - 1];
      for (let i = 0; i < keys.length - 1; i++) {
        if (value >= keys[i] && value <= keys[i + 1]) {
          lower = keys[i];
          upper = keys[i + 1];
          break;
        }
      }
      return [lower, upper];
    }

    function interpolate2D(conf, cover, n) {
      const confs = Object.keys(kTable).map(Number);
      const covers = Object.keys(kTable[confs[0]]).map(Number);

      const [confLow, confHigh] = findBoundingKeys(confs, conf);
      const [coverLow, coverHigh] = findBoundingKeys(covers, cover);

      function kAt(c, t) {
        const table = kTable[c][t];
        const ns = Object.keys(table).map(Number);
        const [nLow, nHigh] = findBoundingKeys(ns, n);

        if (nLow === nHigh) return table[nLow];
        const kLow = table[nLow], kHigh = table[nHigh];
        return kLow + ((n - nLow) * (kHigh - kLow)) / (nHigh - nLow);
      }

      const q11 = kAt(confLow, coverLow);
      const q21 = kAt(confHigh, coverLow);
      const q12 = kAt(confLow, coverHigh);
      const q22 = kAt(confHigh, coverHigh);

      const denomConf = confHigh - confLow || 1;
      const denomCover = coverHigh - coverLow || 1;

      const fConfLow = q11 + (q12 - q11) * (cover - coverLow) / denomCover;
      const fConfHigh = q21 + (q22 - q21) * (cover - coverLow) / denomCover;

      return fConfLow + (fConfHigh - fConfLow) * (conf - confLow) / denomConf;
    }

    function calculate() {
      
      
      // Ref 결과 읽기
      const raw = document.getElementById("data").value;
      const x = raw.split(/[\n,\t,]+/).map(v => parseFloat(v.trim())).filter(v => !isNaN(v));
      // Test 결과 읽기
      const testRaw = document.getElementById("testData").value;
      const testValues = testRaw.split(/[\n,\t,]+/).map(v => parseFloat(v.trim())).filter(v => !isNaN(v));
      // conf, tolerance level 읽기
      const conf = parseFloat(document.getElementById("confidence").value);
      const cover = parseFloat(document.getElementById("tolerance").value);

      if (x.length < 2) {
        alert("Please enter at least two valid numbers.");
        return;
      }

      const n = x.length;
      const mean = jStat.mean(x);
      const sd = jStat.stdev(x, true);
      const sd3Low = mean - 3 * sd;
      const sd3High = mean + 3 * sd;

      const confDec = conf / 100;
      const tVal = jStat.studentt.inv(1 - (1 - confDec) / 2, n - 1);
      const predLow = mean - tVal * sd * Math.sqrt(1 + 1/n);
      const predHigh = mean + tVal * sd * Math.sqrt(1 + 1/n);

      const k = interpolate2D(conf, cover, n);
      //const k = interpolateMeekerK(n);

      const tolLow = mean - k * sd;
      const tolHigh = mean + k * sd;

      const confiLow = jStat.studentt.inv((1 - confDec) / 2, n - 1) * sd / Math.sqrt(n) + mean;
      const confiHigh = jStat.studentt.inv(1 - (1 - confDec) / 2, n - 1) * sd / Math.sqrt(n) + mean;

      document.getElementById("result").innerHTML = `
        <p><strong>Reference of Mean:</strong> ${mean.toFixed(2)} &nbsp; | &nbsp;
           <strong>Standard Deviation:</strong> ${sd.toFixed(2)} &nbsp; | &nbsp;
           <strong>Samples:</strong> ${n}  

       <p style="color:#980000; font-weight:bold;">🎯 ±3SD Interval :</p>
        [${sd3Low.toFixed(2)}, ${sd3High.toFixed(2)}]<br><br>

        <p style="color:#FF6347; font-weight:bold;">🎯 Prediction Interval (for 1 future value):</p>
        [${predLow.toFixed(2)}, ${predHigh.toFixed(2)}]<br><br>

        <p style="color:#3CB371; font-weight:bold;">🎯 Tolerance Interval (covers ${cover.toFixed(1)}%, ${conf}% confidence):</p>
        [${tolLow.toFixed(2)}, ${tolHigh.toFixed(2)}] <em><small>(Howe Table Interpolation, similar to JMP)</small></em><br><br>

        <p style="color:#4169E1; font-weight:bold;">🎯 Confidence Interval (mean):</p>
        [${confiLow.toFixed(2)}, ${confiHigh.toFixed(2)}]
      `;

      //reference data dot
      const trace = {
        x: x,
        y: Array(x.length).fill(1).map((_, i) => Math.floor(i / 1)),  // 각 점을 y축에 겹치지 않게 배치
        mode: 'markers',
        type: 'scatter',
        marker: {
          color: 'gray',
          size: 10,
          opacity: 0.8
        },
        name: 'Reference Data'
      };
      
      //test data dot 
      const testTrace = {
        x: testValues,
        //y: Array(testValues.length).fill(1).map((_, i) => Math.floor(i / 1)),
        //y: testValues.map((_, i) => i * 0.5),    // 0~1 사이에서 무작위 y값
        y: testValues.map(() => Math.random() * x.length), 
        mode: 'markers',
        type: 'scatter',
        marker: {
          color: 'red',
          size: 10,
          symbol: 'circle',
          opacity: 0.9
        },
        name: 'Test data'
      };
      
      const methodName = document.getElementById("methodName").value.trim();
      const plotTitle = methodName ? `Result of ${methodName}` : 'Data Distribution and Intervals';

      const layout = {
        title: plotTitle,
          yaxis: {
            //showticklabels: true,
            title: 'order',
            //showticklabels: true,
            //showgrid: true
          },
        xaxis: {
            //showticklabels: true,
            title: 'results',
          },
        shapes: [
          // Prediction Interval
          { type: 'line', x0: predLow, x1: predLow, yref: 'paper', y0: 0, y1: 1, line: { color: '#FF6347', dash: 'dot' } },
          { type: 'line', x0: predHigh, x1: predHigh, yref: 'paper', y0: 0, y1: 1, line: { color: '#FF6347', dash: 'dot' } },

          // Tolerance Interval
          { type: 'line', x0: tolLow, x1: tolLow, yref: 'paper', y0: 0, y1: 1, line: { color: '#3CB371' , dash: 'dot' } },
          { type: 'line', x0: tolHigh, x1: tolHigh, yref: 'paper', y0: 0, y1: 1, line: { color: '#3CB371', dash: 'dot'  } },

          // Confidence
          { type: 'line', x0: confiLow, x1: confiLow, yref: 'paper', y0: 0, y1: 1, line: { color: '#4169E1', dash: 'dot' } },
          { type: 'line', x0: confiHigh, x1: confiHigh, yref: 'paper', y0: 0, y1: 1, line: { color: '#4169E1', dash: 'dot' } },

          // ±3SD
          { type: 'line', x0: sd3Low, x1: sd3Low, yref: 'paper', y0: 0, y1: 1, line: { color: '#980000', dash: 'dot' } },
          { type: 'line', x0: sd3High, x1: sd3High, yref: 'paper', y0: 0, y1: 1, line: { color: '#980000', dash: 'dot' } }
        ]
      };

      Plotly.newPlot('plot', [trace, testTrace], layout);
    }
  </script>
    <footer style="margin-top: 50px; font-size: 0.9em; color: gray; text-align: center;">
    created by chanmi@ckdpharm.com &nbsp;|&nbsp; version: 0.1
  </footer>
</body>
</html>
