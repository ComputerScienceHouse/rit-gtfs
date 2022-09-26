const GtfsRealtimeBindings = require('gtfs-realtime-bindings')
const conversions = require('./conversions')

function createVehiclePos (busData) {
  var position = new GtfsRealtimeBindings.transit_realtime.Position({
    latitude: busData.position[0],
    longitude: busData.position[1],
    bearing: busData.heading,
    speed: conversions.mphToMetersPerSec(busData.speed)
  })

  var vehicleDesc = createVehicleDescriptor(busData.id)

  const trip = new GtfsRealtimeBindings.transit_realtime.TripDescriptor({
    trip_id: busData.gtfs_trip_id,
  });

  var vehiclePos = new GtfsRealtimeBindings.transit_realtime.VehiclePosition({
    trip,
    position: position,
    timestamp: conversions.timestampToUnix(busData.last_updated_on),
    vehicle: vehicleDesc,
    trip: createTripDescriptor(null, busData.route_id)
  })

  return vehiclePos
}

function createVehicleDescriptor (id) {
  return new GtfsRealtimeBindings.transit_realtime.VehicleDescriptor({
    id: String(id)
  })
}

function createFeedHeader (timestamp) {
  if (!timestamp) {
    console.log('WARNING: No timestamp provided while creating feed header. Using the current time instead')
  }

  var feedHeader = new GtfsRealtimeBindings.transit_realtime.FeedHeader({
    gtfsRealtimeVersion: '2.0',
    incrementality: 0,
    timestamp: conversions.timestampToUnix(timestamp || new Date().toUTCString())
  })

  return feedHeader
}

function createStopTimeUpdate (stopId, arrivalEstimate) {
  return new GtfsRealtimeBindings.transit_realtime.TripUpdate.StopTimeUpdate({
    stopId: stopId,
    arrival: arrivalEstimate
  })
}

function createStopTimeEvent (timestamp) {
  var unixTime = conversions.timestampToUnix(timestamp)
  return new GtfsRealtimeBindings.transit_realtime.TripUpdate.StopTimeEvent({
    time: unixTime
  })
}

function createStopTimeUpdates (arrivalEstimates) {
  var updates = []

  arrivalEstimates.forEach(est => {
    var unixTime = createStopTimeEvent(est.arrival_at)
    updates.push(createStopTimeUpdate(est.stop_id, unixTime))
  })

  return updates
}

function createTripDescriptor (tripId, routeId) {
  return new GtfsRealtimeBindings.transit_realtime.TripDescriptor({
    tripId: String(tripId),
    routeId: String(routeId)
  })
}

function createTripUpdate (busData) {
  var stopTimeUpdates = createStopTimeUpdates(busData.arrival_estimates)

  var tripUpdate = new GtfsRealtimeBindings.transit_realtime.TripUpdate({
    vehicle: createVehicleDescriptor(busData.vehicle_id),
    timestamp: conversions.timestampToUnix(busData.last_updated_on),
    stopTimeUpdate: stopTimeUpdates,
    trip: createTripDescriptor(null, busData.route_id)
  })

  return tripUpdate
}

module.exports = { createVehicleDescriptor, createTripUpdate, createTripDescriptor, createStopTimeUpdates, createStopTimeUpdate, createStopTimeEvent, createVehiclePos, createFeedHeader }
