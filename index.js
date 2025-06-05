

/**
 * @typedef {import('leaflet')}
 * @typedef {L.Map} LeafletMap
 * @typedef {L.Marker} LeafletMarker
 * @typedef {L.LatLng} LeafletLatLng
 * @typedef {L.LeafletMouseEvent} LeafletMouseEvent
 */

/**
 * The map
 * @type {LeafletMap}
 */
let map;

/**
 * The API key
 * @type {string}
 */
const api_key = 'YOUR_API_KEY';

const vehicle_cost_per_hour = 2;
const vehicle_cost_per_kilometer = 20;
const vehicle_fix_cost = 0;
const order_service_time = 300;
const optimization_duration = 30;
const start_of_day = dayjs().startOf('day');
const end_of_day = dayjs().startOf('day').add(3, 'days');

const previous_route_color = '#4268f9';
const optimized_route_color = '#00CC66';

/**
 * The orders
 * @type {Array}
 */
const orders = [];

/**
 * The optimized routes
 * @type {RouteStructure[]}
 */
let optimizedRoutes = [];

/**
 * Object to display the routes on the map
 * @type {object}
 */
const routeDisplay = {
  // The current route
  current: {
    routes: [], // The polylines of the routes
    decorator: null, // The decorator with the arrows
    layer: null, // The layer group containing routes + decorator
  },
  // The previous route
  previous: {
    routes: [], // The polylines of the routes
    layer: null, // The layer group
  },
};

/**
 * Get the vehicle count per depot
 * @returns {number} - The vehicle count count per depot
 */
function getVehicleCount() {
  return Number.parseInt($('#vehicle-count').val());
}

/**
 * Get the insertion mode
 * @returns {string} - The insertion mode
 */
function getInsertionMode() {
  return $('#insertion-mode').val();
}

/**
 * Get the insertion order
 * @returns {string} - The insertion order
 */
function getInsertionOrder() {
  return $('#insertion-order').val();
}

/**
 * Get the optimization stop
 * @returns {boolean} - The optimization stop
 */
function getOptimizationStop() {
  return $('#optimization-stop').is(':checked');
}

/**
 * Disable all the inputs, buttons and selects
 * @param {string} currentState - The current state
 */
function onOptimizing(currentState) {
  $('input').prop('disabled', true);
  $('button').prop('disabled', true);
  $('select').prop('disabled', true);
  map.removeEventListener('click', handleMapClick);

  const currentText = $('#start-optimization').text();
  const dotCount = (currentText.match(/\./g) || []).length;
  const dots = '.'.repeat((dotCount % 3) + 1);
  const spaces = '\u00A0'.repeat(3 - dots.length);
  $('#start-optimization').text(currentState + dots + spaces);
}

/**
 * Enable all the inputs, buttons and selects
 */
function onOptimized() {
  $('input').prop('disabled', false);
  $('button').prop('disabled', false);
  $('select').prop('disabled', false);
  map.addEventListener('click', handleMapClick);
  $('#start-optimization').text('Start Optimization');
}

/**
 * Handle the click event on the map
 * @param {LeafletMouseEvent} e - The event
 */
function handleMapClick(e) {
  if (orders.length >= 20) {
    alert('Error: You cannot add more than 20 locations');
    return;
  }
  getAddress(e.latlng.lat, e.latlng.lng, (address) => {
    orders.push({
      index: (orders.length + 1).toString(),
      latitude: e.latlng.lat,
      longitude: e.latlng.lng,
      address: address,
      color: getColorFromIndex(orders.length),
      isDepot: orders.length === 0,
      vehicleId: undefined,
      depotId: undefined,
      used: false,
    });
    updateMarkers();
    updateList();
  });
}

/**
 * Sort the orders by vehicleId, arrival time or original order
 * @param {object} orderA - The first order
 * @param {object} orderB - The second order
 * @returns {number} - The sorted order
 */
function sortOrders(orderA, orderB) {
  // The depots are always placed at the beginning
  if (orderA.isDepot) return -1;
  if (orderB.isDepot) return 1;

  // Sort by vehicleId if available
  if (orderA.vehicleId !== orderB.vehicleId) {
    if (orderA.vehicleId === undefined) return 1;
    if (orderB.vehicleId === undefined) return -1;
    return orderA.vehicleId - orderB.vehicleId;
  }

  // Sort by arrival time if available
  if (orderA.arrival && orderB.arrival) {
    return orderA.arrival.diff(orderB.arrival);
  }

  // Keep the original order if no arrival time
  return 0;
}

