const get = require("lodash/get");
const unirest = require("unirest");
const constants = require("./constants");
const gtfsUtils = require("./gtfsBindingsBuilders");
const GtfsRealtimeBindings = require("gtfs-realtime-bindings");
const {Request} = require("node-fetch");

function buildRequest(path, agencyId, options = {}) {
  const url = new URL(`${constants.translocBaseEndpoint}${path}`);
  url.searchParams.append("agencies", agencyId);
  return new Request(url, options);
}

function getVehicleArray(translocResponse, agencyId) {
  return translocResponse.body?.vehicles || {};
}

function createTranslocCall(agencyId, transocAPIKey) {
  const apiCall = unirest("GET", constants.translocVehicleEndpoint);

  apiCall.query({
    agencies: agencyId,
  });

  return apiCall;
}

function getTripUpdateFeedMessage(translocRes, agencyId) {
  let agencyData = [];

  if (translocRes.error) {
    console.log("Error retrieving data from API:\n" + translocRes.error);
  } else {
    agencyData = getVehicleArray(translocRes, agencyId);
  }

  const feedMessage = new GtfsRealtimeBindings.transit_realtime.FeedMessage();
  feedMessage.header = gtfsUtils.createFeedHeader(
    get(translocRes, "body.generated_on")
  );

  agencyData.forEach((vehicle) => {
    const tripUpdate = gtfsUtils.createTripUpdate(vehicle);

    const feedEntity = new GtfsRealtimeBindings.transit_realtime.FeedEntity({
      id: String(vehicle.id),
      tripUpdate,
    });
    feedMessage.entity.push(feedEntity);
  });

  return feedMessage;
}

function getVehiclePositionFeedMessage(translocRes, agencyId) {
  let agencyData = [];

  if (translocRes.error) {
    console.log("Error retrieving data from API:\n" + translocRes.error);
  } else {
    agencyData = getVehicleArray(translocRes, agencyId);
  }

  const feedMessage = new GtfsRealtimeBindings.transit_realtime.FeedMessage();
  feedMessage.header = gtfsUtils.createFeedHeader(
    get(translocRes, "body.generated_on")
  );

  agencyData.forEach((vehicle) => {
    const vehiclePos = gtfsUtils.createVehiclePos(vehicle);

    const feedEntity = new GtfsRealtimeBindings.transit_realtime.FeedEntity({
      vehicle: vehiclePos,
      id: String(vehicle.id),
    });
    feedMessage.entity.push(feedEntity);
  });

  return feedMessage;
}

module.exports = {
  getVehicleArray,
  createTranslocCall,
  getTripUpdateFeedMessage,
  getVehiclePositionFeedMessage,
  buildRequest,
};
