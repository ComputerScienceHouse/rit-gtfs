const express = require("express");
const fetch = require("node-fetch");
const constants = require("../utilities/constants");
const csv = require("../utilities/csv");
const cheerio = require("cheerio");
const {buildRequest} = require("../utilities/webCallUtils");
const router = express.Router();

router.get("/agency.txt", async (req, res) => {
  const {agencies} = await fetch(
    buildRequest("/agencies", req.context.agencyId)
  ).then((response) => response.json());
  res.send(
    csv.serialize(
      ["agency_id", "agency_name", "agency_url", "agency_timezone"],
      agencies.map((agency) => ({
        agency_id: agency.id,
        agency_name: agency.long_name,
        agency_url: agency.url,
        agency_timezone: agency.timezone,
      })),
      res
    )
  );
});

const ROUTE_TYPES = {
  bus: 3,
};

router.get("/routes.txt", async (req, res) => {
  const {routes} = await fetch(
    buildRequest("/routes", req.context.agencyId)
  ).then((response) => response.json());
  res.send(
    csv.serialize(
      [
        "route_id",
        "agency_id",
        "route_short_name",
        "route_long_name",
        "route_type",
        "route_color",
        "route_text_color",
      ],
      routes.map((route) => ({
        route_id: route.id,
        agency_id: route.agency_id,
        route_short_name: route.short_name,
        route_long_name: route.long_name,
        route_type: ROUTE_TYPES[route.type],
        route_color: route.color,
        route_text_color: route.text_color,
      })),
      res
    )
  );
});

router.get("/stops.txt", async (req, res) => {
  const {stops} = await fetch(
    buildRequest("/stops", req.context.agencyId)
  ).then((response) => response.json());
  res.send(
    csv.serialize(
      ["stop_id", "stop_name", "stop_code", "stop_lat", "stop_lon"],
      stops.map((stop) => ({
        stop_id: stop.id,
        stop_name: stop.name,
        stop_code: stop.code,
        stop_lat: stop.position[0],
        stop_lon: stop.position[1],
      }))
    )
  );
});

function serializeDate() {
  const date = new Date();
  return `${date.getFullYear()}${(date.getMonth() + 1)
    .toString()
    .padStart(2, "0")}${date.getDate().toString().padStart(2, "0")}`;
}

function generateDates() {
  const fall = {
    start: new Date(new Date().getFullYear(), 8, 1),
    end: new Date(new Date().getFullYear(), 11, 14),
  };
  const spring = {
    start: new Date(new Date().getFullYear(), 0, 14),
    end: new Date(new Date().getFullYear(), 4, 14),
  };
  return {fall, spring};
}

router.get("/calendar.txt", async (req, res) => {
  const {fall, spring} = generateDates();
  res.send(
    csv.serialize(
      [
        "service_id",
        "monday",
        "tuesday",
        "wednesday",
        "thursday",
        "friday",
        "saturday",
        "sunday",
        "start_date",
        "end_date",
      ],
      [
        {
          service_id: `weekday-${new Date().getFullYear()}-fall`,
          monday: 1,
          tuesday: 1,
          wednesday: 1,
          thursday: 1,
          friday: 1,
          saturday: 0,
          sunday: 0,
          start_date: serializeDate(fall.start),
          end_date: serializeDate(fall.end),
        },
        {
          service_id: `weekend-${new Date().getFullYear()}-fall`,
          monday: 0,
          tuesday: 0,
          wednesday: 0,
          thursday: 0,
          friday: 0,
          saturday: 1,
          sunday: 1,
          start_date: serializeDate(fall.start),
          end_date: serializeDate(fall.end),
        },
        {
          service_id: `weekday-${new Date().getFullYear()}-spring`,
          monday: 1,
          tuesday: 1,
          wednesday: 1,
          thursday: 1,
          friday: 1,
          saturday: 0,
          sunday: 0,
          start_date: serializeDate(spring.start),
          end_date: serializeDate(spring.end),
        },
        {
          service_id: `weekend-${new Date().getFullYear()}-spring`,
          monday: 0,
          tuesday: 0,
          wednesday: 0,
          thursday: 0,
          friday: 0,
          saturday: 1,
          sunday: 1,
          start_date: serializeDate(spring.start),
          end_date: serializeDate(spring.end),
        },
      ]
    )
  );
});

const SCHEDULE_OVERRIDES = {
  "11-Campus Shuttle": "https://www.rit.edu/parking/11-campus-shuttle",
  "12-Retail Weekend": "https://www.rit.edu/parking/12-weekend-retail-shuttle",
};

