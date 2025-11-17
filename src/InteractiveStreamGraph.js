import React, { Component } from "react";
import * as d3 from "d3";

class InteractiveStreamGraph extends Component {
  constructor(props) {
    super(props);
    this.svgRef = React.createRef();
    this.tooltipRef = React.createRef();
  }

  componentDidMount() {
    this.renderChart();
  }

  componentDidUpdate() {
    this.renderChart();
  }

  renderChart() {
    const chartData = this.props.csvData;
    console.log("Rendering chart with data:", chartData);
    if (!chartData || chartData.length === 0) {
      return;
    }

    const llmModels = ["GPT-4", "Gemini", "PaLM-2", "Claude", "LLaMA-3.1"];

    const colors = {
      "GPT-4": "#e41a1c",
      "Gemini": "#377eb8",
      "PaLM-2": "#4daf4a",
      "Claude": "#984ea3",
      "LLaMA-3.1": "#ff7f00"
    };

    d3.select(this.svgRef.current).selectAll("*").remove();
    d3.select(this.tooltipRef.current).selectAll("*").remove();

    const margin = { top: 20, right: 150, bottom: 40, left: 60 };
    const width = 800 - margin.left - margin.right;
    const height = 500 - margin.top - margin.bottom;

    const svg = d3
      .select(this.svgRef.current)
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom);

    const g = svg
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    const data = chartData.map((d) => ({
      date: d.Date,
      ...llmModels.reduce((acc, model) => {
        acc[model] = d[model] || 0;
        return acc;
      }, {})
    }));

    const xScale = d3
      .scaleTime()
      .domain(d3.extent(data, (d) => d.date))
      .range([0, width]);

    const stack = d3
      .stack()
      .keys(llmModels)
      .order(d3.stackOrderNone)
      .offset(d3.stackOffsetWiggle);

    const stackedData = stack(data);

    const yMax = d3.max(stackedData, (layer) =>
      d3.max(layer, (d) => d[1])
    );
    const yMin = d3.min(stackedData, (layer) =>
      d3.min(layer, (d) => d[0])
    );

    const yScale = d3
      .scaleLinear()
      .domain([yMin, yMax])
      .range([height, 0])
      .nice();

    const area = d3
      .area()
      .x((d) => xScale(d.data.date))
      .y0((d) => yScale(d[0]))
      .y1((d) => yScale(d[1]))
      .curve(d3.curveBasis);

    const layers = g
      .selectAll(".layer")
      .data(stackedData)
      .enter()
      .append("path")
      .attr("class", "layer")
      .attr("d", area)
      .style("fill", (d) => colors[d.key])
      .style("opacity", 0.8)
      .on("mouseover", function (event, d) {
        d3.select(this).style("opacity", 1);
        showTooltip(event, d);
      })
      .on("mousemove", function (event, d) {
        moveTooltip(event, d);
      })
      .on("mouseout", function () {
        d3.select(this).style("opacity", 0.8);
        hideTooltip();
      });

    const xAxis = g
      .append("g")
      .attr("transform", `translate(0,${height})`)
      .call(
        d3.axisBottom(xScale)
          .tickValues(data.map(d => d.date))
          .tickFormat(d3.timeFormat("%b"))
      );

    const legendHeight = llmModels.length * 25;
    const legendY = margin.top + (height - legendHeight) / 2;
    const legend = svg
      .append("g")
      .attr("transform", `translate(${width + margin.left + 20}, ${legendY})`);

    const legendItems = legend
      .selectAll(".legend-item")
      .data(llmModels)
      .enter()
      .append("g")
      .attr("class", "legend-item")
      .attr("transform", (d, i) => `translate(0, ${i * 25})`);

    legendItems
      .append("rect")
      .attr("width", 18)
      .attr("height", 18)
      .attr("fill", (d) => colors[d]);

    legendItems
      .append("text")
      .attr("x", 25)
      .attr("y", 9)
      .attr("dy", "0.35em")
      .style("font-size", "12px")
      .text((d) => d);

    const tooltip = d3.select(this.tooltipRef.current);