/**
 * Update the orders list
 */
function updateList() {
  $('#order-list').empty();

  const ordersList = orders.sort(sortOrders);

  for (const order of ordersList) {
    addOrderToList(order);
  }

  // Update the insertion order select if necessary
  if (['before', 'after'].includes(getInsertionMode())) {
    updateInsertionOrderSelect();
  }
}

/**
 * Add an order to the orders list
 * @param {object} order - The order to add
 */
function addOrderToList(order) {
  const ordersList = $('#order-list');
  const orderItem = $(`<div class="order-item container container-row ${order.used ? 'used' : ''}"></div>`);

  const leftColumn = $('<div class="container container-column grow-0"></div>');
  const middleColumn = $('<div class="container container-column grow-1"></div>');
  const rightColumn = $('<div class="container container-column grow-0"></div>');
  const lockColumn = $('<div class="container container-column grow-0"></div>');

  const markerIcon = `<div><span class="marker-icon" style="background-color: ${order.color};">${order.index}</span></div>`;
  const addressInfo = `<div>${order.address}</div>`;
  const deliveryInfo = `
    <div>
      ${order.arrival !== undefined ? `<span> Arrival: ${order.arrival.format('HH:mm')}</span>` : ''}
      ${order.vehicleId !== undefined ? `<span> Vehicle: ${order.vehicleId}</span>` : ''}
    </div>
  `;

  const depotLabel = 'Depot';

  leftColumn.append(markerIcon);
  middleColumn.append(addressInfo);
  if (!order.isDepot) {
    middleColumn.append(deliveryInfo);
  } else {
    rightColumn.append(depotLabel);
  }

  orderItem.append(leftColumn, middleColumn, rightColumn, lockColumn);
  ordersList.append(orderItem);
}

/**
 * Update the markers on the map
 */
function updateMarkers() {
  removeAllMarkers();
  for (const order of orders) {
    const svg = createMarkerSVG(order.color, '#ffffff', order.index);
    const divIcon = createDivIcon(svg);
    L.marker([order.latitude, order.longitude], { icon: divIcon }).addTo(map);
  }
}

/**
 * Remove all the markers from the map
 */
function removeAllMarkers() {
  map.eachLayer((layer) => {
    if (layer instanceof L.Marker) {
      map.removeLayer(layer);
    }
  });
}

/**
 * Get the address of a location
 * @param {number} latitude - The latitude of the location
 * @param {number} longitude - The longitude of the location
 * @param {function} action - The function to call with the address
 */
function getAddress(latitude, longitude, action) {
  // Define the parameters needed for the REST query.
  fetch(`https://api.myptv.com/geocoding/v1/locations/by-position/${latitude}/${longitude}`,
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'apiKey': api_key
      },
    }
  )
    .then((response) =>
      response.json().then((result) => {
        if (result.locations) {
          action(result.locations[0].formattedAddress);
        } else if (result.description) {
          alert(`Error: ${result.description}`);
        } else {
          alert('Error: No address found');
        }
      })
    )
    .catch((ex) => {
      console.error(ex);
      alert(ex.message);
    });
}

/**
 * Create an order vehicle combination
 * @param {object} order - The order
 * @returns {object}
 */
function createOrderVehicleCombination(order) {
  return {
    type: 'ORDER_REQUIRES_VEHICLE',
    orderCategory: order.index,
    vehicleCategory: order.vehicleId.toString(),
  };
}

/**
 * Create a delivery
 * @param {object} order - The order
 * @returns {object}
 */
function createDelivery(order) {
  return {
    id: order.index,
    delivery: {
      locationId: order.index,
      duration: order_service_time,
      categories: [order.index, !order.vehicleId ? 'new' : 'optimized']
    },
    properties: {
      categories: [order.index],
    },
  };
}

/**
 * Create a vehicle
 * @param {object} order - The order depot
 * @param {number} currentIndex - The index of the vehicle for the current depot
 * @returns {object} - The vehicle, with an id composed of the order depot index and the vehicle index for the current depot
 */
