const get = require('lodash/get')
const unirest = require('unirest')
const constants = require('./constants')
const gtfsUtils = require('./gtfsBindingsBuilders')
const GtfsRealtimeBindings = require('gtfs-realtime-bindings')
const {Request} = require('node-fetch')

function buildRequest(path, agencyId, options={}) {
  const url = new URL(`${constants.translocBaseEndpoint}${path}`);
  url.searchParams.append('agencies', agencyId);
  return new Request(url, options);
}

function getVehicleArray (translocResponse, agencyId) {
  return translocResponse.body?.vehicles || {};
}

function createTranslocCall (agencyId, transocAPIKey) {
  var apiCall = unirest('GET', constants.translocVehicleEndpoint)

  apiCall.query({
    agencies: agencyId
  })

  return apiCall
}

function getTripUpdateFeedMessage (translocRes, agencyId) {
  var agencyData = []

  if (translocRes.error) {
    console.log('Error retrieving data from API:\n' + translocRes.error)
  } else {
    agencyData = getVehicleArray(translocRes, agencyId)
  }

  var feedMessage = new GtfsRealtimeBindings.transit_realtime.FeedMessage()
  feedMessage.header = gtfsUtils.createFeedHeader(get(translocRes, 'body.generated_on'))

  agencyData.forEach((vehicle) => {
    var tripUpdate = gtfsUtils.createTripUpdate(vehicle)

    var feedEntity = new GtfsRealtimeBindings.transit_realtime.FeedEntity({
      id: String(vehicle.id),
      tripUpdate: tripUpdate
    })
    feedMessage.entity.push(feedEntity)
  })

  return feedMessage
}

function getVehiclePositionFeedMessage (translocRes, agencyId) {
  var agencyData = []

  if (translocRes.error) {
    console.log('Error retrieving data from API:\n' + translocRes.error)
  } else {
    agencyData = getVehicleArray(translocRes, agencyId)
  }

  var feedMessage = new GtfsRealtimeBindings.transit_realtime.FeedMessage()
  feedMessage.header = gtfsUtils.createFeedHeader(get(translocRes, 'body.generated_on'))

  agencyData.forEach((vehicle) => {
    var vehiclePos = gtfsUtils.createVehiclePos(vehicle)

    var feedEntity = new GtfsRealtimeBindings.transit_realtime.FeedEntity({
      vehicle: vehiclePos,
      id: String(vehicle.id)
    })
    feedMessage.entity.push(feedEntity)
  })

  return feedMessage
}

module.exports = {
  getVehicleArray,
  createTranslocCall,
  getTripUpdateFeedMessage,
  getVehiclePositionFeedMessage,
  buildRequest
}