router.get("/trips.txt", async (req, res) => {
  const {fall, spring} = generateDates();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const {routes} = await fetch(
    buildRequest("/routes", req.context.agencyId)
  ).then((res) => res.json());
  const season = fall.start >= today ? "fall" : "spring";
  res.send(
    csv.serialize(
      ["route_id", "service_id", "trip_id"],
      await Promise.all(
        routes.map(async (route) => {
          // UGHHHHHH
          if (!route.url) {
            route.url = SCHEDULE_OVERRIDES[route.long_name];
          }
          if (!route.url) return null;
          const contents = await fetch(route.url).then((res) => res.text());
          const routeType = contents.includes("This route runs weekends.")
            ? "weekend"
            : "weekday";
          return {
            route_id: route.id,
            service_id: `${routeType}-${new Date().getFullYear()}-${season}`,
            trip_id: route.id,
          };
        })
      ).then((trips) => trips.filter((trip) => trip !== null))
    )
  );
});

const STOP_NAMES = {
  "F Lot": "F Lot Loop",
  "Walmart West": "Wal-Mart West",
  "Walmart East": "Wal-Mart East",
  "Perkins Rd.": "Perkins Road",
  NTID: "LBJ",
  "175 Jefferson": "175 Jefferson (Radisson)",
  "Perkins Rd.": "Perkins Road",
  "UC West": "UC West Inbound",
  "Tech Park Dr": "Tech Park I/B",
  "Marketplace Mall": "Market Place Mall",
  "Perkins Rd": "Perkins Road",
};

function parseDayTime(time, ctx) {
  const [_, hourLocal, minute, ampm] = /^(\d+):(\d+) *([ap]m)$/i.exec(time);
  let hour = parseInt(hourLocal);
  if (ampm.toLowerCase() === "pm" && hour != 12) {
    hour += 12;
  }
  if (ampm.toLowerCase() === "am" && hour === 12) {
    hour = 0;
  }

  // Time will always march forward
  if (ctx.lastTime) {
    if (hour < ctx.lastTime.hour) {
      hour += 24;
    }
  }
  ctx.lastTime = {hour, minute};

  return {
    text: `${hour.toString().padStart(2, "0")}:${minute
      .toString()
      .padStart(2, "0")}:00`,
    totalMinutes: hour * 60 + parseInt(minute),
  };
}

router.get("/stop_times.txt", async (req, res) => {
  const {fall, spring} = generateDates();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const {routes} = await fetch(
    buildRequest("/routes", req.context.agencyId)
  ).then((res) => res.json());
  const {stops} = await fetch(
    buildRequest("/stops", req.context.agencyId)
  ).then((res) => res.json());

  const stopMap = {};
  for (const stop of stops) {
    stopMap[stop.name] = stop;
  }

  res.send(
    csv.serialize(
      [
        "trip_id",
        "arrival_time",
        "departure_time",
        "stop_id",
        "stop_sequence",
        "timepoint",
      ],
      await Promise.all(
        routes.map(async (route) => {
          // UGHHHHHH
          if (!route.url) {
            route.url = SCHEDULE_OVERRIDES[route.long_name];
          }
          if (!route.url) return null;
          const contents = await fetch(route.url).then((res) => res.text());
          const $ = cheerio.load(contents);
          const thead = $("tr", "table thead").first()[0];
          const tbody = $("tbody", "table").first()[0];
          const stops = thead.children
            .filter(
              (node) =>
                node.type == "tag" &&
                node.name == "th" &&
                node.attribs.scope == "col"
            )
            .map((node) => $.text([node]).trim())
            .map((stopName) => STOP_NAMES[stopName] || stopName)
            .map((stopName) => stopMap[stopName]);
          const ctx = {};
          const rows = tbody.children
            .filter(
              (node) =>
                node.type == "tag" &&
                node.name == "tr" &&
                node.attribs.class?.trim() != "blue-bus"
            )
            .map((node) => {
              return node.children
                .filter(
                  (node) =>
                    node.type == "tag" &&
                    node.name == "td" &&
                    node.attribs.scope != "row"
                )
                .map((node) => $.text([node]).trim())
                .map((time) =>
                  time
                    .split("/")
                    .map((time) => time.trim())
                    .filter((time) => time != "." && time != "")
                    .map((time) => parseDayTime(time, ctx))
                    .sort((a, b) => a.totalMinutes - b.totalMinutes)
                    .map((time) => time.text)
                );
            });
          const routeType = contents.includes("This route runs weekends.")
            ? "weekend"
            : "weekday";
          let timeIndex = 0;
          return rows.flatMap((row) => {
            return row.flatMap((times, index) =>
              times.map((time) => ({
                trip_id: route.id,
                arrival_time: time,
                departure_time: time,
                stop_id: stops[index].id,
                stop_sequence: timeIndex++,
                timepoint: 1,
              }))
            );
          });
        })
      ).then((trips) => trips.flat().filter((trip) => trip !== null))
    )
  );
});

module.exports = router;