    function showTooltip(event, layerData) {
      const model = layerData.key;
      const modelData = data.map((d) => ({
        date: d.date,
        value: d[model]
      }));

      tooltip.selectAll("*").remove();

      const tooltipDiv = tooltip
        .append("div")
        .style("background", "white")
        .style("padding", "10px")
        .style("border", "1px solid #ccc")
        .style("border-radius", "5px")
        .style("box-shadow", "0 2px 8px rgba(0,0,0,0.2)");

      tooltipDiv
        .append("div")
        .style("font-weight", "bold")
        .style("margin-bottom", "8px")
        .text(model);

      const tooltipWidth = Math.max(300, modelData.length * 25);
      const tooltipHeight = 150;
      const tooltipMargin = { top: 10, right: 10, bottom: 30, left: 40 };

      const tooltipSvg = tooltipDiv
        .append("svg")
        .attr("width", tooltipWidth)
        .attr("height", tooltipHeight);

      const tooltipG = tooltipSvg
        .append("g")
        .attr("transform", `translate(${tooltipMargin.left},${tooltipMargin.top})`);

      const barAreaWidth = tooltipWidth - tooltipMargin.left - tooltipMargin.right;
      
      const tooltipXScale = d3
        .scaleBand()
        .domain(modelData.map((d, i) => i))
        .range([0, barAreaWidth])
        .padding(0.1);
      
      const barWidth = tooltipXScale.bandwidth();

      const maxValue = d3.max(modelData, (d) => d.value);
      let yDomainMax;
      let yAxisTicks;
      
      if (model === "GPT-4") {
        yDomainMax = maxValue;
        yAxisTicks = null;
      } else {
        yDomainMax = Math.ceil(maxValue / 20) * 20;
        yAxisTicks = d3.range(0, yDomainMax + 1, 20);
      }

      const tooltipYScale = d3
        .scaleLinear()
        .domain([0, yDomainMax])
        .range([tooltipHeight - tooltipMargin.top - tooltipMargin.bottom, 0]);

      tooltipG
        .selectAll(".bar")
        .data(modelData)
        .enter()
        .append("rect")
        .attr("class", "bar")
        .attr("x", (d, i) => tooltipXScale(i))
        .attr("width", barWidth)
        .attr("y", (d) => tooltipYScale(d.value))
        .attr("height", (d) => tooltipHeight - tooltipMargin.top - tooltipMargin.bottom - tooltipYScale(d.value))
        .attr("fill", colors[model]);

      const xAxis = tooltipG
        .append("g")
        .attr("transform", `translate(0,${tooltipHeight - tooltipMargin.top - tooltipMargin.bottom})`)
        .call(
          d3.axisBottom(tooltipXScale)
            .tickFormat((d) => d3.timeFormat("%b")(modelData[d].date))
        )
        .style("font-size", "10px");
      
      xAxis
        .selectAll("text")
        .style("text-anchor", "middle")
        .attr("dx", "0")
        .attr("dy", "0.5em");

      tooltip
        .style("opacity", 1)
        .style("left", event.clientX + "px")
        .style("top", event.clientY + "px");

      const yAxis = tooltipG.append("g");
      if (model === "GPT-4") {
        yAxis
          .call(
            d3.axisLeft(tooltipYScale)
              .ticks(4)
              .tickFormat(d3.format("d"))
          )
          .style("font-size", "10px");
      } else {
        yAxis
          .call(
            d3.axisLeft(tooltipYScale)
              .tickValues(yAxisTicks)
              .tickFormat(d3.format("d"))
          )
          .style("font-size", "10px");
      }
      
      xAxis.select(".domain").style("stroke", "#000");
      yAxis.select(".domain").style("stroke", "#000");
      xAxis.selectAll(".tick line").style("stroke", "#000");
      yAxis.selectAll(".tick line").style("stroke", "#000");
    }

    function moveTooltip(event, layerData) {
      tooltip
        .style("left", event.clientX + "px")
        .style("top", event.clientY + "px");
    }

    function hideTooltip() {
      tooltip.style("opacity", 0);
    }
  }

  render() {
    return (
      <div style={{ position: "relative" }}>
        <svg ref={this.svgRef} className="svg_parent"></svg>
        <div
          ref={this.tooltipRef}
          style={{
            position: "fixed",
            opacity: 0,
            pointerEvents: "none",
            zIndex: 1000
          }}
        ></div>
      </div>
    );
  }
}

export default InteractiveStreamGraph;