function createVehicle(order, currentIndex) {
  return {
    id: currentIndex.toString(),
    costs: {
      perHour: vehicle_cost_per_hour,
      perKilometer: vehicle_cost_per_kilometer,
      fixed: vehicle_fix_cost,
    },
    start: {
      locationId: order.index,
      earliestStartTime: start_of_day.toISOString(),
    },
    end: {
      locationId: order.index,
      latestEndTime: end_of_day.toISOString()
    },
    routing: {
      profile: 'EUR_CAR',
    },
    categories: [currentIndex.toString()],
  };
}

/**
 * Create a depot
 * @param {object} order - The order depot
 * @returns {object}
 */
function createDepot(order) {
  return {
    id: order.index,
    locationId: order.index,
  };
}

/**
 * Create a location
 * @param {object} order - The order
 * @returns {object}
 */
function createLocation(order) {
  return {
    id: order.index,
    latitude: order.latitude,
    longitude: order.longitude,
  };
}

/**
 * Create the settings
 * @returns {object} - The settings
 */
function createSettings() {
  return {
    duration: optimization_duration,
  };
}

/**
 * Maps optimized Route to input RouteStructure
 * @param {Route} optimizedRoute - Optimized route from API result.
 * @returns {RouteStructure} Mapped RouteStructure ready for re-optimization.
 */
function mapOptimizedRouteToStructure(optimizedRoute) {
  const routeStructure = {
    vehicleId: optimizedRoute.vehicleId,
    start: optimizedRoute.start.departure,
    tasks: [],
    breaks: [],
  };

  for (const stop of optimizedRoute.stops) {
    for (const appointment of stop.appointments) {
      for (const task of appointment.tasks) {
        routeStructure.tasks.push({
          orderId: task.orderId,
          type: task.type,
          depotId: task.depotId,
        });
      }
      for (const pause of appointment.breaks) {
        routeStructure.breaks.push({
          start: pause.start,
          duration: pause.duration,
        });
      }
    }
  }

  return routeStructure;
}

/**
 * Create the respected sequence
 * @param {object} optimizedRoute - The optimized route
 * @returns {object} - The respected sequence
 */
function createRespectedSequence(optimizedRoute) {
  const respectedSequence = {
    taskCategories: [],
  };

  for (const stop of optimizedRoute.stops) {
    for (const appointment of stop.appointments) {
      for (const task of appointment.tasks) {
        if (task.depotId === undefined) {
          respectedSequence.taskCategories.push(task.orderId);
        }
      }
    }
  }

  // If we are inserting directly before or after an order, we need to add the new orders to the respected sequence
  const insertionMode = getInsertionMode();
  const insertionOrder = getInsertionOrder();

  if (insertionMode === 'direct-before') {
    const index = respectedSequence.taskCategories.indexOf(insertionOrder);
    if (index !== -1) {
      respectedSequence.taskCategories.splice(index, 0, 'new');
    }
  } else if (insertionMode === 'direct-after') {
    const index = respectedSequence.taskCategories.indexOf(insertionOrder);
    if (index !== -1) {
      respectedSequence.taskCategories.splice(index + 1, 0, 'new');
    }
  }

  return respectedSequence;
}

/**
 * Create a forbidden sequence if we are inserting before or after an order
 * @returns {object} - The forbidden sequence
 */
function createForbiddenSequences() {
  const insertionMode = getInsertionMode();
  const insertionOrder = getInsertionOrder();

  if (insertionMode === 'before') {
    return {
      firstTaskCategory: insertionOrder,
      type: 'NOT_BEFORE',
      secondTaskCategory: 'new',
    };
  }
  if (insertionMode === 'after') {
    return {
      firstTaskCategory: 'new',
      type: 'NOT_BEFORE',
      secondTaskCategory: insertionOrder,
    };
  }

  return undefined;
}

/**
 * Update the insertion order select
 */
function updateInsertionOrderSelect() {
  const orderSelect = $('#insertion-order');
  orderSelect.empty();

  const ordersList = orders.sort(sortOrders);
  for (const order of ordersList) {
    if (!order.isDepot && order.used) {
      orderSelect.append(`<option value="${order.index}">Order ${order.index}</option>`);
    }
  }
}

