const { REGIONS } = require('./regions');
const places = require('./places.json');

module.exports = {
  REGIONS,
  PROVINCES: places.PROVINCES,
  MUNICIPALITIES: places.MUNICIPALITIES
};
