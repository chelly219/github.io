import React, { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import Plot from "react-plotly.js";

function parseData(input) {
  return input
    .split(/,|\s+/)
    .map((v) => parseFloat(v))
    .filter((v) => !isNaN(v));
}

function mean(arr) {
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function stddev(arr) {
  const m = mean(arr);
  return Math.sqrt(arr.reduce((sum, val) => sum + (val - m) ** 2, 0) / (arr.length - 1));
}

function tCritical(n, alpha) {
  const tTable = {
    5: 2.776, 10: 2.262, 20: 2.093, 30: 2.045, 50: 2.009, 100: 1.984,
  };
  return tTable[n] || 1.96; // fallback to normal approx
}

function kFactor(n, alpha = 0.05, p = 0.99) {
  const t = tCritical(n, alpha);
  return t * Math.sqrt((n + 1) / n * (1 + 1 / (n - 1)));
}

function calculateCI(data, alpha = 0.05) {
  const n = data.length;
  const m = mean(data);
  const s = stddev(data);
  const t = tCritical(n, alpha);
  const margin = t * s / Math.sqrt(n);
  return [m - margin, m + margin];
}

function calculateToleranceInterval(data, alpha = 0.05, p = 0.99) {
  const n = data.length;
  const m = mean(data);
  const s = stddev(data);
  const k = kFactor(n, alpha, p);
  return [m - k * s, m + k * s];
}

function calculateTOST(data, margin = 0.5, alpha = 0.05) {
  const n = data.length;
  const m = mean(data);
  const s = stddev(data);
  const se = s / Math.sqrt(n);
  const tLow = (m - (-margin)) / se;
  const tHigh = (margin - m) / se;
  return {
    result: tLow > 1.96 && tHigh > 1.96,
    lowerBound: m - 1.96 * se,
    upperBound: m + 1.96 * se,
    mean: m
  };
}

export default function App() {
  const [inputData, setInputData] = useState("");
  const [doCI, setDoCI] = useState(true);
  const [doTI, setDoTI] = useState(true);
  const [doTOST, setDoTOST] = useState(true);
  const [alpha, setAlpha] = useState(0.05);
  const [coverage, setCoverage] = useState(0.99);
  const [margin, setMargin] = useState(0.5);
  const [ciResult, setCiResult] = useState(null);
  const [tiResult, setTiResult] = useState(null);
  const [tostResult, setTostResult] = useState(null);
  const [dataPoints, setDataPoints] = useState([]);

  const handleCalculate = () => {
    const data = parseData(inputData);
    if (data.length < 2) return;

    setDataPoints(data);

    if (doCI) {
      const ci = calculateCI(data, alpha);
      setCiResult(ci);
    }

    if (doTI) {
      const ti = calculateToleranceInterval(data, alpha, coverage);
      setTiResult(ti);
    }

    if (doTOST) {
      const tost = calculateTOST(data, margin, alpha);
      setTostResult(tost);
    }
  };

  return (
    <div className="max-w-xl mx-auto p-4 space-y-4">
      <h1 className="text-2xl font-bold">📊 CI, Tolerance Interval & TOST Calculator</h1>
      <Input
        placeholder="Enter values (e.g., 12.3, 12.5, 12.7)"
        value={inputData}
        onChange={(e) => setInputData(e.target.value)}
      />
      <div className="grid grid-cols-2 gap-2">
        <Input type="number" step="0.01" min="0" max="1" value={alpha} onChange={(e) => setAlpha(parseFloat(e.target.value))} placeholder="Alpha (e.g. 0.05)" />
        <Input type="number" step="0.01" min="0" max="1" value={coverage} onChange={(e) => setCoverage(parseFloat(e.target.value))} placeholder="Coverage (e.g. 0.99)" />
        <Input type="number" step="0.01" value={margin} onChange={(e) => setMargin(parseFloat(e.target.value))} placeholder="TOST Margin (e.g. 0.5)" />
      </div>
      <div className="flex gap-4">
        <label className="flex items-center gap-2">
          <Checkbox checked={doCI} onCheckedChange={setDoCI} /> CI
        </label>
        <label className="flex items-center gap-2">
          <Checkbox checked={doTI} onCheckedChange={setDoTI} /> Tolerance Interval
        </label>
        <label className="flex items-center gap-2">
          <Checkbox checked={doTOST} onCheckedChange={setDoTOST} /> TOST
        </label>
      </div>
      <Button onClick={handleCalculate}>Calculate</Button>

      <Card>
        <CardContent className="p-4 space-y-2">
          {ciResult && (
            <div>✅ {100 * (1 - alpha)}% CI: [{ciResult[0].toFixed(3)}, {ciResult[1].toFixed(3)}]</div>
          )}
          {tiResult && (
            <div>✅ {100 * (1 - alpha)}% TI ({100 * coverage}% coverage): [{tiResult[0].toFixed(3)}, {tiResult[1].toFixed(3)}]</div>
          )}
          {tostResult && (
            <div>
              ✅ TOST Result: {tostResult.result ? "Equivalent (Accepted)" : "Not Equivalent (Rejected)"}
            </div>
          )}
        </CardContent>
      </Card>

      {dataPoints.length > 0 && (
        <Plot
          data={[
            {
              x: dataPoints,
              type: "scatter",
              mode: "markers",
              marker: { color: "blue" },
              name: "Data"
            },
            ciResult && {
              x: [ciResult[0], ciResult[1]],
              y: [0, 0],
              type: "scatter",
              mode: "lines",
              line: { color: "green" },
              name: `${100 * (1 - alpha)}% CI`
            },
            tiResult && {
              x: [tiResult[0], tiResult[1]],
              y: [0.1, 0.1],
              type: "scatter",
              mode: "lines",
              line: { color: "red" },
              name: `${100 * (1 - alpha)}% TI`
            },
            tostResult && {
              x: [tostResult.lowerBound, tostResult.upperBound],
              y: [0.2, 0.2],
              type: "scatter",
              mode: "lines",
              line: { color: tostResult.result ? "purple" : "gray", dash: "dash" },
              name: "TOST Interval"
            }
          ].filter(Boolean)}
          layout={{
            title: "Data & Intervals",
            height: 350,
            xaxis: { title: "Value" },
            yaxis: { visible: false },
            showlegend: true
          }}
        />
      )}
    </div>
  );
}
