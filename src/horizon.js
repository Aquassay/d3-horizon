import { map, min, max, bisector } from 'd3-array';
import { axisTop } from 'd3-axis';
import { curveLinear, area } from 'd3-shape';
import { schemeGreens, schemeBlues } from 'd3-scale-chromatic';
import { create, pointer } from 'd3-selection';
import { scaleTime, scaleLinear } from 'd3-scale';

/**
 * Generate Horizon chart
 * 
 * @param {Object[]}    series                          Series to show in Horizon chart
 * @param {String}      series[].name                   Serie name
 * @param {Array[]}     series[].data                   Serie Data
 * @param {Date}        series[].data[][0]              Time of specific data element
 * @param {Number}      series[].data[][1]              Value of specific data element
 * @param {Object}      options                         Horizon configuration options
 * @param {Function}    [options.x]                     Given d in data, returns the (temporal) x-value
 * @param {Function}    [options.y]                     Given d in data, returns the (quantitative) y-value
 * @param {Function}    [options.defined]               For gaps in data
 * @param {Function}    [options.curve]                 Method of interpolation between points (Default : curveLinear)
 * @param {Number}      [options.marginTop]             Top margin, in pixels
 * @param {Number}      [options.marginRight]           Right margin, in pixels
 * @param {Number}      [options.marginBottom]          Bottom margin, in pixels
 * @param {Number}      [options.marginLeft]            Left margin, in pixels
 * @param {Number}      [options.width]                 Outer width, in pixels
 * @param {Number}      [options.size]                  Outer height of a single horizon, in pixels
 * @param {Number}      [options.bands]                 Number of bands
 * @param {Number}      [options.padding]               Separation between adjacent horizons
 * @param {Function}    [options.xType]                 Type of x-scale (Default : scaleTime)
 * @param {Number[]}    [options.xDomain]               [xmin, xmax]
 * @param {Number[]}    [options.xRange]                [left, right] (Default : [marginLeft, width - marginRight])
 * @param {Function}    [options.yType]                 type of y-scale
 * @param {Number[]}    [options.yDomain]               [ymin, ymax]. By default, each series uses its own domain. If you want all series to use the same one, you should set this parameter.
 * @param {Number[]}    [options.yRange]                [bottom, top]
 * @param {Array[]}     [options.scheme]                [positive, negative] : Schemes used for show positive and negative values. (Default : [schemeGreens, schemeBlues])
 * @param {Function}    [options.onHover]               Callback on horizon hover to show tooltip with values for Example
 * @returns {SVGElement}                                D3 SVG to show
 */
