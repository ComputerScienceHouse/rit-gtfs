const translocBaseEndpoint = "https://feeds.transloc.com/3";
const translocVehicleEndpoint = `${translocBaseEndpoint}/vehicle_statuses?include_arrivals=true`;

module.exports = {
  translocVehicleEndpoint,
  translocBaseEndpoint,
};
