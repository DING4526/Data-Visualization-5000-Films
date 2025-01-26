function kernelDensityEstimator(kernel, X) {
    return function (V) {
        return X.map(x => [x, d3.mean(V, v => kernel(x - v))]);
    };
}

function kernelEpanechnikov(k) {
    return function (v) {
        return Math.abs(v /= k) <= 1 ? 0.75 * (1 - v * v) / k : 0;
    };
}

function processData(marketShareData, roiData) {
    const processedData = [];
    const allRois = [];
    const yearlyRois = {};
    const yearlyMarketShare = {};
    const roiQuartiles = {};

    const years = Object.keys(marketShareData);

    years.forEach(year => {
        if (+year >= 1960) {
            yearlyRois[year] = [];
            yearlyMarketShare[year] = [];
            Object.keys(marketShareData[year]).forEach(genre => {
                if (roiData[year] && roiData[year][genre] !== undefined) {
                    const roi = roiData[year][genre];
                    if (roi >= -1 && roi <= 10) {
                        const roiPercent = roi * 100;
                        processedData.push({
                            year: +year,
                            genre: genre,
                            roi: roiPercent,
                            marketShare: marketShareData[year][genre]
                        });
                        allRois.push(roiPercent);
                        yearlyRois[year].push(roiPercent);
                        yearlyMarketShare[year].push({
                            genre: genre,
                            marketShare: marketShareData[year][genre],
                            roi: roiPercent
                        });
                    }
                }
            });
            if (yearlyRois[year].length > 0) {
                yearlyMarketShare[year].sort((a, b) => a.roi - b.roi);

                const n = yearlyRois[year].length;
                const q1Index = Math.floor(n / 4);
                const q3Index = Math.floor(3 * n / 4);

                const q1 = yearlyMarketShare[year][q1Index].roi;
                const q3 = yearlyMarketShare[year][q3Index].roi;

                roiQuartiles[year] = { q1, q3 };
            }
        }
    });
    return { processedData, allRois, yearlyRois, roiQuartiles };
}


//设置主要的SVG大小 边距   因为设置时划到了一个SVG上，后续调整直接用绝对的大小了，没有用页面相对的
//但是貌似可以加一个容器？？？
const margin = { top: 40, right: 430, bottom: 60, left: 80 };
const width = 1230 - margin.left - margin.right;
const height = 600 - margin.top - margin.bottom;

