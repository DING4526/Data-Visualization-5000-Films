
        // ---------------------------//
        //         INITIALIZED        //
        // ---------------------------//

        var svgWidth = window.innerWidth
        var svgHeight = window.innerHeight*0.93
        var max_r = 25
        var max_x = 10
        var max_y = 3E+9
        var max_z = 4E+8
        var auto_on = true
        var animationInterval = 100; // 每步动画的时间间隔（毫秒）
        const startDate = new Date("1972/01/01")
        const endDate = new Date("2016/09/09")
        const max_R = max_r

        var originalOrder = [];       // 保存初始顺序的数组

        // set the dimensions and margins of the graph
        var margin = { top: 90, right: 420, bottom: 60, left: 150 },
            width = svgWidth - margin.left - margin.right,
            height = svgHeight - margin.top - margin.bottom;

        // append the svg object to the body of the page
        var svg = d3.select("#main-container")
            .append("svg")
            .attr("width", width + margin.left + margin.right)
            .attr("height", height + margin.top + margin.bottom)
            .append("g")
            .attr("id", "chart-container")
            .attr("transform",
                "translate(" + margin.left + "," + margin.top + ")");
        svg.insert("rect", ":first-child") // 在 <g> 的最前面插入
            .attr("class", "chart-background")
            .attr("x", 0) // 背景矩形的起点 X 坐标
            .attr("y", 0) // 背景矩形的起点 Y 坐标
            .attr("width", width) // 矩形的宽度
            .attr("height", height) // 矩形的高度
            .attr("fill", "white"); // 设置背景颜色为白色

        //Read the data
        d3.csv("movies.csv", function (data) {
            // 数据预处理，每行数据逐个处理
            data.vote_average = +data.vote_average; // 确保 vote_average 是数值类型
            // 检查 genres 字段是否有效，并解析
            if (data.genres && data.genres !== "undefined" && data.genres !== "") {
                try {
                    // 处理 genres 字段的双引号转义，并解析 JSON
                    data.genres_list = JSON.parse(data.genres.replace(/""/g, '"'))
                        .map(function (genre) { return genre.name; });
                } catch (e) {
                    console.error("JSON 解析错误:", data.genres, e);
                    data.genres_list = []; // 设置默认空数组
                }
            } else {
                data.genres_list = []; // 设置默认空数组
            }
            return data;
        }, function (error, data) {

            // ---------------------------//
            //         ORDER RESET        //
            // ---------------------------//

            // 记录初始顺序
            function saveOriginalOrder() {
                d3.selectAll(".bubbles").each(function (d, i) {
                    originalOrder[i] = this; // 保存每个元素的引用
                });
            }

            // 恢复初始顺序
            function restoreOriginalOrder() {
                originalOrder.forEach(function (element) {
                    element.parentNode.appendChild(element); // 按初始顺序重新添加元素
                });
            }

            // 将特定类别的气泡置顶
            function bringToFront(selectedClass) {
                d3.selectAll(".bubbles." + selectedClass.replace(/\s+/g, '-'))
                    .each(function () {
                        this.parentNode.appendChild(this); // 将选中类别的气泡移到顶层
                    });
            }

            // ---------------------------//
            //        DATA PROVIDER       //
            // ---------------------------//

            // vote_average 数组 重新映射
            var voteAverages = data.map(function (d) { return d.vote_average; });
            var minVote = d3.min(voteAverages);
            var maxVote = d3.max(voteAverages);
            var rescaleVote = d3.scaleLinear()
                .domain([minVote, maxVote]) // 输入范围
                .range([2, 9.5]); // 输出范围
            data.forEach(function (d) {
                d.budget = +d.budget
                d.revenue = +d.revenue; // 将 revenue 转为数字类型
                d.vote_average = +rescaleVote(d.vote_average).toFixed(2); // 转换并保留1位小数
            });

            // genre_menu 保存电影类型序列
            var genre_menu = ["Drama", "Comedy", "Thriller", "Action", "Romance", "Adventure", "Crime", "Science-Fiction", "Horror", "Family", "Animation", "Others"]

            //维护交互变量
            const state = {
                selectedDate: auto_on ? startDate : endDate, // 当前选中的上映时间
                maxY: max_y, // 当前 Y 轴最大值
                maxX: max_x, //当前 X 最大值
                selectedGenre: null, // 当前选中的电影类别
                hoveredGenre: null, // 当前悬停的电影类别
                SelectedDot: null, // 当前选中的唯一bubble
                isAnimating: false, // 标记是否正在播放动画
                timer: null, // 保存动画的计时器引用
                isSwapped: false, // 用于跟踪是否交换了 X 和 Z 轴
            };

            // ---------------------------//
            //           UPDATE           //
            // ---------------------------//

            function updateBubbles() {
                svg.selectAll(".bubbles")
                    .transition()
                    .duration(30)
                    .style("opacity", function (d) {
                        const inDateRange = state.selectedDate ? d.release_date_parsed <= state.selectedDate : true;
                        const inYRange = d.revenue <= state.maxY && (state.isSwapped ? d.budget <= state.maxX : 1);
                        const inGenre =
                            state.selectedGenre ? genre(d) === state.selectedGenre : // 如果有选中的类别，判断是否匹配
                                state.hoveredGenre ? genre(d) === state.hoveredGenre : // 如果有悬停的类别，判断是否匹配
                                    true; // 如果两者都没有，所有气泡显示
                        // return inDateRange && inYRange && inGenre ? 0.8 : 0; // 仅在满足所有条件时显示
                        return inDateRange && inYRange && inGenre ? (state.isSwapped ? z(d.vote_average) : 0.8) : 0
                    })
                    .style("pointer-events", function (d) {
                        const inDateRange = state.selectedDate ? d.release_date_parsed <= state.selectedDate : true;
                        const inYRange = d.revenue <= state.maxY && (state.isSwapped ? d.budget <= state.maxX : 1);
                        const inGenre =
                            state.selectedGenre ? genre(d) === state.selectedGenre : // 如果有选中的类别，判断是否匹配
                                state.hoveredGenre ? genre(d) === state.hoveredGenre : // 如果有悬停的类别，判断是否匹配
                                    true; // 如果两者都没有，所有气泡显示
                        return inDateRange && inYRange && inGenre ? "all" : "none"; // 禁止鼠标事件
                    })
                    .attr("cx", function (d) {
                        return state.isSwapped ? x(d.budget) : x(d.vote_average);
                    })
                    .attr("r", function (d) {
                        return state.isSwapped ? max_R / 5 : z(d.budget); // 固定半径
                    });


                // 更新 KDE
                drawRevenueKDE();
                // drawKDECurve(); // 在每次更新时绘制核密度曲线

                // 如果有选中的类别，将其气泡置顶
                if (state.selectedGenre) {
                    bringToFront(state.selectedGenre);
                }
                else {
                    restoreOriginalOrder();
                }
            }

            function updateLegends() {
                svg.selectAll(".legend-Genres").classed("legend-Genres-hover", function (d) {
                    const isDotGenre =
                        state.selectedDot && genre(state.selectedDot) === d;
                    return (
                        state.selectedGenre === d ||
                        state.hoveredGenre === d ||
                        isDotGenre // 如果选中的点的类别对应图例，则高亮
                    )
                })
            }

            // 更新比例尺和气泡半径
            function updateBubbleSizes() {
                // 更新比例尺 z
                z = d3.scalePow().exponent(1 / 2)
                    .domain([0, max_z])
                    .range([0, max_r]);

                // 更新所有气泡的半径
                svg.selectAll(".bubbles")
                    // .transition() // 添加动画效果
                    // .duration(100)
                    .attr("r", function (d) { return z(d.budget); });

                // 更新 legend-Bubbles
                updateLegendBubbles();
            }

            // 更新 legend-Bubbles 的函数
            function updateLegendBubbles() {
                // 更新 circles
                legendBubblesGroup.selectAll("circle")
                    .data(valuesToShow)
                    .attr("cy", function (d) { return - z(d); })
                    .attr("r", function (d) { return z(d); });

                // 更新 lines
                legendBubblesGroup.selectAll("line")
                    .data(valuesToShow)
                    .attr("x1", function (d) { return max_R + z(d); })
                    .attr("x2", max_R + max_r * 2)
                    .attr("y1", function (d) { return - z(d); })
                    .attr("y2", function (d) { return - z(d); })

                // 更新 labels
                legendBubblesGroup.selectAll("text")
                    .data(valuesToShow)
                    .attr("x", function (d) { return max_R + max_r * 2 + 10; })
                    .attr("y", function (d) { return - z(d); })
                    .text(function (d) { return (d / 1e6).toFixed(1) + "M"; });
            }

            function updateFilteredData() {
                const filteredData = data.filter(function (d) {
                    const inDateRange = d.release_date_parsed <= state.selectedDate ? true : false;
                    const inGenre =
                        state.selectedGenre ? genre(d) === state.selectedGenre : // 如果有选中的类别，判断是否匹配
                            true; // 如果没有，所有气泡显示
                    return inDateRange && inGenre
                });
                return filteredData
            }

            function auto_updateAxis() {
                auto_updateYAxis()
                auto_updateXAxis()
                drawGridlines()
            }

            // 控制显示或隐藏 x-max-slider-container
            function updateToolsVisibility() {
                if (state.isSwapped == 0) {
                    d3.select("#x-max-slider-container").style("display", "none");
                    d3.select(".legend-Bubbles").style("display", "block");
                    d3.select("#max-r-button-container").style("display", "flex")
                } else {
                    d3.select("#x-max-slider-container").style("display", "flex");
                    d3.select(".legend-Bubbles").style("display", "none");
                    d3.select("#max-r-button-container").style("display", "none")
                }
            }

            function updateColorLegend() {
                // 移除已有的色谱图例（避免重复创建）
                d3.select(".color-legend").remove();
                d3.select("defs #opacity-gradient-vertical").remove(); // 移除渐变定义，避免重复

                // 如果未交换轴或者未选择任何种类，则不显示色谱图例
                // if (!state.isSwapped || !state.selectedGenre) return;
                if (!state.isSwapped) return;

                // 获取选中 Genre 的颜色
                const selectedGenreColor = state.selectedGenre ? myColor(state.selectedGenre) : "black";

                // 创建图例容器
                const colorLegendGroup = svg.append("g")
                    .attr("class", "color-legend")
                    .attr("transform", `translate(${xLegend}, ${yLegendBubblesGrop + 60})`); // 与 legend-Bubbles 相同位置

                // 定义线性渐变
                const gradientId = "opacity-gradient-vertical";
                const gradient = svg.append("defs")
                    .append("linearGradient")
                    .attr("id", gradientId)
                    .attr("x1", "0%")
                    .attr("x2", "0%") // 改为竖直方向渐变
                    .attr("y1", "100%") // 从底部开始
                    .attr("y2", "0%"); // 到顶部结束

                // 添加渐变色段（从完全透明到完全不透明）
                const opacityStops = d3.range(0, 1.1, 0.1); // 生成渐变点（0 到 1，步长为 0.1）
                opacityStops.forEach(opacity => {
                    gradient.append("stop")
                        .attr("offset", `${opacity * 100}%`) // 偏移比例
                        .attr("stop-color", selectedGenreColor) // 颜色保持一致
                        .attr("stop-opacity", opacity); // 通过透明度渐变
                });

                // 添加渐变色块
                colorLegendGroup.append("rect")
                    .attr("x", 0) // 保持水平居中
                    .attr("y", -max_r * 5) // 使色块向上延伸
                    .attr("width", max_r) // 色块宽度
                    .attr("height", max_r * 5) // 色块高度
                    .style("fill", `url(#${gradientId})`);

                // 添加坐标刻度
                const legendScale = d3.scaleLinear()
                    .domain([10, 4]) // 调整透明度范围为 4-10
                    .range([-max_r * 5, 0]); // 对应色块长度从顶部到底部

                const legendAxis = d3.axisRight(legendScale) // 竖直刻度，显示在色块右侧
                    .ticks(7) // 刻度数量
                    .tickFormat(d3.format(".0f")); // 格式化为整数

                colorLegendGroup.append("g")
                    .attr("class", "color-axis")
                    .attr("transform", `translate(${max_r}, 0)`) // 刻度轴放到色块右侧
                    .call(legendAxis)
                    .selectAll("text")
                    .attr("class", "axis_text");

                // 添加竖版文字
                // colorLegendGroup.append("text")
                //     .attr("class", "legend-label")
                //     .attr("x", max_r * 2) // 放在刻度右侧
                //     .attr("y", -max_r * 3) // 居中放置在色块旁
                //     .attr("transform", `rotate(90, ${max_r * 2}, ${-max_r * 2.5})`) // 旋转 90 度
                //     .attr("text-anchor", "middle") // 文本居中
                //     .style("font-size", "14px")
                //     .style("font-weight", "bold")
                //     .text("IMDB RATING");
                colorLegendGroup.append("text")
                    .attr("class", "legend-label")
                    .attr("x", 0) // 放在刻度右侧
                    .attr("y", -140) // 居中放置在色块旁
                    .attr("text-anchor", "middle") // 文本居中
                    .style("font-size", "14px")
                    .style("font-weight", "bold")
                    .text("TMDB RATING");

            }



            // ---------------------------//
            //       AXIS AND SCALE       //
            // ---------------------------//

            // Title of the whole chart
            svg.append("text")
                .attr("x", width * 3 / 5 + 20)
                .attr("y", -35)
                .attr("class", "title")
                .text("Genres, Ratings, and ROI: A Time-Lapse of Movie Trends")
                .attr("text-anchor", "middle");

            // Add X axis
            var x = d3.scaleLinear()
                .domain([1.5, max_x])
                .range([0, width]);
            // 定义 X 轴，并绑定到 g 元素
            var axis_x = svg.append("g")
                .attr("class", "x-axis") // 添加一个类，方便选择
                .attr("transform", "translate(0," + height + ")")
                .call(d3.axisBottom(x).ticks(10)); // 此处 axis_x 是 g 选择器

            // 设置文本样式（可选）
            axis_x.selectAll("text") // 单独设置文本样式
                .attr("class", "axis_text")

            // Add X axis title:
            svg.append("text")
                .attr("class", "axis_title")
                .attr("text-anchor", "left")
                .attr("x", width + 25)
                .attr("y", height )
                .text("TMDB Rating");

            // Add Y axis
            var y = d3.scaleLinear()
                .domain([0, max_y])
                .range([height, 0]);
            var axis_y = svg.append("g")
                .call(d3.axisLeft(y).ticks(10)
                    .tickFormat(function (d) {
                        return (d / 1e6).toLocaleString()
                    })
                )
            axis_y.selectAll("text")
                .attr("class", "axis_text");

            // Add Y axis title:
            svg.append("text")
                .attr("class", "axis_title")
                .attr("text-anchor", "start")
                .attr("x", 30)
                .attr("y", -margin.top * 1 / 5)
                .text("Revenue(Million)")

            // Add a scale for bubble size
            var z = d3.scalePow().exponent(1 / 2)
                .domain([0, max_z])
                .range([0, max_r]);

            // Add a scale for bubble color
            var myColor = d3.scaleOrdinal()
                .domain(genre_menu)
                .range(d3.schemeCategory20);

            // 在初始化或比例尺更新时调用
            drawGridlines();


            // ---------------------------//
            //          TOOLTIP           //
            // ---------------------------//

            // -1- Create a tooltip div that is hidden by default:
            var tooltip = d3.select("#main-container")
                .append("div")
                .style("opacity", 0)
                .attr("class", "tooltip")
                .style("background-color", "black")
                .style("border-radius", "5px")
                .style("padding", "10px")
                .style("color", "white")
                .style("position", "absolute"); // 关键：确保 tooltip 绝对定位


            // -2- Create 3 functions to show / update (when mouse move but stay on same circle) / hide the tooltip
            var showTooltip = function (d) {
                const index = state.isSwapped ? -5 : 1
                tooltip
                    .transition()
                    .duration(200)
                    .style("opacity", 0.8)
                    .style("left", (d3.mouse(this)[0] - index * 50) + "px")
                    .style("top", (d3.mouse(this)[1] + 20) + "px")
                tooltip
                    .html(
                        `<div>
                            <strong>Title:</strong> ${d.title || "Unknown"}（${d.release_date}）<br>
                            <strong>Genres:</strong> ${d.genres_list.join(", ") || "Unknown"}<br>
                            <strong>Revenue:</strong> $ ${d.revenue ? (Math.round(d.revenue / 1E+6)).toLocaleString() : "N/A"} Million<br>
                            <strong>Budget:</strong> $ ${d.budget ? (Math.round(d.budget / 1E+6)).toLocaleString() : "N/A"} Million<br>
                            <strong>Rating:</strong> ${d.vote_average ? (parseFloat(d.vote_average).toFixed(1)) : "N/A"} / 10
                        </div>`
                    )
            }
            var moveTooltip = function (d) {
                const index = state.isSwapped ? -3 : 1
                tooltip
                    .style("left", (d3.mouse(this)[0] - index * 50) + "px")
                    .style("top", (d3.mouse(this)[1] + 20) + "px")
            }
            var hideTooltip = function (d) {
                tooltip
                    .transition()
                    .duration(200)
                    .style("opacity", 0)
            }


            // ---------------------------//
            //          CIRCLES           //
            // ---------------------------//

            function genre(d) {
                // 添加安全检查，确保 d.genres_list 存在且是数组
                if (Array.isArray(d.genres_list) && d.genres_list.length > 0) {
                    // console.log("当前行数据:", d.genres_list);
                    const firstGenre = d.genres_list[0].replace(/\s+/g, '-'); // 获取第一个 genre
                    if (genre_menu.includes(firstGenre)) return firstGenre
                    if (d.genres_list.length > 1) {
                        const secondGenre = d.genres_list[1].replace(/\s+/g, '-'); // 获取第二个 genre
                        if (genre_menu.includes(secondGenre)) return secondGenre
                    }
                    return "Others";
                }
                else {
                    console.log("当前行数据为空或未定义");
                    return "Unknown";
                }
            }

            // Add dots
            svg.append('g')
                .selectAll("dot")
                .data(data)
                .enter()
                .append("circle")
                .attr("class", function (d) { return "bubbles " + genre(d); })
                .attr("cx", function (d) { return x(d.vote_average); })
                .attr("cy", function (d) { return y(d.revenue); })
                .attr("r", function (d) { return z(d.budget); })
                .style("fill", function (d) { return myColor(genre(d)); })
                // -3- Trigger the functions for hover
                .on("mouseover", showTooltip)
                .on("mousemove", moveTooltip)
                .on("mouseleave", hideTooltip)
                .on("click", function (d) {
                    // console.log("clicked dot")
                    if (state.selectedDot == this) {
                        // 恢复当前 dot
                        d3.select(this).classed("dot-selected", false)
                        // 恢复所有对应的图例
                        d3.selectAll(".legend-Genres").classed("legend-Genres-hover", false); // 添加高亮类)
                        if (state.selectedGenre != null) {
                            d3.selectAll(".legend-Genres." + genre(d).replace(/\s+/g, '-')).classed("legend-Genres-hover", true) // 添加 hover 样式
                        }
                        state.selectedDot = null
                        d3.select("#jump-button-container").style("display", "none"); // 隐藏按钮
                    }
                    else {
                        // 恢复所有对应的图例 和原先的dot
                        d3.select(state.selectedDot).classed("dot-selected", false)
                        d3.selectAll(".legend-Genres").classed("legend-Genres-hover", false);
                        // 突出当前 dot 和图例
                        d3.select(this).classed("dot-selected", true).style("opacity", null);  // 添加阴影
                        d.genres_list.forEach(function (genreName) {
                            d3.selectAll(".legend-Genres." + genreName.replace(/\s+/g, '-')).classed("legend-Genres-hover", true); // 添加高亮类
                        });
                        state.selectedDot = this
                        // 显示跳转按钮
                        const searchUrl = `https://www.douban.com/search?cat=1002&q=${encodeURIComponent(d.title)}`;
                        d3.select("#jump-button-container").style("display", "block");
                        d3.select("#jump-button").on("click", () => {
                            window.open(searchUrl, "_blank"); // 打开豆瓣搜索结果
                        });
                    }
                })

            // 按照上映日期重新排序小球，最近日期排在最上层
            svg.selectAll(".bubbles")
                .sort(function (a, b) {
                    return b.release_date_parsed - a.release_date_parsed; // 按日期降序排序
                })
                .each(function () {
                    this.parentNode.appendChild(this); // 将最近的日期排在最上层
                });

            // 保存初始顺序
            saveOriginalOrder();


            // ---------------------------//
            //        GENRES SELECT       //
            // ---------------------------//


            // 处理鼠标 clicked 事件
            var clickGenreBubble = function (genre) {
                if (state.selectedDot) {
                    d3.select(state.selectedDot).classed("dot-selected", false)
                    state.selectedDot = null; // 清空点击状态
                    d3.select("#jump-button-container").style("display", "none"); // 隐藏按钮
                }
                state.selectedGenre = state.selectedGenre === genre ? null : genre; // 切换高亮状态
                state.hoveredGenre = null
                updateBubbles() // 调用更新函数
                updateLegends();
                console.log(state.isSwapped, state.selectedGenre)
                updateColorLegend(); // 只在交换时显示色谱图例
                auto_updateAxis()
            };

            // 处理鼠标 hover 事件
            var handleHover = function (d) {
                if (state.selectedGenre == null) {
                    state.hoveredGenre = d; // 设置为鼠标悬停类别
                    state.SelectedDot = null;
                    d3.select(state.selectedDot).classed("dot-selected", false)
                    updateBubbles(); // 恢复气泡显示
                    updateLegends(); // 恢复图例显示
                }
            };

            // 处理鼠标移出事件
            var handleMouseLeave = function (d) {
                if (state.selectedGenre == null) {
                    state.hoveredGenre = null; // 清空悬停的类别
                    updateBubbles(); // 恢复气泡显示
                    updateLegends(); // 恢复图例显示
                }
            };


            // ---------------------------//
            //           LEGEND           //
            // ---------------------------//

            const xLegend = width + margin.right * 1 / 2 + 20

            // Add legend-Genres
            var size = 20;
            var allgroups = genre_menu;

            // <g> for legend-Genres
            var legendGengresGroup = svg.selectAll("legendGengresGroup")
                .data(allgroups)
                .enter()
                .append("g")
                .attr("class", function (d) { return "legend-Genres " + d.replace(/\s+/g, '-'); }) // 给容器添加类名
                .attr("transform", function (d, i) {
                    return "translate(" + (xLegend - 10) + "," + (height / 10 + i * (size + 8)) + ")";
                }) // 每个 g 容器的位置

            legendGengresGroup
                .style("fill", function (d) { return myColor(d); })
                .on("click", clickGenreBubble)     // 添加点击事件
                .on("mouseover", handleHover)    // 鼠标悬停高亮
                .on("mouseleave", handleMouseLeave); // 鼠标离开恢复透明度

            // 添加圆点到容器中
            legendGengresGroup.append("circle")
                .attr("r", 10)

            // 添加标签到容器中
            legendGengresGroup.append("text")
                .attr("x", size * 0.8) // 相对于圆点的偏移
                .attr("y", 0)          // 垂直居中调整
                .text(function (d) { return d; })
                .attr("text-anchor", "left")
                .style("alignment-baseline", "middle")

            // Add legend-Bubble
            var valuesToShow = [max_z / 100, max_z / 10, max_z]
            const yLegendBubblesGrop = height - 30

            // <g> for legend-Bubbles
            var legendBubblesGroup = svg.append("g")
                .attr("class", "legend-Bubbles")
                .attr("transform", `translate(${xLegend - 40}, ${yLegendBubblesGrop})`) // 设置整体位置
                .style("display", state.isSwapped ? "none" : "block");

            // Add legend: circles
            legendBubblesGroup
                .selectAll("circle")
                .data(valuesToShow)
                .enter()
                .append("circle")
                .attr("cx", max_r) // 调整相对位置
                .attr("cy", function (d) { return - z(d); })
                .attr("r", function (d) { return z(d); })
                .style("fill", "none")
                .attr("stroke", "black");

            // Add legend: lines
            legendBubblesGroup
                .selectAll("line")
                .data(valuesToShow)
                .enter()
                .append("line")
                .attr("x1", function (d) { return max_R + z(d); })
                .attr("x2", max_R + max_r * 2)
                .attr("y1", function (d) { return - z(d); })
                .attr("y2", function (d) { return - z(d); })
                .attr("stroke", "black")
                .style("stroke-dasharray", ("2,2"));

            // Add legend: labels
            legendBubblesGroup
                .selectAll("text")
                .data(valuesToShow)
                .enter()
                .append("text")
                .attr("x", function (d) { return max_R + max_r * 2 + 10; }) // 微调文本位置
                .attr("y", function (d) { return - z(d); })
                .text(function (d) { return (d / 1e6).toFixed(1) + "M"; }) // 转为百万单位
                .style("font-size", "10px")
                .attr("alignment-baseline", "middle");

            // Add legend title
            legendBubblesGroup.append("text")
                .attr("x", max_r) // 居中标题
                .attr("y", max_r - 10)
                .text("Budget (Million)")
                .attr("text-anchor", "middle")
                .style("font-size", "12px")
                .style("font-weight", "bold");



            // ---------------------------//
            //          BAR CHART         //
            // ---------------------------//


            // 根据 selectedDate 前的数据计算每个 genre 的平均预算值
            function calculateAverageBudgetByDate(op = 1) {
                const filteredData = data.filter(function (d) {
                    return d.release_date_parsed <= state.selectedDate; // 只考虑 selectedDate 前的数据
                });

                const genreCauculator = {};
                const maxGenreData = {}

                // 遍历筛选后的数据，按 genre 累加预算值和计数
                filteredData.forEach(function (d) {
                    const genreName = genre(d); // 只考虑 genres_list 的第一个值
                    // if(d.budget==0)console.error("budget=0")
                    if (genre_menu.includes(genreName)) {
                        if (!genreCauculator[genreName]) { genreCauculator[genreName] = { totalData: 0, count: 0 }; }
                        if (!maxGenreData[genreName]) { maxGenreData[genreName] = 0; }
                        var scaledata = (op == 1 || op == 4) ? d.budget : (op == 2 || op == 5) ? d.revenue : op == 3 || op == 6 ? d.vote_average : 0
                        genreCauculator[genreName].totalData += scaledata || 0; // 累加预算
                        genreCauculator[genreName].count += 1; // 累加计数
                        if (scaledata > maxGenreData[genreName]) { maxGenreData[genreName] = scaledata }
                    }
                });

                // 计算每个 genre 的平均预算值
                const averageGenreData = {};
                Object.keys(genreCauculator).forEach(function (genre) {
                    const genreData = genreCauculator[genre];
                    averageGenreData[genre] = genreData.count > 0 ? genreData.totalData / genreData.count : 0;
                });
                if (op == 4 || op == 5 || op == 6) return maxGenreData;
                else return averageGenreData;
            }

            // 更新柱状图
            function updateBarChart() {
                const op = +d3.select("#data-type-select").property("value"); // 获取选中的 op 值
                const GenreData = calculateAverageBudgetByDate(op); // 计算每个 genre 的预算值
                // const maxBudget = d3.max(Object.values(GenreData));

                // **排序 genre_menu 根据 GenreData 的值从高到低**
                const sortedGenres = [...genre_menu].sort((a, b) => (GenreData[b] || 0) - (GenreData[a] || 0));

                // 定义比例尺，将预算值映射到柱子的宽度
                const barScale = d3.scaleLinear()
                    .domain(op === 1 ? [0, 100 * 1e6] : op === 2 ? [0, 300 * 1e6] : op == 3 ? [6, 9] : op == 4 ? [0, max_z] : op == 5 ? [0, max_y] : [8, 9.8])
                    .range([0, 180]); // 输出范围为柱子的最大宽度（可调整）

                // 绑定数据
                const bars = barChartGroup.selectAll("rect")
                    .data(sortedGenres, function (d) { return d; }); // 按 genre 名称绑定

                // 更新柱子
                bars.enter()
                    .append("rect")
                    .merge(bars)
                    .attr("class", "bar")
                    .transition() // 添加动画效果
                    .duration(200) // 动画持续时间
                    .attr("x", function (d) { return -barScale(GenreData[d] || 0) }) // 横向柱子的起点
                    .attr("y", function (d, i) { return i * (size + 8) - 5; }) // 与图例对齐
                    .attr("height", size - 8) // 柱子高度固定，与图例一致
                    .attr("width", function (d) { return barScale(GenreData[d] || 0); }) // 映射宽度
                    .attr("fill", function (d) { return myColor(d); }) // 与图例颜色一致
                    .attr("transform", function (d) {
                        return `translate(85, 0)`; // 将柱子移动到图例左侧
                    });

                // 删除多余的柱子
                bars.exit().remove();

                // 添加标签
                const labels = barChartGroup.selectAll("text.bar-label")
                    .data(sortedGenres, function (d) { return d; }); // 绑定数据到 genre_menu
                labels.enter()
                    .append("text")
                    .attr("class", "bar-label")
                    .merge(labels)
                    .transition() // 添加动画效果
                    .duration(200) // 动画持续时间
                    .attr("x", function (d) { return -barScale(GenreData[d] || 0) + 75; }) // 标签位置在柱子左侧
                    .attr("y", function (d, i) { return i * (size + 8) + size / 3 - 2; }) // 标签垂直对齐
                    .attr("text-anchor", "end") // 标签右对齐
                    .text(function (d) {
                        const value = GenreData[d] || 0;
                        var labeltxt = op == 3 || op == 6 ? `${(value).toFixed(2)}` : `${(value / 1e6).toFixed(0)}M`

                        return labeltxt
                    })
                    .style("font-size", "12px") // 标签字体大小
                    .style("fill", "black"); // 标签颜色

                // 删除多余的标签
                labels.exit().remove();

                // 更新图例位置
                const legendGroups = svg.selectAll(".legend-Genres")
                    .data(sortedGenres, function (d) { return d; });

                legendGroups.transition()
                    .duration(200) // 动画持续时间
                    .attr("transform", function (d, i) {
                        return `translate(${xLegend - 10}, ${height / 10 + i * (size + 8)})`; // 按排序后的位置更新
                    });
            }

            // 添加柱状图 <g> 容器
            var barChartGroup = svg.append("g")
                .attr("class", "bar-chart")
                .attr("transform", `translate(${xLegend - 110}, ${height / 10})`); // 调整位置到图例左侧

            d3.select("#bar-chart-controls")
                .style("position", "absolute")
                .style("left", `${xLegend - 50}px`) // 设置水平位置
                .style("top", `${margin.top - 35}px`); // 设置垂直位置
            // 添加下拉框
            d3.select("#data-type-select")
                .selectAll("option")
                .data([
                    { value: 1, text: "Average Budget" },
                    { value: 2, text: "Average Revenue" },
                    { value: 3, text: "Average Rate" },
                    { value: 4, text: "Max Budget" },
                    { value: 5, text: "Max Revenue" },
                    { value: 6, text: "Max Rate" }
                ])
                .enter()
                .append("option")
                .attr("value", function (d) { return d.value; })
                .text(function (d) { return d.text; });
            // 添加下拉框事件监听
            d3.select("#data-type-select").on("change", function () {
                updateBarChart();
            });


            // ---------------------------//
            //      TRANSPARENT LABEL     //
            // ---------------------------//

            var fontSize = Math.min(width, height) * 0.24;
            // 添加年份显示的透明标签
            var yearLabel = svg.append("text")
                .attr("class", "year-label") // 使用 CSS 类
                .attr("x", width * 1 / 5) // 居中显示
                .attr("y", height * 2 / 3) // 垂直居中显示
                .style("font-size", `${fontSize}px`)
                .text(""); // 初始内容为空

            // 更新年份显示函数
            function updateYearLabel(date) {
                var year = d3.timeFormat("%Y")(date); // 提取年份
                if (year == "0NaN") year = "2016"
                yearLabel.text(year); // 更新标签内容
            }

            // ---------------------------//
            //        TIME SLIDER         //
            // ---------------------------//

            d3.select("#time-slider-container")
                .style("top", `${margin.bottom * 3 / 5 + height + margin.top}px`) // 滑块位于图表下方
                .style("left", "50%")
                .style("transform", "translateX(-63%)")
                .style("width", `${width * 2 / 3}px`) // 设置宽度与图表相同

            // 获取所有电影的上映日期
            var parseDate = d3.timeParse("%Y/%m/%d"); // 假设日期格式为 "YYYY/MM/DD"
            data.forEach(function (d) {
                d.release_date_parsed = parseDate(d.release_date); // 转换为日期对象
            });

            // 找到最早和最晚的日期
            // var minDate = d3.min(data, function (d) { return d.release_date_parsed; });
            var minDate = startDate
            var maxDate = d3.max(data, function (d) { return d.release_date_parsed; });

            // 更新滑块的范围
            var timeSlider = d3.select("#time-slider")
                .attr("min", +minDate) // 转换为时间戳
                .attr("max", +maxDate)
                .attr("value", +maxDate); // 初始值为最大日期

            // 显示当前选定的日期
            d3.select("#time-display").text(d3.timeFormat("%Y/%m/%d")(maxDate));

            // 监听滑块变化事件
            timeSlider.on("input", function () {
                var selectedDate = new Date(+this.value); // 滑块值为时间戳
                d3.select("#time-display").text(d3.timeFormat("%Y/%m/%d")(selectedDate)); // 更新显示日期
                state.selectedDate = selectedDate; // 更新状态

                stopAnimation(); // 停止动画
                d3.select("#pause-button").text("Continue"); // 切换按钮文本为 Continue

                auto_updateAxis()
                updateYearLabel(selectedDate); // 更新年份标签
                updateBubbles()
                updateLegends()
                updateBarChart(); // 更新柱状图

                if (state.selectedDot) {
                    d3.select(state.selectedDot).classed("dot-selected", false)
                    state.selectedDot = null; // 清空点击状态
                    d3.select("#jump-button-container").style("display", state.isSwapped ? "none" : "block"); // 隐藏按钮
                }
            });


            // ---------------------------//
            //        Y_MAX SLIDER        //
            // ---------------------------//

            d3.select("#y-max-slider-container")
                .style("top", `${margin.top * 1.05}px`) // 垂直放置在图表正下方
                .style("left", `${margin.left * 1.2}px`) // 手动计算容器的左侧位置，使其居中
                .style("width", `${140}px`); // 容器宽度与图表一致

            // 设置滑块的范围
            var yMaxSlider = d3.select("#y-max-slider")
                .attr("min", max_y / 100) // 设置最小值为原始最大值的 10%
                .attr("max", max_y)
                .attr("value", max_y); // 初始值为最大 revenue

            // 显示滑块的初始值
            d3.select("#y-max-display").text(`Max: ${(max_y / 1e6).toFixed(0)}`);

            // 更新图表的函数
            function updateYAxis(newMax) {
                y.domain([0, newMax]); // 更新 Y 轴比例尺
                // 更新 Y 轴
                axis_y.transition().call(
                    d3.axisLeft(y).ticks(10) // 显示 10 个刻度
                        .tickFormat(function (d) {
                            return (d / 1e6).toLocaleString() // 将值格式化为百万单位
                        })
                ).selectAll("text").attr("class", "axis_text")

                // 更新点的位置
                svg.selectAll(".bubbles")
                    .filter(function (d) {
                        return d.revenue > newMax; // 超出范围的点
                    })
                    .style("opacity", 0) // 直接设置透明度，无需动画
                    .interrupt(); // 停止未完成的动画
                svg.selectAll(".bubbles")
                    .filter(function (d) {
                        return d.revenue <= newMax; // 只处理可见范围内的数据点
                    })
                    .attr("cy", function (d) {
                        return y(d.revenue);
                    });

                // 更新状态
                state.maxY = newMax;
                updateBubbles();
            }

            // 包装更新逻辑
            var updateYAxisThrottled = throttle(function (newMax) {
                updateYAxis(newMax);
            }, 30); // 每 50ms 执行一次
            var updateYAxisDebounced = debounce(function (newMax) {
                updateYAxisThrottled(newMax);
            }, 50); // 延迟 100ms 执行

            // 监听最大值滑块
            yMaxSlider.on("input", function () {
                var newMax = +this.value; // 获取滑块的新值
                // 更新滑块显示
                d3.select("#y-max-display").text(`Max: ${(newMax / 1e6).toFixed(0)}`);
                // 更新图表
                updateYAxisDebounced(newMax);
            });

            function auto_updateYAxis() {
                if (auto_on === false) { return }
                var maxRevenue = d3.max(updateFilteredData(), function (d) {
                    return d.revenue || 0;
                });
                maxRevenue = Math.max(Math.min(maxRevenue * 1.1, max_y), max_y / 100)
                // 更新 Y 轴最大值和图表
                updateYAxisDebounced(maxRevenue);
                // 更新 Y-Max Slider 的值
                d3.select("#y-max-slider")
                    .property("value", maxRevenue) // 动态设置 y-max slider 的值
                    .each(function () {
                        d3.select("#y-max-display").text(`Max: ${(maxRevenue / 1e6).toFixed(0)}`); // 更新显示文本
                    });
            }

            // ---------------------------//
            //        X_MAX SLIDER        //
            // ---------------------------//

            d3.select("#x-max-slider-container")
                .style("top", `${margin.top + height - 30}px`) // 垂直放置在图表正下方
                .style("left", `${margin.left + width + 20}px`) // 手动计算容器的左侧位置，使其居中
                .style("width", `${140}px`) // 容器宽度与图表一致
                .style("display", state.isSwapped ? "flex" : "none"); // 当 isSwapped 为 0 时隐藏，为 1 时显示


            // 设置滑块的范围
            var xMaxSlider = d3.select("#x-max-slider")
                .attr("min", max_z / 100) // 设置最小值为原始最大值的 10%
                .attr("max", max_z)
                .attr("value", max_z) // 初始值为最大 budget

            // 显示滑块的初始值
            d3.select("#x-max-display").text(`Max: ${(max_z / 1e6).toFixed(0)}`);

            // 更新图表的函数
            function updateXAxis(newMax) {
                if (!state.isSwapped) return
                x.domain([0, newMax]); // 更新 X 轴比例尺
                // 更新 X 轴
                axis_x.transition().call(
                    d3.axisBottom(x).ticks(10) // 显示 10 个刻度
                        .tickFormat(function (d) {
                            return (d / 1e6).toLocaleString() // 将值格式化为百万单位
                        })
                ).selectAll("text").attr("class", "axis_text")

                // 更新点的位置
                svg.selectAll(".bubbles")
                    .filter(function (d) {
                        return d.budget > newMax; // 超出范围的点
                    })
                    .style("opacity", 0) // 直接设置透明度，无需动画
                    .interrupt(); // 停止未完成的动画
                svg.selectAll(".bubbles")
                    .filter(function (d) {
                        return d.budget <= newMax; // 只处理可见范围内的数据点
                    })
                    .attr("cx", function (d) {
                        return y(d.budget);
                    });

                // 更新状态
                state.maxX = newMax;
                updateBubbles();
            }

            // 包装更新逻辑
            var updateXAxisThrottled = throttle(function (newMax) {
                updateXAxis(newMax);
            }, 30); // 每 50ms 执行一次
            var updateXAxisDebounced = debounce(function (newMax) {
                updateXAxisThrottled(newMax);
            }, 50); // 延迟 100ms 执行

            // 监听最大值滑块
            xMaxSlider.on("input", function () {
                var newMax = +this.value; // 获取滑块的新值
                // 更新滑块显示
                d3.select("#y-max-display").text(`Max: ${(newMax / 1e6).toFixed(0)}`);
                // 更新图表
                updateXAxisDebounced(newMax);
            });

            function auto_updateXAxis() {
                if (auto_on === false) { return }

                var maxBudget = d3.max(updateFilteredData(), function (d) {
                    // console.log("budget:"+d.budget)
                    return d.budget || 0;
                });
                maxBudget = Math.max(Math.min(maxBudget * 1.1, max_z), max_z / 100)
                // console.log("maxbudget:"+maxBudget)

                // 更新 X 轴最大值和图表
                updateXAxisDebounced(maxBudget);
                // 更新 X-Max Slider 的值
                d3.select("#x-max-slider")
                    .property("value", maxBudget) // 动态设置 x-max slider 的值
                    .each(function () {
                        // console.log("maxbudget:"+maxBudget)
                        d3.select("#x-max-display").text(`Max: ${(maxBudget / 1e6).toFixed(0)}`); // 更新显示文本
                    });
            }

            // ---------------------------//
            //           BUTTONS          //
            // ---------------------------//

            console.log(state.isSwapped)
            // max_r 大小控制按钮
            var maxRbuttonContainer = d3.select("#main-container")
                .append("div")
                .attr("id", "max-r-button-container")
                .style("top", `${yLegendBubblesGrop + max_R}px`)
                .style("left", `${margin.left + xLegend - 15}px`)
                .style("transform", "translateX(-50%)") // 调整到以自身宽度中心对齐
                .style("display", state.isSwapped ? "none" : "flex")

            maxRbuttonContainer.append("button")
                .attr("id", "max-r-increase")
                .attr("class", "round-button")
                .text("+")
                .on("click", function () {
                    max_r = max_r * 1.2; // 增加 max_z
                    updateBubbleSizes();
                });

            maxRbuttonContainer.append("button")
                .attr("id", "max-r-decrease")
                .attr("class", "round-button")
                .style("padding", "2px 8px")
                .text("-")
                .on("click", function () {
                    max_r = max_r / 1.2; // 减少 max_z
                    updateBubbleSizes();
                });

            //auto-switch 按钮
            var autoSwitchbuttonContainer = d3.select("#main-container")
                .append("div")
                .style("position", "absolute")
                .attr("id", "auto-switch-button-container")
                .style("top", `${margin.top * 1.3}px`) // 垂直放置在图表正下方
                .style("left", `${margin.left * 2.9}px`) // 手动计算容器的左侧位置，使其居中
                .style("transform", "translateX(-50%)") // 调整到以自身宽度中心对齐
                .append("button")
                .attr("id", "auto-switch")
                .attr("class", "border-button")
                .style("padding", "2px 8px")
                .text("Auto On")
                .on("click", function (d) {
                    auto_on = auto_on ? false : true
                    d3.select(this).text(auto_on ? "Auto On" : "Auto Off"); // 更新按钮文本
                    auto_updateAxis()
                });

            // 添加 Replay 按钮
            var replayButtonContainer = d3.select("#main-container")
                .append("div")
                .attr("id", "replay-button-container")
                .style("top", `${margin.bottom + height + margin.top}px`)
                .style("left", `${xLegend - 140}px`)
                .style("position", "absolute")
                .style("transform", "translateX(-50%)");

            replayButtonContainer.append("button")
                .attr("id", "replay-button")
                .style("padding", "2px 8px")
                .attr("class", "border-button")
                .text("Replay")
                .on("click", function () {
                    stopAnimation(); // 确保停止当前动画
                    state.selectedDate = minDate; // 重置时间为最早日期
                    startTimeAnimation(); // 从头开始播放动画
                    d3.select("#pause-button").text("Pause"); // 确保 Pause 按钮显示正确文本
                });

            // 添加 Pause 按钮
            var pauseButtonContainer = d3.select("#main-container")
                .append("div")
                .attr("id", "pause-button-container")
                .style("top", `${margin.bottom + height + margin.top}px`)
                .style("left", `${xLegend - 40}px`)
                .style("position", "absolute")
                .style("transform", "translateX(-50%)");

            pauseButtonContainer.append("button")
                .attr("id", "pause-button")
                .attr("class", "border-button")
                .style("padding", "2px 8px")
                .text("Pause")
                .on("click", function () {
                    if (state.isAnimating) {
                        stopAnimation(); // 暂停动画
                        d3.select(this).text("Continue"); // 切换按钮文本为 Continue
                    } else {
                        startTimeAnimation(); // 继续动画
                        d3.select(this).text("Pause"); // 切换按钮文本为 Pause
                    }
                });

            var swapAxisButtonContainer = d3.select("#main-container")
                .append("div")
                .attr("id", "swap-axis-button-container")
                .style("top", `${margin.bottom - 20 + height + margin.top}px`)
                .style("left", `${margin.left + 40}px`)
                .style("position", "absolute")
                .style("transform", "translateX(-50%)");

            // 添加交换 X 和 Z 轴的按钮
            swapAxisButtonContainer.append("button")
                .attr("id", "swap-axes-button")
                .attr("class", "border-button")
                .style("padding", "8px 12px")
                .style("margin", "10px")
                .text(function () {
                    return state.isSwapped ? "Revenue vs Rating" : "Revenue vs Budget"
                })
                .on("click", function () {
                    swapAxes(); // 调用交换函数
                    d3.select(this).text(function () {
                        return state.isSwapped ? "Revenue vs Budget" : "Revenue vs Rating"
                    })
                });

            // 添加 跳转 按钮
            var navigateButtonContainer = d3.select("#main-container")
                .append("div")
                .attr("id", "navigate-button-container")
                .style("top", `${margin.bottom + height + margin.top + 10}px`)
                .style("left", `${xLegend + margin.left}px`)
                .style("position", "absolute")
                .style("transform", "translateX(-50%)");

            navigateButtonContainer.append("button")
                .attr("id", "navigate-button")
                .style("padding", "5px 8px")
                .attr("class", "border-button")
                .text("ROI & Markrt-share")

            document.getElementById("navigate-button").addEventListener("click", function () {
                window.location.href = "./ROI/ROI.html";
            });



            // ---------------------------//
            //     ANIMATION ON START     //
            // ---------------------------//

            function stopAnimation() {
                if (state.timer) {
                    clearInterval(state.timer); // 清除动画计时器
                    state.timer = null;
                    state.isAnimating = false; // 标记动画已停止
                }
            }

            function startTimeAnimation() {
                stopAnimation(); // 确保之前的动画已停止
                state.isAnimating = true; // 标记正在播放动画
                var currentDate = state.selectedDate || minDate; // 从当前时间开始（默认最早日期）

                // 设置定时器，逐步更新时间
                state.timer = setInterval(function () {
                    // 更新滑块值
                    timeSlider.property("value", +currentDate);

                    // 更新显示日期
                    d3.select("#time-display").text(d3.timeFormat("%Y/%m/%d")(currentDate));
                    state.selectedDate = currentDate; // 更新状态

                    // 动态使用当前比例尺更新气泡
                    svg.selectAll(".bubbles")
                        .attr("cx", function (d) {
                            return state.isSwapped ? x(d.budget) : x(d.vote_average);
                        })
                        .attr("r", function (d) {
                            return state.isSwapped ? max_R / 5 : z(d.budget);
                        })

                    updateBarChart()
                    updateBubbles(); // 更新小球显示
                    updateYearLabel(currentDate); // 更新年份标签
                    auto_updateAxis()

                    // 如果到达最晚日期，停止动画
                    if (currentDate >= maxDate) {
                        stopAnimation(); // 停止动画
                        d3.select("#pause-button").text("Continue"); // 切换 Pause 按钮为 Continue
                    }
                    else {
                        currentDate = new Date(currentDate.getTime() + 3 * 30 * 24 * 60 * 60 * 1000); // 每次增加一个月
                    }
                }, animationInterval);
            }

            // 调用动画函数，在页面加载完成时触发

            updateBarChart()
            updateYearLabel()
            startTimeAnimation();


            // ---------------------------//
            //          SWAP AXIS         //
            // ---------------------------//


            // 封装交换 X 和 Z 轴的函数
            function swapAxes() {
                // 暂停动画
                const wasAnimating = state.isAnimating;
                if (wasAnimating) {
                    stopAnimation(); // 暂停动画
                    console.log("is stop")
                }
                filteredData = updateFilteredData()
                if (!state.isSwapped) {
                    // 交换为 budget -> X 轴, vote_average -> Z 轴
                    x.domain([0, max_z]) // X 轴范围映射到预算
                        .range([0, width]); // 输出范围为图表宽度
                    z.domain([4, 10]) // 气泡大小范围映射到评分
                        .range([0, 1]); // 输出范围为气泡的最大半径

                    // 更新气泡属性
                    svg.selectAll(".bubbles")
                        .data(filteredData, d => d.id) // 绑定筛选后的数据
                        .transition()
                        .duration(500)
                        .attr("cx", function (d) { return x(d.budget); }) // X 轴映射为预算
                        .attr("r", function (d) { return max_R / 5; }) // 气泡半径映射为评分
                        .style("opacity", function (d) { return `${z(d.vote_average)}` })

                    console.log("axis_x:", axis_x); // 检查 axis_x 是否为 D3 对象
                    // 更新 X 轴
                    axis_x.transition()
                        .duration(300)
                        .call(d3.axisBottom(x).ticks(10).tickFormat(function (d) {
                            return `${(d / 1e6).toFixed(0)}`;
                        }))
                        .selectAll("text")
                        .attr("class", "axis_text")

                    // 更新 X 轴标题
                    svg.select(".axis_title")
                        .text("Budget(Million$)");

                } else {
                    // 恢复为 vote_average -> X 轴, budget -> Z 轴
                    x.domain([1.5, max_x]) // X 轴范围映射到评分
                        .range([0, width]);
                    z.domain([0, max_z]) // 气泡大小范围映射到预算
                        .range([0, max_r]);

                    // 更新气泡属性
                    svg.selectAll(".bubbles")
                        .data(filteredData, d => d.id) // 绑定筛选后的数据
                        .transition()
                        .duration(500)
                        .attr("cx", function (d) { return x(d.vote_average); }) // X 轴映射为评分
                        .attr("r", function (d) { return z(d.budget); }) // 气泡半径映射为预算
                        .style("opacity", function (d) { return "0.8" })

                    // 更新 X 轴
                    axis_x.transition()
                        .duration(300)
                        .call(d3.axisBottom(x).ticks(10).tickFormat(function (d) {
                            return d.toFixed(1); // 显示为小数格式（适用于评分）
                        }))
                        .selectAll("text")
                        .attr("class", "axis_text");

                    // 更新 X 轴标题
                    svg.select(".axis_title")
                        .text("TMDb Rating");
                }

                // 切换状态
                state.isSwapped = !state.isSwapped;
                updateColorLegend(); // 只在交换时显示色谱图例
                updateToolsVisibility()
                auto_updateAxis()
                // 如果动画之前在播放，继续动画
                if (wasAnimating) {
                    startTimeAnimation();
                    console.log("is continue")
                }
            }


            // 防抖函数
            function debounce(func, delay) {
                let timeout;
                return function (...args) {
                    clearTimeout(timeout);
                    timeout = setTimeout(() => func.apply(this, args), delay);
                };
            }
            // 节流函数
            function throttle(func, delay) {
                let lastCall = 0;
                return function (...args) {
                    const now = Date.now();
                    if (now - lastCall >= delay) {
                        lastCall = now;
                        func.apply(this, args);
                    }
                };
            }

            // ---------------------------//
            //          GRID LINE         //
            // ---------------------------//

            // 添加网格线的函数
            function drawGridlines() {
                // 移除已有的网格线，避免重复绘制
                d3.selectAll(".gridline").remove();

                // 添加水平网格线（对应 y 轴）
                svg.append("g")
                    .attr("class", "gridline horizontal-grid")
                    .call(d3.axisLeft(y) // 使用 y 轴比例尺生成
                        .tickSize(-width) // 网格线长度与图表宽度一致
                        .tickFormat("") // 移除刻度文本，仅保留网格线
                    )

                // 添加垂直网格线（对应 x 轴）
                svg.append("g")
                    .attr("class", "gridline vertical-grid")
                    .attr("transform", `translate(0,${height})`) // 将网格线放置在图表区域底部
                    .call(d3.axisBottom(x) // 使用 x 轴比例尺生成
                        .tickSize(-height) // 网格线长度与图表高度一致
                        .tickFormat("") // 移除刻度文本，仅保留网格线
                    )
            }


            // ---------------------------//
            //          DRAW KDE          //
            // ---------------------------//

            // 核密度估计函数
            function kernelDensityEstimator(kernel, X) {
                return function (V) {
                    return X.map(function (x) {
                        return [x, d3.mean(V, function (v) { return kernel(x - v); })];
                    });
                };
            }

            // 核函数（高斯核）
            function kernelGaussian(bandwidth) {
                return function (u) {
                    return Math.exp(-0.5 * (u / bandwidth) ** 2) / (Math.sqrt(2 * Math.PI) * bandwidth);
                };
            }

            function drawRevenueKDE() {
                // 获取有效数据
                const filteredData = updateFilteredData();
                const revenueData = filteredData.map(d => d.revenue).filter(d => d > 0 && d <= state.maxY); // 过滤掉无效数据

                // 设置核密度估计参数
                const bandwidth =
                    // d3.deviation(revenueData) / 2; // 核密度估计的带宽
                    // Math.max(d3.deviation(revenueData) / 2, state.maxY / 50);
                    // state.maxY / 200
                    max_y / 500

                // 创建比例尺
                const yScaleKDE = d3.scaleLinear()
                    .domain([0, state.maxY]) // Y 轴范围为 Revenue 值
                    .range([height, 0]); // 映射到图表高度

                const xScaleKDE = d3.scaleLinear()
                    .domain([0, 0.00000001]) // X 轴范围为概率密度值（可以根据实际值调整）
                    .range([0, 100]); // 核密度曲线的最大宽度

                // 核密度估计函数
                const kde = kernelDensityEstimator(kernelGaussian(bandwidth), yScaleKDE.ticks(100));
                const density = kde(revenueData);
                const usedColor = state.selectedGenre ? myColor(state.selectedGenre) : "grey"

                // 绘制 KDE 曲线
                const lineGenerator = d3.line()
                    .curve(d3.curveBasis) // 平滑曲线
                    .x(d => xScaleKDE(d[1])) // X 轴为核密度值
                    .y(d => yScaleKDE(d[0])); // Y 轴为 Revenue 值

                // 移除已有的 KDE 曲线（避免重复绘制）
                svg.selectAll(".kde-line").remove();
                svg.selectAll(".kde-area").remove();

                // 添加阴影区域
                svg.append("path")
                    .datum(density)
                    .attr("class", "kde-area")
                    .attr("fill", usedColor) // 半透明钢蓝色
                    .style("pointer-event", "none")
                    .style("opacity","0.3")
                    .attr("d", d3.area()
                        .curve(d3.curveBasis)
                        .x0(0) // 起始点为 X 轴 0
                        .x1(d => xScaleKDE(d[1])) // 结束点为核密度值
                        .y(d => yScaleKDE(d[0])) // Y 轴为 Revenue 值
                    );

                // 添加 KDE 曲线
                svg.append("path")
                    .datum(density)
                    .attr("class", "kde-line")
                    .attr("fill", "none")
                    .style("pointer-event", "none")
                    .attr("stroke", "grey")
                    .attr("stroke-width", 1.5)
                    .attr("d", lineGenerator);

                // // 添加核密度曲线的标签（可选）
                // svg.selectAll(".kde-label").remove();
                // svg.append("text")
                //     .attr("class", "kde-label")
                //     .attr("x", xScaleKDE(0.1)) // 核密度值的最大范围
                //     .attr("y", yScaleKDE(max_y)) // Y 轴顶部
                //     .attr("dy", -10)
                //     .attr("text-anchor", "end")
                //     .style("fill", "steelblue")
                //     .style("font-size", "12px")
                //     .text("Density (KDE)");
            }

        })