/**
 * Create the request body
 * @returns {object} - The request body
 */
function createRequestBody() {
  const locations = [];
  const deliveries = [];
  const vehicles = [];
  const depots = [];
  const settings = createSettings();
  const orderVehicle = [];
  const respectedSequences = [];
  const forbiddenSequences = [];
  const routes = [];

  for (const order of orders) {
    // Create the location
    locations.push(createLocation(order));

    if (order.isDepot) {
      // Create the depot
      depots.push(createDepot(order));

      // Create the vehicles
      for (let currentIndex = 1; currentIndex <= getVehicleCount(); currentIndex++) {
        vehicles.push(createVehicle(order, currentIndex));
      }
    } else {
      // Create the delivery
      deliveries.push(createDelivery(order));
    }

    if (order.vehicleId !== undefined && order.depotId !== undefined) {
      // Create the order vehicle combination
      orderVehicle.push(createOrderVehicleCombination(order))
    }
  }

  if (optimizedRoutes.length > 0) {
    for (const route of optimizedRoutes) {
      routes.push(mapOptimizedRouteToStructure(route));
      respectedSequences.push(createRespectedSequence(route));
    }
    const forbiddenSequence = createForbiddenSequences();
    if (forbiddenSequence !== undefined) {
      forbiddenSequences.push(forbiddenSequence);
    }
  }

  const requestBody = {
    locations,
    orders: {
      deliveries,
    },
    vehicles,
    depots,
    settings,
    constraints: {
      combinations: {
        orderVehicle,
      },
      tasks: {
        respectedSequences,
        forbiddenSequences,
      },
    },
    routes,
  };

  return requestBody;
}

/**
 * Start the optimization
 */
function startOptimization() {
  if (orders.filter((order) => order.isDepot).length === 0) {
    alert('Error: No depot found');
    return;
  }

  const requestBody = createRequestBody();

  fetch("https://api.myptv.com/routeoptimization/optiflow/v1/optimizations",
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apiKey': api_key,
      },
      body: JSON.stringify(requestBody),
    }
  )
    .then((response) => response.json()
      .then((result) => {
        if (result.id) {
          fetchResult(result.id);
        } else {
          alert('Error: No optimization ID found');
        }
      })
    )
    .catch((ex) => {
      console.error(ex);
      alert(ex.message);
    });
}


/**
 * Periodically fetch the result of the optimization
 * @param {string} optimizationId - The ID of the optimization
 */
function fetchResult(optimizationId) {
  fetch(`https://api.myptv.com/routeoptimization/optiflow/v1/optimizations/${optimizationId}`, 
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'apiKey': api_key,
      },
    }
  )
    .then((response) => response.json()
      .then((result) => {
        if (['FAILED', 'SUCCEEDED'].includes(result.status)) {
          onOptimized();
          showResult(result);
        } else {
          const isFullyScheduled = result.metrics?.numberOfUnscheduledOrders === 0;
          if (getOptimizationStop() && isFullyScheduled) {
            stopOptimization(optimizationId);
          }
          onOptimizing(result.status);
          setTimeout(() => fetchResult(optimizationId), 1000);
        }
      }))
    .catch((ex) => {
      console.error(ex);
      alert(ex.message);
    });
}

/**
 * Stop the optimization
 * @param {string} optimizationId - The ID of the optimization
 */
function stopOptimization(optimizationId) {
  fetch(`https://api.myptv.com/routeoptimization/optiflow/v1/optimizations/${optimizationId}/stop`, 
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apiKey': api_key,
      },
    }
  );
}

/**
 * Convert an order index to coordinates
 * @param {string} orderIndex - The index of the order
 * @returns {array} - The coordinates of the order
 */
function orderIndexToCoordinates(orderIndex) {
  const order = orders.find(o => o.index === orderIndex);
  return [order.latitude, order.longitude];
}

/**
 * Extract the polyline of a route
 * @param {object} route - The route
 * @returns {L.Polyline} - The polyline of the route
 */
