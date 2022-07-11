/**
 * Get SVG URL to make an svg file export
 * 
 * @param {SVGElement} svgElement 
 * @returns {String}                The URL to make export
 */
const getURL = (svgElement) => {
    const svg           = svgElement.cloneNode(true);
    const serializer    = new XMLSerializer();
    const rules         = svg.querySelectorAll('.rule');

    rules.forEach(rule => rule.remove());

    const source = serializer.serializeToString(svg);
    const url    = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(source)}`;

    return url;
};

export default getURL;