const horizon = (series, {
    x = ([x]) => x,
    y = ([, y]) => y,
    defined, 
    curve = curveLinear, 
    marginTop = 20,
    marginRight = 0,
    marginBottom = 0,
    marginLeft = 0,
    width = 640,
    size = 25,
    bands = 3,
    padding = 1,
    xType = scaleTime,
    xDomain,
    xRange = [marginLeft, width - marginRight],
    yType = scaleLinear,
    yDomain,
    yRange = [size, size - bands * (size - padding)],
    scheme = [schemeGreens, schemeBlues],
    colors = [scheme[0][Math.max(3, bands)], scheme[1][Math.max(3, bands)]], // an array of colors
    onHover, // tooltip element if needed to show data
} = {}) => {
    const height = series.length * size + marginTop + marginBottom;
    const svg = create('svg')
        .attr('width', width)
        .attr('height', height)
        .attr('viewBox', [0, 0, width, height])
        .attr('style', 'max-width: 100%; height: auto; height: intrinsic;')
        .attr('font-family', 'sans-serif')
        .attr('font-size', 10);

    const xScale    = xType(xDomain, xRange);
    const xAxis     = axisTop(xScale).ticks(width / 80).tickSizeOuter(0);

    const seriesListeners = [];

    series.forEach((serie, i) => {
        if (!serie.data) {
            return;
        }

        // Compute values.
        const X = map(serie.data, x);
        const Y = map(serie.data, y);

        if (defined === undefined) {
            defined = (d, i) => !isNaN(X[i]) && !isNaN(Y[i]);
        }

        const D = map(serie.data, defined);
        const I = serie.data.map((data, i) => i);

        const yMax          = Math.max(Math.abs(min(Y)), max(Y));
        let yDomainLocal    = yDomain;

        if (yDomainLocal === undefined) {
            yDomainLocal = [0, yMax];
        }

        const positiveY = Y.map(y => (y >= 0 ? y : 0));
        const negativeY = Y.map(y => (y < 0 ? Math.abs(y) : 0));

        // Construct scales and axes.

        const yScale = yType(yDomainLocal, yRange);

        // A unique identifier for clip paths (to avoid conflicts).
        const uid = `${i}-${uuid()}`;

        // Construct an area generator.
        const areaNegative = area()
            .defined(i => D[i])
            .curve(curve)
            .x(i => xScale(X[i]))
            .y0(yScale(0))
            .y1(i => yScale(negativeY[i]));

        const areaPositive = area()
            .defined(i => D[i])
            .curve(curve)
            .x(i => xScale(X[i]))
            .y0(yScale(0))
            .y1(i => yScale(positiveY[i]));

        const g = svg.append('g')
            .attr('transform', `translate(0,${i * size + marginTop})`);

        const defs = g.append('defs');

        defs.append('clipPath')
            .attr('id', `${uid}-clip-${i}`)
            .append('rect')
            .attr('y', padding)
            .attr('width', width)
            .attr('height', size - padding);

        defs.append('path')
            .attr('id', `${uid}-path-positive-${i}`)
            .attr('d', areaPositive(I));

        defs.append('path')
            .attr('id', `${uid}-path-negative-${i}`)
            .attr('d', areaNegative(I));

        g
            .attr('clip-path', `url(#${uid}-clip-${i})`)
            .append('g')
            .selectAll('use')
            .data((d, i) => new Array(bands).fill(i))
            .join('use')
            .attr('fill', (_, i) => colors[0][i + Math.max(0, 3 - bands)])
            .attr('transform', (_, i) => `translate(0,${i * size})`)
            .attr('xlink:href', `#${uid}-path-positive-${i}`);

        g
            .attr('clip-path', `url(#${uid}-clip-${i})`)
            .append('g')
            .selectAll('use')
            .data((d, i) => new Array(bands).fill(i))
            .join('use')
            .attr('fill', (_, i) => colors[1][i + Math.max(0, 3 - bands)])
            .attr('transform', (_, i) => `translate(0,${i * size})`)
            .attr('xlink:href', `#${uid}-path-negative-${i}`);

        g.append('text')
            .attr('x', marginLeft + 5)
            .attr('y', (size + padding) / 2)
            .attr('dy', '0.35em')
            .attr('fill', 'black')
            .attr('font-size', '12px')
            .attr('font-weight', 'bold')
            .attr('stroke-width', 3)
            .attr('stroke', 'white')
            .attr('paint-order', 'stroke')
            .text(serie.name);

        const listener = (x) => {
            const index = bisector(d => d.x).left(serie.data, xScale.invert(x), 0, serie.data.length - 1);

            return {
                name    : serie.name,
                value   : Y[index],
            };
        };

        seriesListeners.push(listener);
    });

    // Since there are normally no left or right margins, don’t show ticks that
    // are close to the edge of the chart, as these ticks are likely to be clipped.
    svg.append('g')
        .attr('transform', `translate(0,${marginTop})`)
        .call(xAxis)
        .call(g => g.selectAll('.tick')
            .filter(d => xScale(d) < 10 || xScale(d) > width - 10)
            .remove())
        .call(g => g.select('.domain').remove());

    const ruler = svg.append('line')
        .attr('class', 'rule')
        .attr('stroke', 'black')
        .attr('stroke-dasharray', '1,1')
        .attr('y1', 0)
        .attr('y2', height)
        .attr('x1', 0.5)
        .attr('x2', 0.5);

    svg.on('mousemove touchmove', (event) => {
        const [x]   = pointer(event, svg.node());

        ruler.attr('x1', x).attr('x2', x);

        if (onHover) {
            const values = seriesListeners.map(listener => listener(x));

            onHover({
                time : xScale.invert(x),
                event,
                values,
            });
        }
    });

    return svg.node();
};

export default horizon;