function extractRoutePolyline(route) {
  const routeCoordinates = [];
  routeCoordinates.push(orderIndexToCoordinates(route.start.locationId));

  for (const stop of route.stops) {
    for (const appointment of stop.appointments) {
      for (const task of appointment.tasks) {
        if (task.depotId === undefined) {
          routeCoordinates.push(orderIndexToCoordinates(task.orderId));
        }
      }
    }
  }

  routeCoordinates.push(orderIndexToCoordinates(route.end.locationId));

  const polyline = L.polyline(routeCoordinates, {
    color: routeDisplay.current.layer ? optimized_route_color : previous_route_color,
    weight: 6,
    opacity: 1,
  });

  return polyline;
}

/**
 * Update the orders constraints
 * @param {object} route - The route
 */
function updateOrdersConstraints(route) {
  for (const stop of route.stops) {
    for (const appointment of stop.appointments) {
      for (const task of appointment.tasks) {
        if (task.depotId === undefined) {
          const order = orders.find((o) => o.index === task.orderId);
          order.arrival = dayjs(stop.arrival);
          order.vehicleId = Number(route.vehicleId);
          order.depotId = Number(route.start.locationId);
          order.used = true;
        } else {
          const depot = orders.find((o) => o.index === task.depotId);
          depot.used = true;
        }
      }
    }
  }
}

/**
 * Show the result of the optimization
 * @param {object} result - The result of the optimization
 */
function showResult(result) {
  if (result.routes) {
    optimizedRoutes = result.routes;
    const routesPolylines = [];
    for (const route of optimizedRoutes) {
      routesPolylines.push(extractRoutePolyline(route));
      updateOrdersConstraints(route);
    }
    displayPolyline(routesPolylines);
    updateList();
  }
}

/**
 * Move the current route to the previous route
 */
function moveCurrentRouteToPrevious() {
  if (routeDisplay.previous.layer) {
    map.removeLayer(routeDisplay.previous.layer);
  }

  routeDisplay.previous.routes = routeDisplay.current.routes.map((route) =>
    L.polyline(route.getLatLngs(), {
      color: previous_route_color,
      weight: 6,
      opacity: 0.75,
      dashArray: '5, 10',
    })
  );
  routeDisplay.previous.layer = L.layerGroup(routeDisplay.previous.routes).addTo(map);
}

/**
 * Display the optimized routes on the map
 * @param {array} polylines - The polylines of the optimized routes
 */
function displayPolyline(polylines) {
  if (routeDisplay.current.layer) {
    moveCurrentRouteToPrevious();
    map.removeLayer(routeDisplay.current.layer);
  }

  routeDisplay.current.routes = polylines;
  routeDisplay.current.decorator = L.polylineDecorator(polylines, {
    patterns: [
      {
        repeat: 10,
        symbol: L.Symbol.arrowHead({ pixelSize: 6, polygon: false, pathOptions: { color: '#fff7', weight: 3 } }),
      },
    ],
  });

  routeDisplay.current.layer = L.layerGroup([
    ...routeDisplay.current.routes,
    routeDisplay.current.decorator,
  ]).addTo(map);
}

/**
 * Initialize the map
 */
function initMap() {
  const coordinate = L.latLng(49, 8.4);

  map = new L.Map('map', {
    center: coordinate,
    zoom: 13,
    zoomControl: false,
  });

  L.control.zoom({ position: 'bottomright' }).addTo(map);

  new L.tileLayer(
    "https://api.myptv.com/rastermaps/v1/image-tiles/{z}/{x}/{y}?size={tileSize}",
    {
      attribution: `© ${new Date().getFullYear()}, PTV Logistics, HERE`,
      tileSize: 256,
      trackResize: false,
    },
    [
      {
        header: 'apiKey',
        value: api_key,
      },
    ]
  ).addTo(map);

  map.on('click', handleMapClick);
}

/**
 * Initialize the events
 */
function initEvents() {
  $('#start-optimization').click(startOptimization);

  $('#insertion-mode').on('change', function() {
    if (['before', 'after', 'direct-before', 'direct-after'].includes($(this).val())) {
      $('#order-selector').show();
      updateInsertionOrderSelect();
    } else {
      $('#order-selector').hide();
    }
  });
}

/**
 * Wait for the document to be ready
 */
$(document).ready(() => {
  initMap();
  initEvents();
});