const svg = d3.select("#chart")
    .append("svg")
    .attr("width", width + margin.left + margin.right + 200)
    .attr("height", height + margin.top + margin.bottom + 350)
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`)
    .attr("id", "svg");

const tooltip = d3.select("body")
    .append("div")
    .attr("class", "tooltip")
    .style("opacity", 0);

// 载入数据
// 这里奠定了我写的屎山代码的基调 WWW
// 因为我用的都是全局变量，定义函数的时候就用的无参函数，画完一个图还好，后来画热力图的时候就发现G了。
/*
    写注释时，发现不如让GPT帮我写，我发现和我的代码一比，南开大学仿真实验的平台代码都算逻辑清晰的
    w~w~w~~~~~~~~~~~~~~~
    这个整个绘制代码都在下面了，看的时候可以直接拉到最后，通过ADD--- 函数，就大致知道什么功能
    需要注意的是，在ADDHEATMAP函数以下，才是添加多图的方式，因为我一开始都没想到要画那么多图！！！（我的好队友😊）
*/
Promise.all([
    d3.json("market_share_data.json"),
    d3.json("roi_data.json"),
    d3.json("movie_runtime.json")
]).then(([marketShareData, roiData, runtimeData]) => {
    const { processedData: data, allRois, yearlyRois, roiQuartiles } = processData(marketShareData, roiData);
    console.log(roiQuartiles);

    // 创建比例尺
    const xScale = d3.scaleLinear()
        .domain([1960, 2017])
        .range([0, width]);

    const yScale = d3.scaleLinear()
        .domain([-100, 1000])
        .range([height, 0]);

    const radiusScale = d3.scaleSqrt()
        .domain([0, d3.max(data, d => d.marketShare)])
        .range([3, 12]);

    const color = d3.scaleOrdinal()
        .range(d3.schemeTableau10);


    function addGrid() {
        svg.append("g")
            .attr("class", "grid")
            .attr("transform", `translate(0,${height})`)
            .call(d3.axisBottom(xScale)
                .ticks(10)
                .tickSize(-height)
                .tickFormat("")
            );

        svg.append("g")
            .attr("class", "grid")
            .call(d3.axisLeft(yScale)
                .ticks(10)
                .tickSize(-width)
                .tickFormat("")
            );
    }


    function addAxes() {
        svg.append("g")
            .call(d3.axisLeft(yScale)
                .ticks(10)
                .tickFormat(d => `${d}%`))
            .append("text")
            .attr("class", "axis-label")
            .attr("transform", "rotate(-90)")
            .attr("y", -60)
            .attr("x", -height / 2)
            .attr("text-anchor", "middle")
            .attr("fill", "black")
            .text("ROI (%)");
    }


    function addDensityDistribution() {
        const kde = kernelDensityEstimator(kernelEpanechnikov(7), yScale.ticks(100));
        const density = kde(allRois);
        const maxDensity = d3.max(density, d => d[1]);
        const densityScale = d3.scaleLinear()
            .domain([0, maxDensity])
            .range([0, width * 0.15]);

        const distributionLine = d3.line()
            .curve(d3.curveBasis)
            .x(d => width + densityScale(d[1]))
            .y(d => yScale(d[0]));

        svg.append("path")
            .datum(density)
            .attr("class", "distribution-line")
            .attr("d", distributionLine);
        const distributionArea = d3.area()
            .curve(d3.curveBasis)
            .x0(width)
            .x1(d => width + densityScale(d[1]))
            .y(d => yScale(d[0]));
        svg.append("path")
            .datum(density)
            .attr("class", "density-path")
            .attr("d", distributionArea);
    }


    function addBubbles() {
        svg.selectAll("circle")
            .data(data)
            .enter()
            .append("circle")
            .attr("class", "bubble-circle")
            .attr("cx", d => xScale(d.year))
            .attr("cy", d => yScale(d.roi))
            .attr("r", d => radiusScale(d.marketShare))
            .attr("fill", d => color(d.genre))
            .attr("opacity", 0.7)
            .attr("stroke", "white")
            .attr("stroke-width", 0.5)
            .on("mouseover", function (event, d) {
                d3.select(this)
                    .attr("opacity", 1)
                    .attr("stroke-width", 2);
                if (d.roi < roiQuartiles[d.year].q1) {
                    addImage(event, '0');
                } else if (d.roi < roiQuartiles[d.year].q3 && d.roi >= roiQuartiles[d.year].q1) {
                    addImage(event, '1');
                } else {
                    addImage(event, '2');
                }
                addBubblemapTooltip();
                function addBubblemapTooltip() {
                    tooltip.transition()
                        .duration(200)
                        .style("opacity", .9);
                    tooltip.html(
                        `<strong>${d.genre}</strong><br/>` +
                        `Year: ${d.year}<br/>` +
                        `ROI: ${d.roi.toFixed(1)}%<br/>` +
                        `Market Share: ${(d.marketShare * 100).toFixed(2)}%`
                    )
                        .style("left", (event.pageX + 10) + "px")
                        .style("top", (event.pageY - 28) + "px");
                }
            })
            .on("mouseout", function () {
                d3.select(this)
                    .attr("opacity", 0.7)
                    .attr("stroke-width", 0.5);
                removeBubblemapTooltip();
                function removeBubblemapTooltip() {
                    tooltip.transition()
                        .duration(500)
                        .style("opacity", 0);
                }
            })
            .on("contextmenu", function (event, d) {
                event.preventDefault(); // 阻止默认行为
                updateRuntimeAnalysis(d.year); // 更新运行时间分析
                console.log("sort by${d.year}");
            })
            .on("click", function (event, d) {
                const bbox = this.getBoundingClientRect();
                const svgBox = svg.node().getBoundingClientRect();
                drawYearMarketShare(d.year, bbox.x - svgBox.x, bbox.y - svgBox.y);
                function drawYearMarketShare(year, x, y) {
                    d3.selectAll(".market-share-container").remove();

                    const yearData = data.filter(d => d.year === year)
                        .sort((a, b) => b.marketShare - a.marketShare);
                    const margin = { top: 60, right: 60, bottom: 60, left: 60 };
                    const width = 400;
                    const height = 350;
                    const innerRadius = 25;
                    const outerRadius = Math.min(width, height) * 0.45;

                    const container = svg.append("g")
                        .attr("class", "market-share-container")
                        .attr("transform", `translate(${x}, ${y})`);

                    container.append("rect")
                        .attr("width", width + margin.left + margin.right)
                        .attr("height", height + margin.top + margin.bottom)
                        .attr("fill", "white")
                        .attr("stroke", "#ddd")
                        .attr("rx", 4);

                    const chartArea = container.append("g")
                        .attr("transform", `translate(${(width + margin.left + margin.right) / 2}, ${(height + margin.top + margin.bottom) / 2})`);

                    const angleScale = d3.scaleBand()
                        .domain(yearData.map(d => d.genre))
                        .range([0, 2 * Math.PI])
                        .align(0);

                    const radiusScale = d3.scaleRadial()
                        .domain([0, d3.max(yearData, d => d.roi)])
                        .range([innerRadius, outerRadius]);

                    const arc = d3.arc()
                        .innerRadius(innerRadius)
                        .outerRadius(d => radiusScale(d.roi))
                        .startAngle(d => angleScale(d.genre))
                        .endAngle(d => angleScale(d.genre) + angleScale.bandwidth())
                        .padAngle(0.02)
                        .padRadius(innerRadius);

                    chartArea.selectAll("path")
                        .data(yearData)
                        .join("path")
                        .attr("d", arc)
                        .attr("fill", d => color(d.genre))
                        .attr("stroke", "white")
                        .attr("stroke-width", 1)
                        .attr("opacity", 0.8)
                        .on("mouseover", function (event, d) {
                            d3.select(this)
                                .attr("opacity", 1)
                                .attr("stroke-width", 2);
                            tooltip.transition()
                                .duration(200)
                                .style("opacity", .9);
                            tooltip.html(
                                `Genre: ${d.genre}<br/>` +
                                `Market Share: ${(d.marketShare * 100).toFixed(1)}%<br/>` +
                                `ROI: ${d.roi.toFixed(1)}%`
                            )
                                .style("left", (event.pageX + 10) + "px")
                                .style("top", (event.pageY - 28) + "px");
                        })
                        .on("mouseout", function () {
                            d3.select(this)
                                .attr("opacity", 0.8)
                                .attr("stroke-width", 1);
                            tooltip.transition()
                                .duration(500)
                                .style("opacity", 0);
                        });

                    chartArea.append("g")
                        .attr("text-anchor", "end")
                        .call(g => g.append("text")
                            .attr("x", -6)
                            .attr("y", -outerRadius - 10)
                            .attr("dy", "-1em")
                            .attr("fill", "#666")
                            .style("font-size", "10px")
                            .text("ROI (%)"))
                        .call(g => g.selectAll("g")
                            .data(radiusScale.ticks(5).slice(1))
                            .join("g")
                            .attr("fill", "none")
                            .call(g => g.append("circle")
                                .attr("stroke", "#000")
                                .attr("stroke-opacity", 0.2)
                                .attr("r", radiusScale))
                            .call(g => g.append("text")
                                .attr("x", -6)
                                .attr("y", d => -radiusScale(d))
                                .attr("dy", "0.35em")
                                .attr("fill", "#666")
                                .style("font-size", "8px")
                                .text(d => d.toFixed(0))));

                    chartArea.append("g")
                        .attr("text-anchor", "middle")
                        .selectAll("g")
                        .data(yearData)
                        .join("g")
                        .attr("transform", d => `
                    rotate(${((angleScale(d.genre) + angleScale.bandwidth() / 2) * 180 / Math.PI - 90)})
                    translate(${outerRadius + 10},0)
                `)
                        .call(g => g.append("line")
                            .attr("x2", 20)
                            .attr("stroke", "#999")
                            .attr("stroke-width", 0.5))
                        .call(g => g.append("text")
                            .attr("transform", d => (angleScale(d.genre) + angleScale.bandwidth() / 2 + Math.PI / 2) % (2 * Math.PI) < Math.PI
                                ? "rotate(90)translate(0,-9)"
                                : "rotate(-90)translate(0,16)")
                            .attr("dy", ".35em")
                            .style("font-size", "8px")
                            .style("fill", "#333")
                            .text(d => `${d.genre} (${(d.marketShare * 100).toFixed(1)}%)`));

                    container.append("text")
                        .attr("x", (width + margin.left + margin.right) / 2)
                        .attr("y", margin.top / 2)
                        .attr("text-anchor", "middle")
                        .style("font-size", "14px")
                        .style("font-weight", "bold")
                        .text(`Market Share and ROI Distribution (${year})`);

                    container.append("text")
                        .attr("x", width + margin.right - 20)
                        .attr("y", margin.top / 2)
                        .text("×")
                        .style("cursor", "pointer")
                        .style("font-size", "14px")
                        .on("click", () => container.remove());

                    const legend = container.append("g")
                        .attr("transform", `translate(${margin.left - 20}, ${margin.top + 20})`);

                    const legendItems = legend.selectAll("g")
                        .data(yearData)
                        .join("g")
                        .attr("transform", (d, i) => `translate(0, ${i * 20})`);

                    legendItems.append("rect")
                        .attr("width", 12)
                        .attr("height", 12)
                        .attr("fill", d => color(d.genre));

                    legendItems.append("text")
                        .attr("x", 20)
                        .attr("y", 9)
                        .style("font-size", "10px")
                        .text(d => d.genre);
                }
            })
    }

    function addLegend() {
        const legendData = Array.from(new Set(data.map(d => d.genre))).sort();
        const legend = svg.selectAll(".legend")
            .data(legendData)
            .enter().append("g")
            .attr("class", "legend")
            .attr("transform", (d, i) => `translate(${width + 10},${i * 20})`);

        legend.append("circle")
            .attr("class", "circle-legend")
            .attr("cx", 0)
            .attr("cy", 0)
            .attr("r", 6)
            .style("fill", color)
            .on("mouseover", function (event, genre) {
                svg.selectAll(".bubble-circle")
                    .attr("opacity", d => d.genre === genre ? 1 : 0.1);
            })
            .on("mouseout", function () {
                svg.selectAll(".bubble-circle")
                    .attr("opacity", 0.7);
            })
            .on("click", function (event, genre) {  // 添加点击事件
                const bbox = this.getBoundingClientRect();
                const svgBox = svg.node().getBoundingClientRect();
                drawGenreROITrend(genre, bbox.x - svgBox.x, bbox.y - svgBox.y);
                function drawGenreROITrend(genre, x, y) {
                    d3.selectAll(".trend-chart-container").remove();
                    const trendContainer = svg.append("g")
                        .attr("class", "trend-chart-container")
                        .attr("transform", `translate(${x + 20}, ${y - 50})`);

                    const genreData = data.filter(d => d.genre === genre)
                        .sort((a, b) => a.year - b.year);

                    const trendMargin = { top: 20, right: 50, bottom: 30, left: 40 };
                    const trendWidth = 200;
                    const trendHeight = 150;

                    trendContainer.append("rect")
                        .attr("width", trendWidth + trendMargin.left + trendMargin.right)
                        .attr("height", trendHeight + trendMargin.top + trendMargin.bottom)
                        .attr("fill", "white")
                        .attr("stroke", "#ddd")
                        .attr("rx", 4);

                    const trendArea = trendContainer.append("g")
                        .attr("transform", `translate(${trendMargin.left},${trendMargin.top})`);

                    const trendXScale = d3.scaleLinear()
                        .domain([1960, 2016])
                        .range([0, trendWidth]);

                    const trendYScaleROI = d3.scaleLinear()
                        .domain([d3.min(genreData, d => d.roi), d3.max(genreData, d => d.roi)])
                        .range([trendHeight, 0]);

                    const trendYScaleMarket = d3.scaleLinear()
                        .domain([0, d3.max(genreData, d => d.marketShare)])
                        .range([trendHeight, 0]);

                    const roiLine = d3.line()
                        .x(d => trendXScale(d.year))
                        .y(d => trendYScaleROI(d.roi))
                        .curve(d3.curveCatmullRom);

                    const marketLine = d3.line()
                        .x(d => trendXScale(d.year))
                        .y(d => trendYScaleMarket(d.marketShare))
                        .curve(d3.curveCatmullRom);

                    trendArea.append("g")
                        .attr("transform", `translate(0,${trendHeight})`)
                        .call(d3.axisBottom(trendXScale)
                            .ticks(5)
                            .tickFormat(d3.format("d")));
                    trendArea.append("g")
                        .call(d3.axisLeft(trendYScaleROI)
                            .ticks(5)
                            .tickFormat(d => `${d.toFixed(0)}%`));
                    trendArea.append("g")
                        .attr("transform", `translate(${trendWidth}, 0)`)
                        .call(d3.axisRight(trendYScaleMarket)
                            .ticks(5)
                            .tickFormat(d => `${(d * 100).toFixed(1)}%`));
                    trendArea.append("path")
                        .datum(genreData)
                        .attr("fill", "none")
                        .attr("stroke", '#FA7F6F')
                        .attr("stroke-width", 2)
                        .attr("d", roiLine);
                    trendArea.append("path")
                        .datum(genreData)
                        .attr("fill", "none")
                        .attr("stroke", '#82B0D2')
                        .attr("stroke-width", 2)
                        .style("opacity", 0.6)
                        .attr("d", marketLine);
                    trendArea.selectAll(".trend-point-roi")
                        .data(genreData)
                        .enter()
                        .append("circle")
                        .attr("class", "trend-point-roi")
                        .attr("cx", d => trendXScale(d.year))
                        .attr("cy", d => trendYScaleROI(d.roi))
                        .attr("r", 3)
                        .attr("fill", '#FA7F6F');
                    trendArea.selectAll(".trend-point-market")
                        .data(genreData)
                        .enter()
                        .append("circle")
                        .attr("class", "trend-point-market")
                        .attr("cx", d => trendXScale(d.year))
                        .attr("cy", d => trendYScaleMarket(d.marketShare))
                        .attr("r", 3)
                        .attr("fill", '#82B0D2');

                    const legend = trendArea.append("g")
                        .attr("class", "trend-legend")
                        .attr("transform", `translate(${trendWidth / 2}, -5)`);

                    legend.append("text")
                        .attr("text-anchor", "middle")
                        .style("font-size", "12px")
                        .text(`${genre} Trends`);

                    trendArea.append("text")
                        .attr("transform", "rotate(-90)")
                        .attr("y", -30)
                        .attr("x", -trendHeight / 2)
                        .attr("text-anchor", "middle")
                        .style("font-size", "10px")
                        .text("ROI (%)");
                    trendArea.append("text")
                        .attr("transform", "rotate(-90)")
                        .attr("y", trendWidth + 30)
                        .attr("x", -trendHeight / 2)
                        .attr("text-anchor", "middle")
                        .style("font-size", "10px")
                        .text("Market Share (%)");

                    trendContainer.append("text")
                        .attr("x", trendWidth + trendMargin.left + trendMargin.right - 20)
                        .attr("y", 15)
                        .text("×")
                        .style("cursor", "pointer")
                        .style("font-size", "14px")
                        .on("click", () => trendContainer.remove());

                    const trendTooltip = d3.select("body").append("div")
                        .attr("class", "tooltip")
                        .style("opacity", 0);

                    trendArea.selectAll("circle")
                        .on("mouseover", function (event, d) {
                            const isROI = d3.select(this).classed("trend-point-roi");
                            trendTooltip.transition()
                                .duration(200)
                                .style("opacity", .9);
                            trendTooltip.html(
                                `Year: ${d.year}<br>` +
                                `${isROI ? 'ROI' : 'Market Share'}: ${isROI ?
                                    d.roi.toFixed(1) + '%' :
                                    (d.marketShare * 100).toFixed(2) + '%'}`
                            )
                                .style("left", (event.pageX + 5) + "px")
                                .style("top", (event.pageY - 28) + "px");
                        })
                        .on("mouseout", function () {
                            trendTooltip.transition()
                                .duration(500)
                                .style("opacity", 0);
                        });
                }
            });

        legend.append("text")
            .attr("x", 15)
            .attr("y", 4)
            .text(d => d);
    }

    function addQuartileLines() {
        // 收集所有年份的数据点
        const q1Points = [];
        const q3Points = [];

        Object.keys(roiQuartiles).sort((a, b) => +a - +b).forEach(year => {
            q1Points.push({
                x: xScale(+year),
                y: yScale(roiQuartiles[year].q1)
            });
            q3Points.push({
                x: xScale(+year),
                y: yScale(roiQuartiles[year].q3)
            });
        });

        const lineGenerator = d3.line()
            .x(d => d.x)
            .y(d => d.y)
            .curve(d3.curveCatmullRom.alpha(0.5));

        svg.append("path")
            .datum(q1Points)
            .attr("d", lineGenerator)
            .attr("stroke", "rgba(70, 130, 180, 0.7)")
            .attr("stroke-width", 3)
            .attr("fill", "none")
            .attr("class", "quartile-line");
        svg.append("path")
            .datum(q3Points)
            .attr("d", lineGenerator)
            .attr("stroke", "rgba(188, 75, 81, 0.7)")
            .attr("stroke-width", 3)
            .attr("fill", "none")
            .attr("class", "quartile-line");

        const areaGenerator = d3.area()
            .x(d => d.x)
            .y0(d => d.y0)
            .y1(d => d.y1)
            .curve(d3.curveCatmullRom.alpha(0.5));

        // 创建填充区域的数据
        const areaData = q1Points.map((point, i) => ({
            x: point.x,
            y0: point.y,
            y1: q3Points[i].y
        }));

        // 添加填充区域
        svg.append("path")
            .datum(areaData)
            .attr("d", areaGenerator)
            .attr("fill", "rgba(128, 128, 128, 0.1)") // 非常淡的灰色填充
            .attr("class", "quartile-area");
    }

    function addTitle() {
        svg.append("text")
            .attr("x", width / 2)
            .attr("y", -margin.top / 2)
            .attr("text-anchor", "middle")
            .attr("class", "axis-label")
            .text("Movie ROI and Market Share (1960-2016)");
    }
    // 添加年份轴和空心箭头
    /*
        这个箭头画的比较草率，主要是我的美术攻击比较差劲，之前画过实心的，惨不忍睹
        
    */
    function addYearAxis() {
        const axisY = height;  // 上线的位置
        const lineGap = 30;  // 两条线之间的距离
        const defs = svg.append("defs");

        defs.append("marker")
            .attr("id", "arrow-top")
            .attr("viewBox", "0 -5 10 10")
            .attr("refX", 8)
            .attr("refY", 0)
            .attr("markerWidth", 8)
            .attr("markerHeight", 8)
            .attr("orient", "auto")
            .append("path")
            .attr("d", "M 0,-3 L 8,0 L 0,3")
            .attr("fill", "none")
            .attr("stroke", "black")
            .attr("stroke-width", "1px");
        defs.append("marker")
            .attr("id", "arrow-bottom")
            .attr("viewBox", "0 -5 10 10")
            .attr("refX", 8)
            .attr("refY", 0)
            .attr("markerWidth", 8)
            .attr("markerHeight", 8)
            .attr("orient", "auto")
            .append("path")
            .attr("d", "M 0,-3 L 8,0 L 0,3")
            .attr("fill", "none")
            .attr("stroke", "black")
            .attr("stroke-width", "1px");
        svg.append("line")
            .attr("x1", 0)
            .attr("y1", axisY)
            .attr("x2", width)
            .attr("y2", axisY)
            .attr("stroke", "black")
            .attr("marker-end", "url(#arrow-top)")
            .attr("stroke-width", "1px");
        svg.append("line")
            .attr("x1", 0)
            .attr("y1", axisY + lineGap)
            .attr("x2", width)
            .attr("y2", axisY + lineGap)
            .attr("stroke", "black")
            .attr("marker-end", "url(#arrow-bottom)")
            .attr("stroke-width", "1px");

        const yearScale = xScale;
        const ticks = yearScale.ticks(10);

        const tickGroup = svg.selectAll(".year-tick")
            .data(ticks)
            .enter()
            .append("g")
            .attr("class", "year-tick")
            .attr("transform", d => `translate(${yearScale(d)}, ${axisY})`);
        tickGroup.append("line")
            .attr("x1", 0)
            .attr("y1", 0)
            .attr("x2", 0)
            .attr("y2", lineGap / 5)
            .attr("stroke", "black")
            .attr("stroke-width", "1px");
        tickGroup.append("line")
            .attr("x1", 0)
            .attr("y1", 4 * lineGap / 5)
            .attr("x2", 0)
            .attr("y2", lineGap)
            .attr("stroke", "black")
            .attr("stroke-width", "1px");
        tickGroup.append("text")
            .attr("x", 0)
            .attr("y", lineGap / 2)
            .attr("dy", "0.35em")
            .attr("text-anchor", "middle")
            .text(d => d)
            .style("font-size", "12px");
    }
    //绘制热力图
    function addHeatmap() {
        const heatmapWidth = width;
        const heatmapHeight = 150;
        const roiBins = 20;
        const minROI = -100;
        const maxROI = 1000;
        const heatmapXScale = xScale;

        const heatmapYScale = d3.scaleLinear()
            .domain([minROI, maxROI])
            .range([0, heatmapHeight]);
        const heatmapGroup = svg.append("g")
            .attr("class", "heatmap")
            .attr("transform", `translate(0, ${height + 30})`);
        const colorScale = d3.scaleSequential(d3.interpolateBlues)
            .domain([0, 1]);
        const years = d3.range(1960, 2019);
        const roiStep = (maxROI - minROI) / (roiBins - 1);
        const roiRanges = d3.range(roiBins).map(i =>
            minROI + roiStep * i
        );

        const gridData = [];
        years.forEach(year => {
            const yearData = data.filter(d => d.year === year);
            if (yearData.length > 0) {
                const totalMarketShare = d3.sum(yearData, d => d.marketShare);

                for (let i = 0; i < roiBins - 1; i++) {
                    const roiBottom = roiRanges[i];
                    const roiTop = roiRanges[i + 1];

                    const binData = yearData.filter(d =>
                        d.roi >= roiBottom && d.roi < roiTop
                    );

                    const binMarketShare = d3.sum(binData, d => d.marketShare);
                    const marketShareRatio = binMarketShare / totalMarketShare;

                    gridData.push({
                        year: year,
                        roiTop: roiTop,
                        roiBottom: roiBottom,
                        marketShareRatio: marketShareRatio,
                        details: binData
                    });
                }
            }
        });
        function addHeatmapCell() {
            heatmapGroup.selectAll("rect")
                .data(gridData)
                .enter()
                .append("rect")
                .attr("x", d => heatmapXScale(d.year))
                .attr("y", d => heatmapYScale(d.roiBottom))
                .attr("width", width / (2018 - 1960))
                .attr("height", d => heatmapYScale(d.roiTop) - heatmapYScale(d.roiBottom))
                .attr("fill", d => colorScale(d.marketShareRatio))
                .attr("stroke", "#fff")
                .attr("stroke-width", 0.5)
                .on("mouseover", function (event, d) {
                    addHeatmapTooltip();
                    addLegendTempLine();
                    LinkAndAddLineOnBubbleChart();
                    addYearDensityDistributionNearHeatmap();
                    function addHeatmapTooltip() {
                        tooltip.transition()
                            .duration(200)
                            .style("opacity", .9);
                        tooltip.html(
                            `Year: ${d.year}<br/>` +
                            `ROI Range: ${d.roiBottom.toFixed(1)}% - ${d.roiTop.toFixed(1)}%<br/>` +
                            `Market Share: ${(d.marketShareRatio * 100).toFixed(2)}%`
                        )
                            .style("left", (event.pageX + 10) + "px")
                            .style("top", (event.pageY - 28) + "px");
                    }
                    function addLegendTempLine() {
                        legendGroup.append("line")
                            .attr("class", "tempLine")
                            .attr("x1", 0)
                            .attr("x2", 0)
                            .attr("y1", heatmapHeight - d.marketShareRatio * heatmapHeight)
                            .attr("y2", heatmapHeight - d.marketShareRatio * heatmapHeight)
                            .attr("stroke", "rgba(188, 75, 81, 0.7)")
                            .attr("stroke-width", "2px")
                            .transition()
                            .duration(200)
                            .attr("x2", 20)
                            .attr("y2", heatmapHeight - d.marketShareRatio * heatmapHeight);
                        console.log(d.marketShareRatio * heatmapHeight)
                    }
                    function LinkAndAddLineOnBubbleChart() {
                        svg.append("line")
                            .attr("class", "roi-range-line")
                            .attr("x1", 0)
                            .attr("y1", yScale(d.roiTop))
                            .attr("x2", width)
                            .attr("y2", yScale(d.roiTop))
                            .attr("stroke", "rgba(188, 75, 81, 0.7)")
                            .attr("stroke-width", "1px")
                            .attr("stroke-dasharray", "5,5");
                        svg.append("line")
                            .attr("class", "roi-range-line")
                            .attr("x1", 0)
                            .attr("y1", yScale(d.roiBottom))
                            .attr("x2", width)
                            .attr("y2", yScale(d.roiBottom))
                            .attr("stroke", "rgba(188, 75, 81, 0.7)")
                            .attr("stroke-width", "1px")
                            .attr("stroke-dasharray", "5,5");
                        svg.selectAll(".bubble-circle")
                            .attr("opacity", function (bubbleData) {
                                if (bubbleData.roi >= d.roiBottom && bubbleData.roi <= d.roiTop) return 1;
                                else return 0.1;
                            });
                    }
                    function addYearDensityDistributionNearHeatmap() {
                        const yearData = data.filter(item => item.year === d.year);
                        const yearRois = yearData.map(item => item.roi);

                        const densityWidth = 50;  // 密度图宽度
                        const densityX = width + 80;  // 密度图x位置（在原图右侧）

                        const kde = kernelDensityEstimator(kernelEpanechnikov(25), heatmapYScale.ticks(100));
                        const density = kde(yearRois);

                        const maxDensity = d3.max(density, d => d[1]);
                        const densityScale = d3.scaleLinear()
                            .domain([0, maxDensity])
                            .range([0, densityWidth]);

                        const yearDistributionLine = d3.line()
                            .curve(d3.curveBasis)
                            .x(d => densityX + densityScale(d[1]))
                            .y(d => heatmapYScale(d[0]));

                        const yearDistributionArea = d3.area()
                            .curve(d3.curveBasis)
                            .x0(densityX)
                            .x1(d => densityX + densityScale(d[1]))
                            .y(d => heatmapYScale(d[0]));

                        svg.append("path")
                            .datum(density)
                            .attr("class", "year-distribution-line")
                            .attr("transform", `translate(0, ${height + 30})`)  // 与热力图对齐
                            .attr("d", yearDistributionLine)
                            .attr("fill", "none")
                            .attr("stroke", "rgba(188, 75, 81, 0.7)")
                            .attr("stroke-width", 2);

                        svg.append("path")
                            .datum(density)
                            .attr("class", "year-distribution-area")
                            .attr("transform", `translate(0, ${height + 30})`)  // 与热力图对齐
                            .attr("d", yearDistributionArea)
                            .attr("fill", "rgba(188, 75, 81, 0.2)");

                        svg.append("text")
                            .attr("class", "year-distribution-label")
                            .attr("transform", `translate(${densityX}, ${height + 20})`)
                            .attr("text-anchor", "middle")
                            .attr("fill", "black")
                            .attr("font-size", "12px")
                            .text(`Year: ${d.year}`);
                    }
                })
                .on("mouseout", function () {
                    removeTooltip();
                    removeLegendTempLine();
                    removeOnLineOnBubbleChart();
                    removeYearDensityDistribution();
                    function removeTooltip() {
                        tooltip.transition()
                            .duration(500)
                            .style("opacity", 0);
                    }
                    function removeLegendTempLine() {
                        legendGroup.selectAll(".tempLine")
                            .transition()
                            .duration(200)
                            .attr("x2", function () { return this.getAttribute("x1"); })
                            .attr("y2", function () { return this.getAttribute("y1"); })
                            .remove();
                    }
                    function removeOnLineOnBubbleChart() {
                        svg.selectAll(".roi-range-line").remove();
                        svg.selectAll("circle")
                            .attr("opacity", 0.7);
                    }
                    function removeYearDensityDistribution() {
                        svg.selectAll(".year-distribution-line").remove();
                        svg.selectAll(".year-distribution-area").remove();
                        svg.selectAll(".year-distribution-label").remove();
                    }
                }
                );
        }
        const yAxisGroup = heatmapGroup.append("g")
            .call(d3.axisLeft(heatmapYScale)
                .ticks(11)
                .tickValues(d3.range(-100, 1001, 100))
                .tickFormat(d => d === -100 ? '' : `${d.toFixed(0)}%`));
        yAxisGroup.append("text")
            .attr("class", "axis-label")
            .attr("transform", `translate(-50, ${heatmapHeight / 2}) rotate(-90)`)
            .attr("text-anchor", "middle")
            .attr("fill", "black")
            .attr("font-size", "12px")
            .text("ROI (%)");
        function addColorLegend(heatmapGroup, colorScale, height, width, position = {}) {
            const legendConfig = {
                x: width - 60,
                y: height + heatmapHeight + margin.bottom + 170,
                width: 20,
                labelOffset: 40,
                ...position
            };
            const legendGroup = heatmapGroup.append("g")
                .attr("transform", `translate(${legendConfig.x}, ${legendConfig.y})`);
            const defs = heatmapGroup.append("defs");
            const linearGradient = defs.append("linearGradient")
                .attr("id", "heatmap-gradient")
                .attr("x1", "0%")
                .attr("y1", "100%")
                .attr("x2", "0%")
                .attr("y2", "0%");
            linearGradient.selectAll("stop")
                .data(d3.range(0, 1.1, 0.1))
                .enter()
                .append("stop")
                .attr("offset", d => `${d * 100}%`)
                .attr("stop-color", d => colorScale(d));
            legendGroup.append("rect")
                .attr("width", legendConfig.width)
                .attr("height", height)
                .style("fill", "url(#heatmap-gradient)");
            const legendScale = d3.scaleLinear()
                .domain([100, 0])
                .range([0, height]);
            const legendAxis = d3.axisRight(legendScale)
                .ticks(5)
                .tickFormat(d => `${d}%`);
            legendGroup.append("g")
                .attr("transform", `translate(${legendConfig.width}, 0)`)
                .call(legendAxis);
            legendGroup.append("text")
                .attr("transform", `translate(${legendConfig.width + legendConfig.labelOffset}, ${height / 2}) rotate(-90)`)
                .attr("text-anchor", "middle")
                .attr("class", "axis-label")
                .text("Market Share");
            legendGroup.append("line")
                .attr("x1", 0)
                .attr("x2", legendConfig.width)
                .attr("y1", 0)
                .attr("y2", 0)
                .attr("stroke", "black")
                .attr("stroke-width", "1px");
            legendGroup.append("line")
                .attr("x1", 0)
                .attr("x2", legendConfig.width)
                .attr("y1", height)
                .attr("y2", height)
                .attr("stroke", "black")
                .attr("stroke-width", "1px");
            return legendGroup;
        }
        function addHeatmapTitle() {
            heatmapGroup.append("text")
                .attr("x", width / 2)
                .attr("y", heatmapHeight + 40)
                .attr("text-anchor", "middle")
                .attr("class", "axis-label")
                .text("ROI Distribution by Year and Market Share");
        }
        function addHeatmapButtomAndLeftLine() {
            heatmapGroup.append("line")
                .attr("x1", 0)
                .attr("x2", width)
                .attr("y1", heatmapHeight)
                .attr("y2", heatmapHeight)
                .attr("stroke", "black")
                .attr("stroke-width", "1px");
            heatmapGroup.append("line")
                .attr("x1", 0)
                .attr("x2", 0)
                .attr("y1", 0)
                .attr("y2", heatmapHeight)
                .attr("stroke", "black")
                .attr("stroke-width", "1px");
        }
        addHeatmapCell();
        legendGroup = addColorLegend(svg, colorScale, heatmapHeight, width + 60);
        addHeatmapTitle();
        addHeatmapButtomAndLeftLine();
    }

    // 绘制图表--------------------上映时间与时长关系展示
    /*
        这个是临时赶工（不是），交互比较少，起始可以添加很多交互
    */
    function addRuntimeAnalysis() {
        const runtimeMargin = { top: 20, right: 20, bottom: 20, left: 0 };
        const runtimeWidth = 250;
        const runtimeGroup = svg.append("g")
            .attr("class", "runtime-analysis")
            .attr("transform", `translate(${width + margin.right / 4}, ${runtimeMargin.top})`);
        function calculateAverages(runtimeData, marketShareData) {
            const averages = {};
            Object.keys(runtimeData).forEach(year => {
                Object.entries(runtimeData[year]).forEach(([genre, runtime]) => {
                    if (!averages[genre]) {
                        averages[genre] = {
                            genre: genre,
                            runtime: 0,
                            runtimeCount: 0,
                            marketShare: 0,
                            marketShareCount: 0
                        };
                    }
                    averages[genre].runtime += runtime;
                    averages[genre].runtimeCount++;

                    if (marketShareData[year] && marketShareData[year][genre]) {
                        averages[genre].marketShare += marketShareData[year][genre] * 100;
                        averages[genre].marketShareCount++;
                    }
                });
            });
            return Object.values(averages).map(d => ({
                genre: d.genre,
                runtime: d.runtime / d.runtimeCount,
                marketShare: d.marketShare / d.marketShareCount
            })).sort((a, b) => b.runtime - a.runtime);
        }
        const averageData = calculateAverages(runtimeData, marketShareData);
        const runtimeXScale = d3.scaleLinear()
            .domain([0, d3.max(averageData, d => d.runtime)])
            .range([0, runtimeWidth]);

        const runtimeYScale = d3.scaleBand()
            .domain(averageData.map(d => d.genre))
            .range([0, height])
            .padding(0.3);
        runtimeGroup.append("text")
            .attr("class", "runtime-title")
            .attr("x", runtimeWidth / 2)
            .attr("y", -10)
            .attr("text-anchor", "middle")
            .style("font-size", "14px")
            .style("font-weight", "bold")
            .text("Average Runtime & Market Share");
        const bars = runtimeGroup.selectAll(".runtime-bar-group")
            .data(averageData)
            .enter()
            .append("g")
            .attr("class", "runtime-bar-group")
            .attr("transform", d => `translate(0,${runtimeYScale(d.genre)})`);
        bars.append("rect")
            .attr("class", "runtime-bar")
            .attr("x", 0)
            .attr("y", 0)
            .attr("height", runtimeYScale.bandwidth())
            .attr("fill", d => color(d.genre))
            .attr("opacity", 0.7)
            .transition()
            .duration(750)
            .attr("width", d => runtimeXScale(d.runtime));
        const marketShareScale = d3.scaleSqrt()
            .domain([0, d3.max(averageData, d => d.marketShare)])
            .range([4, 15]);
        bars.append("circle")
            .attr("class", "market-share-indicator")
            .attr("cx", d => runtimeXScale(d.runtime) + 10)
            .attr("cy", runtimeYScale.bandwidth() / 2)
            .attr("r", d => marketShareScale(d.marketShare))
            .attr("fill", "white")
            .attr("stroke", d => color(d.genre))
            .attr("stroke-width", 2)
            .style("opacity", 0.8);
        bars.append("text")
            .attr("class", "runtime-label")
            .attr("x", d => runtimeXScale(d.runtime) + 25)
            .attr("y", runtimeYScale.bandwidth() / 2)
            .attr("dy", "0.35em")
            .style("font-size", "11px")
            .text(d => `${Math.round(d.runtime)}min (${d.marketShare.toFixed(1)}%)`);

        bars.on("mouseenter", function (event, d) {
            svg.selectAll("circle")
                .attr("opacity", circle => circle.genre === d.genre ? 1 : 0.1);
            d3.select(this).select(".runtime-bar")
                .attr("opacity", 1)
                .attr("stroke", "#fff")
                .attr("stroke-width", 1);
            tooltip.transition()
                .style("opacity", .9);
            tooltip.html(`<strong>${d.genre}</strong><p>Average Runtime: ${Math.round(d.runtime)}min</p><p>Average Market Share: ${d.marketShare.toFixed(1)}%</p>`)
                .style("left", (event.pageX + 5) + "px")
                .style("top", (event.pageY - 28) + "px")
        })
            .on("mouseleave", function () {
                svg.selectAll("circle")
                    .attr("opacity", 0.7);
                d3.select(this).select(".runtime-bar")
                    .attr("opacity", 0.7)
                    .attr("stroke", "none");
                tooltip.transition()
                    .style("opacity", 0);
            });
        runtimeGroup.append("g")
            .attr("class", "runtime-axis")
            .attr("transform", `translate(0,${height})`)
            .call(d3.axisBottom(runtimeXScale)
                .ticks(5)
                .tickFormat(d => `${d}min`));
    }
    //添加一个按照年份进行会排序放映时间的函数
    // 这个是通过年份索引表示的
    // 但是我还没找到合适的调用返回的工具
    function updateRuntimeAnalysis(year) {
        svg.selectAll(".runtime-analysis").remove();
        const runtimeMargin = { top: 20, right: 20, bottom: 20, left: 0 };
        const runtimeWidth = 250;
        const runtimeGroup = svg.append("g")
            .attr("class", "runtime-analysis")
            .attr("transform", `translate(${width + margin.right / 4}, ${runtimeMargin.top})`);
        const yearData = [];
        Object.entries(runtimeData[year] || {}).forEach(([genre, runtime]) => {
            if (marketShareData[year] && marketShareData[year][genre] !== undefined) {
                yearData.push({
                    genre: genre,
                    runtime: runtime,
                    marketShare: marketShareData[year][genre] * 100
                });
            }
        });
        yearData.sort((a, b) => b.runtime - a.runtime);
        const runtimeXScale = d3.scaleLinear()
            .domain([0, d3.max(yearData, d => d.runtime)])
            .range([0, runtimeWidth]);
        const runtimeYScale = d3.scaleBand()
            .domain(yearData.map(d => d.genre))
            .range([0, height])
            .padding(0.3);
        runtimeGroup.append("text")
            .attr("class", "runtime-title")
            .attr("x", runtimeWidth / 2)
            .attr("y", -10)
            .attr("text-anchor", "middle")
            .style("font-size", "14px")
            .style("font-weight", "bold")
            .text(`Movie Runtime Analysis (${year})`);
        const bars = runtimeGroup.selectAll(".runtime-bar-group")
            .data(yearData)
            .enter()
            .append("g")
            .attr("class", "runtime-bar-group")
            .attr("transform", d => `translate(0,${runtimeYScale(d.genre)})`);
        bars.append("rect")
            .attr("class", "runtime-bar")
            .attr("x", 0)
            .attr("y", 0)
            .attr("height", runtimeYScale.bandwidth())
            .attr("fill", d => color(d.genre))
            .attr("opacity", 0.7)
            .transition()
            .duration(750)
            .attr("width", d => runtimeXScale(d.runtime));
        const marketShareScale = d3.scaleSqrt()
            .domain([0, d3.max(yearData, d => d.marketShare)])
            .range([4, 15]);
        bars.append("circle")
            .attr("class", "market-share-indicator")
            .attr("cx", d => runtimeXScale(d.runtime) + 10)
            .attr("cy", runtimeYScale.bandwidth() / 2)
            .attr("r", d => marketShareScale(d.marketShare))
            .attr("fill", "white")
            .attr("stroke", d => color(d.genre))
            .attr("stroke-width", 2)
            .style("opacity", 0.8);
        bars.append("text")
            .attr("class", "runtime-label")
            .attr("x", d => runtimeXScale(d.runtime) + 25)
            .attr("y", runtimeYScale.bandwidth() / 2)
            .attr("dy", "0.35em")
            .style("font-size", "11px")
            .text(d => `${Math.round(d.runtime)}min (${d.marketShare.toFixed(1)}%)`);
        bars.on("mouseenter", function (event, d) {
            svg.selectAll("circle")
                .attr("opacity", circle => circle.genre === d.genre ? 1 : 0.1);
            d3.select(this).select(".runtime-bar")
                .attr("opacity", 1)
                .attr("stroke", "#fff")
                .attr("stroke-width", 1);
        })
            .on("mouseleave", function () {
                svg.selectAll("circle")
                    .attr("opacity", 0.7);
                d3.select(this).select(".runtime-bar")
                    .attr("opacity", 0.7)
                    .attr("stroke", "none");
            });
        runtimeGroup.append("g")
            .attr("class", "runtime-axis")
            .attr("transform", `translate(0,${height})`)
            .call(d3.axisBottom(runtimeXScale)
                .ticks(5)
                .tickFormat(d => `${d}min`));
    }
    function addImage(event, index) {
        svg.selectAll("image").remove();
        str = './assets/' + index + ".webp";
        console.log(str);
        svg.append("image")
            .attr("xlink:href", str)
            .attr("width", 185)
            .attr("height", 185)
            .attr("x", 850)
            .attr("y", 517)
            .attr("class", "IMG")
            .on("mouseover", function () {
                d3.select(this).style("cursor", "pointer");
            })
            .on("mouseout", function () {
                d3.select(this).style("cursor", "default");
            })
            .on("click", function () {
                svg.selectAll("image").remove();
            });
    }


    function addButton() {
        // 添加跳转按钮
        var navigateButtonContainer = d3.select("#chart")
            .append("div")
            .attr("id", "navigate-button-container")
            .style("top", `${margin.bottom + height + margin.top + 30}px`)
            .style("left", `${width + margin.left + margin.right-100}px`)
            .style("position", "absolute")
            .style("transform", "translateX(-50%)");

        navigateButtonContainer.append("button")
            .attr("id", "navigate-button")
            .style("padding", "5px 8px")
            .attr("class", "border-button")
            .text("Time Line")

        document.getElementById("navigate-button").addEventListener("click", function () {
            window.location.href = "../second_draft.html";
        });
    }

    addGrid();
    addAxes();
    addDensityDistribution();
    addBubbles();
    addLegend();
    addQuartileLines();
    addTitle();

    addHeatmap();
    addYearAxis();
    addRuntimeAnalysis();

    addButton();

});
