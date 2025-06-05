/**
 * Get a color from an index
 * @param {number} index - The index
 * @returns {string} - The color
 * @todo Move this function to deployment common directory
 */
const getColorFromIndex = (index) => {
  const phi = (1 + Math.sqrt(5)) / 2;
  const n = 1 + index * phi;

  const r = Math.max(Math.floor((n * 255) % 255), 55);
  const g = Math.max(Math.floor((n * 359) % 255), 55);
  const b = Math.max(Math.floor((n * 231) % 255), 55);

  return `rgb(${r}, ${g}, ${b})`;
};

/**
 * Create a marker SVG
 * @param {string} fillColor - The fill color
 * @param {string} textColor - The text color
 * @param {string} text - The text
 * @returns {string} - The SVG
 * @todo Move this function to deployment common directory
 */
function createMarkerSVG(
  fillColor = "#51535c",
  textColor = "#ffffff",
  text = ""
) {
  return `<svg role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512">
  <path fill="${fillColor}" d="M172.268 501.67C26.97 291.031 0 269.413 0 192 0 85.961 85.961 0 192 0s192 85.961 192 192c0 77.413-26.97 99.031-172.268 309.67-9.535 13.774-29.93 13.773-39.464 0z"></path>
  <text style="fill: ${textColor}; font-family: Arial, sans-serif; font-size: 240px; font-weight: 700; text-anchor: middle; white-space: pre;" x="192" y="289.992">${text}</text>
</svg>`;
}

/**
 * Create a div icon
 * @param {string} svg - The SVG
 * @returns {LeafletDivIcon} - The div icon
 * @todo Move this function to deployment common directory
 */
function createDivIcon(svg) {
  return L.divIcon({
    html: svg,
    className: "marker-icon",
    iconSize: L.point(30, 40),
    iconAnchor: L.point(15, 40),
    popupAnchor: L.point(15, -40),
  });
}
