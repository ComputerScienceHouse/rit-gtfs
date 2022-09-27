const GtfsRealtimeBindings = require('gtfs-realtime-bindings')
const express = require('express')
const serverless = require('serverless-http')
const Sentry = require('@sentry/node')
const Tracing = require("@sentry/tracing");
const constants = require('../utilities/constants')
const webCallUtils = require('../utilities/webCallUtils')
const scheduleRouter = require('./scheduleRouter')
const app = express()

let VERSION = 'unknown';
try {
  VERSION = fs.readFileSync('/commit.txt', 'utf8').trim();
} catch(err) {}

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  integrations: [
    // enable HTTP calls tracing
    new Sentry.Integrations.Http({ tracing: true }),
    // enable Express.js middleware tracing
    new Tracing.Integrations.Express({ app }),
  ],

  // Set tracesSampleRate to 1.0 to capture 100%
  // of transactions for performance monitoring.
  // We recommend adjusting this value in production
  tracesSampleRate: 1.0,
});

// RequestHandler creates a separate execution context using domains, so that every
// transaction/span/breadcrumb is attached to its own Hub instance
app.use(Sentry.Handlers.requestHandler({
  user: false,
  ip: true,
  request: ['cookies', 'data', 'headers', 'method', 'query_string', 'url', 'context'],
  environment: process.env.NODE_ENV || 'development',
  release: 'rit-gtfs@' + VERSION,
}));
// TracingHandler creates a trace for every incoming request
app.use(Sentry.Handlers.tracingHandler());

const router = express.Router()

app.use((req, res, next) => {
  if (typeof req.context == 'undefined') {
    req.context = {};
  }
  next();
})

router.get('/tripupdates/:agencyId(\\d+)', (req, res, next) => {
  var agencyId = req.params.agencyId
  if (!agencyId) {
    throw new Error('Agency ID must be defined')
  }

  const translocCall = webCallUtils.createTranslocCall(agencyId, constants.defaultTranslocAPIKey)

  translocCall.end(function (translocRes) {
    const feedMessage = webCallUtils.getTripUpdateFeedMessage(translocRes, agencyId)

    var encodedMessage = GtfsRealtimeBindings.transit_realtime.FeedMessage.encode(feedMessage).finish()
    res.set({ 'Content-Type': 'application/x-protobuf' })
    res.end(encodedMessage)
    console.log('Sent Trip Updates of size ' + encodedMessage.length + ' for agency ' + agencyId + ' at ' + new Date().toISOString())
  })
})

router.get('/vehiclepositions/:agencyId(\\d+)', (req, res, next) => {
  var agencyId = req.params.agencyId
  if (!agencyId) {
    throw new Error('Agency ID must be defined')
  }

  const translocCall = webCallUtils.createTranslocCall(agencyId, constants.defaultTranslocAPIKey)

  translocCall.end(function (translocRes) {
    const feedMessage = webCallUtils.getVehiclePositionFeedMessage(translocRes, agencyId)

    var encodedMessage = GtfsRealtimeBindings.transit_realtime.FeedMessage.encode(feedMessage).finish()
    res.set({ 'Content-Type': 'application/x-protobuf' })
    res.end(encodedMessage)
    console.log('Sent Vehicle Positions of size ' + encodedMessage.length + ' for agency ' + agencyId + ' at ' + new Date().toISOString())
  })
})

router.use('/schedule/:agencyId(\\d+)', (req, res, next) => {
  var agencyId = req.params.agencyId
  req.context.agencyId = agencyId
  if (!agencyId) {
    throw new Error('Agency ID must be defined')
  }
  next();
}, scheduleRouter);

app.use('/.netlify/functions/server', router)

// ErrorHandler creates a middleware function that logs errors to Sentry
app.use(Sentry.Handlers.errorHandler());

module.exports = app
// We are defining the binary response types here to prevent the aws lambda from treating the response as a string
// Otherwise it may truncate the response
module.exports.handler = serverless(app, { binary: ['application/json', 'application/x-protobuf', 'application/octet-buffer'] })
